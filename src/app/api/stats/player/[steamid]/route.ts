/**
 * Individual Player Stats API
 *
 * GET    /api/stats/player/[steamid] - Returns stats for a single player
 * PATCH  /api/stats/player/[steamid] - Edit a player's stats (admin)
 * DELETE /api/stats/player/[steamid] - Shadow ban a player (hide from leaderboards)
 * PUT    /api/stats/player/[steamid] - Unshadow ban a player
 *
 * Uses modular STAT_COLUMNS config — adding a new stat requires zero changes here.
 */

import { NextRequest, NextResponse } from 'next/server'
import { authenticateWithScope } from '@/services/api-auth'
import { clickhouse } from '@/lib/clickhouse'
import { logger } from '@/lib/logger'
import {
  steamIdParamSchema,
  playerStatsQuerySchema,
  TIMEFRAME_TABLE,
  AGGREGATABLE_COLUMNS,
  normalizeStatRow,
  computePoints,
} from '@/lib/validations/stats'
import { z } from 'zod'

// =============================================================================
// GET - Fetch player stats
// =============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ steamid: string }> }
) {
  const authResult = await authenticateWithScope(request, 'stats:read')
  if (!authResult.success) {
    return NextResponse.json(
      { success: false, error: { code: 'AUTH_ERROR', message: authResult.error } },
      { status: authResult.status }
    )
  }

  try {
    const { steamid } = await params
    const steamIdResult = steamIdParamSchema.safeParse(steamid)
    if (!steamIdResult.success) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid Steam ID' } },
        { status: 400 }
      )
    }

    const { searchParams } = request.nextUrl
    const query = playerStatsQuerySchema.safeParse({
      server_id: searchParams.get('server_id'),
      timeframe: searchParams.get('timeframe'),
    })
    if (!query.success) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid query parameters', details: query.error.flatten() } },
        { status: 400 }
      )
    }

    const { server_id, timeframe } = query.data

    // Check shadow ban status
    const banResult = await clickhouse.query({
      query: `SELECT count() as cnt FROM stats_shadow_bans WHERE steamid = {steamid:String}`,
      query_params: { steamid },
      format: 'JSONEachRow',
    })
    const banRows = await banResult.json<{ cnt: string }>()
    const isShadowBanned = Number(banRows[0]?.cnt || 0) > 0

    // If server_id provided, return single timeframe. Otherwise return all 3.
    if (server_id) {
      const table = TIMEFRAME_TABLE[timeframe]
      const row = await fetchPlayerRow(table, server_id, steamid)
      return NextResponse.json({
        success: true,
        data: row ? normalizeStatRow(row) : null,
        shadowBanned: isShadowBanned,
      })
    }

    // Return all timeframes for all servers
    const results: Record<string, Record<string, unknown>[] | null> = {}
    for (const [tf, table] of Object.entries(TIMEFRAME_TABLE)) {
      const rows = await fetchPlayerRows(table, steamid)
      results[tf] = rows.length > 0
        ? rows.map(normalizeStatRow)
        : null
    }

    return NextResponse.json({
      success: true,
      data: results,
      shadowBanned: isShadowBanned,
    })
  } catch (error) {
    logger.stats.error('Failed to fetch player stats', error as Error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch player stats' } },
      { status: 500 }
    )
  }
}

// =============================================================================
// PATCH - Edit player stats
// =============================================================================

