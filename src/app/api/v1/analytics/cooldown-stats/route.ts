/**
 * Cooldown Stats Analytics API
 *
 * GET /api/v1/analytics/cooldown-stats - Get cooldown efficiency metrics
 *
 * Auth: Token (analytics:read) OR Session (admin)
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAnalyticsRead } from '@/services/api-auth'
import { cooldownStatsQuerySchema } from '@/lib/validations/analytics'
import { logger } from '@/lib/logger'

/**
 * GET /api/v1/analytics/cooldown-stats
 *
 * Get cooldown efficiency metrics.
 * Shows how often players hit cooldowns and which kits have the most cooldown hits.
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
    const parsed = cooldownStatsQuerySchema.safeParse({
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

    // Get total and failed redemptions
    const [totalRedemptions, failedRedemptions, cooldownFailures] = await Promise.all([
      prisma.kitUsageEvent.count({ where }),
      prisma.kitUsageEvent.count({
        where: { ...where, wasSuccessful: false },
      }),
      prisma.kitUsageEvent.count({
        where: {
          ...where,
          wasSuccessful: false,
          failureReason: { contains: 'cooldown' },
        },
      }),
    ])

    // Get kits with most cooldown hits
    const cooldownByKit = await prisma.kitUsageEvent.groupBy({
      by: ['kitName'],
      where: {
        ...where,
        wasSuccessful: false,
        failureReason: { contains: 'cooldown' },
      },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10,
    })

    // Get average cooldown settings per kit
    const kitCooldowns = await prisma.kitUsageEvent.groupBy({
      by: ['kitName'],
      where: {
        ...where,
        cooldownSeconds: { not: null },
      },
      _avg: { cooldownSeconds: true },
    })

    const cooldownMap = new Map(
      kitCooldowns.map((k) => [k.kitName, k._avg.cooldownSeconds])
    )

    // Enrich cooldown data with average cooldown setting
    const kitsWithCooldownIssues = cooldownByKit.map((kit) => ({
      kitName: kit.kitName,
      cooldownHits: kit._count.id,
      averageCooldownSeconds: cooldownMap.get(kit.kitName) || null,
    }))

    // Calculate player cooldown patterns
    const playerCooldownHits = await prisma.kitUsageEvent.groupBy({
      by: ['steamId'],
      where: {
        ...where,
        wasSuccessful: false,
        failureReason: { contains: 'cooldown' },
      },
      _count: { id: true },
    })

    const playersHittingCooldowns = playerCooldownHits.length
    const avgCooldownHitsPerPlayer = playersHittingCooldowns > 0
      ? playerCooldownHits.reduce((sum, p) => sum + p._count.id, 0) / playersHittingCooldowns
      : 0

    return NextResponse.json({
      summary: {
        totalRedemptions,
        failedRedemptions,
        cooldownFailures,
        cooldownFailureRate: totalRedemptions > 0
          ? ((cooldownFailures / totalRedemptions) * 100).toFixed(2)
          : '0',
        otherFailures: failedRedemptions - cooldownFailures,
      },
      kitsWithCooldownIssues,
      playerStats: {
        playersHittingCooldowns,
        avgCooldownHitsPerPlayer: avgCooldownHitsPerPlayer.toFixed(1),
      },
      period: {
        days,
        startDate: startDate.toISOString(),
        endDate: new Date().toISOString(),
      },
    })
  } catch (error) {
    logger.analytics.error('Failed to fetch cooldown stats', error as Error)
    return NextResponse.json(
      { error: 'Failed to fetch cooldown stats' },
      { status: 500 }
    )
  }
}
