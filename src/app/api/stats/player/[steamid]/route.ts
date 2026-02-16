/**
 * Individual Player Stats API
 *
 * GET /api/stats/player/[steamid] - Returns stats for a single player across all timeframes
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
  normalizeStatRow,
} from '@/lib/validations/stats'

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

    // If server_id provided, return single timeframe. Otherwise return all 3.
    if (server_id) {
      const table = TIMEFRAME_TABLE[timeframe]
      const row = await fetchPlayerRow(table, server_id, steamid)
      return NextResponse.json({
        success: true,
        data: row ? normalizeStatRow(row) : null,
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
    })
  } catch (error) {
    logger.stats.error('Failed to fetch player stats', error as Error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch player stats' } },
      { status: 500 }
    )
  }
}

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
