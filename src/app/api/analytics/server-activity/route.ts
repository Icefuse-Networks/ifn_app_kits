/**
 * Server Activity API
 *
 * GET /api/analytics/server-activity - Get server activity stats
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { authenticateWithScope } from '@/services/api-auth'
import { logger } from '@/lib/logger'

const querySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
})

/**
 * GET /api/analytics/server-activity
 * Returns server activity statistics
 */
export async function GET(request: NextRequest) {
  const authResult = await authenticateWithScope(request, 'analytics:read')

  if (!authResult.success) {
    return NextResponse.json(
      { success: false, error: { code: 'AUTH_ERROR', message: authResult.error } },
      { status: authResult.status }
    )
  }

  try {
    const { searchParams } = new URL(request.url)

    // SECURITY: Zod validated
    const parsed = querySchema.safeParse({
      days: searchParams.get('days'),
    })

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid parameters' } },
        { status: 400 }
      )
    }

    const { days } = parsed.data
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    // PERF: Aggregate by server
    const serverStats = await prisma.kitUsageEvent.groupBy({
      by: ['serverIdentifier'],
      where: {
        redeemedAt: { gte: startDate },
      },
      _count: { id: true },
      _max: { redeemedAt: true },
      orderBy: { _count: { id: 'desc' } },
    })

    // Get unique players per server
    const uniquePlayers = await Promise.all(
      serverStats.map(async (s) => {
        const count = await prisma.kitUsageEvent.findMany({
          where: {
            serverIdentifier: s.serverIdentifier,
            redeemedAt: { gte: startDate },
          },
          select: { steamId: true },
          distinct: ['steamId'],
        })
        return { serverIdentifier: s.serverIdentifier, uniquePlayers: count.length }
      })
    )

    const uniqueMap = new Map(uniquePlayers.map((u) => [u.serverIdentifier, u.uniquePlayers]))

    const data = serverStats.map((s) => ({
      serverIdentifier: s.serverIdentifier,
      totalRedemptions: s._count.id,
      uniquePlayers: uniqueMap.get(s.serverIdentifier) || 0,
      lastActivity: s._max.redeemedAt,
    }))

    // Calculate totals
    const totalServers = serverStats.length
    const totalRedemptions = data.reduce((sum, s) => sum + s.totalRedemptions, 0)
    const totalUniquePlayers = new Set(uniquePlayers.flatMap(() => [])).size

    // Get actual total unique players across all servers
    const allUniquePlayers = await prisma.kitUsageEvent.findMany({
      where: {
        redeemedAt: { gte: startDate },
      },
      select: { steamId: true },
      distinct: ['steamId'],
    })

    return NextResponse.json({
      success: true,
      data,
      summary: {
        totalServers,
        totalRedemptions,
        totalUniquePlayers: allUniquePlayers.length,
      },
    })
  } catch (error) {
    logger.admin.error('Failed to fetch server activity', error as Error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch server activity' } },
      { status: 500 }
    )
  }
}
