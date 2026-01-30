/**
 * Kit Overlap Analytics API
 *
 * GET /api/v1/analytics/kit-overlap - Get kit overlap statistics
 *
 * Auth: Token (analytics:read) OR Session (admin)
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAnalyticsRead } from '@/services/api-auth'
import { kitOverlapQuerySchema } from '@/lib/validations/analytics'
import { logger } from '@/lib/logger'

/**
 * GET /api/v1/analytics/kit-overlap
 *
 * Get kit overlap statistics.
 * Shows players using multiple kits vs single-kit users and common kit combinations.
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
    const parsed = kitOverlapQuerySchema.safeParse({
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

    // Get player-kit usage
    const playerKitUsage = await prisma.kitUsageEvent.groupBy({
      by: ['steamId', 'kitName'],
      where,
      _count: { id: true },
    })

    // Group by player
    const playerKits = new Map<string, Set<string>>()
    for (const row of playerKitUsage) {
      const existing = playerKits.get(row.steamId) || new Set()
      existing.add(row.kitName)
      playerKits.set(row.steamId, existing)
    }

    // Calculate kit count distribution
    const kitCountDistribution = new Map<number, number>()
    for (const kits of playerKits.values()) {
      const count = kits.size
      kitCountDistribution.set(count, (kitCountDistribution.get(count) || 0) + 1)
    }

    // Convert to array for response
    const distribution = Array.from(kitCountDistribution.entries())
      .map(([kitsUsed, playerCount]) => ({
        kitsUsed,
        playerCount,
      }))
      .sort((a, b) => a.kitsUsed - b.kitsUsed)

    // Calculate summary stats
    const totalPlayers = playerKits.size
    const singleKitPlayers = kitCountDistribution.get(1) || 0
    const multiKitPlayers = totalPlayers - singleKitPlayers

    const allKitCounts = Array.from(playerKits.values()).map((kits) => kits.size)
    const avgKitsPerPlayer = allKitCounts.length > 0
      ? allKitCounts.reduce((a, b) => a + b, 0) / allKitCounts.length
      : 0

    // Find common kit combinations (for multi-kit users)
    const combinations = new Map<string, number>()
    for (const kits of playerKits.values()) {
      if (kits.size < 2) continue

      const kitArray = Array.from(kits).sort()
      // Get all pairs
      for (let i = 0; i < kitArray.length; i++) {
        for (let j = i + 1; j < kitArray.length; j++) {
          const combo = `${kitArray[i]}|${kitArray[j]}`
          combinations.set(combo, (combinations.get(combo) || 0) + 1)
        }
      }
    }

    const commonCombinations = Array.from(combinations.entries())
      .map(([combo, count]) => {
        const [kit1, kit2] = combo.split('|')
        return { kit1, kit2, playerCount: count }
      })
      .sort((a, b) => b.playerCount - a.playerCount)
      .slice(0, 10)

    return NextResponse.json({
      summary: {
        totalPlayers,
        singleKitPlayers,
        multiKitPlayers,
        multiKitPercentage: totalPlayers > 0
          ? ((multiKitPlayers / totalPlayers) * 100).toFixed(1)
          : '0',
        avgKitsPerPlayer: avgKitsPerPlayer.toFixed(1),
      },
      distribution,
      commonCombinations,
      period: {
        days,
        startDate: startDate.toISOString(),
        endDate: new Date().toISOString(),
      },
    })
  } catch (error) {
    logger.analytics.error('Failed to fetch kit overlap stats', error as Error)
    return NextResponse.json(
      { error: 'Failed to fetch kit overlap stats' },
      { status: 500 }
    )
  }
}
