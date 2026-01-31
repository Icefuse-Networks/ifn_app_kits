/**
 * Token Categories API - List and Create
 *
 * GET  /api/token-categories - List all token categories
 * POST /api/token-categories - Create new token category
 *
 * Auth: Session only (admin) - Token auth not allowed for category management
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireSession } from '@/services/api-auth'
import { auditCreate } from '@/services/audit'
import { id } from '@/lib/id'
import { logger } from '@/lib/logger'

/**
 * Create category schema
 */
const createCategorySchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(255).optional(),
  color: z.string().max(20).optional(),
})

/**
 * GET /api/token-categories
 * List all token categories with token counts
 */
export async function GET(request: NextRequest) {
  // SECURITY: Session auth only
  const authResult = await requireSession(request)

  if (!authResult.success) {
    return NextResponse.json(
      { success: false, error: { code: 'AUTH_ERROR', message: authResult.error } },
      { status: authResult.status }
    )
  }

  try {
    // PERF: Select only needed fields with count
    const categories = await prisma.tokenCategory.findMany({
      select: {
        id: true,
        name: true,
        description: true,
        color: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: { tokens: true },
        },
      },
      orderBy: { name: 'asc' },
    })

    // Return raw array for backwards compatibility with existing page
    return NextResponse.json(categories)
  } catch (error) {
    logger.admin.error('Failed to list token categories', error as Error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to list token categories' } },
      { status: 500 }
    )
  }
}

/**
 * POST /api/token-categories
 * Create a new token category
 */
export async function POST(request: NextRequest) {
  // SECURITY: Session auth only
  const authResult = await requireSession(request)

  if (!authResult.success) {
    return NextResponse.json(
      { success: false, error: { code: 'AUTH_ERROR', message: authResult.error } },
      { status: authResult.status }
    )
  }

  try {
    const body = await request.json()

    // SECURITY: Zod validated
    const parsed = createCategorySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Validation failed', details: parsed.error.flatten() } },
        { status: 400 }
      )
    }

    const { name, description, color } = parsed.data

    // Check for duplicate name
    const existing = await prisma.tokenCategory.findFirst({
      where: { name: { equals: name, mode: 'insensitive' } },
      select: { id: true },
    })

    if (existing) {
      return NextResponse.json(
        { success: false, error: { code: 'DUPLICATE_ERROR', message: 'A category with this name already exists' } },
        { status: 409 }
      )
    }

    const category = await prisma.tokenCategory.create({
      data: {
        id: id.tokenCategory(),
        name,
        description: description || null,
        color: color || null,
      },
    })

    // SECURITY: Audit logged
    await auditCreate(
      'token_category',
      category.id,
      authResult.context,
      { name, description, color },
      request
    )

    logger.admin.info('Token category created', {
      categoryId: category.id,
      name: category.name,
      actor: authResult.context.actorId,
    })

    return NextResponse.json({ success: true, data: category }, { status: 201 })
  } catch (error) {
    logger.admin.error('Failed to create token category', error as Error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create token category' } },
      { status: 500 }
    )
  }
}
