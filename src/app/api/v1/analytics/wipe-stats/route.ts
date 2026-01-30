/**
 * Wipe Stats Analytics API
 *
 * GET /api/v1/analytics/wipe-stats - Get per-wipe analytics
 *
 * Auth: Token (analytics:read) OR Session (admin)
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAnalyticsRead } from '@/services/api-auth'
import { wipeAnalyticsQuerySchema } from '@/lib/validations/analytics'
import { logger } from '@/lib/logger'

/**
 * GET /api/v1/analytics/wipe-stats
 *
 * Get analytics for a specific wipe.
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
    const parsed = wipeAnalyticsQuerySchema.safeParse({
      wipeId: searchParams.get('wipeId'),
      serverId: searchParams.get('serverId'),
      limit: searchParams.get('limit'),
    })

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { wipeId, serverId, limit } = parsed.data

    // If no wipeId, get the most recent wipe for the server
    let targetWipeId = wipeId
    if (!targetWipeId && serverId) {
      const latestWipe = await prisma.serverWipe.findFirst({
        where: { gameServerId: serverId },
        orderBy: { wipedAt: 'desc' },
        select: { id: true },
      })
      if (latestWipe) {
        targetWipeId = latestWipe.id
      }
    }

    if (!targetWipeId) {
      return NextResponse.json(
        { error: 'No wipe specified and no recent wipe found' },
        { status: 400 }
      )
    }

    // Get wipe details
    const wipe = await prisma.serverWipe.findUnique({
      where: { id: targetWipeId },
      include: {
        gameServer: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    if (!wipe) {
      return NextResponse.json(
        { error: 'Wipe not found' },
        { status: 404 }
      )
    }

    // PERF: Parallel queries
    const [
      totalRedemptions,
      uniquePlayers,
      successfulRedemptions,
      topKits,
      redemptionsBySource,
    ] = await Promise.all([
      // Total redemptions
      prisma.kitUsageEvent.count({
        where: { wipeId: targetWipeId },
      }),

      // Unique players
      prisma.kitUsageEvent.groupBy({
        by: ['steamId'],
        where: { wipeId: targetWipeId },
      }).then((result) => result.length),

      // Successful redemptions
      prisma.kitUsageEvent.count({
        where: {
          wipeId: targetWipeId,
          wasSuccessful: true,
        },
      }),

      // Top kits during this wipe
      prisma.kitUsageEvent.groupBy({
        by: ['kitName'],
        where: { wipeId: targetWipeId },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: limit,
      }),

      // Redemptions by source
      prisma.kitUsageEvent.groupBy({
        by: ['redemptionSource'],
        where: { wipeId: targetWipeId },
        _count: { id: true },
      }),
    ])

    // Calculate wipe duration
    const wipeStart = wipe.wipedAt
    const wipeEnd = wipe.endedAt || new Date()
    const wipeDurationHours = Math.round(
      (wipeEnd.getTime() - wipeStart.getTime()) / (1000 * 60 * 60)
    )

    return NextResponse.json({
      wipe: {
        id: wipe.id,
        wipeNumber: wipe.wipeNumber,
        wipedAt: wipe.wipedAt,
        endedAt: wipe.endedAt,
        mapSeed: wipe.mapSeed,
        mapSize: wipe.mapSize,
        durationHours: wipeDurationHours,
        isActive: !wipe.endedAt,
      },
      server: wipe.gameServer,
      stats: {
        totalRedemptions,
        uniquePlayers,
        successfulRedemptions,
        failedRedemptions: totalRedemptions - successfulRedemptions,
        successRate: totalRedemptions > 0
          ? ((successfulRedemptions / totalRedemptions) * 100).toFixed(1)
          : '0',
        redemptionsPerHour: wipeDurationHours > 0
          ? (totalRedemptions / wipeDurationHours).toFixed(1)
          : '0',
      },
      topKits: topKits.map((kit) => ({
        kitName: kit.kitName,
        count: kit._count.id,
      })),
      redemptionsBySource: redemptionsBySource.map((source) => ({
        source: source.redemptionSource,
        count: source._count.id,
      })),
    })
  } catch (error) {
    logger.analytics.error('Failed to fetch wipe stats', error as Error)
    return NextResponse.json(
      { error: 'Failed to fetch wipe stats' },
      { status: 500 }
    )
  }
}
