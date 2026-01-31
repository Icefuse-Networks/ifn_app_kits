/**
 * Analytics Query API - Dashboard Queries
 *
 * POST /api/analytics/query - Query analytics data
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { authenticateWithScope } from '@/services/api-auth'
import { logger } from '@/lib/logger'

/**
 * Query schema for analytics
 */
const analyticsQuerySchema = z.object({
  type: z.enum(['kit-usage', 'daily-stats', 'hourly-stats', 'global-stats', 'server-stats']),
  filters: z.object({
    kitConfigId: z.string().optional(),
    kitName: z.string().optional(),
    serverIdentifier: z.string().optional(),
    gameServerId: z.number().int().optional(),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    steamId: z.string().optional(),
  }).optional(),
  pagination: z.object({
    page: z.number().int().min(1).default(1),
    limit: z.number().int().min(1).max(100).default(50),
  }).optional(),
  orderBy: z.enum(['redeemedAt', 'kitName', 'totalRedemptions']).optional(),
  orderDir: z.enum(['asc', 'desc']).default('desc'),
})

/**
 * POST /api/analytics/query
 * Query analytics data with filters
 */
export async function POST(request: NextRequest) {
  const authResult = await authenticateWithScope(request, 'analytics:read')

  if (!authResult.success) {
    return NextResponse.json(
      { success: false, error: { code: 'AUTH_ERROR', message: authResult.error } },
      { status: authResult.status }
    )
  }

  try {
    const body = await request.json()

    // SECURITY: Zod validated
    const parsed = analyticsQuerySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Validation failed', details: parsed.error.flatten() } },
        { status: 400 }
      )
    }

    const { type, filters, pagination, orderBy, orderDir } = parsed.data
    const page = pagination?.page ?? 1
    const limit = pagination?.limit ?? 50
    const skip = (page - 1) * limit

    let data: unknown
    let total = 0

    switch (type) {
      case 'kit-usage': {
        const where: Record<string, unknown> = {}

        if (filters?.kitConfigId) where.kitConfigId = filters.kitConfigId
        if (filters?.kitName) where.kitName = { contains: filters.kitName, mode: 'insensitive' }
        if (filters?.serverIdentifier) where.serverIdentifier = filters.serverIdentifier
        if (filters?.gameServerId) where.gameServerId = filters.gameServerId
        if (filters?.steamId) where.steamId = filters.steamId
        if (filters?.startDate || filters?.endDate) {
          where.redeemedAt = {}
          if (filters.startDate) (where.redeemedAt as Record<string, Date>).gte = new Date(filters.startDate)
          if (filters.endDate) (where.redeemedAt as Record<string, Date>).lte = new Date(filters.endDate)
        }

        const [events, count] = await Promise.all([
          prisma.kitUsageEvent.findMany({
            where,
            orderBy: { [orderBy || 'redeemedAt']: orderDir },
            skip,
            take: limit,
            select: {
              id: true,
              kitName: true,
              steamId: true,
              playerName: true,
              redemptionSource: true,
              wasSuccessful: true,
              redeemedAt: true,
              serverIdentifier: true,
            },
          }),
          prisma.kitUsageEvent.count({ where }),
        ])

        data = events
        total = count
        break
      }

      case 'daily-stats': {
        const where: Record<string, unknown> = {}

        if (filters?.kitConfigId) where.kitConfigId = filters.kitConfigId
        if (filters?.kitName) where.kitName = { contains: filters.kitName, mode: 'insensitive' }
        if (filters?.gameServerId) where.gameServerId = filters.gameServerId
        if (filters?.startDate || filters?.endDate) {
          where.date = {}
          if (filters.startDate) (where.date as Record<string, Date>).gte = new Date(filters.startDate)
          if (filters.endDate) (where.date as Record<string, Date>).lte = new Date(filters.endDate)
        }

        const [stats, count] = await Promise.all([
          prisma.kitUsageDailyStats.findMany({
            where,
            orderBy: { date: orderDir },
            skip,
            take: limit,
          }),
          prisma.kitUsageDailyStats.count({ where }),
        ])

        data = stats
        total = count
        break
      }

      case 'hourly-stats': {
        const where: Record<string, unknown> = {}

        if (filters?.kitConfigId) where.kitConfigId = filters.kitConfigId
        if (filters?.gameServerId) where.gameServerId = filters.gameServerId

        const stats = await prisma.kitUsageHourlyStats.findMany({
          where,
          orderBy: [{ dayOfWeek: 'asc' }, { hourOfDay: 'asc' }],
        })

        data = stats
        total = stats.length
        break
      }

      case 'global-stats': {
        const where: Record<string, unknown> = {}

        if (filters?.kitConfigId) where.kitConfigId = filters.kitConfigId
        if (filters?.kitName) where.kitName = { contains: filters.kitName, mode: 'insensitive' }

        const [stats, count] = await Promise.all([
          prisma.kitGlobalStats.findMany({
            where,
            orderBy: { totalRedemptions: orderDir },
            skip,
            take: limit,
          }),
          prisma.kitGlobalStats.count({ where }),
        ])

        data = stats
        total = count
        break
      }

      case 'server-stats': {
        // Aggregate stats by server
        const stats = await prisma.kitUsageEvent.groupBy({
          by: ['serverIdentifier'],
          _count: { id: true },
          _max: { redeemedAt: true },
          orderBy: { _count: { id: orderDir } },
          take: limit,
          skip,
        })

        data = stats.map((s) => ({
          serverIdentifier: s.serverIdentifier,
          totalEvents: s._count.id,
          lastActivity: s._max.redeemedAt,
        }))
        total = stats.length
        break
      }
    }

    return NextResponse.json({
      success: true,
      data,
      meta: {
        page,
        limit,
        total,
        hasMore: skip + limit < total,
      },
    })
  } catch (error) {
    logger.admin.error('Failed to query analytics', error as Error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to query analytics' } },
      { status: 500 }
    )
  }
}
