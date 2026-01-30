/**
 * Kit Usage Analytics API - Batch Events
 *
 * POST /api/v1/analytics/kit-usage/batch - Record multiple kit usage events
 *
 * Auth: Token (analytics:write) OR Session (admin)
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAnalyticsWrite } from '@/services/api-auth'
import { kitUsageBatchSchema } from '@/lib/validations/analytics'
import { id } from '@/lib/id'
import { logger } from '@/lib/logger'

interface BatchResult {
  success: number
  duplicates: number
  failed: number
  errors: Array<{ eventId: string; error: string }>
}

/**
 * POST /api/v1/analytics/kit-usage/batch
 *
 * Record multiple kit usage events in a batch.
 * Skips duplicates and returns summary.
 * Maximum 100 events per batch.
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
    const parsed = kitUsageBatchSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { events } = parsed.data
    const result: BatchResult = {
      success: 0,
      duplicates: 0,
      failed: 0,
      errors: [],
    }

    // Get existing eventIds to skip duplicates
    const eventIds = events.map((e) => e.eventId)
    const existingEvents = await prisma.kitUsageEvent.findMany({
      where: { eventId: { in: eventIds } },
      select: { eventId: true },
    })
    const existingEventIds = new Set(existingEvents.map((e) => e.eventId))

    // Filter out duplicates
    const newEvents = events.filter((e) => !existingEventIds.has(e.eventId))
    result.duplicates = events.length - newEvents.length

    if (newEvents.length === 0) {
      return NextResponse.json({
        ...result,
        message: 'All events were duplicates',
      })
    }

    // Cache server lookups
    const serverIdentifiers = [...new Set(newEvents.map((e) => e.serverIdentifier))]
    const servers = await prisma.gameServer.findMany({
      where: {
        OR: serverIdentifiers.flatMap((identifier) => [
          { name: identifier },
          { ip: identifier },
        ]),
      },
      select: { id: true, name: true, ip: true },
    })
    const serverMap = new Map<string, number>()
    for (const server of servers) {
      serverMap.set(server.name, server.id)
      serverMap.set(server.ip, server.id)
    }

    // Prepare data for batch insert
    const eventsToCreate = newEvents.map((event) => {
      const redeemedAtUTC = event.redeemedAt
      const hourOfDay = redeemedAtUTC.getUTCHours()
      const dayOfWeek = redeemedAtUTC.getUTCDay()
      const gameServerId = serverMap.get(event.serverIdentifier) || null

      return {
        id: id.kitUsageEvent(),
        eventId: event.eventId,
        kitId: event.kitId || '',
        kitName: event.kitName,
        kitConfigId: event.kitConfigId || null,
        gameServerId,
        serverIdentifier: event.serverIdentifier,
        wipeId: event.wipeId || null,
        steamId: event.steamId,
        playerName: event.playerName || null,
        authLevel: event.authLevel,
        redemptionSource: event.redemptionSource,
        wasSuccessful: event.wasSuccessful,
        failureReason: event.failureReason || null,
        hourOfDay,
        dayOfWeek,
        cooldownSeconds: event.cooldownSeconds || null,
        itemCount: event.itemCount || null,
        redeemedAt: redeemedAtUTC,
      }
    })

    // Use transaction for atomic batch insert
    await prisma.$transaction(async (tx) => {
      // Batch insert events
      const created = await tx.kitUsageEvent.createMany({
        data: eventsToCreate,
        skipDuplicates: true,
      })
      result.success = created.count

      // Update global stats for each unique kit
      const kitStats = new Map<string, { count: number; configId?: string; lastRedeemed: Date }>()
      for (const event of newEvents) {
        const existing = kitStats.get(event.kitName)
        if (existing) {
          existing.count++
          if (event.redeemedAt > existing.lastRedeemed) {
            existing.lastRedeemed = event.redeemedAt
          }
        } else {
          kitStats.set(event.kitName, {
            count: 1,
            configId: event.kitConfigId,
            lastRedeemed: event.redeemedAt,
          })
        }
      }

      // Upsert global stats for each kit
      for (const [kitName, stats] of kitStats) {
        await tx.kitGlobalStats.upsert({
          where: { kitName },
          create: {
            id: id.kitGlobalStats(),
            kitName,
            kitConfigId: stats.configId,
            totalRedemptions: stats.count,
            uniquePlayers: 1,
            firstRedeemed: stats.lastRedeemed,
            lastRedeemed: stats.lastRedeemed,
          },
          update: {
            totalRedemptions: { increment: stats.count },
            lastRedeemed: stats.lastRedeemed,
          },
        })
      }
    })

    logger.analytics.info('Batch kit usage events recorded', {
      total: events.length,
      success: result.success,
      duplicates: result.duplicates,
    })

    return NextResponse.json(result)
  } catch (error) {
    logger.analytics.error('Failed to record batch kit usage events', error as Error)
    return NextResponse.json(
      { error: 'Failed to record batch kit usage events' },
      { status: 500 }
    )
  }
}
