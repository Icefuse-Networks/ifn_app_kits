/**
 * Server Identifier API - Single Resource Operations
 *
 * DELETE /api/identifiers/[id] - Delete a server identifier
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireSession } from '@/services/api-auth'
import { auditDelete } from '@/services/audit'
import { serverIdentifierIdSchema } from '@/lib/validations/kit'
import { logger } from '@/lib/logger'

interface RouteContext {
  params: Promise<{ id: string }>
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
