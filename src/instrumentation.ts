/**
 * Next.js Instrumentation — Server Startup Tasks
 *
 * Runs once when the server starts. Used for scheduled tasks
 * that need to run on a timer (e.g., monthly stats reset).
 */

export async function register() {
  // Only run scheduled tasks on the Node.js server runtime (not edge)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startMonthlyResetScheduler } = await import('@/lib/scheduled/monthly-stats-reset')
    startMonthlyResetScheduler()
  }
}
