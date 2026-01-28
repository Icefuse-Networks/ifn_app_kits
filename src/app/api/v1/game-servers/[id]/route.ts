/**
 * Game Server API - Get, Update, Delete by ID
 *
 * GET    /api/v1/game-servers/[id] - Get game server
 * PATCH  /api/v1/game-servers/[id] - Update game server
 * DELETE /api/v1/game-servers/[id] - Delete game server
 *
 * Auth: Token (servers:read/write) OR Session (admin)
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireServersRead, requireServersWrite } from '@/services/api-auth'
import { auditUpdate, auditDelete } from '@/services/audit'
import { gameServerIdSchema, updateGameServerSchema } from '@/lib/validations/kit'
import { logger } from '@/lib/logger'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /api/v1/game-servers/[id]
 *
 * Get a specific game server by ID.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  // SECURITY: Auth check with scope
  const authResult = await requireServersRead(request)

  if (!authResult.success) {
    return NextResponse.json(
      { error: authResult.error },
      { status: authResult.status }
    )
  }

  try {
    const { id: idStr } = await params

    // SECURITY: Zod validated
    const parsed = gameServerIdSchema.safeParse({ id: idStr })
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid server ID' }, { status: 400 })
    }

    const server = await prisma.gameServer.findUnique({
      where: { id: parsed.data.id },
      include: {
        kitConfig: {
          select: { id: true, name: true, description: true },
        },
      },
    })

    if (!server) {
      return NextResponse.json({ error: 'Game server not found' }, { status: 404 })
    }

    return NextResponse.json(server)
  } catch (error) {
    logger.kits.error('Failed to fetch game server', error as Error)
    return NextResponse.json(
      { error: 'Failed to fetch game server' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/v1/game-servers/[id]
 *
 * Update a game server.
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  // SECURITY: Auth check with write scope
  const authResult = await requireServersWrite(request)

  if (!authResult.success) {
    return NextResponse.json(
      { error: authResult.error },
      { status: authResult.status }
    )
  }

  try {
    const { id: idStr } = await params

    // SECURITY: Zod validated
    const idParsed = gameServerIdSchema.safeParse({ id: idStr })
    if (!idParsed.success) {
      return NextResponse.json({ error: 'Invalid server ID' }, { status: 400 })
    }

    const body = await request.json()
    const bodyParsed = updateGameServerSchema.safeParse(body)
    if (!bodyParsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: bodyParsed.error.flatten() },
        { status: 400 }
      )
    }

    // Get old values for audit
    const oldServer = await prisma.gameServer.findUnique({
      where: { id: idParsed.data.id },
      select: { name: true, ip: true, port: true, kitConfigId: true },
    })

    if (!oldServer) {
      return NextResponse.json({ error: 'Game server not found' }, { status: 404 })
    }

    const server = await prisma.gameServer.update({
      where: { id: idParsed.data.id },
      data: bodyParsed.data,
    })

    // SECURITY: Audit logged
    await auditUpdate(
      'game_server',
      server.id.toString(),
      authResult.context,
      oldServer,
      { name: server.name, ip: server.ip, port: server.port, kitConfigId: server.kitConfigId },
      request
    )

    logger.kits.info('Game server updated', {
      serverId: server.id,
      name: server.name,
      actor: authResult.context.actorId,
    })

    return NextResponse.json(server)
  } catch (error: unknown) {
    const prismaError = error as { code?: string }

    if (prismaError.code === 'P2025') {
      return NextResponse.json({ error: 'Game server not found' }, { status: 404 })
    }
    if (prismaError.code === 'P2003') {
      return NextResponse.json(
        { error: 'Invalid kit config ID' },
        { status: 400 }
      )
    }

    logger.kits.error('Failed to update game server', error as Error)
    return NextResponse.json(
      { error: 'Failed to update game server' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/v1/game-servers/[id]
 *
 * Delete a game server.
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  // SECURITY: Auth check with write scope
  const authResult = await requireServersWrite(request)

  if (!authResult.success) {
    return NextResponse.json(
      { error: authResult.error },
      { status: authResult.status }
    )
  }

  try {
    const { id: idStr } = await params

    // SECURITY: Zod validated
    const parsed = gameServerIdSchema.safeParse({ id: idStr })
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid server ID' }, { status: 400 })
    }

    // Get old values for audit
    const oldServer = await prisma.gameServer.findUnique({
      where: { id: parsed.data.id },
      select: { name: true, ip: true, port: true },
    })

    if (!oldServer) {
      return NextResponse.json({ error: 'Game server not found' }, { status: 404 })
    }

    await prisma.gameServer.delete({
      where: { id: parsed.data.id },
    })

    // SECURITY: Audit logged
    await auditDelete(
      'game_server',
      parsed.data.id.toString(),
      authResult.context,
      oldServer,
      request
    )

    logger.kits.info('Game server deleted', {
      serverId: parsed.data.id,
      name: oldServer.name,
      actor: authResult.context.actorId,
    })

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const prismaError = error as { code?: string }

    if (prismaError.code === 'P2025') {
      return NextResponse.json({ error: 'Game server not found' }, { status: 404 })
    }

    logger.kits.error('Failed to delete game server', error as Error)
    return NextResponse.json(
      { error: 'Failed to delete game server' },
      { status: 500 }
    )
  }
}
