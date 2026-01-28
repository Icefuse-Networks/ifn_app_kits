/**
 * Kit Config API - Get, Update, Delete by ID
 *
 * GET    /api/v1/kits/[id] - Get kit config
 * PUT    /api/v1/kits/[id] - Update kit config
 * DELETE /api/v1/kits/[id] - Delete kit config
 *
 * Auth: Token (kits:read/write) OR Session (admin)
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireKitsRead, requireKitsWrite } from '@/services/api-auth'
import { auditUpdate, auditDelete } from '@/services/audit'
import { kitConfigIdSchema, updateKitConfigSchema } from '@/lib/validations/kit'
import { parseKitData, countKits } from '@/lib/utils/kit'
import { logger } from '@/lib/logger'
import type { KitConfigParsed } from '@/types/kit'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /api/v1/kits/[id]
 *
 * Get a specific kit configuration by ID.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  // SECURITY: Auth check with scope
  const authResult = await requireKitsRead(request)

  if (!authResult.success) {
    return NextResponse.json(
      { error: authResult.error },
      { status: authResult.status }
    )
  }

  try {
    const { id: idStr } = await params

    // SECURITY: Zod validated
    const parsed = kitConfigIdSchema.safeParse({ id: idStr })
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid kit ID' }, { status: 400 })
    }

    const kit = await prisma.kitConfig.findUnique({
      where: { id: parsed.data.id },
      include: {
        gameServers: {
          select: { id: true, name: true },
        },
      },
    })

    if (!kit) {
      return NextResponse.json({ error: 'Kit config not found' }, { status: 404 })
    }

    // Parse kit data
    const parsedKitData = parseKitData(kit.kitData)
    const response: KitConfigParsed = {
      id: kit.id,
      name: kit.name,
      description: kit.description,
      kitData: parsedKitData,
      storeData: kit.storeData ? JSON.parse(kit.storeData) : null,
      createdAt: kit.createdAt,
      updatedAt: kit.updatedAt,
      gameServers: kit.gameServers,
    }

    return NextResponse.json(response)
  } catch (error) {
    logger.kits.error('Failed to fetch kit config', error as Error)
    return NextResponse.json(
      { error: 'Failed to fetch kit config' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/v1/kits/[id]
 *
 * Update a kit configuration.
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  // SECURITY: Auth check with write scope
  const authResult = await requireKitsWrite(request)

  if (!authResult.success) {
    return NextResponse.json(
      { error: authResult.error },
      { status: authResult.status }
    )
  }

  try {
    const { id: idStr } = await params

    // SECURITY: Zod validated
    const idParsed = kitConfigIdSchema.safeParse({ id: idStr })
    if (!idParsed.success) {
      return NextResponse.json({ error: 'Invalid kit ID' }, { status: 400 })
    }

    const body = await request.json()
    const bodyParsed = updateKitConfigSchema.safeParse(body)
    if (!bodyParsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: bodyParsed.error.flatten() },
        { status: 400 }
      )
    }

    // Get old values for audit
    const oldKit = await prisma.kitConfig.findUnique({
      where: { id: idParsed.data.id },
      select: { name: true, description: true },
    })

    if (!oldKit) {
      return NextResponse.json({ error: 'Kit config not found' }, { status: 404 })
    }

    const { name, description, kitData, storeData } = bodyParsed.data

    // Build update data
    const updateData: Record<string, unknown> = {}
    if (name !== undefined) updateData.name = name
    if (description !== undefined) updateData.description = description
    if (kitData !== undefined) {
      updateData.kitData = typeof kitData === 'string'
        ? kitData
        : JSON.stringify(kitData)
    }
    if (storeData !== undefined) updateData.storeData = storeData

    const kit = await prisma.kitConfig.update({
      where: { id: idParsed.data.id },
      data: updateData,
    })

    // SECURITY: Audit logged
    await auditUpdate(
      'kit_config',
      kit.id.toString(),
      authResult.context,
      oldKit,
      { name: kit.name, description: kit.description },
      request
    )

    logger.kits.info('Kit config updated', {
      kitId: kit.id,
      name: kit.name,
      actor: authResult.context.actorId,
    })

    // Return with parsed kitData
    const parsedKitData = parseKitData(kit.kitData)
    const response: KitConfigParsed = {
      id: kit.id,
      name: kit.name,
      description: kit.description,
      kitData: parsedKitData,
      storeData: kit.storeData ? JSON.parse(kit.storeData) : null,
      createdAt: kit.createdAt,
      updatedAt: kit.updatedAt,
    }

    return NextResponse.json(response)
  } catch (error: unknown) {
    const prismaError = error as { code?: string }

    if (prismaError.code === 'P2025') {
      return NextResponse.json({ error: 'Kit config not found' }, { status: 404 })
    }
    if (prismaError.code === 'P2002') {
      return NextResponse.json(
        { error: 'Kit config with this name already exists' },
        { status: 409 }
      )
    }

    logger.kits.error('Failed to update kit config', error as Error)
    return NextResponse.json(
      { error: 'Failed to update kit config' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/v1/kits/[id]
 *
 * Delete a kit configuration.
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  // SECURITY: Auth check with write scope
  const authResult = await requireKitsWrite(request)

  if (!authResult.success) {
    return NextResponse.json(
      { error: authResult.error },
      { status: authResult.status }
    )
  }

  try {
    const { id: idStr } = await params

    // SECURITY: Zod validated
    const parsed = kitConfigIdSchema.safeParse({ id: idStr })
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid kit ID' }, { status: 400 })
    }

    // Get old values for audit
    const oldKit = await prisma.kitConfig.findUnique({
      where: { id: parsed.data.id },
      select: { name: true, description: true },
    })

    if (!oldKit) {
      return NextResponse.json({ error: 'Kit config not found' }, { status: 404 })
    }

    await prisma.kitConfig.delete({
      where: { id: parsed.data.id },
    })

    // SECURITY: Audit logged
    await auditDelete(
      'kit_config',
      parsed.data.id.toString(),
      authResult.context,
      oldKit,
      request
    )

    logger.kits.info('Kit config deleted', {
      kitId: parsed.data.id,
      name: oldKit.name,
      actor: authResult.context.actorId,
    })

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const prismaError = error as { code?: string }

    if (prismaError.code === 'P2025') {
      return NextResponse.json({ error: 'Kit config not found' }, { status: 404 })
    }

    logger.kits.error('Failed to delete kit config', error as Error)
    return NextResponse.json(
      { error: 'Failed to delete kit config' },
      { status: 500 }
    )
  }
}
