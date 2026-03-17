/**
 * Holding Server Session API
 *
 * POST  /api/servers/holding - Wiping server notifies it's going down (creates session)
 * GET   /api/servers/holding - Holding server polls for active sessions targeting it
 * PATCH /api/servers/holding - Wiping server signals it's back online (completes session)
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { authenticateWithScope } from '@/services/api-auth'
import { id } from '@/lib/id'
import { logger } from '@/lib/logger'

const createSessionSchema = z.object({
  sourceServerId: z.string().min(1).max(60),
  holdingServerId: z.string().min(1).max(60),
  playerCount: z.number().min(0).max(10000).default(0),
  playerSteamIds: z.array(z.string().min(1).max(20)).max(500).optional(),
})

const pollSessionSchema = z.object({
  holdingServerId: z.string().min(1).max(60),
})

const completeSessionSchema = z.object({
  sourceServerId: z.string().min(1).max(60),
})

/**
 * POST - Wiping server creates a holding session before redirecting players
 */
export async function POST(request: NextRequest) {
  const authResult = await authenticateWithScope(request, 'redirect:write')
  if (!authResult.success) {
    return NextResponse.json(
      { success: false, error: { code: 'AUTH_ERROR', message: authResult.error } },
      { status: authResult.status }
    )
  }

  try {
    const body = await request.json()
    const parsed = createSessionSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Validation failed', details: parsed.error.flatten() } },
        { status: 400 }
      )
    }

    const { sourceServerId, holdingServerId, playerCount, playerSteamIds } = parsed.data

    const sourceServer = await prisma.serverIdentifier.findFirst({
      where: { hashedId: sourceServerId },
      select: { id: true, name: true, hashedId: true, ip: true, port: true },
    })

    if (!sourceServer) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Source server not found' } },
        { status: 404 }
      )
    }

    const holdingServer = await prisma.serverIdentifier.findFirst({
      where: { hashedId: holdingServerId },
      select: { id: true, hashedId: true },
    })

    if (!holdingServer) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Holding server not found' } },
        { status: 404 }
      )
    }

    // Complete any existing active sessions for this source server (idempotent)
    await prisma.holdingSession.updateMany({
      where: {
        sourceServerId,
        status: 'active',
      },
      data: {
        status: 'superseded',
        completedAt: new Date(),
      },
    })

    const session = await prisma.holdingSession.create({
      data: {
        id: id.holdingSession(),
        sourceServerId,
        holdingServerId,
        sourceServerName: sourceServer.name,
        playerCount,
        playerSteamIds: playerSteamIds?.length ? playerSteamIds.join(',') : null,
        status: 'active',
      },
    })

    logger.admin.info('Holding session created', {
      sessionId: session.id,
      sourceServerId,
      holdingServerId,
      playerCount,
    })

    return NextResponse.json({
      success: true,
      data: {
        sessionId: session.id,
        sourceServerId,
        holdingServerId,
        sourceServerName: sourceServer.name,
        startedAt: session.startedAt.toISOString(),
      },
    }, { status: 201 })
  } catch (error) {
    logger.admin.error('Failed to create holding session', error as Error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create holding session' } },
      { status: 500 }
    )
  }
}

/**
 * GET - Holding server polls for active sessions where players are waiting
 * Returns all active holding sessions targeting this holding server
 */
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
    const holdingServerId = searchParams.get('holdingServerId')

    if (!holdingServerId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'holdingServerId required' } },
        { status: 400 }
      )
    }

    const parsed = pollSessionSchema.safeParse({ holdingServerId })
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid holdingServerId' } },
        { status: 400 }
      )
    }

    // Auto-expire sessions older than 20 minutes
    const expiryThreshold = new Date(Date.now() - 20 * 60 * 1000)
    await prisma.holdingSession.updateMany({
      where: {
        holdingServerId: parsed.data.holdingServerId,
        status: 'active',
        startedAt: { lt: expiryThreshold },
      },
      data: {
        status: 'expired',
        completedAt: new Date(),
      },
    })

    const sessions = await prisma.holdingSession.findMany({
      where: {
        holdingServerId: parsed.data.holdingServerId,
        status: 'active',
      },
      orderBy: { startedAt: 'asc' },
    })

    if (sessions.length === 0) {
      return NextResponse.json({ success: true, data: { sessions: [] } })
    }

    // Resolve source server connection info for return redirects
    const sourceServerIds = [...new Set(sessions.map(s => s.sourceServerId))]
    const sourceServers = await prisma.serverIdentifier.findMany({
      where: { hashedId: { in: sourceServerIds } },
      select: { hashedId: true, name: true, ip: true, port: true },
    })
    const serverMap = new Map(sourceServers.map(s => [s.hashedId, s]))

    const data = sessions.map(s => {
      const source = serverMap.get(s.sourceServerId)
      return {
        sessionId: s.id,
        sourceServerId: s.sourceServerId,
        sourceServerName: s.sourceServerName,
        sourceServerIp: source?.ip || null,
        sourceServerPort: source?.port || null,
        playerCount: s.playerCount,
        playerSteamIds: s.playerSteamIds ? s.playerSteamIds.split(',') : [],
        startedAt: s.startedAt.toISOString(),
        startedAtMs: s.startedAt.getTime(),
      }
    })

    return NextResponse.json({ success: true, data: { sessions: data } })
  } catch (error) {
    logger.admin.error('Failed to poll holding sessions', error as Error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to poll holding sessions' } },
      { status: 500 }
    )
  }
}

/**
 * PATCH - Wiping server signals it's back online after wipe (OnNewSave)
 * Marks all active sessions for this source server as 'completed'
 */
export async function PATCH(request: NextRequest) {
  const authResult = await authenticateWithScope(request, 'redirect:write')
  if (!authResult.success) {
    return NextResponse.json(
      { success: false, error: { code: 'AUTH_ERROR', message: authResult.error } },
      { status: authResult.status }
    )
  }

  try {
    const body = await request.json()
    const parsed = completeSessionSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Validation failed', details: parsed.error.flatten() } },
        { status: 400 }
      )
    }

    const { sourceServerId } = parsed.data

    const result = await prisma.holdingSession.updateMany({
      where: {
        sourceServerId,
        status: 'active',
      },
      data: {
        status: 'completed',
        completedAt: new Date(),
      },
    })

    logger.admin.info('Holding sessions completed', {
      sourceServerId,
      count: result.count,
    })

    return NextResponse.json({
      success: true,
      data: { completed: result.count },
    })
  } catch (error) {
    logger.admin.error('Failed to complete holding session', error as Error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to complete holding session' } },
      { status: 500 }
    )
  }
}
