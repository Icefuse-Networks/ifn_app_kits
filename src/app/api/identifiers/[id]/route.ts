import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireSession } from '@/services/api-auth'
import { auditUpdate, auditDelete } from '@/services/audit'
import {
  serverIdentifierIdSchema,
  updateServerIdentifierSchema,
} from '@/lib/validations/kit'
import { logger } from '@/lib/logger'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, context: RouteContext) {
  const authResult = await requireSession(request)
  if (!authResult.success) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  try {
    const { id } = await context.params
    const parsed = serverIdentifierIdSchema.safeParse({ id })
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid identifier ID format' }, { status: 400 })
    }

    const identifier = await prisma.serverIdentifier.findUnique({
      where: { id: parsed.data.id },
      select: {
        id: true,
        name: true,
        hashedId: true,
        description: true,
        ip: true,
        port: true,
        connectEndpoint: true,
        playerData: true,
        playerCount: true,
        lastPlayerUpdate: true,
        categoryId: true,
        createdAt: true,
        updatedAt: true,
        category: { select: { id: true, name: true } },
      },
    })

    if (!identifier) {
      return NextResponse.json({ error: 'Server identifier not found' }, { status: 404 })
    }

    return NextResponse.json(identifier)
  } catch (error) {
    logger.admin.error('Failed to fetch server identifier', error as Error)
    return NextResponse.json({ error: 'Failed to fetch server identifier' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const authResult = await requireSession(request)

  if (!authResult.success) {
    return NextResponse.json(
      { error: authResult.error },
      { status: authResult.status }
    )
  }

  try {
    const { id } = await context.params

    // SECURITY: Zod validated
    const idParsed = serverIdentifierIdSchema.safeParse({ id })
    if (!idParsed.success) {
      return NextResponse.json(
        { error: 'Invalid identifier ID format' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const parsed = updateServerIdentifierSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    // Get existing identifier
    const existing = await prisma.serverIdentifier.findUnique({
      where: { id: idParsed.data.id },
      select: {
        id: true,
        name: true,
        description: true,
        categoryId: true,
      },
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Server identifier not found' },
        { status: 404 }
      )
    }

    // Check for duplicate name if name is being changed
    if (parsed.data.name && parsed.data.name !== existing.name) {
      const duplicate = await prisma.serverIdentifier.findFirst({
        where: {
          name: parsed.data.name,
          id: { not: idParsed.data.id },
        },
        select: { id: true },
      })

      if (duplicate) {
        return NextResponse.json(
          { error: 'A server identifier with this name already exists' },
          { status: 409 }
        )
      }
    }

    // Validate categoryId exists if provided
    if (parsed.data.categoryId) {
      const categoryExists = await prisma.serverIdentifierCategory.findUnique({
        where: { id: parsed.data.categoryId },
        select: { id: true },
      })

      if (!categoryExists) {
        return NextResponse.json(
          { error: 'Category not found' },
          { status: 400 }
        )
      }
    }

    const identifier = await prisma.serverIdentifier.update({
      where: { id: idParsed.data.id },
      data: {
        name: parsed.data.name,
        description: parsed.data.description,
        categoryId: parsed.data.categoryId,
      },
      select: {
        id: true,
        name: true,
        hashedId: true,
        description: true,
        ip: true,
        port: true,
        connectEndpoint: true,
        categoryId: true,
        createdAt: true,
        updatedAt: true,
        category: {
          select: { id: true, name: true },
        },
        _count: {
          select: { usageEvents: true },
        },
      },
    })

    // SECURITY: Audit logged
    await auditUpdate(
      'server_identifier',
      identifier.id,
      authResult.context,
      {
        name: existing.name,
        description: existing.description,
        categoryId: existing.categoryId,
      },
      {
        name: identifier.name,
        description: identifier.description,
        categoryId: identifier.categoryId,
      },
      request
    )

    logger.admin.info('Server identifier updated', {
      identifierId: identifier.id,
      name: identifier.name,
      categoryId: identifier.categoryId,
      actor: authResult.context.actorId,
    })

    return NextResponse.json(identifier)
  } catch (error) {
    logger.admin.error('Failed to update server identifier', error as Error)
    return NextResponse.json(
      { error: 'Failed to update server identifier' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/identifiers/[id]
 * Delete a server identifier
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  const authResult = await requireSession(request)

  if (!authResult.success) {
    return NextResponse.json(
      { error: authResult.error },
      { status: authResult.status }
    )
  }

  try {
    const { id } = await context.params

    // SECURITY: Zod validated
    const parsed = serverIdentifierIdSchema.safeParse({ id })
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid identifier ID format' },
        { status: 400 }
      )
    }

    // Get existing identifier for audit log
    const existing = await prisma.serverIdentifier.findUnique({
      where: { id: parsed.data.id },
      select: {
        id: true,
        name: true,
        hashedId: true,
        description: true,
        _count: {
          select: { usageEvents: true },
        },
      },
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Server identifier not found' },
        { status: 404 }
      )
    }

    // Delete the identifier (cascade will handle usage events)
    await prisma.serverIdentifier.delete({
      where: { id: parsed.data.id },
    })

    // SECURITY: Audit logged
    await auditDelete(
      'server_identifier',
      existing.id,
      authResult.context,
      { name: existing.name, hashedId: existing.hashedId },
      request
    )

    logger.admin.info('Server identifier deleted', {
      identifierId: existing.id,
      name: existing.name,
      actor: authResult.context.actorId,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.admin.error('Failed to delete server identifier', error as Error)
    return NextResponse.json(
      { error: 'Failed to delete server identifier' },
      { status: 500 }
    )
  }
}
