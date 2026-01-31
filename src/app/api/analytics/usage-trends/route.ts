/**
 * Usage Trends API
 *
 * GET /api/analytics/usage-trends - Get usage trends over time
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { authenticateWithScope } from '@/services/api-auth'
import { logger } from '@/lib/logger'

const querySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
  granularity: z.enum(['daily', 'weekly']).default('daily'),
})

/**
 * GET /api/analytics/usage-trends
 * Returns usage trends over time
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
      granularity: searchParams.get('granularity'),
    })

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid parameters' } },
        { status: 400 }
      )
    }

    const { days, granularity } = parsed.data
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    // Get all events in the date range
    const events = await prisma.kitUsageEvent.findMany({
      where: {
        redeemedAt: { gte: startDate },
      },
      select: {
        redeemedAt: true,
        wasSuccessful: true,
      },
      orderBy: { redeemedAt: 'asc' },
    })

    // Group by date
    const dateMap = new Map<string, { total: number; successful: number; failed: number }>()

    for (const event of events) {
      const date = event.redeemedAt.toISOString().split('T')[0]
      const existing = dateMap.get(date) || { total: 0, successful: 0, failed: 0 }
      existing.total++
      if (event.wasSuccessful) {
        existing.successful++
      } else {
        existing.failed++
      }
      dateMap.set(date, existing)
    }

    // Fill in missing dates
    const data: Array<{ date: string; total: number; successful: number; failed: number }> = []
    const currentDate = new Date(startDate)
    const now = new Date()

    while (currentDate <= now) {
      const dateStr = currentDate.toISOString().split('T')[0]
      const stats = dateMap.get(dateStr) || { total: 0, successful: 0, failed: 0 }
      data.push({ date: dateStr, ...stats })
      currentDate.setDate(currentDate.getDate() + 1)
    }

    // If weekly, aggregate by week
    let finalData = data
    if (granularity === 'weekly') {
      const weekMap = new Map<string, { date: string; total: number; successful: number; failed: number }>()
      for (const d of data) {
        const date = new Date(d.date)
        const weekStart = new Date(date)
        weekStart.setDate(date.getDate() - date.getDay())
        const weekKey = weekStart.toISOString().split('T')[0]
        const existing = weekMap.get(weekKey) || { date: weekKey, total: 0, successful: 0, failed: 0 }
        existing.total += d.total
        existing.successful += d.successful
        existing.failed += d.failed
        weekMap.set(weekKey, existing)
      }
      finalData = Array.from(weekMap.values())
    }

    // Calculate summary
    const totalRedemptions = finalData.reduce((sum, d) => sum + d.total, 0)
    const successfulRedemptions = finalData.reduce((sum, d) => sum + d.successful, 0)

    return NextResponse.json({
      success: true,
      data: finalData,
      summary: {
        totalRedemptions,
        successfulRedemptions,
        failedRedemptions: totalRedemptions - successfulRedemptions,
      },
    })
  } catch (error) {
    logger.admin.error('Failed to fetch usage trends', error as Error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch usage trends' } },
      { status: 500 }
    )
  }
}
