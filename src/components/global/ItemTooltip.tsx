'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { RUST_ITEM_CDN } from '@/lib/rust-items'

// =============================================================================
// Types
// =============================================================================

interface ItemJsonData {
  itemid: number
  shortname: string
  Name: string
  Description: string
  Category: string
  maxDraggable: number
  ItemType: string
  AmountType: string
  stackable: number
  quickDespawn: boolean
  rarity: string
  condition: {
    enabled: boolean
    max: number
    repairable: boolean
  }
  Parent: number
  isWearable: boolean
  isHoldable: boolean
  isUsable: boolean
  HasSkins: boolean
}

interface ItemTooltipProps {
  shortname: string
  visible: boolean
  x: number
  y: number
}

// =============================================================================
// Cache
// =============================================================================

const jsonCache = new Map<string, ItemJsonData | null>()
const pendingFetches = new Map<string, Promise<ItemJsonData | null>>()

// =============================================================================
// Helpers
// =============================================================================

function getItemJsonUrl(shortname: string): string {
  return `${RUST_ITEM_CDN}/${shortname}.json`
}

async function fetchItemJson(shortname: string): Promise<ItemJsonData | null> {
  // Return cached data if available
  if (jsonCache.has(shortname)) {
    return jsonCache.get(shortname) ?? null
  }

  // Return pending fetch if already in progress
  if (pendingFetches.has(shortname)) {
    return pendingFetches.get(shortname) ?? null
  }

  // Start new fetch
  const fetchPromise = (async () => {
    try {
      const response = await fetch(getItemJsonUrl(shortname), {
        referrerPolicy: 'no-referrer',
      })

      if (!response.ok) {
        console.warn(`[ItemTooltip] Failed to fetch ${shortname}: HTTP ${response.status}`)
        jsonCache.set(shortname, null)
        return null
      }

      const data: ItemJsonData = await response.json()
      jsonCache.set(shortname, data)
      return data
    } catch (err) {
      console.warn(`[ItemTooltip] Error fetching ${shortname}:`, err)
      jsonCache.set(shortname, null)
      return null
    } finally {
      pendingFetches.delete(shortname)
    }
  })()

  pendingFetches.set(shortname, fetchPromise)
  return fetchPromise
}

// =============================================================================
// Component
// =============================================================================

