/**
 * Wipe Peak Hours Analytics API
 *
 * GET /api/v1/analytics/wipe-peak-hours - Get peak activity hours for a wipe
 *
 * Auth: Token (analytics:read) OR Session (admin)
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAnalyticsRead } from '@/services/api-auth'
import { wipePeakHoursQuerySchema } from '@/lib/validations/analytics'
import { logger } from '@/lib/logger'

/**
 * GET /api/v1/analytics/wipe-peak-hours
 *
 * Get peak activity hours for a specific wipe.
 * Shows hourly breakdown of player activity.
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
    const parsed = wipePeakHoursQuerySchema.safeParse({
      wipeId: searchParams.get('wipeId'),
      serverId: searchParams.get('serverId'),
    })

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { wipeId, serverId } = parsed.data

    // Get target wipe
    const targetWipe = wipeId
      ? await prisma.serverWipe.findUnique({ where: { id: wipeId } })
      : await prisma.serverWipe.findFirst({
          where: serverId ? { gameServerId: serverId } : undefined,
          orderBy: { wipedAt: 'desc' },
        })

    if (!targetWipe) {
      return NextResponse.json(
        { error: 'No wipe found' },
        { status: 404 }
      )
    }

    // Get hourly breakdown
    const hourlyData = await prisma.kitUsageEvent.groupBy({
      by: ['hourOfDay'],
      where: { wipeId: targetWipe.id },
      _count: { id: true },
      orderBy: { hourOfDay: 'asc' },
    })

    // Initialize 24-hour array
    const hourlyBreakdown = Array.from({ length: 24 }, (_, hour) => ({
      hour,
      count: 0,
      percentage: '0',
    }))

    // Fill in data
    const totalEvents = hourlyData.reduce((sum, h) => sum + h._count.id, 0)
    for (const row of hourlyData) {
      hourlyBreakdown[row.hourOfDay] = {
        hour: row.hourOfDay,
        count: row._count.id,
        percentage: totalEvents > 0
          ? ((row._count.id / totalEvents) * 100).toFixed(1)
          : '0',
      }
    }

    // Find peak hours (top 3)
    const peakHours = [...hourlyBreakdown]
      .sort((a, b) => b.count - a.count)
      .slice(0, 3)
      .map((h) => ({
        hour: h.hour,
        timeRange: `${h.hour.toString().padStart(2, '0')}:00 - ${((h.hour + 1) % 24).toString().padStart(2, '0')}:00`,
        count: h.count,
      }))

    // Calculate prime time (consecutive 4-hour window with most activity)
    let maxSum = 0
    let primeTimeStart = 0

    for (let start = 0; start < 24; start++) {
      let sum = 0
      for (let i = 0; i < 4; i++) {
        sum += hourlyBreakdown[(start + i) % 24].count
      }
      if (sum > maxSum) {
        maxSum = sum
        primeTimeStart = start
      }
    }

    const primeTime = {
      startHour: primeTimeStart,
      endHour: (primeTimeStart + 4) % 24,
      timeRange: `${primeTimeStart.toString().padStart(2, '0')}:00 - ${((primeTimeStart + 4) % 24).toString().padStart(2, '0')}:00`,
      totalEvents: maxSum,
      percentageOfTotal: totalEvents > 0
        ? ((maxSum / totalEvents) * 100).toFixed(1)
        : '0',
    }

    return NextResponse.json({
      wipe: {
        id: targetWipe.id,
        wipeNumber: targetWipe.wipeNumber,
        wipedAt: targetWipe.wipedAt,
      },
      hourlyBreakdown,
      peakHours,
      primeTime,
      totalEvents,
    })
  } catch (error) {
    logger.analytics.error('Failed to fetch wipe peak hours', error as Error)
    return NextResponse.json(
      { error: 'Failed to fetch wipe peak hours' },
      { status: 500 }
    )
  }
}
