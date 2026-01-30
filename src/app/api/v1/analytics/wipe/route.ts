/**
 * Server Wipe Analytics API
 *
 * POST /api/v1/analytics/wipe - Register a new server wipe
 * GET  /api/v1/analytics/wipe - Get current/recent wipe for a server
 *
 * Auth: Token (analytics:write/read) OR Session (admin)
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAnalyticsWrite, requireAnalyticsRead } from '@/services/api-auth'
import { serverWipeSchema, wipesQuerySchema } from '@/lib/validations/analytics'
import { id } from '@/lib/id'
import { logger } from '@/lib/logger'

/**
 * POST /api/v1/analytics/wipe
 *
 * Register a new server wipe.
 * Closes the previous wipe (sets endedAt) and creates a new one.
 * Returns the wipe ID for subsequent event tracking.
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
    const parsed = serverWipeSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { gameServerId, wipeNumber, wipedAt, mapSeed, mapSize } = parsed.data

    // Verify the game server exists
    const server = await prisma.gameServer.findUnique({
      where: { id: gameServerId },
      select: { id: true, name: true },
    })

    if (!server) {
      return NextResponse.json(
        { error: 'Game server not found' },
        { status: 404 }
      )
    }

    // Check for duplicate wipe number
    const existingWipe = await prisma.serverWipe.findUnique({
      where: {
        gameServerId_wipeNumber: {
          gameServerId,
          wipeNumber,
        },
      },
      select: { id: true },
    })

    if (existingWipe) {
      return NextResponse.json(
        { error: 'Wipe number already exists for this server', wipeId: existingWipe.id },
        { status: 409 }
      )
    }

    // Use transaction to close previous wipe and create new one
    const wipe = await prisma.$transaction(async (tx) => {
      // Close the previous wipe (set endedAt)
      await tx.serverWipe.updateMany({
        where: {
          gameServerId,
          endedAt: null,
        },
        data: {
          endedAt: wipedAt,
        },
      })

      // Create the new wipe
      return tx.serverWipe.create({
        data: {
          id: id.serverWipe(),
          gameServerId,
          wipeNumber,
          wipedAt,
          mapSeed,
          mapSize,
        },
      })
    })

    logger.analytics.info('Server wipe registered', {
      wipeId: wipe.id,
      gameServerId,
      wipeNumber,
      serverName: server.name,
    })

    return NextResponse.json(
      {
        success: true,
        wipeId: wipe.id,
        wipeNumber: wipe.wipeNumber,
        wipedAt: wipe.wipedAt,
      },
      { status: 201 }
    )
  } catch (error) {
    logger.analytics.error('Failed to register server wipe', error as Error)
    return NextResponse.json(
      { error: 'Failed to register server wipe' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/v1/analytics/wipe
 *
 * Get wipes for a server.
 * Query params: serverId, limit
 */
export async function GET(request: NextRequest) {
  // SECURITY: Auth check with analytics:read scope
  const authResult = await requireAnalyticsRead(request)

  if (!authResult.success) {
    return NextResponse.json(
      { error: authResult.error },
      { status: authResult.status }
    )
  }

  try {
    const { searchParams } = new URL(request.url)

    // SECURITY: Zod validated
    const parsed = wipesQuerySchema.safeParse({
      serverId: searchParams.get('serverId'),
      limit: searchParams.get('limit'),
    })

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { serverId, limit } = parsed.data

    // PERF: Select only needed fields
    const wipes = await prisma.serverWipe.findMany({
      where: serverId ? { gameServerId: serverId } : undefined,
      select: {
        id: true,
        gameServerId: true,
        wipeNumber: true,
        wipedAt: true,
        endedAt: true,
        mapSeed: true,
        mapSize: true,
        createdAt: true,
        gameServer: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            usageEvents: true,
          },
        },
      },
      orderBy: { wipedAt: 'desc' },
      take: limit,
    })

    return NextResponse.json(wipes)
  } catch (error) {
    logger.analytics.error('Failed to fetch wipes', error as Error)
    return NextResponse.json(
      { error: 'Failed to fetch wipes' },
      { status: 500 }
    )
  }
}
