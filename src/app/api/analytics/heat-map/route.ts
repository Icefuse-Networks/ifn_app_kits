/**
 * Heat Map API
 *
 * GET /api/analytics/heat-map - Get usage heat map by hour/day
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { authenticateWithScope } from '@/services/api-auth'
import { logger } from '@/lib/logger'

const querySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
})

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/**
 * GET /api/analytics/heat-map
 * Returns usage heat map data (7 days x 24 hours)
 */
export async function GET(request: NextRequest) {
  const authResult = await authenticateWithScope(request, 'analytics:read')

  if (!authResult.success) {
    return NextResponse.json(
      { success: false, error: { code: 'AUTH_ERROR', message: authResult.error } },
      { status: authResult.status }
    )
  }

  try {
    const { searchParams } = new URL(request.url)

    // SECURITY: Zod validated
    const parsed = querySchema.safeParse({
      days: searchParams.get('days'),
    })

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid parameters' } },
        { status: 400 }
      )
    }

    const { days } = parsed.data
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    // Get all events in the date range
    const events = await prisma.kitUsageEvent.findMany({
      where: {
        redeemedAt: { gte: startDate },
        wasSuccessful: true,
      },
      select: {
        redeemedAt: true,
      },
    })

    // Initialize 7x24 grid (days x hours)
    const heatData: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0))
    let maxValue = 0
    let peakDay = 0
    let peakHour = 0
    let peakCount = 0

    // Count events by day/hour
    for (const event of events) {
      const dayOfWeek = event.redeemedAt.getDay()
      const hour = event.redeemedAt.getHours()
      heatData[dayOfWeek][hour]++

      if (heatData[dayOfWeek][hour] > maxValue) {
        maxValue = heatData[dayOfWeek][hour]
      }

      if (heatData[dayOfWeek][hour] > peakCount) {
        peakCount = heatData[dayOfWeek][hour]
        peakDay = dayOfWeek
        peakHour = hour
      }
    }

    return NextResponse.json({
      success: true,
      data: heatData,
      maxValue,
      peak: {
        dayOfWeek: peakDay,
        dayName: DAY_NAMES[peakDay],
        hourOfDay: peakHour,
        count: peakCount,
      },
    })
  } catch (error) {
    logger.admin.error('Failed to fetch heat map data', error as Error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch heat map data' } },
      { status: 500 }
    )
  }
}
