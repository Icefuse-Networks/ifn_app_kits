/**
 * Kits Sync API - Plugin Synchronization
 *
 * POST /api/kits/sync - Sync kit data from plugin
 * GET  /api/kits/sync - Get kit data for plugin (by config name or ID)
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { authenticateWithScope } from '@/services/api-auth'
import { pluginConfigQuerySchema, updateKitConfigSchema } from '@/lib/validations/kit'
import { logger } from '@/lib/logger'

/**
 * GET /api/kits/sync
 * Get kit configuration for plugin synchronization
 * Query: ?config=ConfigName or ?id=category_xxx
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
    const configName = searchParams.get('config')
    const configId = searchParams.get('id')

    const parsed = pluginConfigQuerySchema.safeParse({ config: configName, id: configId })

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Either config (name) or id must be provided' } },
        { status: 400 }
      )
    }

    // Find config by ID or name
    const config = await prisma.kitConfig.findFirst({
      where: configId
        ? { id: configId }
        : { name: { equals: configName!, mode: 'insensitive' } },
      select: {
        id: true,
        name: true,
        kitData: true,
        updatedAt: true,
      },
    })

    if (!config) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Kit configuration not found' } },
        { status: 404 }
      )
    }

    // Parse kitData for plugin consumption
    let kitData: unknown
    try {
      kitData = JSON.parse(config.kitData)
    } catch {
      kitData = config.kitData
    }

    return NextResponse.json({
      success: true,
      data: {
        id: config.id,
        name: config.name,
        kitData,
        updatedAt: config.updatedAt,
      },
    })
  } catch (error) {
    logger.admin.error('Failed to get kit sync data', error as Error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to get kit sync data' } },
      { status: 500 }
    )
  }
}

/**
 * POST /api/kits/sync
 * Sync kit data from plugin to server
 * Body: { id: string, kitData: object }
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

    // SECURITY: Zod validated - id and kitData
    const syncSchema = z.object({
      id: z.string().min(1).max(100),
      kitData: z.union([z.string().min(2).max(10_000_000), z.record(z.unknown())]),
    })

    const syncParsed = syncSchema.safeParse(body)
    if (!syncParsed.success) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'id and kitData are required', details: syncParsed.error.flatten() } },
        { status: 400 }
      )
    }

    const { id: configId, kitData: rawKitData } = syncParsed.data

    // Validate kitData structure
    const parsed = updateKitConfigSchema.safeParse({ kitData: rawKitData })
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid kit data', details: parsed.error.flatten() } },
        { status: 400 }
      )
    }

    const existing = await prisma.kitConfig.findUnique({
      where: { id: configId },
    })

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Kit configuration not found' } },
        { status: 404 }
      )
    }

    const kitDataString = typeof parsed.data.kitData === 'string'
      ? parsed.data.kitData
      : JSON.stringify(parsed.data.kitData)

    const config = await prisma.kitConfig.update({
      where: { id: configId },
      data: { kitData: kitDataString },
      select: {
        id: true,
        name: true,
        updatedAt: true,
      },
    })

    logger.admin.info('Kit configuration synced from plugin', {
      configId: config.id,
      name: config.name,
      actor: authResult.context.actorId,
    })

    return NextResponse.json({
      success: true,
      data: {
        id: config.id,
        name: config.name,
        updatedAt: config.updatedAt,
      },
    })
  } catch (error) {
    logger.admin.error('Failed to sync kit data', error as Error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to sync kit data' } },
      { status: 500 }
    )
  }
}
