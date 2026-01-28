/**
 * Rust Items API - Server-side proxy with caching
 *
 * GET /api/v1/items - Returns all Rust item definitions
 *
 * Fetches from GitHub server-side (bypasses browser CSP)
 * and caches in memory for 1 hour to avoid repeated external requests.
 */

import { NextResponse } from 'next/server'
import { RUST_ITEMS_URL, type RustItem } from '@/lib/rust-items'

// In-memory cache
let cachedItems: RustItem[] | null = null
let cacheTimestamp = 0
const CACHE_TTL = 60 * 60 * 1000 // 1 hour

export async function GET() {
  const now = Date.now()

  // Return cached data if fresh
  if (cachedItems && now - cacheTimestamp < CACHE_TTL) {
    return NextResponse.json(cachedItems)
  }

  try {
    const response = await fetch(RUST_ITEMS_URL, { next: { revalidate: 3600 } })

    if (!response.ok) {
      throw new Error(`Upstream returned ${response.status}`)
    }

    const items: RustItem[] = await response.json()

    // Update cache
    cachedItems = items
    cacheTimestamp = now

    return NextResponse.json(items)
  } catch (error) {
    // Serve stale cache if available
    if (cachedItems) {
      return NextResponse.json(cachedItems)
    }

    console.error('Failed to fetch Rust items:', error)
    return NextResponse.json(
      { error: 'Failed to fetch Rust items' },
      { status: 502 }
    )
  }
}
