/**
 * Heat Map Analytics API
 *
 * GET /api/v1/analytics/heat-map - Get time-of-day usage patterns
 *
 * Auth: Token (analytics:read) OR Session (admin)
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAnalyticsRead } from '@/services/api-auth'
import { heatMapQuerySchema } from '@/lib/validations/analytics'
import { logger } from '@/lib/logger'

/**
 * GET /api/v1/analytics/heat-map
 *
 * Get a 24x7 grid of kit usage by hour and day of week.
 * Returns data optimized for heat map visualization.
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
    const parsed = heatMapQuerySchema.safeParse({
      days: searchParams.get('days'),
      kitConfigId: searchParams.get('kitConfigId'),
      serverId: searchParams.get('serverId'),
    })

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { days, kitConfigId, serverId } = parsed.data

    // Calculate date range
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    // Build where clause
    const where: Record<string, unknown> = {
      redeemedAt: { gte: startDate },
    }

    if (kitConfigId) {
      where.kitConfigId = kitConfigId
    }

    if (serverId) {
      where.gameServerId = serverId
    }

    // PERF: Use groupBy for aggregation
    const heatMapData = await prisma.kitUsageEvent.groupBy({
      by: ['hourOfDay', 'dayOfWeek'],
      where,
      _count: {
        id: true,
      },
    })

    // Initialize 24x7 grid with zeros
    const grid: number[][] = Array.from({ length: 7 }, () =>
      Array.from({ length: 24 }, () => 0)
    )

    let maxValue = 0

    // Populate grid with data
    for (const row of heatMapData) {
      const count = row._count.id
      grid[row.dayOfWeek][row.hourOfDay] = count
      if (count > maxValue) {
        maxValue = count
      }
    }

    // Calculate totals
    const totalRedemptions = heatMapData.reduce(
      (sum, row) => sum + row._count.id,
      0
    )

    // Find peak hour
    let peakHour = 0
    let peakDay = 0
    let peakCount = 0
    for (let day = 0; day < 7; day++) {
      for (let hour = 0; hour < 24; hour++) {
        if (grid[day][hour] > peakCount) {
          peakCount = grid[day][hour]
          peakHour = hour
          peakDay = day
        }
      }
    }

    const dayNames = [
      'Sunday',
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
    ]

    return NextResponse.json({
      data: grid,
      maxValue,
      totalRedemptions,
      peak: {
        dayOfWeek: peakDay,
        dayName: dayNames[peakDay],
        hourOfDay: peakHour,
        count: peakCount,
      },
      period: {
        days,
        startDate: startDate.toISOString(),
        endDate: new Date().toISOString(),
      },
    })
  } catch (error) {
    logger.analytics.error('Failed to fetch heat map data', error as Error)
    return NextResponse.json(
      { error: 'Failed to fetch heat map data' },
      { status: 500 }
    )
  }
}
