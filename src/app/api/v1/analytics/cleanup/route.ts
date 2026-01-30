/**
 * Analytics Cleanup API
 *
 * POST /api/v1/analytics/cleanup - Delete old analytics events
 *
 * Auth: Session only (admin) - sensitive operation
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireSession } from '@/services/api-auth'
import { config } from '@/config'
import { logger } from '@/lib/logger'

/**
 * POST /api/v1/analytics/cleanup
 *
 * Delete KitUsageEvent records older than retention period.
 * Global stats (KitGlobalStats) are preserved.
 *
 * Admin session required - no token auth allowed.
 */
export async function POST(request: NextRequest) {
  // SECURITY: Session-only auth for sensitive cleanup operation
  const authResult = await requireSession(request)

  if (!authResult.success) {
    return NextResponse.json(
      { error: authResult.error },
      { status: authResult.status }
    )
  }

  try {
    // Calculate cutoff date
    const retentionDays = config.analytics.retentionDays
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays)

    // Count events to be deleted
    const countToDelete = await prisma.kitUsageEvent.count({
      where: {
        redeemedAt: { lt: cutoffDate },
      },
    })

    if (countToDelete === 0) {
      return NextResponse.json({
        success: true,
        deleted: 0,
        message: 'No events older than retention period',
        retentionDays,
        cutoffDate: cutoffDate.toISOString(),
      })
    }

    // Delete old events in batches to avoid timeout
    const batchSize = 1000
    let totalDeleted = 0

    while (totalDeleted < countToDelete) {
      const deleted = await prisma.kitUsageEvent.deleteMany({
        where: {
          redeemedAt: { lt: cutoffDate },
        },
      })

      totalDeleted += deleted.count

      if (deleted.count < batchSize) {
        break
      }
    }

    // Also clean up daily stats older than retention
    const dailyDeleted = await prisma.kitUsageDailyStats.deleteMany({
      where: {
        date: { lt: cutoffDate },
      },
    })

    logger.analytics.info('Analytics cleanup completed', {
      eventsDeleted: totalDeleted,
      dailyStatsDeleted: dailyDeleted.count,
      retentionDays,
      cutoffDate: cutoffDate.toISOString(),
      actor: authResult.context.actorId,
    })

    return NextResponse.json({
      success: true,
      deleted: {
        events: totalDeleted,
        dailyStats: dailyDeleted.count,
      },
      retentionDays,
      cutoffDate: cutoffDate.toISOString(),
    })
  } catch (error) {
    logger.analytics.error('Failed to cleanup analytics', error as Error)
    return NextResponse.json(
      { error: 'Failed to cleanup analytics' },
      { status: 500 }
    )
  }
}
