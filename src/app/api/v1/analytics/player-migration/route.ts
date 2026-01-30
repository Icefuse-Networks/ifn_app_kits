/**
 * Player Migration Analytics API
 *
 * GET /api/v1/analytics/player-migration - Get cross-server player data
 *
 * Auth: Token (analytics:read) OR Session (admin)
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAnalyticsRead } from '@/services/api-auth'
import { playerMigrationQuerySchema } from '@/lib/validations/analytics'
import { logger } from '@/lib/logger'

/**
 * GET /api/v1/analytics/player-migration
 *
 * Get players who use kits on multiple servers.
 * Shows cross-server player activity patterns.
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
    const parsed = playerMigrationQuerySchema.safeParse({
      days: searchParams.get('days'),
      limit: searchParams.get('limit'),
    })

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { days, limit } = parsed.data

    // Calculate date range
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    // Get player-server pairs
    const playerServers = await prisma.kitUsageEvent.groupBy({
      by: ['steamId', 'gameServerId'],
      where: {
        redeemedAt: { gte: startDate },
        gameServerId: { not: null },
      },
      _count: { id: true },
    })

    // Group by player
    const playerMap = new Map<string, Map<number, number>>()
    for (const row of playerServers) {
      if (!row.gameServerId) continue

      const existing = playerMap.get(row.steamId) || new Map()
      existing.set(row.gameServerId, row._count.id)
      playerMap.set(row.steamId, existing)
    }

    // Filter to multi-server players
    const multiServerPlayers = Array.from(playerMap.entries())
      .filter(([, servers]) => servers.size > 1)
      .map(([steamId, servers]) => ({
        steamId,
        serverCount: servers.size,
        totalRedemptions: Array.from(servers.values()).reduce((a, b) => a + b, 0),
        servers: Array.from(servers.entries()).map(([serverId, count]) => ({
          serverId,
          count,
        })),
      }))
      .sort((a, b) => b.serverCount - a.serverCount || b.totalRedemptions - a.totalRedemptions)
      .slice(0, limit)

    // Get server names
    const allServerIds = new Set<number>()
    for (const player of multiServerPlayers) {
      for (const server of player.servers) {
        allServerIds.add(server.serverId)
      }
    }

    const servers = await prisma.gameServer.findMany({
      where: { id: { in: Array.from(allServerIds) } },
      select: { id: true, name: true },
    })
    const serverMap = new Map(servers.map((s) => [s.id, s.name]))

    // Enrich with server names
    const result = multiServerPlayers.map((player) => ({
      ...player,
      servers: player.servers.map((s) => ({
        ...s,
        serverName: serverMap.get(s.serverId) || 'Unknown',
      })),
    }))

    // Calculate server combination stats
    const serverCombinations = new Map<string, number>()
    for (const player of multiServerPlayers) {
      const combo = player.servers
        .map((s) => s.serverId)
        .sort((a, b) => a - b)
        .join('-')
      serverCombinations.set(combo, (serverCombinations.get(combo) || 0) + 1)
    }

    const topCombinations = Array.from(serverCombinations.entries())
      .map(([combo, count]) => ({
        serverIds: combo.split('-').map(Number),
        serverNames: combo.split('-').map((id) => serverMap.get(Number(id)) || 'Unknown'),
        playerCount: count,
      }))
      .sort((a, b) => b.playerCount - a.playerCount)
      .slice(0, 10)

    // Calculate summary stats
    const totalPlayers = playerMap.size
    const multiServerCount = multiServerPlayers.length
    const singleServerCount = totalPlayers - multiServerCount

    return NextResponse.json({
      data: result,
      topCombinations,
      summary: {
        totalPlayers,
        multiServerPlayers: multiServerCount,
        singleServerPlayers: singleServerCount,
        multiServerPercentage: totalPlayers > 0
          ? ((multiServerCount / totalPlayers) * 100).toFixed(1)
          : '0',
      },
      period: {
        days,
        startDate: startDate.toISOString(),
        endDate: new Date().toISOString(),
      },
    })
  } catch (error) {
    logger.analytics.error('Failed to fetch player migration data', error as Error)
    return NextResponse.json(
      { error: 'Failed to fetch player migration data' },
      { status: 500 }
    )
  }
}
