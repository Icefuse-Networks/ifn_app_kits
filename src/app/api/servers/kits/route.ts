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
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireKitsRead } from '@/services/api-auth'
import { safeParseKitData } from '@/lib/utils/kit'
import { logger } from '@/lib/logger'
import { isValidPrefixedId } from '@/lib/id'
import type { KitsData } from '@/types/kit'
import type { PerksData } from '@/components/kit-manager/modals/PerksModal'

function parseStoreData(raw: string | null | undefined): Record<string, unknown> {
  if (!raw) return {}
  try { return JSON.parse(raw) as Record<string, unknown> } catch { return {} }
}

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
      { success: false, error: { code: 'AUTH_ERROR', message: authResult.error } },
      { status: authResult.status }
    )
  }

  try {
    const { searchParams } = new URL(request.url)

    // SECURITY: Zod validated query params
    const querySchema = z.object({
      config: z.string().max(100).optional(),
      id: z.string().max(100).optional(),
    })

    const queryValidation = querySchema.safeParse({
      config: searchParams.get('config') ?? undefined,
      id: searchParams.get('id') ?? undefined,
    })

    if (!queryValidation.success) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid query parameters', details: queryValidation.error.flatten() } },
        { status: 400 }
      )
    }

    const { config: configParam, id: idParam } = queryValidation.data

    // Single config mode: plugin requests a specific kit configuration
    // Prefer ID-based lookup if provided
    if (idParam || configParam) {
      let kitConfig: { id: string; name: string; kitData: string; storeData?: string | null } | null = null

      if (idParam) {
        // Check if this is a category ID or a server identifier
        if (isValidPrefixedId(idParam, 'category')) {
          // Direct category ID lookup (legacy)
          kitConfig = await prisma.kitConfig.findUnique({
            where: { id: idParam },
            select: { id: true, name: true, kitData: true, storeData: true },
          })
        } else {
          // Server identifier lookup - find via ServerIdentifier -> KitMapping -> KitConfig
          const serverIdentifier = await prisma.serverIdentifier.findFirst({
            where: { OR: [{ id: idParam }, { hashedId: idParam }] },
            select: { id: true },
          })

          if (serverIdentifier) {
            // Find kit mapping for this server (single source of truth)
            const mapping = await prisma.kitMapping.findFirst({
              where: {
                serverIdentifierId: serverIdentifier.id,
                minutesAfterWipe: null,
              },
              select: { configId: true },
            })

            if (mapping?.configId) {
              kitConfig = await prisma.kitConfig.findUnique({
                where: { id: mapping.configId },
                select: { id: true, name: true, kitData: true, storeData: true },
              })
            }
          }
        }
      } else if (configParam) {
        // Legacy: lookup by name (first match)
        kitConfig = await prisma.kitConfig.findFirst({
          where: { name: configParam.trim() },
          select: { id: true, name: true, kitData: true, storeData: true },
        })
      }

      if (!kitConfig) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Kit config not found' } },
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
          { success: false, error: { code: 'INTERNAL_ERROR', message: 'Invalid kit data' } },
          { status: 500 }
        )
      }

      // Return flat kit array for direct plugin consumption
      // Resolve category/subcategory IDs to human-readable names
      const categories = parsed._categories || {}
      const perksMap = (parseStoreData(kitConfig.storeData).perks ?? {}) as Record<string, PerksData>
      const kitList = Object.values(parsed._kits).map((kit) => {
        const resolved = { ...kit } as Record<string, unknown>
        if (resolved.Category && categories[resolved.Category as string]) {
          const catName = categories[resolved.Category as string].name
          // Resolve subcategory name if present
          if (resolved.Subcategory && categories[resolved.Category as string].subcategories?.[resolved.Subcategory as string]) {
            resolved.Subcategory = categories[resolved.Category as string].subcategories[resolved.Subcategory as string].name
          } else {
            resolved.Subcategory = undefined
          }
          resolved.Category = catName
        } else {
          resolved.Category = undefined
          resolved.Subcategory = undefined
        }
        // Attach perks keyed by kit UUID
        const kitUuid = resolved.uuid as string | undefined
        resolved.Perks = kitUuid ? (perksMap[kitUuid] ?? null) : null
        return resolved
      })

      logger.kits.info('Plugin fetched specific config', {
        actorType: authResult.context.type,
        actorId: authResult.context.actorId,
        configId: kitConfig.id,
        configName: kitConfig.name,
        kitCount: kitList.length,
      })

      return NextResponse.json({ success: true, data: kitList })
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

    return NextResponse.json({ success: true, data: kitsMap })
  } catch (error) {
    logger.kits.error('Failed to fetch kit data for plugin', error as Error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch kit data' } },
      { status: 500 }
    )
  }
}
