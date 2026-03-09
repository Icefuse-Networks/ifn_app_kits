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

const TZ = 'America/New_York'

/**
 * Get the current UTC offset in ms for a timezone at a given instant.
 * Handles DST transitions automatically.
 */
function getTzOffsetMs(tz: string, at: Date): number {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  })
  const parts = fmt.formatToParts(at)
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parseInt(parts.find(p => p.type === type)!.value, 10)

  const tzYear = get('year')
  const tzMonth = get('month') - 1
  const tzDay = get('day')
  let tzHour = get('hour')
  if (tzHour === 24) tzHour = 0
  const tzMinute = get('minute')
  const tzSecond = get('second')

  const localAsUtc = Date.UTC(tzYear, tzMonth, tzDay, tzHour, tzMinute, tzSecond)
  return localAsUtc - at.getTime()
}

/**
 * Build a UTC Date from wall-clock components in a given timezone.
 */
function wallClockToUtc(tz: string, year: number, month: number, day: number, hour: number, minute: number): Date {
  const guess = new Date(Date.UTC(year, month, day, hour, minute, 0, 0))
  const offset = getTzOffsetMs(tz, guess)
  const utc = new Date(guess.getTime() - offset)
  const verify = getTzOffsetMs(tz, utc)
  if (verify !== offset) {
    return new Date(guess.getTime() - verify)
  }
  return utc
}

/**
 * Get wall-clock components in a timezone for a UTC instant.
 */
function utcToWallClock(tz: string, utc: Date): { year: number; month: number; day: number; dayOfWeek: number; hour: number; minute: number } {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
    hour12: false, weekday: 'short',
  })
  const parts = fmt.formatToParts(utc)
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parseInt(parts.find(p => p.type === type)!.value, 10)

  const weekdayStr = parts.find(p => p.type === 'weekday')!.value
  const dayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }

  let hour = get('hour')
  if (hour === 24) hour = 0

  return {
    year: get('year'),
    month: get('month') - 1,
    day: get('day'),
    dayOfWeek: dayMap[weekdayStr] ?? 0,
    hour,
    minute: get('minute'),
  }
}

/**
 * Compute next occurrence of a weekly schedule in the server timezone.
 * Returns a UTC Date object.
 */
function computeNextOccurrence(dayOfWeek: number, hour: number, minute: number, tz: string): Date {
  const now = new Date()
  const wall = utcToWallClock(tz, now)

  let daysUntil = (dayOfWeek - wall.dayOfWeek + 7) % 7

  const candidateDay = new Date(Date.UTC(wall.year, wall.month, wall.day + daysUntil))
  let candidate = wallClockToUtc(tz, candidateDay.getUTCFullYear(), candidateDay.getUTCMonth(), candidateDay.getUTCDate(), hour, minute)

  if (candidate.getTime() <= now.getTime()) {
    const nextWeek = new Date(Date.UTC(candidateDay.getUTCFullYear(), candidateDay.getUTCMonth(), candidateDay.getUTCDate() + 7))
    candidate = wallClockToUtc(tz, nextWeek.getUTCFullYear(), nextWeek.getUTCMonth(), nextWeek.getUTCDate(), hour, minute)
  }

  return candidate
}

/**
 * Check if a UTC date falls on force wipe day (first Thursday of month) in the given timezone.
 */
function isForceWipeDay(date: Date, tz: string): boolean {
  const wall = utcToWallClock(tz, date)

  const firstOfMonth = new Date(Date.UTC(wall.year, wall.month, 1))
  const firstDow = firstOfMonth.getUTCDay()
  const daysUntilThursday = ((4 - firstDow) + 7) % 7
  const firstThursday = 1 + daysUntilThursday

  return wall.day === firstThursday
}

/**
 * Compute the next global force wipe (first Thursday of month at given timezone time).
 * Returns a UTC Date object.
 */
function computeNextForceWipe(hour: number, minute: number, tz: string): Date {
  const now = new Date()
  const wall = utcToWallClock(tz, now)

  for (let monthOffset = 0; monthOffset <= 2; monthOffset++) {
    const targetMonth = new Date(Date.UTC(wall.year, wall.month + monthOffset, 1))
    const year = targetMonth.getUTCFullYear()
    const month = targetMonth.getUTCMonth()

    const firstOfMonth = new Date(Date.UTC(year, month, 1))
    const firstDow = firstOfMonth.getUTCDay()
    const daysUntilThursday = ((4 - firstDow) + 7) % 7
    const firstThursdayDay = 1 + daysUntilThursday

    const candidate = wallClockToUtc(tz, year, month, firstThursdayDay, hour, minute)

    if (candidate.getTime() > now.getTime()) {
      return candidate
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
      select: { id: true, timezone: true },
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

    const serverTz = server.timezone || TZ

    const forceWipeHour = config?.forceWipeHour ?? 13
    const forceWipeMinute = config?.forceWipeMinute ?? 55

    const nextForceWipe = computeNextForceWipe(forceWipeHour, forceWipeMinute, serverTz)
    let nextWipe: Date = nextForceWipe
    let nextWipeType = 'force'
    let nextDayOfWeek = 4
    let nextHour = forceWipeHour
    let nextMinute = forceWipeMinute

    const schedules = await prisma.wipeSchedule.findMany({
      where: { serverIdentifierId: server.id, isActive: true },
    })

    for (const schedule of schedules) {
      const candidate = computeNextOccurrence(schedule.dayOfWeek, schedule.hour, schedule.minute, serverTz)

      if (isForceWipeDay(candidate, serverTz)) {
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
