/**
 * Plugin Integration Endpoint
 *
 * GET /api/servers/kits                    - Returns all kit configs (backward compatible)
 * GET /api/servers/kits?config=5x          - Returns kits for a specific config by name (legacy)
 * GET /api/servers/kits?id=category_xxx    - Returns kits for a specific config by ID (new)
 *
 * Auth: Token (kits:read) required
 * This is the endpoint the Rust plugin calls to fetch kit configurations.
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireKitsRead } from '@/services/api-auth'
import { safeParseKitData } from '@/lib/utils/kit'
import { logger } from '@/lib/logger'
import { isValidPrefixedId } from '@/lib/id'
import type { KitsData } from '@/types/kit'

/**
 * GET /api/servers/kits
 *
 * Three modes:
 * 1. With ?id=category_xxx: Returns flat Kit[] array by ID (preferred)
 * 2. With ?config=NAME: Returns flat Kit[] array by name (legacy)
 * 3. Without params: Returns all configs as { configName: kitData } map
 */
export async function GET(request: NextRequest) {
  // SECURITY: Token auth required (kits:read scope)
  const authResult = await requireKitsRead(request)

  if (!authResult.success) {
    return NextResponse.json(
      { error: authResult.error },
      { status: authResult.status }
    )
  }

  try {
    const { searchParams } = new URL(request.url)
    const configParam = searchParams.get('config')
    const idParam = searchParams.get('id')

    // Single config mode: plugin requests a specific kit configuration
    // Prefer ID-based lookup if provided
    if (idParam || configParam) {
      let kitConfig: { id: string; name: string; kitData: string } | null = null

      if (idParam) {
        // SECURITY: Validate prefixed ID format
        if (!isValidPrefixedId(idParam, 'category')) {
          return NextResponse.json(
            { error: 'Invalid category ID format' },
            { status: 400 }
          )
        }

        // PERF: Select only needed fields
        kitConfig = await prisma.kitConfig.findUnique({
          where: { id: idParam },
          select: { id: true, name: true, kitData: true },
        })
      } else if (configParam) {
        // SECURITY: Basic validation for legacy name-based lookup
        if (configParam.length > 100) {
          return NextResponse.json(
            { error: 'Config name too long' },
            { status: 400 }
          )
        }

        // Legacy: lookup by name (first match)
        kitConfig = await prisma.kitConfig.findFirst({
          where: { name: configParam.trim() },
          select: { id: true, name: true, kitData: true },
        })
      }

      if (!kitConfig) {
        return NextResponse.json(
          { error: 'Kit config not found' },
          { status: 404 }
        )
      }

      const parsed = safeParseKitData(kitConfig.kitData)

      if (!parsed) {
        logger.kits.error('Failed to parse kitData for config', {
          id: kitConfig.id,
          name: kitConfig.name,
        })
        return NextResponse.json(
          { error: 'Invalid kit data' },
          { status: 500 }
        )
      }

      // Return flat kit array for direct plugin consumption
      const kitList = Object.values(parsed._kits)

      logger.kits.info('Plugin fetched specific config', {
        actorType: authResult.context.type,
        actorId: authResult.context.actorId,
        configId: kitConfig.id,
        configName: kitConfig.name,
        kitCount: kitList.length,
      })

      return NextResponse.json(kitList)
    }

    // All configs mode: existing behavior (backward compatible)
    // PERF: Select only needed fields
    const kitConfigs = await prisma.kitConfig.findMany({
      select: {
        name: true,
        kitData: true,
      },
    })

    const kitsMap: Record<string, KitsData> = {}

    for (const config of kitConfigs) {
      const parsed = safeParseKitData(config.kitData)

      if (parsed) {
        kitsMap[config.name] = parsed
      } else {
        logger.kits.warn('Failed to parse kitData for config', { name: config.name })
      }
    }

    logger.kits.info('Plugin fetched all kit data', {
      actorType: authResult.context.type,
      actorId: authResult.context.actorId,
      configCount: Object.keys(kitsMap).length,
    })

    return NextResponse.json(kitsMap)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    logger.kits.error('Failed to fetch kit data for plugin', error as Error)
    return NextResponse.json(
      { error: 'Failed to fetch kit data', detail: message },
      { status: 500 }
    )
  }
}
