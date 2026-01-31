/**
 * Skins API - Steam Workshop Skin Images
 *
 * POST /api/skins - Batch resolve skin IDs to preview image URLs
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { logger } from '@/lib/logger'

/**
 * Request schema for skin lookup
 */
const skinLookupSchema = z.object({
  ids: z.array(z.string()).min(1).max(100),
})

/**
 * Steam Workshop CDN URL for skin previews
 */
const STEAM_CDN_BASE = 'https://steamcommunity-a.akamaihd.net/economy/image/'

/**
 * POST /api/skins
 * Resolve Steam Workshop skin IDs to preview image URLs
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // SECURITY: Zod validated
    const parsed = skinLookupSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid skin IDs' } },
        { status: 400 }
      )
    }

    const { ids } = parsed.data

    // Build result map
    // For now, we construct URLs directly from skin IDs
    // Steam Workshop skins can be looked up via the Steam API if needed
    const result: Record<string, string | null> = {}

    for (const id of ids) {
      // Skip invalid/empty IDs
      if (!id || id === '0') {
        result[id] = null
        continue
      }

      // Try to fetch from Steam Workshop API
      // For now, return null as we don't have Steam API integration
      // The CDN URL pattern for Rust skins is:
      // https://steamcommunity-a.akamaihd.net/economy/image/{icon_url}
      // But we need to look up the icon_url from Steam's API
      result[id] = null
    }

    // Return as direct JSON (not wrapped in envelope for backwards compatibility)
    return NextResponse.json(result)
  } catch (error) {
    logger.admin.error('Failed to resolve skin images', error as Error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to resolve skin images' } },
      { status: 500 }
    )
  }
}
