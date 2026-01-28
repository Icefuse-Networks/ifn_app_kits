/**
 * Game Servers API - List and Create
 *
 * GET  /api/v1/game-servers - List all game servers
 * POST /api/v1/game-servers - Create new game server
 *
 * Auth: Token (servers:read/write) OR Session (admin)
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireServersRead, requireServersWrite } from '@/services/api-auth'
import { auditCreate } from '@/services/audit'
import { createGameServerSchema } from '@/lib/validations/kit'
import { logger } from '@/lib/logger'

/**
 * GET /api/v1/game-servers
 *
 * List all game servers.
 */
export async function GET(request: NextRequest) {
  // SECURITY: Auth check with scope
  const authResult = await requireServersRead(request)

  if (!authResult.success) {
    return NextResponse.json(
      { error: authResult.error },
      { status: authResult.status }
    )
  }

  try {
    // PERF: Select only needed fields, include kit config name
    const servers = await prisma.gameServer.findMany({
      select: {
        id: true,
        categoryID: true,
        name: true,
        ip: true,
        port: true,
        imageUrl: true,
        iconUrl: true,
        wipeConfig: true,
        kitConfigId: true,
        kitConfig: {
          select: {
            id: true,
            name: true,
          },
        },
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { name: 'asc' },
    })

    return NextResponse.json(servers)
  } catch (error) {
    logger.kits.error('Failed to fetch game servers', error as Error)
    return NextResponse.json(
      { error: 'Failed to fetch game servers' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/v1/game-servers
 *
 * Create a new game server.
 */
export async function POST(request: NextRequest) {
  // SECURITY: Auth check with write scope
  const authResult = await requireServersWrite(request)

  if (!authResult.success) {
    return NextResponse.json(
      { error: authResult.error },
      { status: authResult.status }
    )
  }

  try {
    const body = await request.json()

    // SECURITY: Zod validated
    const parsed = createGameServerSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const server = await prisma.gameServer.create({
      data: parsed.data,
    })

    // SECURITY: Audit logged
    await auditCreate(
      'game_server',
      server.id.toString(),
      authResult.context,
      { name: server.name, ip: server.ip, port: server.port },
      request
    )

    logger.kits.info('Game server created', {
      serverId: server.id,
      name: server.name,
      actor: authResult.context.actorId,
    })

    return NextResponse.json(server, { status: 201 })
  } catch (error: unknown) {
    const prismaError = error as { code?: string }

    if (prismaError.code === 'P2003') {
      return NextResponse.json(
        { error: 'Invalid kit config ID' },
        { status: 400 }
      )
    }

    logger.kits.error('Failed to create game server', error as Error)
    return NextResponse.json(
      { error: 'Failed to create game server' },
      { status: 500 }
    )
  }
}
