/**
 * Steam Skin Image Resolution API
 *
 * Resolves Steam Workshop skin IDs to their preview image URLs.
 * Uses Steam's ISteamRemoteStorage/GetPublishedFileDetails endpoint.
 *
 * POST /api/v1/skins
 * Body: { ids: string[] }  (skin IDs as strings)
 * Returns: { [skinId: string]: string | null }  (skinId -> preview URL or null)
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

// =============================================================================
// Validation
// =============================================================================

const skinRequestSchema = z.object({
  ids: z
    .array(z.string().regex(/^\d+$/, 'Skin ID must be numeric'))
    .min(1, 'At least one skin ID required')
    .max(50, 'Maximum 50 skin IDs per request'),
})

// =============================================================================
// In-memory cache (server-side)
// =============================================================================

const skinCache = new Map<string, { url: string | null; expiresAt: number }>()
const CACHE_TTL_MS = 15 * 60 * 1000 // 15 minutes

function getCached(id: string): string | null | undefined {
  const entry = skinCache.get(id)
  if (!entry) return undefined
  if (Date.now() > entry.expiresAt) {
    skinCache.delete(id)
    return undefined
  }
  return entry.url
}

function setCache(id: string, url: string | null) {
  skinCache.set(id, { url, expiresAt: Date.now() + CACHE_TTL_MS })
}

// =============================================================================
// Steam API
// =============================================================================

const STEAM_API_URL =
  'https://api.steampowered.com/ISteamRemoteStorage/GetPublishedFileDetails/v1/'

interface SteamFileDetail {
  publishedfileid: string
  result: number
  preview_url?: string
}

interface SteamAPIResponse {
  response: {
    resultcount: number
    publishedfiledetails: SteamFileDetail[]
  }
}

async function fetchSkinImages(
  ids: string[]
): Promise<Record<string, string | null>> {
  const results: Record<string, string | null> = {}

  // Check cache first, collect uncached IDs
  const uncachedIds: string[] = []
  for (const id of ids) {
    const cached = getCached(id)
    if (cached !== undefined) {
      results[id] = cached
    } else {
      uncachedIds.push(id)
    }
  }

  if (uncachedIds.length === 0) return results

  // Build form-encoded body for Steam API
  const formData = new URLSearchParams()
  formData.append('itemcount', uncachedIds.length.toString())
  uncachedIds.forEach((id, i) => {
    formData.append(`publishedfileids[${i}]`, id)
  })

  const response = await fetch(STEAM_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formData.toString(),
  })

  if (!response.ok) {
    // Cache null for all failed IDs to avoid repeated failures
    for (const id of uncachedIds) {
      results[id] = null
      setCache(id, null)
    }
    return results
  }

  const data: SteamAPIResponse = await response.json()
  const details = data.response?.publishedfiledetails || []

  // Map results
  const detailMap = new Map(details.map((d) => [d.publishedfileid, d]))
  for (const id of uncachedIds) {
    const detail = detailMap.get(id)
    const url =
      detail && detail.result === 1 && detail.preview_url
        ? detail.preview_url
        : null
    results[id] = url
    setCache(id, url)
  }

  return results
}

// =============================================================================
// Route Handler
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = skinRequestSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    // Deduplicate and filter out "0" (no skin)
    const uniqueIds = [...new Set(parsed.data.ids.filter((id) => id !== '0'))]

    if (uniqueIds.length === 0) {
      return NextResponse.json({})
    }

    const results = await fetchSkinImages(uniqueIds)

    return NextResponse.json(results, {
      headers: {
        'Cache-Control': 'public, max-age=900, s-maxage=900',
      },
    })
  } catch (err) {
    console.error('Skin resolution error:', err)
    return NextResponse.json(
      { error: 'Failed to resolve skin images' },
      { status: 500 }
    )
  }
}
