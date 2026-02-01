/**
 * Server Identifiers API - List and Create
 *
 * GET  /api/identifiers - List all server identifiers
 * POST /api/identifiers - Create new server identifier
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireSession } from '@/services/api-auth'
import { auditCreate } from '@/services/audit'
import { createServerIdentifierSchema } from '@/lib/validations/kit'
import { id } from '@/lib/id'
import { logger } from '@/lib/logger'

/**
 * GET /api/identifiers
 * List all server identifiers with usage counts
 */
export async function GET(request: NextRequest) {
  const authResult = await requireSession(request)

  if (!authResult.success) {
    return NextResponse.json(
      { error: authResult.error },
      { status: authResult.status }
    )
  }

  try {
    const identifiers = await prisma.serverIdentifier.findMany({
      select: {
        id: true,
        name: true,
        hashedId: true,
        description: true,
        ip: true,
        port: true,
        connectEndpoint: true,
        categoryId: true,
        playerData: true,
        playerCount: true,
        lastPlayerUpdate: true,
        createdAt: true,
        updatedAt: true,
        category: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: { usageEvents: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(identifiers)
  } catch (error) {
    logger.admin.error('Failed to list server identifiers', error as Error)
    return NextResponse.json(
      { error: 'Failed to list server identifiers' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/identifiers
 * Create a new server identifier
 */
export async function POST(request: NextRequest) {
  const authResult = await requireSession(request)

  if (!authResult.success) {
    return NextResponse.json(
      { error: authResult.error },
      { status: authResult.status }
    )
  }

  try {
    const body = await request.json()

    // SECURITY: Zod validated
    const parsed = createServerIdentifierSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    // Check for duplicate name
    const existing = await prisma.serverIdentifier.findFirst({
      where: { name: parsed.data.name },
      select: { id: true },
    })

    if (existing) {
      return NextResponse.json(
        { error: 'A server identifier with this name already exists' },
        { status: 409 }
      )
    }

    const identifier = await prisma.serverIdentifier.create({
      data: {
        id: id.serverIdentifier(),
        name: parsed.data.name,
        hashedId: id.identifierHash(),
        description: parsed.data.description || null,
      },
    })

    // SECURITY: Audit logged
    await auditCreate(
      'server_identifier',
      identifier.id,
      authResult.context,
      { name: identifier.name, hashedId: identifier.hashedId },
      request
    )

    logger.admin.info('Server identifier created', {
      identifierId: identifier.id,
      name: identifier.name,
      actor: authResult.context.actorId,
    })

    return NextResponse.json(identifier, { status: 201 })
  } catch (error) {
    logger.admin.error('Failed to create server identifier', error as Error)
    return NextResponse.json(
      { error: 'Failed to create server identifier' },
      { status: 500 }
    )
  }
}
