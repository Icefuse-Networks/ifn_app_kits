/**
 * Server Stats Analytics API
 *
 * GET /api/v1/analytics/server-stats - Get server-specific analytics
 *
 * Auth: Token (analytics:read) OR Session (admin)
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAnalyticsRead } from '@/services/api-auth'
import { serverStatsQuerySchema } from '@/lib/validations/analytics'
import { logger } from '@/lib/logger'

/**
 * GET /api/v1/analytics/server-stats
 *
 * Get detailed analytics for a specific server.
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
    const parsed = serverStatsQuerySchema.safeParse({
      serverId: searchParams.get('serverId'),
      days: searchParams.get('days'),
    })

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { serverId, days } = parsed.data

    // Calculate date range
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    // Get server info
    const server = await prisma.gameServer.findUnique({
      where: { id: serverId },
      select: {
        id: true,
        name: true,
        ip: true,
        port: true,
        kitConfig: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    if (!server) {
      return NextResponse.json(
        { error: 'Server not found' },
        { status: 404 }
      )
    }

    // PERF: Parallel queries for efficiency
    const [
      totalRedemptions,
      uniquePlayers,
      successfulRedemptions,
      topKits,
      recentWipes,
    ] = await Promise.all([
      // Total redemptions
      prisma.kitUsageEvent.count({
        where: {
          gameServerId: serverId,
          redeemedAt: { gte: startDate },
        },
      }),

      // Unique players
      prisma.kitUsageEvent.groupBy({
        by: ['steamId'],
        where: {
          gameServerId: serverId,
          redeemedAt: { gte: startDate },
        },
      }).then((result) => result.length),

      // Successful redemptions
      prisma.kitUsageEvent.count({
        where: {
          gameServerId: serverId,
          redeemedAt: { gte: startDate },
          wasSuccessful: true,
        },
      }),

      // Top kits for this server
      prisma.kitUsageEvent.groupBy({
        by: ['kitName'],
        where: {
          gameServerId: serverId,
          redeemedAt: { gte: startDate },
        },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 10,
      }),

      // Recent wipes
      prisma.serverWipe.findMany({
        where: { gameServerId: serverId },
        orderBy: { wipedAt: 'desc' },
        take: 5,
        select: {
          id: true,
          wipeNumber: true,
          wipedAt: true,
          endedAt: true,
          _count: {
            select: { usageEvents: true },
          },
        },
      }),
    ])

    return NextResponse.json({
      server: {
        id: server.id,
        name: server.name,
        ip: server.ip,
        port: server.port,
        kitConfig: server.kitConfig,
      },
      stats: {
        totalRedemptions,
        uniquePlayers,
        successfulRedemptions,
        failedRedemptions: totalRedemptions - successfulRedemptions,
        successRate: totalRedemptions > 0
          ? ((successfulRedemptions / totalRedemptions) * 100).toFixed(1)
          : '0',
      },
      topKits: topKits.map((kit) => ({
        kitName: kit.kitName,
        count: kit._count.id,
      })),
      recentWipes: recentWipes.map((wipe) => ({
        id: wipe.id,
        wipeNumber: wipe.wipeNumber,
        wipedAt: wipe.wipedAt,
        endedAt: wipe.endedAt,
        eventCount: wipe._count.usageEvents,
      })),
      period: {
        days,
        startDate: startDate.toISOString(),
        endDate: new Date().toISOString(),
      },
    })
  } catch (error) {
    logger.analytics.error('Failed to fetch server stats', error as Error)
    return NextResponse.json(
      { error: 'Failed to fetch server stats' },
      { status: 500 }
    )
  }
}
