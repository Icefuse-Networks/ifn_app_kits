/**
 * Next Wipe Schedule API
 *
 * GET /api/redirect/wipe-schedules/next - Compute next upcoming wipe for a server
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { authenticateWithScope } from '@/services/api-auth'
import { logger } from '@/lib/logger'

const querySchema = z.object({
  serverId: z.string().min(1).max(60),
})

/**
 * Compute next occurrence of a weekly schedule in EST/EDT.
 * Returns a UTC Date object.
 */
function computeNextOccurrence(dayOfWeek: number, hour: number, minute: number): Date {
  // EST offset: -5 hours (simplified, doesn't account for DST dynamically,
  // but the plugin handles final scheduling so this is a best-effort estimate)
  const EST_OFFSET_MS = -5 * 60 * 60 * 1000

  const now = new Date()
  // Current time in EST
  const nowEstMs = now.getTime() + EST_OFFSET_MS
  const nowEst = new Date(nowEstMs)

  // Build candidate date in EST
  const currentDayOfWeek = nowEst.getUTCDay()
  let daysUntil = (dayOfWeek - currentDayOfWeek + 7) % 7

  const candidateEst = new Date(nowEst)
  candidateEst.setUTCDate(candidateEst.getUTCDate() + daysUntil)
  candidateEst.setUTCHours(hour, minute, 0, 0)

  // If same day but time has passed, go to next week
  if (daysUntil === 0 && candidateEst.getTime() <= nowEstMs) {
    candidateEst.setUTCDate(candidateEst.getUTCDate() + 7)
  }

  // Convert back to UTC
  const utcMs = candidateEst.getTime() - EST_OFFSET_MS
  return new Date(utcMs)
}

/**
 * Check if a date falls on force wipe day (first Thursday of month)
 */
function isForceWipeDay(date: Date): boolean {
  const estDate = new Date(date.getTime() - 5 * 60 * 60 * 1000)
  const year = estDate.getUTCFullYear()
  const month = estDate.getUTCMonth()

  const firstOfMonth = new Date(Date.UTC(year, month, 1))
  const firstDow = firstOfMonth.getUTCDay()
  const daysUntilThursday = ((4 - firstDow) + 7) % 7
  const firstThursday = 1 + daysUntilThursday

  return estDate.getUTCDate() === firstThursday
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
      serverId: searchParams.get('serverId'),
    })

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'serverId is required' } },
        { status: 400 }
      )
    }

    const { serverId } = parsed.data

    // Look up server by hashedId
    const server = await prisma.serverIdentifier.findFirst({
      where: { hashedId: serverId },
      select: { id: true },
    })

    if (!server) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Server not found' } },
        { status: 404 }
      )
    }

    const schedules = await prisma.wipeSchedule.findMany({
      where: { serverIdentifierId: server.id, isActive: true },
    })

    if (schedules.length === 0) {
      return NextResponse.json({
        success: true,
        data: null,
      })
    }

    // Get redirect config for minutesBefore
    const config = await prisma.redirectConfig.findFirst({
      where: { isActive: true },
      orderBy: { updatedAt: 'desc' },
      select: { wipeRedirectMinutesBefore: true, enableWipeRedirect: true },
    })

    let nextWipe: Date | null = null
    let nextSchedule: (typeof schedules)[number] | null = null

    for (const schedule of schedules) {
      const candidate = computeNextOccurrence(schedule.dayOfWeek, schedule.hour, schedule.minute)

      // Skip non-force schedules on force wipe day
      if (schedule.wipeType !== 'force' && isForceWipeDay(candidate)) {
        continue
      }

      if (!nextWipe || candidate.getTime() < nextWipe.getTime()) {
        nextWipe = candidate
        nextSchedule = schedule
      }
    }

    if (!nextWipe || !nextSchedule) {
      return NextResponse.json({
        success: true,
        data: null,
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        nextWipeTimestamp: nextWipe.getTime(),
        nextWipeIso: nextWipe.toISOString(),
        wipeType: nextSchedule.wipeType,
        dayOfWeek: nextSchedule.dayOfWeek,
        hour: nextSchedule.hour,
        minute: nextSchedule.minute,
        minutesBefore: config?.wipeRedirectMinutesBefore ?? 2,
        enableWipeRedirect: config?.enableWipeRedirect ?? true,
      },
    })
  } catch (error) {
    logger.admin.error('Failed to compute next wipe', error as Error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to compute next wipe' } },
      { status: 500 }
    )
  }
}
