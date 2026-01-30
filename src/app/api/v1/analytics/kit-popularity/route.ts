/**
 * Kit Popularity Analytics API
 *
 * GET /api/v1/analytics/kit-popularity - Get time-bounded kit popularity
 *
 * Auth: Token (analytics:read) OR Session (admin)
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAnalyticsRead } from '@/services/api-auth'
import { kitPopularityQuerySchema } from '@/lib/validations/analytics'
import { logger } from '@/lib/logger'

/**
 * GET /api/v1/analytics/kit-popularity
 *
 * Get most popular kits within a time window.
 * Can be filtered by kit config, server, or wipe.
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
    const parsed = kitPopularityQuerySchema.safeParse({
      days: searchParams.get('days'),
      kitConfigId: searchParams.get('kitConfigId'),
      serverId: searchParams.get('serverId'),
      wipeId: searchParams.get('wipeId'),
      limit: searchParams.get('limit'),
    })

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { days, kitConfigId, serverId, wipeId, limit } = parsed.data

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

    if (wipeId) {
      where.wipeId = wipeId
    }

    // PERF: Use groupBy for aggregation
    const popularity = await prisma.kitUsageEvent.groupBy({
      by: ['kitName', 'kitConfigId'],
      where,
      _count: {
        id: true,
      },
      orderBy: {
        _count: {
          id: 'desc',
        },
      },
      take: limit,
    })

    // Get unique player counts for each kit
    const kitNames = popularity.map((p) => p.kitName)
    const playerCounts = await prisma.kitUsageEvent.groupBy({
      by: ['kitName'],
      where: {
        ...where,
        kitName: { in: kitNames },
      },
      _count: {
        steamId: true,
      },
    })

    const playerCountMap = new Map(
      playerCounts.map((p) => [p.kitName, p._count.steamId])
    )

    const result = popularity.map((kit) => ({
      kitName: kit.kitName,
      kitConfigId: kit.kitConfigId,
      totalRedemptions: kit._count.id,
      uniquePlayers: playerCountMap.get(kit.kitName) || 0,
    }))

    return NextResponse.json({
      data: result,
      period: {
        days,
        startDate: startDate.toISOString(),
        endDate: new Date().toISOString(),
      },
    })
  } catch (error) {
    logger.analytics.error('Failed to fetch kit popularity', error as Error)
    return NextResponse.json(
      { error: 'Failed to fetch kit popularity' },
      { status: 500 }
    )
  }
}
