/**
 * Kit Config Clone API
 *
 * POST /api/v1/kits/[id]/clone - Deep-clone a kit configuration
 *
 * Auth: Token (kits:write) OR Session (admin)
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireKitsWrite } from '@/services/api-auth'
import { auditCreate } from '@/services/audit'
import { kitConfigIdSchema, cloneKitConfigSchema } from '@/lib/validations/kit'
import { parseKitData } from '@/lib/utils/kit'
import { logger } from '@/lib/logger'
import { id } from '@/lib/id'
import type { KitConfigParsed } from '@/types/kit'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * POST /api/v1/kits/[id]/clone
 *
 * Deep-clone a kit configuration with a new name.
 * Creates a new KitConfig with identical kitData and storeData.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
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
    const bodyParsed = cloneKitConfigSchema.safeParse(body)
    if (!bodyParsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: bodyParsed.error.flatten() },
        { status: 400 }
      )
    }

    // Fetch source config
    const source = await prisma.kitConfig.findUnique({
      where: { id: idParsed.data.id },
      select: { name: true, description: true, kitData: true, storeData: true },
    })

    if (!source) {
      return NextResponse.json({ error: 'Source kit config not found' }, { status: 404 })
    }

    const { name, description } = bodyParsed.data

    // Create deep copy with new name
    const cloned = await prisma.kitConfig.create({
      data: {
        id: id.category(),
        name,
        description: description !== undefined ? description : source.description,
        kitData: source.kitData,
        storeData: source.storeData,
      },
    })

    // SECURITY: Audit logged
    await auditCreate(
      'kit_config',
      cloned.id.toString(),
      authResult.context,
      { name, clonedFrom: idParsed.data.id, sourceName: source.name },
      request
    )

    logger.kits.info('Kit config cloned', {
      kitId: cloned.id,
      name: cloned.name,
      sourceId: idParsed.data.id,
      sourceName: source.name,
      actor: authResult.context.actorId,
    })

    // Return with parsed kitData
    const parsedKitData = parseKitData(cloned.kitData)
    const response: KitConfigParsed = {
      id: cloned.id,
      name: cloned.name,
      description: cloned.description,
      kitData: parsedKitData,
      storeData: cloned.storeData ? JSON.parse(cloned.storeData) : null,
      createdAt: cloned.createdAt,
      updatedAt: cloned.updatedAt,
    }

    return NextResponse.json(response, { status: 201 })
  } catch (error: unknown) {
    const prismaError = error as { code?: string }

    if (prismaError.code === 'P2002') {
      return NextResponse.json(
        { error: 'A category with this name already exists' },
        { status: 409 }
      )
    }

    logger.kits.error('Failed to clone kit config', error as Error)
    return NextResponse.json(
      { error: 'Failed to clone kit config' },
      { status: 500 }
    )
  }
}
