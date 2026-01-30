/**
 * Global Kit Popularity Analytics API
 *
 * GET /api/v1/analytics/global-popularity - Get all-time kit popularity
 *
 * Auth: Token (analytics:read) OR Session (admin)
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAnalyticsRead } from '@/services/api-auth'
import { globalPopularityQuerySchema } from '@/lib/validations/analytics'
import { logger } from '@/lib/logger'

/**
 * GET /api/v1/analytics/global-popularity
 *
 * Get all-time kit popularity from KitGlobalStats.
 * This data is never affected by retention cleanup.
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
    const parsed = globalPopularityQuerySchema.safeParse({
      kitConfigId: searchParams.get('kitConfigId'),
      limit: searchParams.get('limit'),
    })

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { kitConfigId, limit } = parsed.data

    // Build where clause
    const where: Record<string, unknown> = {}
    if (kitConfigId) {
      where.kitConfigId = kitConfigId
    }

    // PERF: Select only needed fields
    const globalStats = await prisma.kitGlobalStats.findMany({
      where,
      select: {
        kitName: true,
        kitConfigId: true,
        totalRedemptions: true,
        uniquePlayers: true,
        firstRedeemed: true,
        lastRedeemed: true,
      },
      orderBy: {
        totalRedemptions: 'desc',
      },
      take: limit,
    })

    return NextResponse.json({
      data: globalStats,
      total: await prisma.kitGlobalStats.count({ where }),
    })
  } catch (error) {
    logger.analytics.error('Failed to fetch global kit popularity', error as Error)
    return NextResponse.json(
      { error: 'Failed to fetch global kit popularity' },
      { status: 500 }
    )
  }
}
