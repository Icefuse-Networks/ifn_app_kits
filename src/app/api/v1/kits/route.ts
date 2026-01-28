/**
 * Kit Configs API - List and Create
 *
 * GET  /api/v1/kits - List all kit configs
 * POST /api/v1/kits - Create new kit config
 *
 * Auth: Token (kits:read/write) OR Session (admin)
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireKitsRead, requireKitsWrite } from '@/services/api-auth'
import { auditCreate } from '@/services/audit'
import { createKitConfigSchema, listKitsQuerySchema } from '@/lib/validations/kit'
import { parseKitData, countKits } from '@/lib/utils/kit'
import { logger } from '@/lib/logger'
import type { KitConfigParsed } from '@/types/kit'

/**
 * GET /api/v1/kits
 *
 * List all kit configurations.
 * Query params:
 *   - full=true: Include parsed kitData
 *   - store=true: Include storeData
 */
export async function GET(request: NextRequest) {
  // SECURITY: Auth check with scope
  let authResult: Awaited<ReturnType<typeof requireKitsRead>>
  try {
    authResult = await requireKitsRead(request)
  } catch (error) {
    logger.kits.error('Auth check failed', error as Error)
    return NextResponse.json(
      { error: 'Authentication service unavailable' },
      { status: 500 }
    )
  }

  if (!authResult.success) {
    return NextResponse.json(
      { error: authResult.error },
      { status: authResult.status }
    )
  }

  try {
    const { searchParams } = new URL(request.url)
    const query = listKitsQuerySchema.parse({
      full: searchParams.get('full'),
      store: searchParams.get('store'),
    })

    // PERF: Select only needed fields
    const kits = await prisma.kitConfig.findMany({
      select: {
        id: true,
        name: true,
        description: true,
        kitData: query.full,
        storeData: query.store,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { name: 'asc' },
    })

    // Transform response
    const response = kits.map((kit) => {
      const base = {
        id: kit.id,
        name: kit.name,
        description: kit.description,
        createdAt: kit.createdAt,
        updatedAt: kit.updatedAt,
      }

      if (query.full && kit.kitData) {
        const parsed = parseKitData(kit.kitData)
        return {
          ...base,
          kitData: parsed,
          kitCount: countKits(parsed),
          storeData: query.store && kit.storeData ? JSON.parse(kit.storeData) : undefined,
        }
      }

      return base
    })

    return NextResponse.json(response)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    logger.kits.error('Failed to fetch kit configs', error as Error)
    return NextResponse.json(
      { error: 'Failed to fetch kit configs', details: message },
      { status: 500 }
    )
  }
}

/**
 * POST /api/v1/kits
 *
 * Create a new kit configuration.
 */
export async function POST(request: NextRequest) {
  // SECURITY: Auth check with write scope
  const authResult = await requireKitsWrite(request)

  if (!authResult.success) {
    return NextResponse.json(
      { error: authResult.error },
      { status: authResult.status }
    )
  }

  try {
    const body = await request.json()

    // SECURITY: Zod validated
    const parsed = createKitConfigSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { name, description, kitData, storeData } = parsed.data

    // Serialize kitData to string if it's an object
    const kitDataStr = typeof kitData === 'string'
      ? kitData
      : JSON.stringify(kitData)

    const kit = await prisma.kitConfig.create({
      data: {
        name,
        description: description || null,
        kitData: kitDataStr,
        storeData: storeData || null,
      },
    })

    // SECURITY: Audit logged
    await auditCreate(
      'kit_config',
      kit.id.toString(),
      authResult.context,
      { name, description },
      request
    )

    logger.kits.info('Kit config created', {
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

    return NextResponse.json(response, { status: 201 })
  } catch (error: unknown) {
    const prismaError = error as { code?: string }

    if (prismaError.code === 'P2002') {
      return NextResponse.json(
        { error: 'Kit config with this name already exists' },
        { status: 409 }
      )
    }

    logger.kits.error('Failed to create kit config', error as Error)
    return NextResponse.json(
      { error: 'Failed to create kit config' },
      { status: 500 }
    )
  }
}
