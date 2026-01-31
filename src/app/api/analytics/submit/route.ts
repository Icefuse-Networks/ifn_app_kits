/**
 * Analytics Submit API - Event Ingestion
 *
 * POST /api/analytics/submit - Submit kit usage events (batch)
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { authenticateWithScope } from '@/services/api-auth'
import { id } from '@/lib/id'
import { logger } from '@/lib/logger'

/**
 * Normalize event object keys from PascalCase to camelCase
 * C# plugins send PascalCase, we use camelCase internally
 */
function normalizeEventKeys(event: Record<string, unknown>): Record<string, unknown> {
  const normalized: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(event)) {
    // Convert first letter to lowercase
    const camelKey = key.charAt(0).toLowerCase() + key.slice(1)
    normalized[camelKey] = value
  }
  return normalized
}

/**
 * Normalize redemption source values
 */
function normalizeRedemptionSource(source: string): string {
  const normalized = source.toLowerCase().replace(/_/g, '')
  const mapping: Record<string, string> = {
    'chatcommand': 'chat',
    'chat_command': 'chat',
    'autokit': 'autokit',
    'auto_kit': 'autokit',
  }
  return mapping[normalized] || normalized
}

/**
 * Kit usage event schema for plugin submission
 */
const kitUsageEventSchema = z.object({
  eventId: z.string().min(1).max(64),
  kitId: z.string().max(60).nullable().optional(),
  kitName: z.string().min(1).max(100),
  kitConfigId: z.string().max(60).nullable().optional(),
  serverIdentifier: z.string().min(1).max(100),
  steamId: z.string().min(1).max(20),
  playerName: z.string().max(100).nullable().optional(),
  authLevel: z.number().int().min(0).optional().default(0),
  redemptionSource: z.string().transform(normalizeRedemptionSource),
  wasSuccessful: z.boolean().optional().default(true),
  failureReason: z.string().max(100).nullable().optional(),
  cooldownSeconds: z.number().int().nullable().optional(),
  itemCount: z.number().int().nullable().optional(),
  // Accept both ISO string and Unix timestamp
  redeemedAt: z.union([
    z.string(),
    z.number().transform((n) => new Date(n * 1000).toISOString()),
  ]),
  // Optional: plugin may send these
  hourOfDay: z.number().int().min(0).max(23).optional(),
  dayOfWeek: z.number().int().min(0).max(6).optional(),
  serverIp: z.string().optional(),
  serverName: z.string().optional(),
  wipeId: z.string().optional(),
})

const batchSubmitSchema = z.object({
  events: z.array(z.record(z.unknown())).min(1).max(100),
})

/**
 * POST /api/analytics/submit
 * Submit kit usage events in batch
 */
export async function POST(request: NextRequest) {
  const authResult = await authenticateWithScope(request, 'analytics:write')

  if (!authResult.success) {
    return NextResponse.json(
      { success: false, error: { code: 'AUTH_ERROR', message: authResult.error } },
      { status: authResult.status }
    )
  }

  try {
    const body = await request.json()

    // SECURITY: Zod validated (first pass - array structure)
    const rawParsed = batchSubmitSchema.safeParse(body)
    if (!rawParsed.success) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Validation failed', details: rawParsed.error.flatten() } },
        { status: 400 }
      )
    }

    // Normalize keys and validate each event
    const events = rawParsed.data.events.map(normalizeEventKeys)
    const validatedEvents: z.infer<typeof kitUsageEventSchema>[] = []

    for (const event of events) {
      const parsed = kitUsageEventSchema.safeParse(event)
      if (parsed.success) {
        validatedEvents.push(parsed.data)
      }
    }

    if (validatedEvents.length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'No valid events in batch' } },
        { status: 400 }
      )
    }

    // Process events - skip duplicates via eventId
    const results = {
      processed: 0,
      skipped: 0,
      errors: [] as string[],
    }

    for (const event of validatedEvents) {
      try {
        // Check for duplicate
        const existing = await prisma.kitUsageEvent.findUnique({
          where: { eventId: event.eventId },
          select: { id: true },
        })

        if (existing) {
          results.skipped++
          continue
        }

        const redeemedAt = new Date(event.redeemedAt)
        const hourOfDay = event.hourOfDay ?? redeemedAt.getUTCHours()
        const dayOfWeek = event.dayOfWeek ?? redeemedAt.getUTCDay()

        // Find server identifier if exists
        const serverIdent = await prisma.serverIdentifier.findFirst({
          where: { hashedId: event.serverIdentifier },
          select: { id: true },
        })

        await prisma.kitUsageEvent.create({
          data: {
            id: id.kitUsageEvent(),
            eventId: event.eventId,
            kitId: event.kitId || event.kitName,
            kitName: event.kitName,
            kitConfigId: event.kitConfigId || null,
            serverIdentifier: event.serverIdentifier,
            serverIdentifierId: serverIdent?.id || null,
            steamId: event.steamId,
            playerName: event.playerName || null,
            authLevel: event.authLevel,
            redemptionSource: event.redemptionSource,
            wasSuccessful: event.wasSuccessful,
            failureReason: event.failureReason || null,
            cooldownSeconds: event.cooldownSeconds || null,
            itemCount: event.itemCount || null,
            hourOfDay,
            dayOfWeek,
            redeemedAt,
          },
        })

        results.processed++
      } catch (error) {
        results.errors.push(`Event ${event.eventId}: ${(error as Error).message}`)
      }
    }

    logger.admin.info('Analytics events submitted', {
      processed: results.processed,
      skipped: results.skipped,
      errors: results.errors.length,
      actor: authResult.context.actorId,
    })

    return NextResponse.json({
      success: true,
      data: results,
    })
  } catch (error) {
    logger.admin.error('Failed to submit analytics events', error as Error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to submit analytics events' } },
      { status: 500 }
    )
  }
}
