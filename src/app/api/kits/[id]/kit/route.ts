/**
 * Per-Kit Operations within a Config
 *
 * PATCH  /api/kits/[id]/kit - Update specific kit properties by name
 * POST   /api/kits/[id]/kit - Add a new kit to a config
 * DELETE /api/kits/[id]/kit - Remove a kit from a config
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { authenticateWithScope } from '@/services/api-auth'
import { auditCreate, auditUpdate, auditDelete } from '@/services/audit'
import {
  kitConfigIdSchema,
  kitSchema,
  patchKitSchema,
  addKitSchema,
  deleteKitSchema,
} from '@/lib/validations/kit'
import { logger } from '@/lib/logger'
import { parseKitData, stringifyKitData, addKit, removeKit } from '@/lib/utils/kit'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * PATCH /api/kits/[id]/kit
 * Update specific properties of a named kit within a config
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
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
    const parsed = patchKitSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Validation failed', details: parsed.error.flatten() } },
        { status: 400 }
      )
    }

    const { kitName, updates } = parsed.data

    const existing = await prisma.kitConfig.findUnique({
      where: { id: idParsed.data.id },
    })

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Kit configuration not found' } },
        { status: 404 }
      )
    }

    const kitsData = parseKitData(existing.kitData)

    if (!kitsData._kits[kitName]) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: `Kit "${kitName}" not found in this configuration` } },
        { status: 404 }
      )
    }

    const existingKit = kitsData._kits[kitName]

    // Merge updates onto existing kit — only the supplied update fields are
    // validated (via patchKitSchema above). We do not re-validate untouched
    // fields because existing plugin-synced data may use alternate conventions
    // (e.g. Condition stored as 0–100 instead of 0–1).
    const mergedKit = { ...existingKit, ...updates }

    const updatedKitsData = {
      ...kitsData,
      _kits: { ...kitsData._kits, [kitName]: mergedKit },
    }

    const config = await prisma.kitConfig.update({
      where: { id: idParsed.data.id },
      data: { kitData: stringifyKitData(updatedKitsData) },
    })

    // SECURITY: Audit logged
    await auditUpdate(
      'kit',
      `${idParsed.data.id}:${kitName}`,
      authResult.context,
      { kitName, ...existingKit },
      { kitName, ...mergedKit },
      request
    )

    logger.admin.info('Kit updated within config', {
      configId: config.id,
      kitName,
      actor: authResult.context.actorId,
    })

    return NextResponse.json({ success: true, data: { kitName, kit: mergedKit } })
  } catch (error) {
    logger.admin.error('Failed to update kit', error as Error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update kit' } },
      { status: 500 }
    )
  }
}

/**
 * POST /api/kits/[id]/kit
 * Add a new kit to a config
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
    const parsed = addKitSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Validation failed', details: parsed.error.flatten() } },
        { status: 400 }
      )
    }

    const { kitName, kit } = parsed.data

    const existing = await prisma.kitConfig.findUnique({
      where: { id: idParsed.data.id },
    })

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Kit configuration not found' } },
        { status: 404 }
      )
    }

    const kitsData = parseKitData(existing.kitData)

    if (kitsData._kits[kitName]) {
      return NextResponse.json(
        { success: false, error: { code: 'CONFLICT', message: `Kit "${kitName}" already exists in this configuration` } },
        { status: 409 }
      )
    }

    const updatedKitsData = addKit(kitsData, kitName, kit)

    const config = await prisma.kitConfig.update({
      where: { id: idParsed.data.id },
      data: { kitData: stringifyKitData(updatedKitsData) },
    })

    // SECURITY: Audit logged
    await auditCreate(
      'kit',
      `${idParsed.data.id}:${kitName}`,
      authResult.context,
      { kitName, configId: idParsed.data.id, ...kit },
      request
    )

    logger.admin.info('Kit added to config', {
      configId: config.id,
      kitName,
      actor: authResult.context.actorId,
    })

    return NextResponse.json({ success: true, data: { kitName, kit } }, { status: 201 })
  } catch (error) {
    logger.admin.error('Failed to add kit', error as Error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to add kit' } },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/kits/[id]/kit
 * Remove a kit from a config by name
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
    const idParsed = kitConfigIdSchema.safeParse({ id: params.id })

    if (!idParsed.success) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid kit configuration ID' } },
        { status: 400 }
      )
    }

    const body = await request.json()

    // SECURITY: Zod validated
    const parsed = deleteKitSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Validation failed', details: parsed.error.flatten() } },
        { status: 400 }
      )
    }

    const { kitName } = parsed.data

    const existing = await prisma.kitConfig.findUnique({
      where: { id: idParsed.data.id },
    })

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Kit configuration not found' } },
        { status: 404 }
      )
    }

    const kitsData = parseKitData(existing.kitData)

    if (!kitsData._kits[kitName]) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: `Kit "${kitName}" not found in this configuration` } },
        { status: 404 }
      )
    }

    const removedKit = kitsData._kits[kitName]
    const updatedKitsData = removeKit(kitsData, kitName)

    const config = await prisma.kitConfig.update({
      where: { id: idParsed.data.id },
      data: { kitData: stringifyKitData(updatedKitsData) },
    })

    // SECURITY: Audit logged
    await auditDelete(
      'kit',
      `${idParsed.data.id}:${kitName}`,
      authResult.context,
      { kitName, configId: idParsed.data.id, ...removedKit },
      request
    )

    logger.admin.info('Kit removed from config', {
      configId: config.id,
      kitName,
      actor: authResult.context.actorId,
    })

    return NextResponse.json({ success: true, data: null })
  } catch (error) {
    logger.admin.error('Failed to remove kit', error as Error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to remove kit' } },
      { status: 500 }
    )
  }
}
