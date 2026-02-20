/**
 * Redirect Analytics API
 *
 * GET /api/redirect/analytics - Aggregated redirect statistics
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { authenticateWithScope } from '@/services/api-auth'
import { logger } from '@/lib/logger'

const querySchema = z.object({
  period: z.enum(['7d', '30d', '90d']).default('30d'),
  serverId: z.string().max(100).optional(),
})

function getPeriodDate(period: string): Date {
  const now = new Date()
  switch (period) {
    case '7d': return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    case '30d': return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    case '90d': return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
    default: return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  }
}

export async function GET(request: NextRequest) {
  const authResult = await authenticateWithScope(request, 'redirect:read')

  if (!authResult.success) {
    return NextResponse.json(
      { success: false, error: { code: 'AUTH_ERROR', message: authResult.error } },
      { status: authResult.status }
    )
  }

  try {
    const { searchParams } = new URL(request.url)
    const parsed = querySchema.safeParse({
      period: searchParams.get('period'),
      serverId: searchParams.get('serverId'),
    })

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid parameters', details: parsed.error.flatten() } },
        { status: 400 }
      )
    }

    const { period, serverId } = parsed.data
    const sinceDate = getPeriodDate(period)

    // Build base where clause
    const baseWhere: Record<string, unknown> = {
      timestamp: { gte: sinceDate },
    }
    if (serverId) {
      baseWhere.sourceIdentifier = serverId
    }

    // Run all queries in parallel
    const [
      total,
      successCount,
      failedCount,
      timeoutCount,
      reasonGroups,
      serverGroups,
      pendingQueue,
      dailyTrend,
    ] = await Promise.all([
      // Total redirects in period
      prisma.redirectLog.count({ where: baseWhere }),

      // Success count
      prisma.redirectLog.count({ where: { ...baseWhere, outcome: 'success' } }),

      // Failed count
      prisma.redirectLog.count({ where: { ...baseWhere, outcome: 'failed' } }),

      // Timeout count
      prisma.redirectLog.count({ where: { ...baseWhere, outcome: 'timeout' } }),

      // Group by redirect reason
      prisma.redirectLog.groupBy({
        by: ['redirectReason'],
        _count: { _all: true },
        where: baseWhere,
        orderBy: { _count: { redirectReason: 'desc' } },
      }),

      // Group by source server
      prisma.redirectLog.groupBy({
        by: ['sourceIdentifier'],
        _count: { _all: true },
        where: baseWhere,
        orderBy: { _count: { sourceIdentifier: 'desc' } },
        take: 20,
      }),

      // Pending queue depth
      prisma.redirectQueue.count({ where: { status: 'pending' } }),

      // Daily trend (raw SQL for date aggregation)
      (serverId
        ? prisma.$queryRaw<Array<{ date: Date; total: bigint; success: bigint; failed: bigint }>>`
            SELECT
              DATE(timestamp) as date,
              COUNT(*) as total,
              COUNT(*) FILTER (WHERE outcome = 'success') as success,
              COUNT(*) FILTER (WHERE outcome = 'failed') as failed
            FROM redirect_log
            WHERE timestamp >= ${sinceDate} AND source_identifier = ${serverId}
            GROUP BY DATE(timestamp)
            ORDER BY date ASC`
        : prisma.$queryRaw<Array<{ date: Date; total: bigint; success: bigint; failed: bigint }>>`
            SELECT
              DATE(timestamp) as date,
              COUNT(*) as total,
              COUNT(*) FILTER (WHERE outcome = 'success') as success,
              COUNT(*) FILTER (WHERE outcome = 'failed') as failed
            FROM redirect_log
            WHERE timestamp >= ${sinceDate}
            GROUP BY DATE(timestamp)
            ORDER BY date ASC`
      ).catch(() => []),
    ])

    // Resolve server names for the grouped data
    const serverIds = serverGroups.map(g => g.sourceIdentifier)
    const servers = serverIds.length > 0
      ? await prisma.serverIdentifier.findMany({
          where: { hashedId: { in: serverIds } },
          select: { hashedId: true, name: true },
        })
      : []
    const serverNameMap = new Map(servers.map(s => [s.hashedId, s.name]))

    // Also get per-server success rates
    const serverSuccessCounts = serverIds.length > 0
      ? await prisma.redirectLog.groupBy({
          by: ['sourceIdentifier'],
          _count: { _all: true },
          where: { ...baseWhere, outcome: 'success', sourceIdentifier: { in: serverIds } },
        })
      : []
    const serverSuccessMap = new Map(serverSuccessCounts.map(g => [g.sourceIdentifier, g._count._all]))

    const successRate = total > 0 ? Math.round((successCount / total) * 1000) / 10 : 0

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          total,
          success: successCount,
          failed: failedCount,
          timeout: timeoutCount,
          successRate,
          pendingQueue,
          period,
        },
        byReason: reasonGroups.map(g => ({
          reason: g.redirectReason,
          count: g._count._all,
        })),
        byServer: serverGroups.map(g => {
          const serverTotal = g._count._all
          const serverSuccess = serverSuccessMap.get(g.sourceIdentifier) || 0
          return {
            serverId: g.sourceIdentifier,
            serverName: serverNameMap.get(g.sourceIdentifier) || g.sourceIdentifier,
            count: serverTotal,
            successRate: serverTotal > 0 ? Math.round((serverSuccess / serverTotal) * 1000) / 10 : 0,
          }
        }),
        trend: Array.isArray(dailyTrend)
          ? dailyTrend.map(d => ({
              date: typeof d.date === 'string' ? d.date : new Date(d.date as unknown as string).toISOString().split('T')[0],
              total: Number(d.total),
              success: Number(d.success),
              failed: Number(d.failed),
            }))
          : [],
      },
    })
  } catch (error) {
    logger.admin.error('Failed to fetch redirect analytics', error as Error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch analytics' } },
      { status: 500 }
    )
  }
}
