/**
 * Cross-Server Analytics API
 *
 * GET /api/v1/analytics/cross-server - Get kit popularity across servers
 *
 * Auth: Token (analytics:read) OR Session (admin)
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAnalyticsRead } from '@/services/api-auth'
import { crossServerQuerySchema } from '@/lib/validations/analytics'
import { logger } from '@/lib/logger'

/**
 * GET /api/v1/analytics/cross-server
 *
 * Get kit popularity breakdown by server.
 * Shows which kits are used on which servers.
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
    const parsed = crossServerQuerySchema.safeParse({
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

    // Get kit usage grouped by kit and server
    const crossServerData = await prisma.kitUsageEvent.groupBy({
      by: ['kitName', 'gameServerId'],
      where: {
        redeemedAt: { gte: startDate },
        gameServerId: { not: null },
      },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
    })

    // Get server names
    const serverIds = [...new Set(crossServerData.map((d) => d.gameServerId).filter(Boolean))] as number[]
    const servers = await prisma.gameServer.findMany({
      where: { id: { in: serverIds } },
      select: { id: true, name: true },
    })
    const serverMap = new Map(servers.map((s) => [s.id, s.name]))

    // Group by kit
    const kitBreakdown = new Map<string, Array<{ serverId: number; serverName: string; count: number }>>()

    for (const row of crossServerData) {
      if (!row.gameServerId) continue

      const existing = kitBreakdown.get(row.kitName) || []
      existing.push({
        serverId: row.gameServerId,
        serverName: serverMap.get(row.gameServerId) || 'Unknown',
        count: row._count.id,
      })
      kitBreakdown.set(row.kitName, existing)
    }

    // Calculate totals and sort by total usage
    const result = Array.from(kitBreakdown.entries())
      .map(([kitName, servers]) => ({
        kitName,
        totalRedemptions: servers.reduce((sum, s) => sum + s.count, 0),
        serverCount: servers.length,
        servers: servers.sort((a, b) => b.count - a.count),
      }))
      .sort((a, b) => b.totalRedemptions - a.totalRedemptions)
      .slice(0, limit)

    return NextResponse.json({
      data: result,
      period: {
        days,
        startDate: startDate.toISOString(),
        endDate: new Date().toISOString(),
      },
    })
  } catch (error) {
    logger.analytics.error('Failed to fetch cross-server data', error as Error)
    return NextResponse.json(
      { error: 'Failed to fetch cross-server data' },
      { status: 500 }
    )
  }
}