export function ItemTooltip({ shortname, visible, x, y }: ItemTooltipProps) {
  const [data, setData] = useState<ItemJsonData | null>(null)
  const [loading, setLoading] = useState(false)
  const [mounted, setMounted] = useState(false)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState({ x, y })

  // Handle client-side mounting for portal
  useEffect(() => {
    setMounted(true)
  }, [])

  // Fetch data when shortname changes and tooltip is visible
  useEffect(() => {
    if (!visible || !shortname) {
      return
    }

    // Check cache first
    if (jsonCache.has(shortname)) {
      setData(jsonCache.get(shortname) ?? null)
      setLoading(false)
      return
    }

    setLoading(true)
    fetchItemJson(shortname).then((result) => {
      setData(result)
      setLoading(false)
    })
  }, [shortname, visible])

  // Adjust position to keep tooltip in viewport
  useEffect(() => {
    if (!visible || !tooltipRef.current) {
      setPosition({ x, y })
      return
    }

    const tooltip = tooltipRef.current
    const rect = tooltip.getBoundingClientRect()
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight

    let newX = x + 16 // Offset from cursor
    let newY = y + 16

    // Prevent overflow right
    if (newX + rect.width > viewportWidth - 16) {
      newX = x - rect.width - 16
    }

    // Prevent overflow bottom
    if (newY + rect.height > viewportHeight - 16) {
      newY = y - rect.height - 16
    }

    // Prevent overflow left/top
    newX = Math.max(16, newX)
    newY = Math.max(16, newY)

    setPosition({ x: newX, y: newY })
  }, [x, y, visible, data])

  // Don't render on server or when not visible
  if (!mounted || !visible) return null

  const tooltipContent = (
    <div
      ref={tooltipRef}
      className="fixed z-[9999] pointer-events-none"
      style={{
        left: position.x,
        top: position.y,
        background: 'var(--bg-elevated)',
        border: '1px solid var(--glass-border)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.05) inset',
        minWidth: 280,
        maxWidth: 360,
      }}
    >
      {loading ? (
        <div className="p-4 text-center">
          <div className="inline-block w-5 h-5 border-2 border-[var(--accent-primary)] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : data ? (
        <div className="p-4">
          {/* Header */}
          <div className="flex items-start gap-3 mb-3 pb-3 border-b border-[var(--glass-border)]">
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                {data.Name}
              </h3>
              <p className="text-xs text-[var(--text-muted)] font-mono mt-0.5">
                {data.shortname}
              </p>
            </div>
            <span
              className="px-2 py-0.5 text-[10px] font-medium rounded-full"
              style={{
                background: 'var(--accent-primary)',
                color: 'white',
              }}
            >
              {data.Category}
            </span>
          </div>

          {/* Description */}
          {data.Description && (
            <p className="text-xs text-[var(--text-secondary)] mb-3 leading-relaxed">
              {data.Description}
            </p>
          )}

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
            <StatRow label="Item ID" value={data.itemid} />
            <StatRow label="Type" value={data.ItemType} />
            <StatRow label="Stack" value={data.stackable} />
            <StatRow label="Rarity" value={data.rarity} />
            {data.condition.enabled && (
              <>
                <StatRow label="Max Condition" value={data.condition.max} />
                <StatRow
                  label="Repairable"
                  value={data.condition.repairable ? 'Yes' : 'No'}
                />
              </>
            )}
          </div>

          {/* Flags */}
          <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-[var(--glass-border)]">
            {data.isWearable && <Flag label="Wearable" />}
            {data.isHoldable && <Flag label="Holdable" />}
            {data.isUsable && <Flag label="Usable" />}
            {data.HasSkins && <Flag label="Has Skins" color="accent" />}
            {data.quickDespawn && <Flag label="Quick Despawn" color="warning" />}
          </div>
        </div>
      ) : (
        <div className="p-4 text-center">
          <p className="text-xs text-[var(--text-muted)]">
            No data available for {shortname}
          </p>
        </div>
      )}
    </div>
  )

  // Use portal to render at document body level (avoids overflow clipping)
  return createPortal(tooltipContent, document.body)
}

// =============================================================================
// Subcomponents
// =============================================================================

function StatRow({
  label,
  value,
}: {
  label: string
  value: string | number
}) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-[var(--text-muted)]">{label}</span>
      <span className="text-[var(--text-primary)] font-medium">{value}</span>
    </div>
  )
}

function Flag({
  label,
  color = 'default',
}: {
  label: string
  color?: 'default' | 'accent' | 'warning'
}) {
  const colors = {
    default: {
      bg: 'rgba(255, 255, 255, 0.1)',
      text: 'var(--text-secondary)',
    },
    accent: {
      bg: 'var(--accent-primary)',
      text: 'white',
    },
    warning: {
      bg: 'var(--status-warning)',
      text: 'white',
    },
  }

  const style = colors[color]

  return (
    <span
      className="px-2 py-0.5 text-[10px] font-medium rounded-full"
      style={{ background: style.bg, color: style.text }}
    >
      {label}
    </span>
  )
}

// =============================================================================
// Hook for easy integration
// =============================================================================

export function useItemTooltip() {
  const [tooltip, setTooltip] = useState({
    visible: false,
    shortname: '',
    x: 0,
    y: 0,
  })

  const showTooltip = useCallback(
    (shortname: string, e: React.MouseEvent) => {
      setTooltip({
        visible: true,
        shortname,
        x: e.clientX,
        y: e.clientY,
      })
    },
    []
  )

  const updatePosition = useCallback((e: React.MouseEvent) => {
    setTooltip((prev) => ({
      ...prev,
      x: e.clientX,
      y: e.clientY,
    }))
  }, [])

  const hideTooltip = useCallback(() => {
    setTooltip((prev) => ({ ...prev, visible: false }))
  }, [])

  return {
    tooltip,
    showTooltip,
    updatePosition,
    hideTooltip,
  }
}
