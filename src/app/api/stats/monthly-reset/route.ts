/**
 * Monthly Stats Reset
 *
 * POST /api/stats/monthly-reset
 * Truncates the rust_player_stats_monthly table.
 * Intended to run on the 1st of every month via cron/scheduler.
 *
 * Auth: requires stats:write scope (API token or admin session).
 * Only touches the monthly table — wipe and overall are NEVER affected.
 */

import { NextRequest, NextResponse } from 'next/server'
import { authenticateWithScope } from '@/services/api-auth'
import { clickhouse } from '@/lib/clickhouse'
import { logger } from '@/lib/logger'
import { TIMEFRAME_TABLE } from '@/lib/validations/stats'

export async function POST(request: NextRequest) {
  const authResult = await authenticateWithScope(request, 'stats:write')
  if (!authResult.success) {
    return NextResponse.json(
      { success: false, error: { code: 'AUTH_ERROR', message: authResult.error } },
      { status: authResult.status }
    )
  }

  try {
    const table = TIMEFRAME_TABLE.monthly

    // Count rows before truncate for logging
    const countResult = await clickhouse.query({
      query: `SELECT count() as cnt FROM ${table}`,
      format: 'JSONEachRow',
    })
    const countRows = await countResult.json<{ cnt: string }>()
    const rowCount = Number(countRows[0]?.cnt || 0)

    await clickhouse.command({
      query: `TRUNCATE TABLE ${table}`,
    })

    logger.stats.info('Monthly stats reset', {
      rows_deleted: rowCount,
      actor: authResult.context.actorId,
    })

    return NextResponse.json({
      success: true,
      data: { rows_deleted: rowCount },
    })
  } catch (error) {
    logger.stats.error('Failed to reset monthly stats', error as Error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to reset monthly stats' } },
      { status: 500 }
    )
  }
}
