/**
 * Next Wipe Schedule API
 *
 * GET /api/servers/wipe-schedules/next - Compute next upcoming wipe for a server
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { authenticateWithScope } from '@/services/api-auth'
import { logger } from '@/lib/logger'

const querySchema = z.object({
  serverId: z.string().min(1).max(60),
})

const EST_OFFSET_MS = -5 * 60 * 60 * 1000

/**
 * Compute next occurrence of a weekly schedule in EST/EDT.
 * Returns a UTC Date object.
 */
function computeNextOccurrence(dayOfWeek: number, hour: number, minute: number): Date {
  const now = new Date()
  const nowEstMs = now.getTime() + EST_OFFSET_MS
  const nowEst = new Date(nowEstMs)

  const currentDayOfWeek = nowEst.getUTCDay()
  let daysUntil = (dayOfWeek - currentDayOfWeek + 7) % 7

  const candidateEst = new Date(nowEst)
  candidateEst.setUTCDate(candidateEst.getUTCDate() + daysUntil)
  candidateEst.setUTCHours(hour, minute, 0, 0)

  if (daysUntil === 0 && candidateEst.getTime() <= nowEstMs) {
    candidateEst.setUTCDate(candidateEst.getUTCDate() + 7)
  }

  const utcMs = candidateEst.getTime() - EST_OFFSET_MS
  return new Date(utcMs)
}

/**
 * Check if a date falls on force wipe day (first Thursday of month)
 */
function isForceWipeDay(date: Date): boolean {
  const estDate = new Date(date.getTime() + EST_OFFSET_MS)
  const year = estDate.getUTCFullYear()
  const month = estDate.getUTCMonth()

  const firstOfMonth = new Date(Date.UTC(year, month, 1))
  const firstDow = firstOfMonth.getUTCDay()
  const daysUntilThursday = ((4 - firstDow) + 7) % 7
  const firstThursday = 1 + daysUntilThursday

  return estDate.getUTCDate() === firstThursday
}

/**
 * Compute the next global force wipe (first Thursday of month at given EST time).
 * Returns a UTC Date object.
 */
function computeNextForceWipe(hour: number, minute: number): Date {
  const now = new Date()
  const nowEstMs = now.getTime() + EST_OFFSET_MS
  const nowEst = new Date(nowEstMs)

  for (let monthOffset = 0; monthOffset <= 2; monthOffset++) {
    const year = nowEst.getUTCFullYear()
    const month = nowEst.getUTCMonth() + monthOffset
    const firstOfMonth = new Date(Date.UTC(year, month, 1))
    const firstDow = firstOfMonth.getUTCDay()
    const daysUntilThursday = ((4 - firstDow) + 7) % 7
    const firstThursdayDay = 1 + daysUntilThursday

    const candidateEst = new Date(Date.UTC(year, month, firstThursdayDay, hour, minute, 0, 0))
    const utcMs = candidateEst.getTime() - EST_OFFSET_MS

    if (utcMs > now.getTime()) {
      return new Date(utcMs)
    }
  }

  return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
}

export async function GET(request: NextRequest) {
  const authResult = await authenticateWithScope(request, 'servers:read')

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

    const config = await prisma.redirectConfig.findFirst({
      where: { isActive: true },
      orderBy: { updatedAt: 'desc' },
      select: {
        wipeRedirectMinutesBefore: true,
        enableWipeRedirect: true,
        forceWipeHour: true,
        forceWipeMinute: true,
      },
    })

    const forceWipeHour = config?.forceWipeHour ?? 13
    const forceWipeMinute = config?.forceWipeMinute ?? 55

    const nextForceWipe = computeNextForceWipe(forceWipeHour, forceWipeMinute)
    let nextWipe: Date = nextForceWipe
    let nextWipeType = 'force'
    let nextDayOfWeek = 4
    let nextHour = forceWipeHour
    let nextMinute = forceWipeMinute

    const schedules = await prisma.wipeSchedule.findMany({
      where: { serverIdentifierId: server.id, isActive: true },
    })

    for (const schedule of schedules) {
      const candidate = computeNextOccurrence(schedule.dayOfWeek, schedule.hour, schedule.minute)

      if (isForceWipeDay(candidate)) {
        continue
      }

      if (candidate.getTime() < nextWipe.getTime()) {
        nextWipe = candidate
        nextWipeType = schedule.wipeType
        nextDayOfWeek = schedule.dayOfWeek
        nextHour = schedule.hour
        nextMinute = schedule.minute
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        nextWipeTimestamp: nextWipe.getTime(),
        nextWipeIso: nextWipe.toISOString(),
        wipeType: nextWipeType,
        dayOfWeek: nextDayOfWeek,
        hour: nextHour,
        minute: nextMinute,
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
