/**
 * Clone Kit Config
 *
 * POST /api/kits/[id]/clone - Clone a kit configuration under a new name
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { authenticateWithScope } from '@/services/api-auth'
import { auditCreate } from '@/services/audit'
import { kitConfigIdSchema, cloneKitConfigSchema } from '@/lib/validations/kit'
import { id } from '@/lib/id'
import { logger } from '@/lib/logger'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * POST /api/kits/[id]/clone
 * Clone a kit configuration with a new name
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const authResult = await authenticateWithScope(request, 'kits:write')

  if (!authResult.success) {
    return NextResponse.json(
      { success: false, error: { code: 'AUTH_ERROR', message: authResult.error } },
      { status: authResult.status }
    )
  }

  try {
    const params = await context.params
    const idParsed = kitConfigIdSchema.safeParse({ id: params.id })

    if (!idParsed.success) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid kit configuration ID' } },
        { status: 400 }
      )
    }

    const body = await request.json()

    // SECURITY: Zod validated
    const parsed = cloneKitConfigSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Validation failed', details: parsed.error.flatten() } },
        { status: 400 }
      )
    }

    const { name, description } = parsed.data

    const source = await prisma.kitConfig.findUnique({
      where: { id: idParsed.data.id },
    })

    if (!source) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Kit configuration not found' } },
        { status: 404 }
      )
    }

    const cloned = await prisma.kitConfig.create({
      data: {
        id: id.category(),
        name,
        description: description ?? null,
        kitData: source.kitData,
        storeData: source.storeData,
      },
    })

    // SECURITY: Audit logged
    await auditCreate(
      'kit_config',
      cloned.id,
      authResult.context,
      { name, description, clonedFrom: source.id },
      request
    )

    logger.admin.info('Kit configuration cloned', {
      sourceId: source.id,
      clonedId: cloned.id,
      name: cloned.name,
      actor: authResult.context.actorId,
    })

    return NextResponse.json({ success: true, data: cloned }, { status: 201 })
  } catch (error) {
    logger.admin.error('Failed to clone kit configuration', error as Error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to clone kit configuration' } },
      { status: 500 }
    )
  }
}
