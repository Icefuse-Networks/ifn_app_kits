/**
 * Cron: Monthly Stats Reset
 *
 * POST /api/cron/monthly-stats-reset
 *
 * Truncates rust_player_stats_monthly on the 1st of every month.
 * Called by an external scheduler (systemd timer, Docker cron, etc.)
 *
 * Auth: Hardcoded secret in x-cron-secret header.
 * Safety: Refuses to run if today is NOT the 1st of the month (UTC).
 */

import { NextRequest, NextResponse } from 'next/server'
import { clickhouse } from '@/lib/clickhouse'
import { logger } from '@/lib/logger'
import { TIMEFRAME_TABLE } from '@/lib/validations/stats'
import { secureTokenCompare } from '@/lib/security/timing-safe'

const CRON_SECRET = 'ifn_cron_monthly_stats_9f4a7b2e1d8c3f60'

export async function POST(request: NextRequest) {
  // SECURITY: Timing-safe comparison of cron secret
  const secret = request.headers.get('x-cron-secret')

  if (!secret || !secureTokenCompare(secret, CRON_SECRET)) {
    return NextResponse.json(
      { success: false, error: { code: 'AUTH_ERROR', message: 'Invalid cron secret' } },
      { status: 401 }
    )
  }

  // Safety: Only allow execution on the 1st of the month (UTC)
  const now = new Date()
  const dayOfMonth = now.getUTCDate()

  if (dayOfMonth !== 1) {
    logger.stats.warn(`Monthly reset rejected: today is day ${dayOfMonth}, not the 1st`)
    return NextResponse.json(
      { success: false, error: { code: 'NOT_ALLOWED', message: `Monthly reset only runs on the 1st. Today is day ${dayOfMonth}.` } },
      { status: 400 }
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

    logger.stats.info('Monthly stats reset via cron', {
      rows_deleted: rowCount,
      utc_date: now.toISOString(),
    })

    return NextResponse.json({
      success: true,
      data: { rows_deleted: rowCount },
    })
  } catch (error) {
    logger.stats.error('Cron monthly stats reset failed', error as Error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to reset monthly stats' } },
      { status: 500 }
    )
  }
}
