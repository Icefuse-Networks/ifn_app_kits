/**
 * Public Leaderboards API
 *
 * GET /api/public/leaderboards - Get public leaderboard data
 *
 * No authentication required - this is a public endpoint.
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'

/**
 * GET /api/public/leaderboards
 *
 * Get public leaderboard data including:
 * - Top kits (all-time)
 * - Server activity (last 30 days)
 * - Heat map (last 30 days)
 */
export async function GET(request: NextRequest) {
  try {
    // Calculate date range for recent stats
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - 30)

    // PERF: Parallel queries
    const [globalStats, serverActivity, heatMapData] = await Promise.all([
      // Top kits (all-time from global stats)
      prisma.kitGlobalStats.findMany({
        select: {
          kitName: true,
          totalRedemptions: true,
          uniquePlayers: true,
          lastRedeemed: true,
        },
        orderBy: { totalRedemptions: 'desc' },
        take: 10,
      }),

      // Server activity (last 30 days)
      prisma.kitUsageEvent.groupBy({
        by: ['gameServerId'],
        where: {
          redeemedAt: { gte: startDate },
          gameServerId: { not: null },
        },
        _count: { id: true },
      }).then(async (activity) => {
        // Get server names
        const serverIds = activity
          .map((s) => s.gameServerId)
          .filter(Boolean) as number[]

        if (serverIds.length === 0) return []

        const servers = await prisma.gameServer.findMany({
          where: { id: { in: serverIds } },
          select: { id: true, name: true },
        })
        const serverMap = new Map(servers.map((s) => [s.id, s.name]))

        // Get unique players per server
        const playerCounts = await prisma.kitUsageEvent.groupBy({
          by: ['gameServerId', 'steamId'],
          where: {
            redeemedAt: { gte: startDate },
            gameServerId: { in: serverIds },
          },
        })

        const uniquePlayersMap = new Map<number, Set<string>>()
        for (const row of playerCounts) {
          if (!row.gameServerId) continue
          const existing = uniquePlayersMap.get(row.gameServerId) || new Set()
          existing.add(row.steamId)
          uniquePlayersMap.set(row.gameServerId, existing)
        }

        return activity
          .filter((s) => s.gameServerId !== null)
          .map((s) => ({
            serverId: s.gameServerId as number,
            serverName: serverMap.get(s.gameServerId as number) || 'Unknown',
            totalRedemptions: s._count.id,
            uniquePlayers: uniquePlayersMap.get(s.gameServerId as number)?.size || 0,
          }))
          .sort((a, b) => b.totalRedemptions - a.totalRedemptions)
      }),

      // Heat map (last 30 days)
      prisma.kitUsageEvent.groupBy({
        by: ['hourOfDay', 'dayOfWeek'],
        where: {
          redeemedAt: { gte: startDate },
        },
        _count: { id: true },
      }).then((data) => {
        // Initialize 24x7 grid
        const grid: number[][] = Array.from({ length: 7 }, () =>
          Array.from({ length: 24 }, () => 0)
        )

        let maxValue = 0
        let peakHour = 0
        let peakDay = 0
        let peakCount = 0

        for (const row of data) {
          const count = row._count.id
          grid[row.dayOfWeek][row.hourOfDay] = count
          if (count > maxValue) {
            maxValue = count
            peakHour = row.hourOfDay
            peakDay = row.dayOfWeek
            peakCount = count
          }
        }

        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

        return {
          data: grid,
          maxValue,
          peak: {
            dayName: dayNames[peakDay],
            hourOfDay: peakHour,
            count: peakCount,
          },
        }
      }),
    ])

    return NextResponse.json({
      topKits: globalStats,
      serverActivity,
      heatMap: heatMapData,
    })
  } catch (error) {
    logger.analytics.error('Failed to fetch public leaderboards', error as Error)
    return NextResponse.json(
      { error: 'Failed to fetch leaderboard data' },
      { status: 500 }
    )
  }
}
