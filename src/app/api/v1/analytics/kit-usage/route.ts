/**
 * Kit Usage Analytics API - Single Event
 *
 * POST /api/v1/analytics/kit-usage - Record a single kit usage event
 *
 * Auth: Token (analytics:write) OR Session (admin)
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAnalyticsWrite } from '@/services/api-auth'
import { kitUsageEventSchema } from '@/lib/validations/analytics'
import { id } from '@/lib/id'
import { logger } from '@/lib/logger'

/**
 * POST /api/v1/analytics/kit-usage
 *
 * Record a single kit usage event.
 * Uses eventId for idempotency - duplicate events are rejected.
 */
export async function POST(request: NextRequest) {
  // SECURITY: Auth check with analytics:write scope
  const authResult = await requireAnalyticsWrite(request)

  if (!authResult.success) {
    return NextResponse.json(
      { error: authResult.error },
      { status: authResult.status }
    )
  }

  try {
    const body = await request.json()

    // SECURITY: Zod validated
    const parsed = kitUsageEventSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const event = parsed.data

    // Extract time-of-day components from redeemedAt
    const redeemedAtUTC = event.redeemedAt
    const hourOfDay = redeemedAtUTC.getUTCHours()
    const dayOfWeek = redeemedAtUTC.getUTCDay()

    // Look up gameServerId if serverIdentifier matches
    let gameServerId: number | null = null
    const server = await prisma.gameServer.findFirst({
      where: {
        OR: [
          { name: event.serverIdentifier },
          { ip: event.serverIdentifier },
        ],
      },
      select: { id: true },
    })
    if (server) {
      gameServerId = server.id
    }

    // SECURITY: Idempotency check via unique eventId
    const existingEvent = await prisma.kitUsageEvent.findUnique({
      where: { eventId: event.eventId },
      select: { id: true },
    })

    if (existingEvent) {
      return NextResponse.json(
        { error: 'Duplicate event', eventId: event.eventId },
        { status: 409 }
      )
    }

    // Create the usage event
    const usageEvent = await prisma.kitUsageEvent.create({
      data: {
        id: id.kitUsageEvent(),
        eventId: event.eventId,
        kitId: event.kitId || '',
        kitName: event.kitName,
        kitConfigId: event.kitConfigId,
        gameServerId,
        serverIdentifier: event.serverIdentifier,
        wipeId: event.wipeId,
        steamId: event.steamId,
        playerName: event.playerName,
        authLevel: event.authLevel,
        redemptionSource: event.redemptionSource,
        wasSuccessful: event.wasSuccessful,
        failureReason: event.failureReason,
        hourOfDay,
        dayOfWeek,
        cooldownSeconds: event.cooldownSeconds,
        itemCount: event.itemCount,
        redeemedAt: redeemedAtUTC,
      },
    })

    // Update global stats atomically
    await prisma.kitGlobalStats.upsert({
      where: { kitName: event.kitName },
      create: {
        id: id.kitGlobalStats(),
        kitName: event.kitName,
        kitConfigId: event.kitConfigId,
        totalRedemptions: 1,
        uniquePlayers: 1,
        firstRedeemed: redeemedAtUTC,
        lastRedeemed: redeemedAtUTC,
      },
      update: {
        totalRedemptions: { increment: 1 },
        lastRedeemed: redeemedAtUTC,
        kitConfigId: event.kitConfigId || undefined,
      },
    })

    logger.analytics.info('Kit usage event recorded', {
      eventId: event.eventId,
      kitName: event.kitName,
      steamId: event.steamId,
    })

    return NextResponse.json(
      { success: true, id: usageEvent.id },
      { status: 201 }
    )
  } catch (error: unknown) {
    const prismaError = error as { code?: string }

    // Handle unique constraint violation (race condition on eventId)
    if (prismaError.code === 'P2002') {
      return NextResponse.json(
        { error: 'Duplicate event' },
        { status: 409 }
      )
    }

    logger.analytics.error('Failed to record kit usage event', error as Error)
    return NextResponse.json(
      { error: 'Failed to record kit usage event' },
      { status: 500 }
    )
  }
}
