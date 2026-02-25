/**
 * Stats Event Ingestion API
 *
 * POST /api/stats/events?server={server_id}
 * Receives batched player stat events from Oxide/Carbon game server plugins.
 * Aggregates by player, merges with existing ClickHouse data, inserts into all 3 timeframe tables.
 *
 * Uses modular STAT_COLUMNS config — adding a new stat requires zero changes here.
 */

import { NextRequest, NextResponse } from 'next/server'
import { authenticateWithScope } from '@/services/api-auth'
import { clickhouse } from '@/lib/clickhouse'
import { logger } from '@/lib/logger'
import {
  statEventSchema,
  statsBatchSchema,
  statsServerParamSchema,
  EVENT_TO_COLUMN,
  EVENT_COLUMNS,
  AGGREGATABLE_COLUMNS,
  TIMEFRAME_TABLE,
  createEmptyDelta,
  computePoints,
} from '@/lib/validations/stats'

// =============================================================================
// Types
// =============================================================================

interface PlayerDelta {
  stats: Record<string, number>
  weapon_kills: Record<string, number>
  name: string
  clan: string
}

// =============================================================================
// Helpers
// =============================================================================

function normalizeEventKeys(event: Record<string, unknown>): Record<string, unknown> {
  const normalized: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(event)) {
    const camelKey = key.charAt(0).toLowerCase() + key.slice(1)
    normalized[camelKey] = value
  }
  return normalized
}

async function fetchExistingRows(
  table: string,
  serverId: string,
  steamIds: string[]
): Promise<Map<string, Record<string, unknown>>> {
  const result = new Map<string, Record<string, unknown>>()
  if (steamIds.length === 0) return result

  const placeholders = steamIds.map((_, i) => `{sid${i}:String}`).join(', ')
  const params: Record<string, string> = { server_id: serverId }
  for (let i = 0; i < steamIds.length; i++) {
    params[`sid${i}`] = steamIds[i]
  }

  try {
    const queryResult = await clickhouse.query({
      query: `SELECT * FROM ${table} FINAL WHERE server_id = {server_id:String} AND steamid IN (${placeholders})`,
      query_params: params,
      format: 'JSONEachRow',
    })
    const rows = await queryResult.json<Record<string, unknown>>()
    for (const row of rows) {
      if (row.steamid) result.set(row.steamid as string, row)
    }
  } catch (error) {
    logger.stats.error(`Failed to fetch existing data from ${table}`, error as Error)
  }

  return result
}

// =============================================================================
// POST Handler
// =============================================================================

