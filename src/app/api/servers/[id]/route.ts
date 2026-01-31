/**
 * Servers API - Single Server Operations
 *
 * GET    /api/servers/[id] - Get game server
 * PUT    /api/servers/[id] - Update game server
 * DELETE /api/servers/[id] - Delete game server
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { authenticateWithScope } from '@/services/api-auth'
import { auditUpdate, auditDelete } from '@/services/audit'
import { gameServerIdSchema, updateGameServerSchema } from '@/lib/validations/kit'
import { logger } from '@/lib/logger'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * GET /api/servers/[id]
 * Get a single game server
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const authResult = await authenticateWithScope(request, 'servers:read')

  if (!authResult.success) {
    return NextResponse.json(
      { success: false, error: { code: 'AUTH_ERROR', message: authResult.error } },
      { status: authResult.status }
    )
  }

  try {
    const params = await context.params
    const parsed = gameServerIdSchema.safeParse({ id: params.id })

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid server ID' } },
        { status: 400 }
      )
    }

    const server = await prisma.gameServer.findUnique({
      where: { id: parsed.data.id },
      include: {
        kitConfig: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    if (!server) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Game server not found' } },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, data: server })
  } catch (error) {
    logger.admin.error('Failed to get game server', error as Error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to get game server' } },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/servers/[id]
 * Update a game server
 */
export async function PUT(request: NextRequest, context: RouteContext) {
  const authResult = await authenticateWithScope(request, 'servers:write')

  if (!authResult.success) {
    return NextResponse.json(
      { success: false, error: { code: 'AUTH_ERROR', message: authResult.error } },
      { status: authResult.status }
    )
  }

  try {
    const params = await context.params
    const idParsed = gameServerIdSchema.safeParse({ id: params.id })

    if (!idParsed.success) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid server ID' } },
        { status: 400 }
      )
    }

    const body = await request.json()

    // SECURITY: Zod validated
    const parsed = updateGameServerSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Validation failed', details: parsed.error.flatten() } },
        { status: 400 }
      )
    }

    // Get existing server for audit
    const existing = await prisma.gameServer.findUnique({
      where: { id: idParsed.data.id },
    })

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Game server not found' } },
        { status: 404 }
      )
    }

    const server = await prisma.gameServer.update({
      where: { id: idParsed.data.id },
      data: parsed.data,
    })

    // SECURITY: Audit logged
    await auditUpdate(
      'game_server',
      String(server.id),
      authResult.context,
      { name: existing.name, ip: existing.ip, port: existing.port },
      { name: server.name, ip: server.ip, port: server.port },
      request
    )

    logger.admin.info('Game server updated', {
      serverId: server.id,
      name: server.name,
      actor: authResult.context.actorId,
    })

    return NextResponse.json({ success: true, data: server })
  } catch (error) {
    logger.admin.error('Failed to update game server', error as Error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update game server' } },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/servers/[id]
 * Delete a game server
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  const authResult = await authenticateWithScope(request, 'servers:write')

  if (!authResult.success) {
    return NextResponse.json(
      { success: false, error: { code: 'AUTH_ERROR', message: authResult.error } },
      { status: authResult.status }
    )
  }

  try {
    const params = await context.params
    const parsed = gameServerIdSchema.safeParse({ id: params.id })

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid server ID' } },
        { status: 400 }
      )
    }

    // Get existing server for audit
    const existing = await prisma.gameServer.findUnique({
      where: { id: parsed.data.id },
    })

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Game server not found' } },
        { status: 404 }
      )
    }

    await prisma.gameServer.delete({
      where: { id: parsed.data.id },
    })

    // SECURITY: Audit logged
    await auditDelete(
      'game_server',
      String(parsed.data.id),
      authResult.context,
      { name: existing.name, ip: existing.ip, port: existing.port },
      request
    )

    logger.admin.info('Game server deleted', {
      serverId: parsed.data.id,
      name: existing.name,
      actor: authResult.context.actorId,
    })

    return NextResponse.json({ success: true, data: null })
  } catch (error) {
    logger.admin.error('Failed to delete game server', error as Error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete game server' } },
      { status: 500 }
    )
  }
}
