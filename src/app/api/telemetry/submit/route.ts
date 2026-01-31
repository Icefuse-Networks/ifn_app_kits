/**
 * Telemetry Submit API - Health and Performance Data
 *
 * POST /api/telemetry/submit - Submit telemetry data from plugins
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { authenticateWithScope } from '@/services/api-auth'
import { logger } from '@/lib/logger'

/**
 * Telemetry event schema
 */
const telemetryEventSchema = z.object({
  serverIdentifier: z.string().min(1).max(100),
  type: z.enum(['health', 'performance', 'error', 'startup', 'shutdown']),
  timestamp: z.string().datetime(),
  data: z.record(z.unknown()).optional(),
  metrics: z.object({
    playerCount: z.number().int().min(0).optional(),
    fps: z.number().min(0).optional(),
    memory: z.number().min(0).optional(),
    entityCount: z.number().int().min(0).optional(),
    uptime: z.number().min(0).optional(),
  }).optional(),
  version: z.string().max(20).optional(),
})

const batchTelemetrySchema = z.object({
  events: z.array(telemetryEventSchema).min(1).max(50),
})

/**
 * POST /api/telemetry/submit
 * Submit telemetry events from plugins
 */
export async function POST(request: NextRequest) {
  const authResult = await authenticateWithScope(request, 'telemetry:write')

  if (!authResult.success) {
    return NextResponse.json(
      { success: false, error: { code: 'AUTH_ERROR', message: authResult.error } },
      { status: authResult.status }
    )
  }

  try {
    const body = await request.json()

    // SECURITY: Zod validated
    const parsed = batchTelemetrySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Validation failed', details: parsed.error.flatten() } },
        { status: 400 }
      )
    }

    const { events } = parsed.data

    // For now, just log telemetry events
    // Future: Store in database or forward to metrics service
    for (const event of events) {
      logger.admin.info('Telemetry event received', {
        serverIdentifier: event.serverIdentifier,
        type: event.type,
        timestamp: event.timestamp,
        metrics: event.metrics,
        version: event.version,
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        received: events.length,
      },
    })
  } catch (error) {
    logger.admin.error('Failed to process telemetry events', error as Error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to process telemetry events' } },
      { status: 500 }
    )
  }
}
