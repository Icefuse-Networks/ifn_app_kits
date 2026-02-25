/**
 * Public Kits API - Bulk Endpoint
 *
 * GET /api/public/kits - Get all store kits for display
 *
 * Query params:
 * - storeOnly: If "true" (default), only return kits with IsStoreKit=true
 *
 * No authentication required - this is a public endpoint.
 * Used by the PayNow store to display kit contents.
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { safeParseKitData } from '@/lib/utils/kit'
import { logger } from '@/lib/logger'
import type { Kit, KitItem } from '@/types/kit'

// =============================================================================
// TYPES
// =============================================================================

/**
 * Transformed item format for store API
 * Matches PayNow's expected KitItem structure
 */
interface StoreKitItem {
  /** Rust item short name */
  ShortName: string
  /** Amount of the item */
  Amount: number
  /** Item skin ID */
  SkinID: number
  /** Container type (main, wear, belt) */
  Container: string
  /** Display name override */
  DisplayName?: string
  /** Blueprint flag */
  Blueprint?: boolean
  /** Condition (0-1) */
  Condition?: number
  /** Contents/attachments */
  Contents?: StoreKitItem[]
}

/**
 * Kit data format for store API
 */
interface StoreKitData {
  /** Kit name */
  Name: string
  /** Kit description */
  Description: string
  /** Cooldown in seconds */
  Cooldown: number
  /** Permission required */
  Permission: string
  /** All items with container type */
  Items: StoreKitItem[]
  /** Max uses (0 = unlimited) */
  MaxUses: number
  /** Hidden from menu */
  Hidden: boolean
  /** Image URL */
  Image?: string
  /** Auth level required */
  AuthLevel?: number
}

/**
 * Per-server kit variant
 */
interface ServerKitVariant {
  storeDescription: string
  kit: StoreKitData
}

/**
 * Perk within a perk category
 */
interface StorePerk {
  id: string
  text: string
}

/**
 * Perk category with child perks
 */
interface StorePerkCategory {
  id: string
  name: string
  perks: StorePerk[]
}

/**
 * Perks data for a kit
 */
interface StorePerksData {
  categories: StorePerkCategory[]
  uncategorized: StorePerk[]
}

/**
 * Store kit entry with per-server variants
 */
interface StoreKitEntry {
  /** Primary kit data (first config encountered, backwards compat) */
  storeDescription: string
  kit: StoreKitData
  /** Per-config kit variants keyed by config name (e.g., "5X Servers") */
  servers: Record<string, ServerKitVariant>
  /** Kit perks organized by category */
  perks?: StorePerksData
}

/**
 * Full API response - keyed by kit name, includes per-server data
 */
type StoreKitsResponse = Record<string, StoreKitEntry>

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Transform a KitItem to store format
 */
function transformItem(item: KitItem, container: string): StoreKitItem {
  const storeItem: StoreKitItem = {
    ShortName: item.Shortname,
    Amount: item.Amount,
    SkinID: typeof item.Skin === 'number' ? item.Skin : parseInt(item.Skin as string) || 0,
    Container: container,
    Condition: item.Condition,
  }

  // Add display name if skin is applied (workshop item)
  if (storeItem.SkinID > 0) {
    storeItem.DisplayName = item.Shortname // Could be enhanced with skin name lookup
  }

  // Add blueprint flag if it's a blueprint
  if (item.BlueprintShortname) {
    storeItem.Blueprint = true
    storeItem.DisplayName = `${item.BlueprintShortname} Blueprint`
  }

  // Transform nested contents
  if (item.Contents && item.Contents.length > 0) {
    storeItem.Contents = item.Contents.map((c) => transformItem(c, container))
  }

  return storeItem
}

/**
 * Transform a Kit to store format
 */
function transformKit(kit: Kit): StoreKitData {
  // Combine all items with container type
  const items: StoreKitItem[] = [
    ...(kit.MainItems || []).map((item) => transformItem(item, 'main')),
    ...(kit.WearItems || []).map((item) => transformItem(item, 'wear')),
    ...(kit.BeltItems || []).map((item) => transformItem(item, 'belt')),
  ]

  return {
    Name: kit.Name,
    Description: kit.Description,
    Cooldown: kit.Cooldown,
    Permission: kit.RequiredPermission,
    Items: items,
    MaxUses: kit.MaximumUses,
    Hidden: kit.IsHidden,
    Image: kit.KitImage || undefined,
    AuthLevel: kit.RequiredAuth,
  }
}

// =============================================================================
// CORS HEADERS
// =============================================================================

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

// =============================================================================
// ROUTE HANDLERS
// =============================================================================

/**
 * OPTIONS /api/public/kits - Handle preflight requests
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: CORS_HEADERS,
  })
}

/**
 * GET /api/public/kits
 *
 * Returns all store kits in a flat structure for the PayNow store.
 * By default, only returns kits with IsStoreKit=true.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const storeOnly = searchParams.get('storeOnly') !== 'false' // Default true

    // PERF: Fetch all configs with kit data
    const configs = await prisma.kitConfig.findMany({
      select: {
        id: true,
        name: true,
        kitData: true,
        storeData: true,
      },
    })

    const response: StoreKitsResponse = {}

    // Process each config — collect per-server variants
    for (const config of configs) {
      const parsed = safeParseKitData(config.kitData)
      if (!parsed) continue

      // Get store descriptions and perks if available
      let storeDescriptions: Record<string, string> = {}
      let storePerks: Record<string, StorePerksData> = {}
      if (config.storeData) {
        try {
          const storeData = typeof config.storeData === 'string'
            ? JSON.parse(config.storeData)
            : config.storeData
          storeDescriptions = storeData.descriptions || {}
          storePerks = storeData.perks || {}
        } catch {
          // Ignore parse errors
        }
      }

      // Process each kit in this config
      for (const [kitKey, kit] of Object.entries(parsed._kits)) {
        if (storeOnly && !kit.IsStoreKit) continue

        const variant: ServerKitVariant = {
          storeDescription: storeDescriptions[kitKey] || kit.Description || '',
          kit: transformKit(kit),
        }

        const kitPerks = storePerks[kitKey]
        const hasPerks = kitPerks && (
          (kitPerks.categories?.length > 0) || (kitPerks.uncategorized?.length > 0)
        )

        if (!response[kit.Name]) {
          // First config for this kit — set as primary
          response[kit.Name] = {
            storeDescription: variant.storeDescription,
            kit: variant.kit,
            servers: { [config.name]: variant },
            ...(hasPerks ? { perks: kitPerks } : {}),
          }
        } else {
          // Additional config — add to servers map
          response[kit.Name].servers[config.name] = variant
          // Merge perks if not already set
          if (hasPerks && !response[kit.Name].perks) {
            response[kit.Name].perks = kitPerks
          }
        }
      }
    }

    // Log for analytics
    logger.analytics.info('Public kits fetched for store', {
      kitCount: Object.keys(response).length,
      storeOnly,
    })

    return NextResponse.json(response, {
      headers: {
        ...CORS_HEADERS,
        // PERF: Cache for 5 minutes, stale-while-revalidate for 1 hour
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600',
      },
    })
  } catch (error) {
    logger.analytics.error('Failed to fetch public kits', error as Error)
    return NextResponse.json(
      { error: 'Failed to fetch kit data' },
      { status: 500, headers: CORS_HEADERS }
    )
  }
}
