/**
 * Kits API - Single Kit Operations
 *
 * GET    /api/kits/[id] - Get kit configuration
 * PUT    /api/kits/[id] - Update kit configuration
 * DELETE /api/kits/[id] - Delete kit configuration
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { authenticateWithScope } from '@/services/api-auth'
import { auditUpdate, auditDelete } from '@/services/audit'
import { kitConfigIdSchema, updateKitConfigSchema } from '@/lib/validations/kit'
import { logger } from '@/lib/logger'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * GET /api/kits/[id]
 * Get a single kit configuration
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const authResult = await authenticateWithScope(request, 'kits:read')

  if (!authResult.success) {
    return NextResponse.json(
      { success: false, error: { code: 'AUTH_ERROR', message: authResult.error } },
      { status: authResult.status }
    )
  }

  try {
    const params = await context.params
    const parsed = kitConfigIdSchema.safeParse({ id: params.id })

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid kit configuration ID' } },
        { status: 400 }
      )
    }

    const config = await prisma.kitConfig.findUnique({
      where: { id: parsed.data.id },
    })

    if (!config) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Kit configuration not found' } },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, data: config })
  } catch (error) {
    logger.admin.error('Failed to get kit configuration', error as Error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to get kit configuration' } },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/kits/[id]
 * Update a kit configuration
 */
export async function PUT(request: NextRequest, context: RouteContext) {
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
    const parsed = updateKitConfigSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Validation failed', details: parsed.error.flatten() } },
        { status: 400 }
      )
    }

    // Get existing config for audit
    const existing = await prisma.kitConfig.findUnique({
      where: { id: idParsed.data.id },
    })

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Kit configuration not found' } },
        { status: 404 }
      )
    }

    const { name, description, kitData, storeData } = parsed.data

    // Build update data
    const updateData: Record<string, unknown> = {}
    if (name !== undefined) updateData.name = name
    if (description !== undefined) updateData.description = description
    if (kitData !== undefined) {
      updateData.kitData = typeof kitData === 'string' ? kitData : JSON.stringify(kitData)
    }
    if (storeData !== undefined) updateData.storeData = storeData

    const config = await prisma.kitConfig.update({
      where: { id: idParsed.data.id },
      data: updateData,
    })

    // SECURITY: Audit logged
    await auditUpdate(
      'kit_config',
      config.id,
      authResult.context,
      { name: existing.name, description: existing.description },
      { name: config.name, description: config.description },
      request
    )

    logger.admin.info('Kit configuration updated', {
      configId: config.id,
      name: config.name,
      actor: authResult.context.actorId,
    })

    return NextResponse.json({ success: true, data: config })
  } catch (error) {
    logger.admin.error('Failed to update kit configuration', error as Error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update kit configuration' } },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/kits/[id]
 * Delete a kit configuration
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  const authResult = await authenticateWithScope(request, 'kits:write')

  if (!authResult.success) {
    return NextResponse.json(
      { success: false, error: { code: 'AUTH_ERROR', message: authResult.error } },
      { status: authResult.status }
    )
  }

  try {
    const params = await context.params
    const parsed = kitConfigIdSchema.safeParse({ id: params.id })

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid kit configuration ID' } },
        { status: 400 }
      )
    }

    // Get existing config for audit
    const existing = await prisma.kitConfig.findUnique({
      where: { id: parsed.data.id },
    })

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Kit configuration not found' } },
        { status: 404 }
      )
    }

    await prisma.kitConfig.delete({
      where: { id: parsed.data.id },
    })

    // SECURITY: Audit logged
    await auditDelete(
      'kit_config',
      parsed.data.id,
      authResult.context,
      { name: existing.name, description: existing.description },
      request
    )

    logger.admin.info('Kit configuration deleted', {
      configId: parsed.data.id,
      name: existing.name,
      actor: authResult.context.actorId,
    })

    return NextResponse.json({ success: true, data: null })
  } catch (error) {
    logger.admin.error('Failed to delete kit configuration', error as Error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete kit configuration' } },
      { status: 500 }
    )
  }
}
