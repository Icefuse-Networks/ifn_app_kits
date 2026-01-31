/**
 * Public Kit Detail API
 *
 * GET /api/public/kits/[name] - Get kit details by name
 *
 * Query params:
 * - identifierId: Optional server identifier to prioritize config lookup
 *
 * No authentication required - this is a public endpoint.
 * Returns kit data for display on public kit viewer.
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { safeParseKitData } from '@/lib/utils/kit'
import { logger } from '@/lib/logger'
import type { Kit } from '@/types/kit'

// CORS headers for cross-origin requests
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

interface RouteContext {
  params: Promise<{ name: string }>
}

/**
 * OPTIONS /api/public/kits/[name] - Handle preflight requests
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: CORS_HEADERS,
  })
}

/**
 * GET /api/public/kits/[name]
 *
 * Find a kit by name across all configurations.
 * If identifierId is provided, tries to find the kit in that server's config first.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { name: kitName } = await context.params
    const { searchParams } = new URL(request.url)
    const identifierId = searchParams.get('identifierId')

    if (!kitName || kitName.length > 100) {
      return NextResponse.json(
        { error: 'Invalid kit name' },
        { status: 400, headers: CORS_HEADERS }
      )
    }

    // Decode URL-encoded kit name
    const decodedKitName = decodeURIComponent(kitName)

    let foundKit: Kit | null = null
    let foundConfigName: string | null = null

    // If identifierId provided, try to find which config that server uses
    // For now, we'll search all configs - could be optimized later with server-to-config mapping

    // PERF: Fetch all configs with kit data
    const configs = await prisma.kitConfig.findMany({
      select: {
        id: true,
        name: true,
        kitData: true,
      },
    })

    // Search through configs for the kit
    for (const config of configs) {
      const parsed = safeParseKitData(config.kitData)
      if (!parsed) continue

      // Search for kit by name (case-insensitive key match)
      for (const [key, kit] of Object.entries(parsed._kits)) {
        if (key.toLowerCase() === decodedKitName.toLowerCase() ||
            kit.Name.toLowerCase() === decodedKitName.toLowerCase()) {
          foundKit = kit
          foundConfigName = config.name
          break
        }
      }

      if (foundKit) break
    }

    if (!foundKit) {
      return NextResponse.json(
        { error: 'Kit not found' },
        { status: 404, headers: CORS_HEADERS }
      )
    }

    // Calculate item counts
    const mainItemCount = foundKit.MainItems?.length || 0
    const wearItemCount = foundKit.WearItems?.length || 0
    const beltItemCount = foundKit.BeltItems?.length || 0
    const totalItemCount = mainItemCount + wearItemCount + beltItemCount

    // Format response with public-safe kit data
    const response = {
      kit: {
        name: foundKit.Name,
        description: foundKit.Description,
        cooldown: foundKit.Cooldown,
        cost: foundKit.Cost,
        isHidden: foundKit.IsHidden,
        isAutoKit: foundKit.IsAutoKit ?? false,
        isStoreKit: foundKit.IsStoreKit ?? false,
        kitImage: foundKit.KitImage || null,
        requiresPermission: !!foundKit.RequiredPermission,
        // Include items for display
        mainItems: foundKit.MainItems || [],
        wearItems: foundKit.WearItems || [],
        beltItems: foundKit.BeltItems || [],
      },
      stats: {
        totalItems: totalItemCount,
        mainItems: mainItemCount,
        wearItems: wearItemCount,
        beltItems: beltItemCount,
      },
      config: {
        name: foundConfigName,
      },
    }

    return NextResponse.json(response, {
      headers: {
        ...CORS_HEADERS,
        // PERF: Cache for 5 minutes
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600',
      },
    })
  } catch (error) {
    logger.analytics.error('Failed to fetch public kit', error as Error)
    return NextResponse.json(
      { error: 'Failed to fetch kit data' },
      { status: 500, headers: CORS_HEADERS }
    )
  }
}
