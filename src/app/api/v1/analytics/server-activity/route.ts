/**
 * Server Activity Analytics API
 *
 * GET /api/v1/analytics/server-activity - Get server activity index
 *
 * Auth: Token (analytics:read) OR Session (admin)
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAnalyticsRead } from '@/services/api-auth'
import { serverActivityQuerySchema } from '@/lib/validations/analytics'
import { logger } from '@/lib/logger'

/**
 * GET /api/v1/analytics/server-activity
 *
 * Get relative activity levels across all servers.
 * Returns server activity ranking with metrics.
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
    const parsed = serverActivityQuerySchema.safeParse({
      days: searchParams.get('days'),
    })

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { days } = parsed.data

    // Calculate date range
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    // Get redemption counts per server
    const serverActivity = await prisma.kitUsageEvent.groupBy({
      by: ['gameServerId'],
      where: {
        redeemedAt: { gte: startDate },
        gameServerId: { not: null },
      },
      _count: { id: true },
    })

    // Get unique player counts per server
    const playerCounts = await prisma.kitUsageEvent.groupBy({
      by: ['gameServerId', 'steamId'],
      where: {
        redeemedAt: { gte: startDate },
        gameServerId: { not: null },
      },
    })

    // Count unique players per server
    const uniquePlayersMap = new Map<number, Set<string>>()
    for (const row of playerCounts) {
      if (!row.gameServerId) continue
      const existing = uniquePlayersMap.get(row.gameServerId) || new Set()
      existing.add(row.steamId)
      uniquePlayersMap.set(row.gameServerId, existing)
    }

    // Get server info
    const serverIds = serverActivity.map((s) => s.gameServerId).filter(Boolean) as number[]
    const servers = await prisma.gameServer.findMany({
      where: { id: { in: serverIds } },
      select: { id: true, name: true },
    })
    const serverMap = new Map(servers.map((s) => [s.id, s.name]))

    // Combine data
    const activityData = serverActivity
      .filter((s) => s.gameServerId !== null)
      .map((s) => ({
        serverId: s.gameServerId as number,
        serverName: serverMap.get(s.gameServerId as number) || 'Unknown',
        totalRedemptions: s._count.id,
        uniquePlayers: uniquePlayersMap.get(s.gameServerId as number)?.size || 0,
      }))
      .sort((a, b) => b.totalRedemptions - a.totalRedemptions)

    // Calculate activity index (percentage of total)
    const totalRedemptions = activityData.reduce((sum, s) => sum + s.totalRedemptions, 0)

    const result = activityData.map((server, index) => ({
      ...server,
      rank: index + 1,
      activityIndex: totalRedemptions > 0
        ? ((server.totalRedemptions / totalRedemptions) * 100).toFixed(1)
        : '0',
      redemptionsPerPlayer: server.uniquePlayers > 0
        ? (server.totalRedemptions / server.uniquePlayers).toFixed(1)
        : '0',
    }))

    return NextResponse.json({
      data: result,
      summary: {
        totalServers: result.length,
        totalRedemptions,
        totalUniquePlayers: new Set(
          playerCounts.map((p) => p.steamId)
        ).size,
      },
      period: {
        days,
        startDate: startDate.toISOString(),
        endDate: new Date().toISOString(),
      },
    })
  } catch (error) {
    logger.analytics.error('Failed to fetch server activity', error as Error)
    return NextResponse.json(
      { error: 'Failed to fetch server activity' },
      { status: 500 }
    )
  }
}
