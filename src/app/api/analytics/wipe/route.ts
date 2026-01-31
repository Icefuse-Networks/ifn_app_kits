/**
 * Analytics Wipe API - Server Wipe Registration
 *
 * POST /api/analytics/wipe - Register a new server wipe
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { authenticateWithScope } from '@/services/api-auth'
import { id } from '@/lib/id'
import { logger } from '@/lib/logger'

/**
 * Wipe registration schema
 */
const wipeRegistrationSchema = z.object({
  serverIdentifier: z.string().min(1).max(100),
  serverIp: z.string().max(45).optional(),
  serverName: z.string().max(255).optional(),
  wipeNumber: z.number().int().min(1),
  wipedAt: z.string().datetime(),
  mapSeed: z.string().max(20).optional(),
  mapSize: z.number().int().optional(),
})

/**
 * POST /api/analytics/wipe
 * Register a new server wipe for analytics tracking
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

    // SECURITY: Zod validated
    const parsed = wipeRegistrationSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Validation failed', details: parsed.error.flatten() } },
        { status: 400 }
      )
    }

    const { serverIdentifier, wipeNumber, wipedAt, mapSeed, mapSize } = parsed.data

    // Check for existing wipe with same server + wipe number
    const existing = await prisma.serverWipe.findUnique({
      where: {
        serverIdentifier_wipeNumber: { serverIdentifier, wipeNumber },
      },
      select: { id: true },
    })

    if (existing) {
      // Return existing wipe ID (idempotent)
      return NextResponse.json({
        success: true,
        data: { wipeId: existing.id, existing: true },
      }, { status: 409 })
    }

    // Create new wipe record
    const wipe = await prisma.serverWipe.create({
      data: {
        id: id.serverWipe(),
        serverIdentifier,
        wipeNumber,
        wipedAt: new Date(wipedAt),
        mapSeed: mapSeed || null,
        mapSize: mapSize || null,
      },
    })

    logger.admin.info('Server wipe registered', {
      wipeId: wipe.id,
      serverIdentifier,
      wipeNumber,
      actor: authResult.context.actorId,
    })

    return NextResponse.json({
      success: true,
      data: { wipeId: wipe.id },
    }, { status: 201 })
  } catch (error) {
    logger.admin.error('Failed to register wipe', error as Error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to register wipe' } },
      { status: 500 }
    )
  }
}
