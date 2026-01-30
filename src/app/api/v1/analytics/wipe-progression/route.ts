/**
 * Wipe Progression Analytics API
 *
 * GET /api/v1/analytics/wipe-progression - Get kit usage over wipe lifecycle
 *
 * Auth: Token (analytics:read) OR Session (admin)
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAnalyticsRead } from '@/services/api-auth'
import { wipeProgressionQuerySchema } from '@/lib/validations/analytics'
import { logger } from '@/lib/logger'

/**
 * GET /api/v1/analytics/wipe-progression
 *
 * Get kit usage over the wipe lifecycle.
 * Shows early wipe (day 1-3) vs late wipe patterns.
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
    const parsed = wipeProgressionQuerySchema.safeParse({
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

    // Get all events for this wipe
    const events = await prisma.kitUsageEvent.findMany({
      where: { wipeId: targetWipe.id },
      select: {
        kitName: true,
        redeemedAt: true,
        wasSuccessful: true,
      },
      orderBy: { redeemedAt: 'asc' },
    })

    if (events.length === 0) {
      return NextResponse.json({
        wipe: {
          id: targetWipe.id,
          wipeNumber: targetWipe.wipeNumber,
          wipedAt: targetWipe.wipedAt,
        },
        progression: [],
        phases: {
          earlyWipe: { days: '1-3', events: 0, kits: [] },
          midWipe: { days: '4-7', events: 0, kits: [] },
          lateWipe: { days: '8+', events: 0, kits: [] },
        },
      })
    }

    // Group events by day since wipe
    const wipeStart = targetWipe.wipedAt
    const dayBuckets = new Map<number, Array<{ kitName: string; wasSuccessful: boolean }>>()

    for (const event of events) {
      const daysSinceWipe = Math.floor(
        (event.redeemedAt.getTime() - wipeStart.getTime()) / (1000 * 60 * 60 * 24)
      )
      const day = Math.max(0, daysSinceWipe)

      const existing = dayBuckets.get(day) || []
      existing.push({ kitName: event.kitName, wasSuccessful: event.wasSuccessful })
      dayBuckets.set(day, existing)
    }

    // Create progression array
    const maxDay = Math.max(...dayBuckets.keys())
    const progression = []

    for (let day = 0; day <= maxDay; day++) {
      const dayEvents = dayBuckets.get(day) || []
      const kitCounts = new Map<string, number>()

      for (const event of dayEvents) {
        kitCounts.set(event.kitName, (kitCounts.get(event.kitName) || 0) + 1)
      }

      const topKits = Array.from(kitCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, count]) => ({ name, count }))

      progression.push({
        day,
        totalEvents: dayEvents.length,
        successfulEvents: dayEvents.filter((e) => e.wasSuccessful).length,
        topKits,
      })
    }

    // Calculate phase breakdowns
    const earlyWipeEvents = events.filter((e) => {
      const days = Math.floor((e.redeemedAt.getTime() - wipeStart.getTime()) / (1000 * 60 * 60 * 24))
      return days >= 0 && days <= 2
    })

    const midWipeEvents = events.filter((e) => {
      const days = Math.floor((e.redeemedAt.getTime() - wipeStart.getTime()) / (1000 * 60 * 60 * 24))
      return days >= 3 && days <= 6
    })

    const lateWipeEvents = events.filter((e) => {
      const days = Math.floor((e.redeemedAt.getTime() - wipeStart.getTime()) / (1000 * 60 * 60 * 24))
      return days >= 7
    })

    const getTopKits = (eventList: typeof events) => {
      const counts = new Map<string, number>()
      for (const e of eventList) {
        counts.set(e.kitName, (counts.get(e.kitName) || 0) + 1)
      }
      return Array.from(counts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, count]) => ({ name, count }))
    }

    return NextResponse.json({
      wipe: {
        id: targetWipe.id,
        wipeNumber: targetWipe.wipeNumber,
        wipedAt: targetWipe.wipedAt,
        endedAt: targetWipe.endedAt,
      },
      progression,
      phases: {
        earlyWipe: {
          days: '1-3',
          events: earlyWipeEvents.length,
          kits: getTopKits(earlyWipeEvents),
        },
        midWipe: {
          days: '4-7',
          events: midWipeEvents.length,
          kits: getTopKits(midWipeEvents),
        },
        lateWipe: {
          days: '8+',
          events: lateWipeEvents.length,
          kits: getTopKits(lateWipeEvents),
        },
      },
    })
  } catch (error) {
    logger.analytics.error('Failed to fetch wipe progression', error as Error)
    return NextResponse.json(
      { error: 'Failed to fetch wipe progression' },
      { status: 500 }
    )
  }
}
