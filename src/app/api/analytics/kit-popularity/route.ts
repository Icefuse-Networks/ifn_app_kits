/**
 * Kit Popularity API
 *
 * GET /api/analytics/kit-popularity - Get most popular kits
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { authenticateWithScope } from '@/services/api-auth'
import { logger } from '@/lib/logger'

const querySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
  limit: z.coerce.number().int().min(1).max(100).default(10),
})

/**
 * GET /api/analytics/kit-popularity
 * Returns most popular kits by redemption count
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
      limit: searchParams.get('limit'),
    })

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid parameters' } },
        { status: 400 }
      )
    }

    const { days, limit } = parsed.data
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    // PERF: Aggregate kit usage with counts
    const popularity = await prisma.kitUsageEvent.groupBy({
      by: ['kitName', 'kitConfigId'],
      where: {
        redeemedAt: { gte: startDate },
        wasSuccessful: true,
      },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: limit,
    })

    // Get unique player counts per kit
    const uniquePlayers = await Promise.all(
      popularity.map(async (p) => {
        const count = await prisma.kitUsageEvent.findMany({
          where: {
            kitName: p.kitName,
            redeemedAt: { gte: startDate },
            wasSuccessful: true,
          },
          select: { steamId: true },
          distinct: ['steamId'],
        })
        return { kitName: p.kitName, uniquePlayers: count.length }
      })
    )

    const uniqueMap = new Map(uniquePlayers.map((u) => [u.kitName, u.uniquePlayers]))

    const data = popularity.map((p) => ({
      kitName: p.kitName,
      kitConfigId: p.kitConfigId,
      totalRedemptions: p._count.id,
      uniquePlayers: uniqueMap.get(p.kitName) || 0,
    }))

    return NextResponse.json({ success: true, data })
  } catch (error) {
    logger.admin.error('Failed to fetch kit popularity', error as Error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch kit popularity' } },
      { status: 500 }
    )
  }
}
