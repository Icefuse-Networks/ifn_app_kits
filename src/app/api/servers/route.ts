/**
 * Servers API - List and Create
 *
 * GET  /api/servers - List all game servers
 * POST /api/servers - Create new game server
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { authenticateWithScope } from '@/services/api-auth'
import { auditCreate } from '@/services/audit'
import { createGameServerSchema } from '@/lib/validations/kit'
import { logger } from '@/lib/logger'

/**
 * GET /api/servers
 * List all game servers
 */
export async function GET(request: NextRequest) {
  const authResult = await authenticateWithScope(request, 'servers:read')

  if (!authResult.success) {
    return NextResponse.json(
      { success: false, error: { code: 'AUTH_ERROR', message: authResult.error } },
      { status: authResult.status }
    )
  }

  try {
    // PERF: Select only needed fields
    const servers = await prisma.gameServer.findMany({
      select: {
        id: true,
        categoryID: true,
        name: true,
        ip: true,
        port: true,
        imageUrl: true,
        iconUrl: true,
        kitConfigId: true,
        createdAt: true,
        updatedAt: true,
        kitConfig: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    })

    return NextResponse.json({ success: true, data: servers })
  } catch (error) {
    logger.admin.error('Failed to list game servers', error as Error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to list game servers' } },
      { status: 500 }
    )
  }
}

/**
 * POST /api/servers
 * Create a new game server
 */
export async function POST(request: NextRequest) {
  const authResult = await authenticateWithScope(request, 'servers:write')

  if (!authResult.success) {
    return NextResponse.json(
      { success: false, error: { code: 'AUTH_ERROR', message: authResult.error } },
      { status: authResult.status }
    )
  }

  try {
    const body = await request.json()

    // SECURITY: Zod validated
    const parsed = createGameServerSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Validation failed', details: parsed.error.flatten() } },
        { status: 400 }
      )
    }

    const server = await prisma.gameServer.create({
      data: {
        categoryID: parsed.data.categoryID,
        name: parsed.data.name,
        ip: parsed.data.ip,
        port: parsed.data.port,
        imageUrl: parsed.data.imageUrl,
        iconUrl: parsed.data.iconUrl,
        wipeConfig: parsed.data.wipeConfig || null,
        botToken: parsed.data.botToken || null,
        kitConfigId: parsed.data.kitConfigId || null,
      },
    })

    // SECURITY: Audit logged
    await auditCreate(
      'game_server',
      String(server.id),
      authResult.context,
      { name: server.name, ip: server.ip, port: server.port },
      request
    )

    logger.admin.info('Game server created', {
      serverId: server.id,
      name: server.name,
      actor: authResult.context.actorId,
    })

    return NextResponse.json({ success: true, data: server }, { status: 201 })
  } catch (error) {
    logger.admin.error('Failed to create game server', error as Error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create game server' } },
      { status: 500 }
    )
  }
}
