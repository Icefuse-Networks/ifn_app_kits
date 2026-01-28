/**
 * useSkinImages Hook
 *
 * Client-side hook that batches and caches Steam skin image lookups.
 * Collects skin IDs from a kit's items and resolves them via /api/v1/skins.
 */

'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { Kit } from '@/types/kit'

// =============================================================================
// Module-level cache (persists across re-renders and component remounts)
// =============================================================================

const skinImageCache = new Map<string, string | null>()
let pendingIds = new Set<string>()
let batchTimer: ReturnType<typeof setTimeout> | null = null
let batchResolvers: Array<() => void> = []

/**
 * Flush pending skin IDs to the API in a single batch request
 */
async function flushBatch() {
  const ids = [...pendingIds]
  const resolvers = [...batchResolvers]
  pendingIds = new Set()
  batchResolvers = []
  batchTimer = null

  if (ids.length === 0) {
    resolvers.forEach((r) => r())
    return
  }

  try {
    const res = await fetch('/api/v1/skins', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    })

    if (res.ok) {
      const data: Record<string, string | null> = await res.json()
      for (const [id, url] of Object.entries(data)) {
        skinImageCache.set(id, url)
      }
      // Mark any IDs not returned as null
      for (const id of ids) {
        if (!skinImageCache.has(id)) {
          skinImageCache.set(id, null)
        }
      }
    } else {
      // On failure, mark all as null so we don't retry endlessly
      for (const id of ids) {
        if (!skinImageCache.has(id)) {
          skinImageCache.set(id, null)
        }
      }
    }
  } catch {
    for (const id of ids) {
      if (!skinImageCache.has(id)) {
        skinImageCache.set(id, null)
      }
    }
  }

  resolvers.forEach((r) => r())
}

/**
 * Queue skin IDs for batch resolution
 */
function queueSkinIds(ids: string[]): Promise<void> {
  return new Promise<void>((resolve) => {
    for (const id of ids) {
      if (!skinImageCache.has(id)) {
        pendingIds.add(id)
      }
    }

    if (pendingIds.size === 0) {
      resolve()
      return
    }

    batchResolvers.push(resolve)

    if (batchTimer) clearTimeout(batchTimer)
    batchTimer = setTimeout(flushBatch, 50)
  })
}

// =============================================================================
// Hook
// =============================================================================

/**
 * Resolve skin images for a kit's items.
 * Returns a map of skinId -> preview URL.
 *
 * @param kit - The kit to resolve skin images for
 * @param enabled - Whether skin resolution is enabled
 */
export function useSkinImages(
  kit: Kit | null,
  enabled: boolean
): Map<string, string | null> {
  const [skinMap, setSkinMap] = useState<Map<string, string | null>>(new Map())
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const resolve = useCallback(async () => {
    if (!kit || !enabled) {
      setSkinMap(new Map())
      return
    }

    // Collect all unique, non-zero skin IDs from the kit
    const allItems = [...kit.MainItems, ...kit.WearItems, ...kit.BeltItems]
    const skinIds = [
      ...new Set(
        allItems
          .map((item) => String(item.Skin))
          .filter((id) => id !== '0' && id !== '')
      ),
    ]

    if (skinIds.length === 0) {
      setSkinMap(new Map())
      return
    }

    // Check which IDs need fetching
    const uncached = skinIds.filter((id) => !skinImageCache.has(id))

    if (uncached.length > 0) {
      await queueSkinIds(uncached)
    }

    if (!mountedRef.current) return

    // Build result map from cache
    const result = new Map<string, string | null>()
    for (const id of skinIds) {
      result.set(id, skinImageCache.get(id) ?? null)
    }
    setSkinMap(result)
  }, [kit, enabled])

  useEffect(() => {
    resolve()
  }, [resolve])

  return skinMap
}

/**
 * Get a single skin image URL from the cache (synchronous).
 * Returns undefined if not yet resolved.
 */
export function getSkinImageUrl(skinId: string | number): string | null | undefined {
  const id = String(skinId)
  if (id === '0' || id === '') return null
  return skinImageCache.get(id)
}
