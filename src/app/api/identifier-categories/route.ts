/**
 * Server Identifier Categories API - List and Create
 *
 * GET  /api/identifier-categories - List all identifier categories
 * POST /api/identifier-categories - Create new identifier category
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireSession } from '@/services/api-auth'
import { auditCreate } from '@/services/audit'
import { createServerIdentifierCategorySchema } from '@/lib/validations/kit'
import { id } from '@/lib/id'
import { logger } from '@/lib/logger'

/**
 * GET /api/identifier-categories
 * List all identifier categories with identifier counts
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
    // PERF: Select only needed fields with count
    const categories = await prisma.serverIdentifierCategory.findMany({
      select: {
        id: true,
        name: true,
        description: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: { identifiers: true },
        },
      },
      orderBy: { name: 'asc' },
    })

    return NextResponse.json(categories)
  } catch (error) {
    logger.admin.error('Failed to list identifier categories', error as Error)
    return NextResponse.json(
      { error: 'Failed to list identifier categories' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/identifier-categories
 * Create a new identifier category
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
    const parsed = createServerIdentifierCategorySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    // Check for duplicate name
    const existing = await prisma.serverIdentifierCategory.findFirst({
      where: { name: { equals: parsed.data.name, mode: 'insensitive' } },
      select: { id: true },
    })

    if (existing) {
      return NextResponse.json(
        { error: 'A category with this name already exists' },
        { status: 409 }
      )
    }

    const category = await prisma.serverIdentifierCategory.create({
      data: {
        id: id.serverIdentifierCategory(),
        name: parsed.data.name,
        description: parsed.data.description || null,
      },
    })

    // SECURITY: Audit logged
    await auditCreate(
      'server_identifier_category',
      category.id,
      authResult.context,
      { name: category.name, description: category.description },
      request
    )

    logger.admin.info('Identifier category created', {
      categoryId: category.id,
      name: category.name,
      actor: authResult.context.actorId,
    })

    return NextResponse.json(category, { status: 201 })
  } catch (error) {
    logger.admin.error('Failed to create identifier category', error as Error)
    return NextResponse.json(
      { error: 'Failed to create identifier category' },
      { status: 500 }
    )
  }
}
