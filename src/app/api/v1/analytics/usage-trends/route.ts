/**
 * Usage Trends Analytics API
 *
 * GET /api/v1/analytics/usage-trends - Get time-series usage data
 *
 * Auth: Token (analytics:read) OR Session (admin)
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAnalyticsRead } from '@/services/api-auth'
import { usageTrendsQuerySchema } from '@/lib/validations/analytics'
import { logger } from '@/lib/logger'

/**
 * GET /api/v1/analytics/usage-trends
 *
 * Get time-series data for kit usage trends.
 * Supports daily, weekly, or monthly granularity.
 */
export async function GET(request: NextRequest) {
  // SECURITY: Auth check with analytics:read scope
  const authResult = await requireAnalyticsRead(request)

  if (!authResult.success) {
    return NextResponse.json(
      { error: authResult.error },
      { status: authResult.status }
    )
  }

  try {
    const { searchParams } = new URL(request.url)

    // SECURITY: Zod validated
    const parsed = usageTrendsQuerySchema.safeParse({
      days: searchParams.get('days'),
      granularity: searchParams.get('granularity'),
      kitName: searchParams.get('kitName'),
      kitConfigId: searchParams.get('kitConfigId'),
      serverId: searchParams.get('serverId'),
      wipeId: searchParams.get('wipeId'),
    })

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { days, granularity, kitName, kitConfigId, serverId, wipeId } = parsed.data

    // Calculate date range
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    // Build where clause
    const where: Record<string, unknown> = {
      redeemedAt: { gte: startDate, lte: endDate },
    }

    if (kitName) {
      where.kitName = kitName
    }

    if (kitConfigId) {
      where.kitConfigId = kitConfigId
    }

    if (serverId) {
      where.gameServerId = serverId
    }

    if (wipeId) {
      where.wipeId = wipeId
    }

    // Get all events in range
    const events = await prisma.kitUsageEvent.findMany({
      where,
      select: {
        redeemedAt: true,
        wasSuccessful: true,
      },
      orderBy: { redeemedAt: 'asc' },
    })

    // Group by time bucket
    const buckets = new Map<string, { total: number; successful: number; failed: number }>()

    for (const event of events) {
      const date = event.redeemedAt
      let bucketKey: string

      switch (granularity) {
        case 'weekly': {
          // Get start of week (Sunday)
          const weekStart = new Date(date)
          weekStart.setDate(date.getDate() - date.getDay())
          bucketKey = weekStart.toISOString().split('T')[0]
          break
        }
        case 'monthly': {
          bucketKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
          break
        }
        default: // daily
          bucketKey = date.toISOString().split('T')[0]
      }

      const bucket = buckets.get(bucketKey) || { total: 0, successful: 0, failed: 0 }
      bucket.total++
      if (event.wasSuccessful) {
        bucket.successful++
      } else {
        bucket.failed++
      }
      buckets.set(bucketKey, bucket)
    }

    // Convert to array sorted by date
    const trendData = Array.from(buckets.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, counts]) => ({
        date,
        ...counts,
      }))

    // Calculate summary stats
    const summary = {
      totalRedemptions: events.length,
      successfulRedemptions: events.filter((e) => e.wasSuccessful).length,
      failedRedemptions: events.filter((e) => !e.wasSuccessful).length,
      averagePerDay: events.length / days,
    }

    return NextResponse.json({
      data: trendData,
      summary,
      period: {
        days,
        granularity,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      },
    })
  } catch (error) {
    logger.analytics.error('Failed to fetch usage trends', error as Error)
    return NextResponse.json(
      { error: 'Failed to fetch usage trends' },
      { status: 500 }
    )
  }
}
