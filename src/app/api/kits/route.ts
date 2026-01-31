/**
 * Kits API - List and Create
 *
 * GET  /api/kits - List all kit configurations
 * POST /api/kits - Create new kit configuration
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { authenticateWithScope } from '@/services/api-auth'
import { auditCreate } from '@/services/audit'
import { createKitConfigSchema, listKitsQuerySchema } from '@/lib/validations/kit'
import { id } from '@/lib/id'
import { logger } from '@/lib/logger'

/**
 * GET /api/kits
 * List all kit configurations
 */
export async function GET(request: NextRequest) {
  const authResult = await authenticateWithScope(request, 'kits:read')

  if (!authResult.success) {
    return NextResponse.json(
      { success: false, error: { code: 'AUTH_ERROR', message: authResult.error } },
      { status: authResult.status }
    )
  }

  try {
    const { searchParams } = new URL(request.url)
    const query = listKitsQuerySchema.safeParse({
      full: searchParams.get('full'),
      store: searchParams.get('store'),
    })

    if (!query.success) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid query parameters' } },
        { status: 400 }
      )
    }

    const { full, store } = query.data

    // PERF: Select only needed fields unless full data requested
    const configs = await prisma.kitConfig.findMany({
      select: {
        id: true,
        name: true,
        description: true,
        kitData: full,
        storeData: store,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: 'desc' },
    })

    return NextResponse.json({ success: true, data: configs })
  } catch (error) {
    logger.admin.error('Failed to list kit configurations', error as Error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to list kit configurations' } },
      { status: 500 }
    )
  }
}

/**
 * POST /api/kits
 * Create a new kit configuration
 */
export async function POST(request: NextRequest) {
  const authResult = await authenticateWithScope(request, 'kits:write')

  if (!authResult.success) {
    return NextResponse.json(
      { success: false, error: { code: 'AUTH_ERROR', message: authResult.error } },
      { status: authResult.status }
    )
  }

  try {
    const body = await request.json()

    // SECURITY: Zod validated
    const parsed = createKitConfigSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Validation failed', details: parsed.error.flatten() } },
        { status: 400 }
      )
    }

    const { name, description, kitData, storeData } = parsed.data

    // Stringify kitData if it's an object
    const kitDataString = typeof kitData === 'string' ? kitData : JSON.stringify(kitData)

    const config = await prisma.kitConfig.create({
      data: {
        id: id.category(),
        name,
        description: description || null,
        kitData: kitDataString,
        storeData: storeData || null,
      },
    })

    // SECURITY: Audit logged
    await auditCreate(
      'kit_config',
      config.id,
      authResult.context,
      { name, description },
      request
    )

    logger.admin.info('Kit configuration created', {
      configId: config.id,
      name: config.name,
      actor: authResult.context.actorId,
    })

    return NextResponse.json({ success: true, data: config }, { status: 201 })
  } catch (error) {
    logger.admin.error('Failed to create kit configuration', error as Error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create kit configuration' } },
      { status: 500 }
    )
  }
}