export async function POST(request: NextRequest) {
  const authResult = await authenticateWithScope(request, 'stats:write')
  if (!authResult.success) {
    return NextResponse.json(
      { success: false, error: { code: 'AUTH_ERROR', message: authResult.error } },
      { status: authResult.status }
    )
  }

  try {
    const serverParam = statsServerParamSchema.safeParse({
      server: request.nextUrl.searchParams.get('server'),
    })
    if (!serverParam.success) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing or invalid server parameter', details: serverParam.error.flatten() } },
        { status: 400 }
      )
    }
    const serverId = serverParam.data.server

    const body = await request.json()
    const rawEvents = Array.isArray(body) ? body : body.events
    const batchParsed = statsBatchSchema.safeParse({ events: rawEvents })
    if (!batchParsed.success) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid event batch', details: batchParsed.error.flatten() } },
        { status: 400 }
      )
    }

    const validEvents: Array<ReturnType<typeof statEventSchema.parse>> = []
    for (const rawEvent of batchParsed.data.events) {
      const normalized = normalizeEventKeys(rawEvent as Record<string, unknown>)
      const parsed = statEventSchema.safeParse(normalized)
      if (parsed.success) {
        validEvents.push(parsed.data)
      }
    }

    if (validEvents.length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'No valid events in batch' } },
        { status: 400 }
      )
    }

    // Aggregate events by steamid into deltas — config-driven
    const deltas = new Map<string, PlayerDelta>()

    for (const event of validEvents) {
      let delta = deltas.get(event.steamid)
      if (!delta) {
        delta = { stats: createEmptyDelta(), weapon_kills: {}, name: 'Unknown', clan: '' }
        deltas.set(event.steamid, delta)
      }

      if (event.name && event.name !== 'Unknown') delta.name = event.name
      if (event.clan) delta.clan = event.clan

      // Map event → column using config
      const column = EVENT_TO_COLUMN[event._event]
      if (column && column in delta.stats) {
        delta.stats[column] += event.amount
      }

      if (event._event === 'kill' && event.weapon) {
        delta.weapon_kills[event.weapon] = (delta.weapon_kills[event.weapon] || 0) + event.amount
      }
    }

    const steamIds = Array.from(deltas.keys())
    const tables = Object.values(TIMEFRAME_TABLE)

    const existingByTable = await Promise.all(
      tables.map(table => fetchExistingRows(table, serverId, steamIds))
    )

    const now = new Date().toISOString().replace('T', ' ').slice(0, 19)
    const insertsByTable: Record<string, unknown>[][] = tables.map(() => [])

    for (const [steamid, delta] of deltas) {
      for (let t = 0; t < tables.length; t++) {
        const existing = existingByTable[t].get(steamid)

        // Merge all aggregatable columns from config
        const merged: Record<string, number> = {}
        for (const col of AGGREGATABLE_COLUMNS) {
          merged[col.column] = (Number(existing?.[col.column]) || 0) + (delta.stats[col.column] || 0)
        }

        // Compute KDR
        const kills = merged.kills || 0
        const deaths = merged.deaths || 0
        const kdr = deaths === 0 ? kills : Math.round((kills / deaths) * 100) / 100

        // Compute points from config
        const points = computePoints(merged)

        // Merge weapon kills JSON
        let mergedWeaponKills: Record<string, number> = {}
        try {
          mergedWeaponKills = JSON.parse((existing?.weapon_kills as string) || '{}')
        } catch (err) {
          logger.admin.warn('Failed to parse weapon_kills JSON from ClickHouse — resetting to empty', err)
        }
        for (const [weapon, count] of Object.entries(delta.weapon_kills)) {
          mergedWeaponKills[weapon] = (mergedWeaponKills[weapon] || 0) + count
        }

        // Build row from config columns
        const row: Record<string, unknown> = {
          server_id: serverId,
          steamid,
          name: delta.name || (existing?.name as string) || 'Unknown',
          avatar: (existing?.avatar as string) || '',
          clan: delta.clan || (existing?.clan as string) || '',
          kdr,
          points,
          weapon_kills: JSON.stringify(mergedWeaponKills),
          updated_at: now,
        }

        // Add all aggregatable columns
        for (const col of AGGREGATABLE_COLUMNS) {
          if (col.column === 'points') continue // already set above
          row[col.column] = merged[col.column]
        }

        // Include non-aggregatable event columns at their existing value
        for (const col of EVENT_COLUMNS) {
          if (!(col.column in row)) {
            row[col.column] = merged[col.column] ?? (Number(existing?.[col.column]) || 0)
          }
        }

        insertsByTable[t].push(row)
      }
    }

    await Promise.all(
      tables.map((table, i) => {
        if (insertsByTable[i].length === 0) return Promise.resolve()
        return clickhouse.insert({
          table,
          values: insertsByTable[i],
          format: 'JSONEachRow',
        })
      })
    )

    logger.stats.info('Events ingested', {
      server: serverId,
      events: validEvents.length,
      players: steamIds.length,
      actor: authResult.context.actorId,
    })

    return NextResponse.json({
      success: true,
      data: {
        processed: validEvents.length,
        players: steamIds.length,
      },
    })
  } catch (error) {
    logger.stats.error('Failed to process stats events', error as Error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to process stats events' } },
      { status: 500 }
    )
  }
}
