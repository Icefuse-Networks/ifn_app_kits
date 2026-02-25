/**
 * Per-Kit Perks Management
 *
 * GET    /api/kits/[id]/perks?kitId=<kitId> - Get perks for a specific kit
 * PUT    /api/kits/[id]/perks               - Replace all perks for a kit
 * DELETE /api/kits/[id]/perks               - Remove all perks for a kit
 *
 * Perks are stored in storeData.perks, keyed by kit UUID (e.g. kit_xxx-yyy).
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { authenticateWithScope } from '@/services/api-auth'
import { auditCreate, auditUpdate, auditDelete } from '@/services/audit'
import {
  kitConfigIdSchema,
  putKitPerksSchema,
  deleteKitPerksSchema,
} from '@/lib/validations/kit'
import { logger } from '@/lib/logger'
import type { PerksData } from '@/components/kit-manager/modals/PerksModal'

type RouteContext = { params: Promise<{ id: string }> }

/** Parse storeData JSON string into a mutable object */
function parseStoreData(raw: string | null): Record<string, unknown> {
  if (!raw) return {}
  try {
    return JSON.parse(raw) as Record<string, unknown>
  } catch {
    return {}
  }
}

/**
 * GET /api/kits/[id]/perks?kitId=<kitId>
 * Return the PerksData for a single kit within the config
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
    const idParsed = kitConfigIdSchema.safeParse({ id: params.id })

    if (!idParsed.success) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid kit configuration ID' } },
        { status: 400 }
      )
    }

    const { searchParams } = new URL(request.url)
    const kitId = searchParams.get('kitId')

    if (!kitId || kitId.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'kitId query parameter is required' } },
        { status: 400 }
      )
    }

    // PERF: Select only storeData — kitData not needed for this operation
    const config = await prisma.kitConfig.findUnique({
      where: { id: idParsed.data.id },
      select: { id: true, storeData: true },
    })

    if (!config) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Kit configuration not found' } },
        { status: 404 }
      )
    }

    const storeData = parseStoreData(config.storeData)
    const perksMap = (storeData.perks ?? {}) as Record<string, PerksData>
    const perks = perksMap[kitId] ?? null

    return NextResponse.json({ success: true, data: { kitId, perks } })
  } catch (error) {
    logger.admin.error('Failed to get kit perks', error as Error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to get kit perks' } },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/kits/[id]/perks
 * Replace all perks for a kit (full replacement of storeData.perks[kitId])
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
    const parsed = putKitPerksSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Validation failed', details: parsed.error.flatten() } },
        { status: 400 }
      )
    }

    const { kitId, perks } = parsed.data

    // PERF: Select only storeData
    const existing = await prisma.kitConfig.findUnique({
      where: { id: idParsed.data.id },
      select: { id: true, storeData: true },
    })

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Kit configuration not found' } },
        { status: 404 }
      )
    }

    const storeData = parseStoreData(existing.storeData)
    const perksMap = (storeData.perks ?? {}) as Record<string, PerksData>
    const previousPerks = perksMap[kitId] ?? null

    const updatedStoreData = {
      ...storeData,
      perks: { ...perksMap, [kitId]: perks },
    }

    await prisma.kitConfig.update({
      where: { id: idParsed.data.id },
      data: { storeData: JSON.stringify(updatedStoreData) },
    })

    // SECURITY: Audit logged
    if (previousPerks) {
      await auditUpdate(
        'kitPerks',
        `${idParsed.data.id}:${kitId}`,
        authResult.context,
        { kitId, perks: previousPerks },
        { kitId, perks },
        request
      )
    } else {
      await auditCreate(
        'kitPerks',
        `${idParsed.data.id}:${kitId}`,
        authResult.context,
        { kitId, configId: idParsed.data.id, perks },
        request
      )
    }

    logger.admin.info('Kit perks updated', {
      configId: idParsed.data.id,
      kitId,
      actor: authResult.context.actorId,
    })

    return NextResponse.json({ success: true, data: { kitId, perks } })
  } catch (error) {
    logger.admin.error('Failed to update kit perks', error as Error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update kit perks' } },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/kits/[id]/perks
 * Remove all perks for a kit (deletes storeData.perks[kitId])
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
    const parsed = deleteKitPerksSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Validation failed', details: parsed.error.flatten() } },
        { status: 400 }
      )
    }

    const { kitId } = parsed.data

    // PERF: Select only storeData
    const existing = await prisma.kitConfig.findUnique({
      where: { id: idParsed.data.id },
      select: { id: true, storeData: true },
    })

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Kit configuration not found' } },
        { status: 404 }
      )
    }

    const storeData = parseStoreData(existing.storeData)
    const perksMap = (storeData.perks ?? {}) as Record<string, PerksData>

    if (!perksMap[kitId]) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: `No perks found for kit "${kitId}"` } },
        { status: 404 }
      )
    }

    const removedPerks = perksMap[kitId]
    const { [kitId]: _removed, ...remainingPerks } = perksMap

    const updatedStoreData = {
      ...storeData,
      perks: remainingPerks,
    }

    await prisma.kitConfig.update({
      where: { id: idParsed.data.id },
      data: { storeData: JSON.stringify(updatedStoreData) },
    })

    // SECURITY: Audit logged
    await auditDelete(
      'kitPerks',
      `${idParsed.data.id}:${kitId}`,
      authResult.context,
      { kitId, configId: idParsed.data.id, perks: removedPerks },
      request
    )

    logger.admin.info('Kit perks removed', {
      configId: idParsed.data.id,
      kitId,
      actor: authResult.context.actorId,
    })

    return NextResponse.json({ success: true, data: null })
  } catch (error) {
    logger.admin.error('Failed to remove kit perks', error as Error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to remove kit perks' } },
      { status: 500 }
    )
  }
}
