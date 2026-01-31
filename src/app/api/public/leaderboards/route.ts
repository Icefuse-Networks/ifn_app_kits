/**
 * Public Leaderboards API
 *
 * GET /api/public/leaderboards - Get public leaderboard data
 *
 * Query params:
 * - identifierId: Optional server identifier ID to filter by
 * - kitName: Optional kit name to filter player stats by
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
 * - Top kits (all-time or per-identifier)
 * - Server/Identifier activity (last 30 days)
 * - Heat map (last 30 days)
 * - Top players (global or per-kit, with identifier filtering)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const identifierId = searchParams.get('identifierId')
    const kitNameFilter = searchParams.get('kitName')

    // Calculate date range for recent stats
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - 30)

    // Build identifier filter if provided
    const identifierFilter = identifierId
      ? { serverIdentifierId: identifierId }
      : {}

    // Build kit filter if provided
    const kitFilter = kitNameFilter ? { kitName: kitNameFilter } : {}

    // PERF: Parallel queries
    const [topKits, identifierActivity, heatMapData, topPlayers] = await Promise.all([
      // Top kits - either global or per-identifier
      identifierId
        ? // Per-identifier: aggregate from usage events
          prisma.kitUsageEvent
            .groupBy({
              by: ['kitName'],
              where: {
                serverIdentifierId: identifierId,
              },
              _count: { id: true },
            })
            .then(async (kitCounts) => {
              // Get unique players per kit
              const uniquePlayersData = await prisma.kitUsageEvent.groupBy({
                by: ['kitName', 'steamId'],
                where: {
                  serverIdentifierId: identifierId,
                },
              })

              const uniquePlayersMap = new Map<string, Set<string>>()
              for (const row of uniquePlayersData) {
                const existing = uniquePlayersMap.get(row.kitName) || new Set()
                existing.add(row.steamId)
                uniquePlayersMap.set(row.kitName, existing)
              }

              // Get last redeemed for each kit
              const lastRedeemedData = await prisma.kitUsageEvent.groupBy({
                by: ['kitName'],
                where: {
                  serverIdentifierId: identifierId,
                },
                _max: { redeemedAt: true },
              })
              const lastRedeemedMap = new Map(
                lastRedeemedData.map((r) => [r.kitName, r._max.redeemedAt])
              )

              return kitCounts
                .map((kit) => ({
                  kitName: kit.kitName,
                  totalRedemptions: kit._count.id,
                  uniquePlayers: uniquePlayersMap.get(kit.kitName)?.size || 0,
                  lastRedeemed: lastRedeemedMap.get(kit.kitName) || null,
                }))
                .sort((a, b) => b.totalRedemptions - a.totalRedemptions)
                .slice(0, 10)
            })
        : // Global: use pre-aggregated global stats
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

      // Identifier activity (last 30 days)
      prisma.kitUsageEvent
        .groupBy({
          by: ['serverIdentifierId'],
          where: {
            redeemedAt: { gte: startDate },
            serverIdentifierId: { not: null },
            ...identifierFilter,
          },
          _count: { id: true },
        })
        .then(async (activity) => {
          const identifierIds = activity
            .map((s) => s.serverIdentifierId)
            .filter(Boolean) as string[]

          if (identifierIds.length === 0) return []

          const identifiers = await prisma.serverIdentifier.findMany({
            where: { id: { in: identifierIds } },
            select: { id: true, name: true },
          })
          const identifierMap = new Map(identifiers.map((s) => [s.id, s.name]))

          // Get unique players per identifier
          const playerCounts = await prisma.kitUsageEvent.groupBy({
            by: ['serverIdentifierId', 'steamId'],
            where: {
              redeemedAt: { gte: startDate },
              serverIdentifierId: { in: identifierIds },
            },
          })

          const uniquePlayersMap = new Map<string, Set<string>>()
          for (const row of playerCounts) {
            if (!row.serverIdentifierId) continue
            const existing =
              uniquePlayersMap.get(row.serverIdentifierId) || new Set()
            existing.add(row.steamId)
            uniquePlayersMap.set(row.serverIdentifierId, existing)
          }

          return activity
            .filter((s) => s.serverIdentifierId !== null)
            .map((s) => ({
              identifierId: s.serverIdentifierId as string,
              identifierName:
                identifierMap.get(s.serverIdentifierId as string) || 'Unknown',
              totalRedemptions: s._count.id,
              uniquePlayers:
                uniquePlayersMap.get(s.serverIdentifierId as string)?.size || 0,
            }))
            .sort((a, b) => b.totalRedemptions - a.totalRedemptions)
        }),

      // Heat map (last 30 days)
      prisma.kitUsageEvent
        .groupBy({
          by: ['hourOfDay', 'dayOfWeek'],
          where: {
            redeemedAt: { gte: startDate },
            ...identifierFilter,
          },
          _count: { id: true },
        })
        .then((data) => {
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

          const dayNames = [
            'Sunday',
            'Monday',
            'Tuesday',
            'Wednesday',
            'Thursday',
            'Friday',
            'Saturday',
          ]

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

      // Top players - aggregated from usage events
      prisma.kitUsageEvent
        .groupBy({
          by: ['steamId'],
          where: {
            redeemedAt: { gte: startDate },
            ...identifierFilter,
            ...kitFilter,
          },
          _count: { id: true },
        })
        .then(async (playerCounts) => {
          // Get player names from most recent event per player
          const steamIds = playerCounts.map((p) => p.steamId)

          if (steamIds.length === 0) return []

          // Fetch unique kits per player
          const uniqueKitsData = await prisma.kitUsageEvent.groupBy({
            by: ['steamId', 'kitName'],
            where: {
              redeemedAt: { gte: startDate },
              steamId: { in: steamIds },
              ...identifierFilter,
              ...kitFilter,
            },
          })

          const uniqueKitsMap = new Map<string, Set<string>>()
          for (const row of uniqueKitsData) {
            const existing = uniqueKitsMap.get(row.steamId) || new Set()
            existing.add(row.kitName)
            uniqueKitsMap.set(row.steamId, existing)
          }

          // Get most recent player names
          const recentEvents = await prisma.kitUsageEvent.findMany({
            where: {
              steamId: { in: steamIds },
              playerName: { not: null },
            },
            select: {
              steamId: true,
              playerName: true,
              redeemedAt: true,
            },
            orderBy: { redeemedAt: 'desc' },
            distinct: ['steamId'],
          })

          const playerNameMap = new Map(
            recentEvents.map((e) => [e.steamId, e.playerName])
          )

          // Get last redeemed time per player
          const lastRedeemedData = await prisma.kitUsageEvent.groupBy({
            by: ['steamId'],
            where: {
              redeemedAt: { gte: startDate },
              steamId: { in: steamIds },
              ...identifierFilter,
              ...kitFilter,
            },
            _max: { redeemedAt: true },
          })
          const lastRedeemedMap = new Map(
            lastRedeemedData.map((r) => [r.steamId, r._max.redeemedAt])
          )

          return playerCounts
            .map((player) => ({
              steamId: player.steamId,
              playerName: playerNameMap.get(player.steamId) || null,
              totalRedemptions: player._count.id,
              uniqueKits: uniqueKitsMap.get(player.steamId)?.size || 0,
              lastRedeemed: lastRedeemedMap.get(player.steamId) || null,
            }))
            .sort((a, b) => b.totalRedemptions - a.totalRedemptions)
            .slice(0, 15)
        }),
    ])

    return NextResponse.json({
      topKits,
      identifierActivity,
      heatMap: heatMapData,
      topPlayers,
      // Include filter info in response
      filter: {
        identifierId: identifierId || null,
        kitName: kitNameFilter || null,
        isGlobal: !identifierId,
      },
    })
  } catch (error) {
    logger.analytics.error('Failed to fetch public leaderboards', error as Error)
    return NextResponse.json(
      { error: 'Failed to fetch leaderboard data' },
      { status: 500 }
    )
  }
}
