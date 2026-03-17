/**
 * Monthly Stats Reset Scheduler
 *
 * Checks every hour if it's the 1st of the month.
 * If so, and if a reset hasn't already happened this month, truncates
 * the rust_player_stats_monthly table.
 *
 * Uses a ClickHouse-persisted flag to prevent duplicate resets across
 * server restarts. This is the ONLY code path that resets monthly stats.
 */

import { clickhouse } from '@/lib/clickhouse'
import { TIMEFRAME_TABLE } from '@/lib/validations/stats'

const CHECK_INTERVAL_MS = 60 * 60 * 1000 // 1 hour
let schedulerStarted = false

/**
 * Get the current month key (e.g. "2026-03")
 */
function getCurrentMonthKey(): string {
  const now = new Date()
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`
}

/**
 * Check if monthly reset already ran this month.
 * We store a marker row in a tiny ClickHouse table.
 */
async function hasResetThisMonth(): Promise<boolean> {
  try {
    // Ensure the marker table exists
    await clickhouse.command({
      query: `
        CREATE TABLE IF NOT EXISTS _stats_monthly_reset_log (
          month_key String,
          reset_at DateTime DEFAULT now()
        )
        ENGINE = ReplacingMergeTree(reset_at)
        ORDER BY month_key
        SETTINGS index_granularity = 8192
      `,
    })

    const result = await clickhouse.query({
      query: `SELECT count() as cnt FROM _stats_monthly_reset_log FINAL WHERE month_key = {month_key:String}`,
      query_params: { month_key: getCurrentMonthKey() },
      format: 'JSONEachRow',
    })
    const rows = await result.json<{ cnt: string }>()
    return Number(rows[0]?.cnt || 0) > 0
  } catch {
    // If we can't check, assume not reset (will retry next hour)
    return false
  }
}

/**
 * Mark this month as reset
 */
async function markResetComplete(): Promise<void> {
  await clickhouse.insert({
    table: '_stats_monthly_reset_log',
    values: [{ month_key: getCurrentMonthKey() }],
    format: 'JSONEachRow',
  })
}

/**
 * Perform the monthly reset: TRUNCATE monthly table
 */
async function performMonthlyReset(): Promise<void> {
  const table = TIMEFRAME_TABLE.monthly

  const countResult = await clickhouse.query({
    query: `SELECT count() as cnt FROM ${table}`,
    format: 'JSONEachRow',
  })
  const countRows = await countResult.json<{ cnt: string }>()
  const rowCount = Number(countRows[0]?.cnt || 0)

  await clickhouse.command({
    query: `TRUNCATE TABLE ${table}`,
  })

  await markResetComplete()

  console.log(
    `[STATS] Monthly reset complete: truncated ${table}, ${rowCount} rows removed, month=${getCurrentMonthKey()}`
  )
}

/**
 * Check if it's time to reset and do it
 */
async function checkAndReset(): Promise<void> {
  try {
    const now = new Date()
    // Only run on the 1st of the month (UTC)
    if (now.getUTCDate() !== 1) return

    const alreadyReset = await hasResetThisMonth()
    if (alreadyReset) return

    console.log('[STATS] 1st of month detected, performing monthly stats reset...')
    await performMonthlyReset()
  } catch (error) {
    console.error('[STATS] Monthly reset check failed:', error)
  }
}

/**
 * Start the scheduler. Called once from instrumentation.ts.
 */
export function startMonthlyResetScheduler(): void {
  if (schedulerStarted) return
  schedulerStarted = true

  console.log('[STATS] Monthly reset scheduler started (checking every hour)')

  // Check immediately on startup
  checkAndReset()

  // Then check every hour
  setInterval(checkAndReset, CHECK_INTERVAL_MS)
}
