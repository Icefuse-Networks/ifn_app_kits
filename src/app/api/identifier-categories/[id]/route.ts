/**
 * Server Identifier Category API - Single Resource Operations
 *
 * PUT    /api/identifier-categories/[id] - Update a category
 * DELETE /api/identifier-categories/[id] - Delete a category
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireSession } from '@/services/api-auth'
import { auditUpdate, auditDelete } from '@/services/audit'
import {
  serverIdentifierCategoryIdSchema,
  updateServerIdentifierCategorySchema,
} from '@/lib/validations/kit'
import { logger } from '@/lib/logger'

interface RouteContext {
  params: Promise<{ id: string }>
}

/**
 * PUT /api/identifier-categories/[id]
 * Update an identifier category
 */
export async function PUT(request: NextRequest, context: RouteContext) {
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
    const idParsed = serverIdentifierCategoryIdSchema.safeParse({ id })
    if (!idParsed.success) {
      return NextResponse.json(
        { error: 'Invalid category ID format' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const parsed = updateServerIdentifierCategorySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    // Get existing category
    const existing = await prisma.serverIdentifierCategory.findUnique({
      where: { id: idParsed.data.id },
      select: { id: true, name: true, description: true },
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Category not found' },
        { status: 404 }
      )
    }

    // Check for duplicate name if name is being changed
    if (parsed.data.name && parsed.data.name !== existing.name) {
      const duplicate = await prisma.serverIdentifierCategory.findFirst({
        where: {
          name: { equals: parsed.data.name, mode: 'insensitive' },
          id: { not: idParsed.data.id },
        },
        select: { id: true },
      })

      if (duplicate) {
        return NextResponse.json(
          { error: 'A category with this name already exists' },
          { status: 409 }
        )
      }
    }

    const category = await prisma.serverIdentifierCategory.update({
      where: { id: idParsed.data.id },
      data: {
        name: parsed.data.name,
        description: parsed.data.description,
      },
    })

    // SECURITY: Audit logged
    await auditUpdate(
      'server_identifier_category',
      category.id,
      authResult.context,
      { name: existing.name, description: existing.description },
      { name: category.name, description: category.description },
      request
    )

    logger.admin.info('Identifier category updated', {
      categoryId: category.id,
      name: category.name,
      actor: authResult.context.actorId,
    })

    return NextResponse.json(category)
  } catch (error) {
    logger.admin.error('Failed to update identifier category', error as Error)
    return NextResponse.json(
      { error: 'Failed to update identifier category' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/identifier-categories/[id]
 * Delete an identifier category (nullifies identifiers' categoryId)
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
    const parsed = serverIdentifierCategoryIdSchema.safeParse({ id })
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid category ID format' },
        { status: 400 }
      )
    }

    // Get existing category
    const existing = await prisma.serverIdentifierCategory.findUnique({
      where: { id: parsed.data.id },
      select: {
        id: true,
        name: true,
        description: true,
        _count: { select: { identifiers: true } },
      },
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Category not found' },
        { status: 404 }
      )
    }

    // Delete the category (onDelete: SetNull will nullify identifiers)
    await prisma.serverIdentifierCategory.delete({
      where: { id: parsed.data.id },
    })

    // SECURITY: Audit logged
    await auditDelete(
      'server_identifier_category',
      existing.id,
      authResult.context,
      { name: existing.name, identifierCount: existing._count.identifiers },
      request
    )

    logger.admin.info('Identifier category deleted', {
      categoryId: existing.id,
      name: existing.name,
      identifiersAffected: existing._count.identifiers,
      actor: authResult.context.actorId,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.admin.error('Failed to delete identifier category', error as Error)
    return NextResponse.json(
      { error: 'Failed to delete identifier category' },
      { status: 500 }
    )
  }
}
