/**
 * Wipe Comparison Analytics API
 *
 * GET /api/v1/analytics/wipe-comparison - Compare kit usage between wipes
 *
 * Auth: Token (analytics:read) OR Session (admin)
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAnalyticsRead } from '@/services/api-auth'
import { wipeComparisonQuerySchema } from '@/lib/validations/analytics'
import { logger } from '@/lib/logger'

/**
 * GET /api/v1/analytics/wipe-comparison
 *
 * Compare kit usage statistics between different wipes.
 * Shows side-by-side wipe statistics and trend changes.
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
    const parsed = wipeComparisonQuerySchema.safeParse({
      serverId: searchParams.get('serverId'),
      limit: searchParams.get('limit'),
    })

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { serverId, limit } = parsed.data

    // Get recent wipes
    const wipes = await prisma.serverWipe.findMany({
      where: serverId ? { gameServerId: serverId } : undefined,
      orderBy: { wipedAt: 'desc' },
      take: limit,
      include: {
        gameServer: {
          select: { id: true, name: true },
        },
      },
    })

    if (wipes.length === 0) {
      return NextResponse.json({ data: [], comparison: null })
    }

    // Get stats for each wipe
    const wipeStats = await Promise.all(
      wipes.map(async (wipe) => {
        const [totalEvents, uniquePlayers, topKits] = await Promise.all([
          prisma.kitUsageEvent.count({
            where: { wipeId: wipe.id },
          }),
          prisma.kitUsageEvent.groupBy({
            by: ['steamId'],
            where: { wipeId: wipe.id },
          }).then((r) => r.length),
          prisma.kitUsageEvent.groupBy({
            by: ['kitName'],
            where: { wipeId: wipe.id },
            _count: { id: true },
            orderBy: { _count: { id: 'desc' } },
            take: 5,
          }),
        ])

        // Calculate wipe duration
        const wipeEnd = wipe.endedAt || new Date()
        const durationHours = Math.round(
          (wipeEnd.getTime() - wipe.wipedAt.getTime()) / (1000 * 60 * 60)
        )

        return {
          wipe: {
            id: wipe.id,
            wipeNumber: wipe.wipeNumber,
            wipedAt: wipe.wipedAt,
            endedAt: wipe.endedAt,
            durationHours,
            isActive: !wipe.endedAt,
            server: wipe.gameServer,
          },
          stats: {
            totalRedemptions: totalEvents,
            uniquePlayers,
            redemptionsPerHour: durationHours > 0
              ? (totalEvents / durationHours).toFixed(1)
              : '0',
            redemptionsPerPlayer: uniquePlayers > 0
              ? (totalEvents / uniquePlayers).toFixed(1)
              : '0',
          },
          topKits: topKits.map((k) => ({
            kitName: k.kitName,
            count: k._count.id,
          })),
        }
      })
    )

    // Calculate comparison between most recent wipes
    let comparison = null
    if (wipeStats.length >= 2) {
      const current = wipeStats[0]
      const previous = wipeStats[1]

      const redemptionChange = previous.stats.totalRedemptions > 0
        ? (((current.stats.totalRedemptions - previous.stats.totalRedemptions) / previous.stats.totalRedemptions) * 100).toFixed(1)
        : 'N/A'

      const playerChange = previous.stats.uniquePlayers > 0
        ? (((current.stats.uniquePlayers - previous.stats.uniquePlayers) / previous.stats.uniquePlayers) * 100).toFixed(1)
        : 'N/A'

      comparison = {
        currentWipe: current.wipe.wipeNumber,
        previousWipe: previous.wipe.wipeNumber,
        redemptionChange: `${Number(redemptionChange) > 0 ? '+' : ''}${redemptionChange}%`,
        playerChange: `${Number(playerChange) > 0 ? '+' : ''}${playerChange}%`,
        isImprovement: Number(redemptionChange) > 0,
      }
    }

    return NextResponse.json({
      data: wipeStats,
      comparison,
    })
  } catch (error) {
    logger.analytics.error('Failed to fetch wipe comparison', error as Error)
    return NextResponse.json(
      { error: 'Failed to fetch wipe comparison' },
      { status: 500 }
    )
  }
}
