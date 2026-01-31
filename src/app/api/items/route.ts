/**
 * Items API - Rust Item Data Proxy
 *
 * GET /api/items - Fetch Rust item data from external source
 *
 * This proxies the request to avoid CORS issues with raw.githubusercontent.com
 */

import { NextResponse } from 'next/server'
import { logger } from '@/lib/logger'

/**
 * External URL for Rust item data
 * Source: Community-maintained item list
 */
const RUST_ITEMS_URL =
  'https://raw.githubusercontent.com/SzyMig/Rust-item-list-JSON/refs/heads/main/Rust-Items.json'

/**
 * Cache for item data (5 minute TTL)
 */
let itemCache: { data: unknown; timestamp: number } | null = null
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

/**
 * GET /api/items
 * Proxy Rust item data from external GitHub source
 */
export async function GET() {
  try {
    // Check cache
    if (itemCache && Date.now() - itemCache.timestamp < CACHE_TTL) {
      return NextResponse.json(itemCache.data)
    }

    // Fetch from external source
    const response = await fetch(RUST_ITEMS_URL, {
      next: { revalidate: 300 }, // 5 minute cache at CDN level
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch items: ${response.status}`)
    }

    const data = await response.json()

    // Update cache
    itemCache = { data, timestamp: Date.now() }

    // Return raw array (not wrapped in envelope for backwards compatibility)
    return NextResponse.json(data)
  } catch (error) {
    logger.admin.error('Failed to fetch Rust items', error as Error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch Rust items' } },
      { status: 500 }
    )
  }
}