const editStatsSchema = z.object({
  server_id: z.string().min(1).max(60),
  timeframe: z.enum(['wipe', 'monthly', 'overall']),
  stats: z.record(z.string(), z.number().min(0).max(999999999)),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ steamid: string }> }
) {
  const authResult = await authenticateWithScope(request, 'stats:write')
  if (!authResult.success) {
    return NextResponse.json(
      { success: false, error: { code: 'AUTH_ERROR', message: authResult.error } },
      { status: authResult.status }
    )
  }

  try {
    const { steamid } = await params
    const steamIdResult = steamIdParamSchema.safeParse(steamid)
    if (!steamIdResult.success) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid Steam ID' } },
        { status: 400 }
      )
    }

    const body = await request.json()
    const parsed = editStatsSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid edit parameters', details: parsed.error.flatten() } },
        { status: 400 }
      )
    }

    const { server_id, timeframe, stats } = parsed.data
    const table = TIMEFRAME_TABLE[timeframe]

    // Whitelist: only allow editing aggregatable columns
    const allowedColumns = new Set(AGGREGATABLE_COLUMNS.map(c => c.column))
    for (const key of Object.keys(stats)) {
      if (!allowedColumns.has(key)) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: `Cannot edit column: ${key}` } },
          { status: 400 }
        )
      }
    }

    // Fetch existing row
    const existing = await fetchPlayerRow(table, server_id, steamid)
    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Player not found' } },
        { status: 404 }
      )
    }

    // Build merged row
    const merged: Record<string, number> = {}
    for (const col of AGGREGATABLE_COLUMNS) {
      merged[col.column] = stats[col.column] ?? Number(existing[col.column]) ?? 0
    }

    // Recompute KDR and points
    const kills = merged.kills || 0
    const deaths = merged.deaths || 0
    const kdr = deaths === 0 ? kills : Math.round((kills / deaths) * 100) / 100
    const points = computePoints(merged)

    const now = new Date().toISOString().replace('T', ' ').slice(0, 19)

    const row: Record<string, unknown> = {
      server_id,
      steamid,
      name: existing.name || '',
      avatar: existing.avatar || '',
      clan: existing.clan || '',
      kdr,
      points,
      weapon_kills: existing.weapon_kills || '{}',
      updated_at: now,
    }

    for (const col of AGGREGATABLE_COLUMNS) {
      if (col.column === 'points') continue
      row[col.column] = merged[col.column]
    }

    await clickhouse.insert({
      table,
      values: [row],
      format: 'JSONEachRow',
    })

    logger.stats.info('Player stats edited', {
      steamid,
      server_id,
      timeframe,
      changes: stats,
      actor: authResult.context.actorId,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.stats.error('Failed to edit player stats', error as Error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to edit stats' } },
      { status: 500 }
    )
  }
}

// =============================================================================
// DELETE - Shadow ban a player
// =============================================================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ steamid: string }> }
) {
  const authResult = await authenticateWithScope(request, 'stats:write')
  if (!authResult.success) {
    return NextResponse.json(
      { success: false, error: { code: 'AUTH_ERROR', message: authResult.error } },
      { status: authResult.status }
    )
  }

  try {
    const { steamid } = await params
    const steamIdResult = steamIdParamSchema.safeParse(steamid)
    if (!steamIdResult.success) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid Steam ID' } },
        { status: 400 }
      )
    }

    await clickhouse.insert({
      table: 'stats_shadow_bans',
      values: [{ steamid, banned_at: new Date().toISOString().replace('T', ' ').slice(0, 19) }],
      format: 'JSONEachRow',
    })

    logger.stats.info('Player shadow banned', {
      steamid,
      actor: authResult.context.actorId,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.stats.error('Failed to shadow ban player', error as Error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to shadow ban' } },
      { status: 500 }
    )
  }
}

// =============================================================================
// PUT - Remove shadow ban
// =============================================================================

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ steamid: string }> }
) {
  const authResult = await authenticateWithScope(request, 'stats:write')
  if (!authResult.success) {
    return NextResponse.json(
      { success: false, error: { code: 'AUTH_ERROR', message: authResult.error } },
      { status: authResult.status }
    )
  }

  try {
    const { steamid } = await params
    const steamIdResult = steamIdParamSchema.safeParse(steamid)
    if (!steamIdResult.success) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid Steam ID' } },
        { status: 400 }
      )
    }

    await clickhouse.command({
      query: `ALTER TABLE stats_shadow_bans DELETE WHERE steamid = {steamid:String}`,
      query_params: { steamid },
    })

    logger.stats.info('Player shadow ban removed', {
      steamid,
      actor: authResult.context.actorId,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.stats.error('Failed to remove shadow ban', error as Error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to remove shadow ban' } },
      { status: 500 }
    )
  }
}

// =============================================================================
// Helpers
// =============================================================================

async function fetchPlayerRow(
  table: string,
  serverId: string,
  steamid: string
): Promise<Record<string, unknown> | null> {
  const result = await clickhouse.query({
    query: `SELECT * FROM ${table} FINAL WHERE server_id = {server_id:String} AND steamid = {steamid:String} LIMIT 1`,
    query_params: { server_id: serverId, steamid },
    format: 'JSONEachRow',
  })
  const rows = await result.json<Record<string, unknown>>()
  return rows[0] || null
}

async function fetchPlayerRows(
  table: string,
  steamid: string
): Promise<Record<string, unknown>[]> {
  const result = await clickhouse.query({
    query: `SELECT * FROM ${table} FINAL WHERE steamid = {steamid:String}`,
    query_params: { steamid },
    format: 'JSONEachRow',
  })
  return result.json<Record<string, unknown>>()
}
