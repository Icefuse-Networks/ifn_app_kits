/**
 * Plugin Integration Endpoint
 *
 * GET /api/servers/kits           - Returns all kit configs (backward compatible)
 * GET /api/servers/kits?config=5x - Returns kits for a specific config as flat array
 *
 * Auth: Token (kits:read) required
 * This is the endpoint the Rust plugin calls to fetch kit configurations.
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireKitsRead } from '@/services/api-auth'
import { safeParseKitData } from '@/lib/utils/kit'
import { logger } from '@/lib/logger'
import { pluginConfigQuerySchema } from '@/lib/validations/kit'
import type { KitsData } from '@/types/kit'

/**
 * GET /api/servers/kits
 *
 * Two modes:
 * 1. With ?config=NAME: Returns flat Kit[] array for plugin consumption
 * 2. Without config param: Returns all configs as { configName: kitData } map
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

    // SECURITY: Zod validated
    const queryResult = pluginConfigQuerySchema.safeParse({
      config: configParam ?? undefined,
    })

    if (!queryResult.success) {
      return NextResponse.json(
        { error: 'Invalid config parameter' },
        { status: 400 }
      )
    }

    const { config: configName } = queryResult.data

    // Single config mode: plugin requests a specific kit configuration
    if (configName) {
      // PERF: Select only needed fields
      const kitConfig = await prisma.kitConfig.findUnique({
        where: { name: configName },
        select: { name: true, kitData: true },
      })

      if (!kitConfig) {
        return NextResponse.json(
          { error: 'Kit config not found' },
          { status: 404 }
        )
      }

      const parsed = safeParseKitData(kitConfig.kitData)

      if (!parsed) {
        logger.kits.error('Failed to parse kitData for config', { name: configName })
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
        config: configName,
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
