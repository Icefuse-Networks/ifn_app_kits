'use client'

import { useState, useEffect, useMemo } from 'react'
import { Search, ChevronDown, ChevronRight, Package, X } from 'lucide-react'
import {
  fetchRustItems,
  getItemImageUrl,
  groupItemsByCategory,
  searchItems,
  ITEM_CATEGORIES,
  type RustItem,
} from '@/lib/rust-items'

// =============================================================================
// Types
// =============================================================================

interface ItemBrowserProps {
  onItemSelect: (shortname: string) => void
  collapsed?: boolean
  onToggle?: () => void
}

// =============================================================================
// Component
// =============================================================================

export function ItemBrowser({
  onItemSelect,
  collapsed = false,
  onToggle,
}: ItemBrowserProps) {
  const [items, setItems] = useState<RustItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set()
  )

  useEffect(() => {
    fetchRustItems()
      .then((data) => {
        setItems(data)
        setLoading(false)
      })
      .catch((err) => {
        setError(err.message)
        setLoading(false)
      })
  }, [])

  const groupedItems = useMemo(() => {
    const filtered = searchItems(items, search)
    return groupItemsByCategory(filtered)
  }, [items, search])

  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev)
      if (next.has(category)) {
        next.delete(category)
      } else {
        next.add(category)
      }
      return next
    })
  }

  // Collapsed state - minimal icon strip
  if (collapsed) {
    return (
      <aside
        className="w-12 flex flex-col items-center py-3 shrink-0 cursor-pointer hover:bg-[var(--bg-card-hover)] transition-colors"
        style={{
          background: 'rgba(255, 255, 255, 0.03)',
          borderLeft: '1px solid rgba(255, 255, 255, 0.10)',
        }}
        onClick={onToggle}
        title="Open Item Browser"
      >
        <Package className="w-5 h-5 text-[var(--accent-primary)]" />
      </aside>
    )
  }

  return (
    <aside
      className="w-64 flex flex-col shrink-0"
      style={{
        background: 'rgba(255, 255, 255, 0.03)',
        borderLeft: '1px solid rgba(255, 255, 255, 0.10)',
      }}
    >
      {/* Header */}
      <div
        className="h-12 px-3 flex items-center justify-between shrink-0"
        style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.10)' }}
      >
        <h3 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
          <Package className="w-4 h-4 text-[var(--accent-primary)]" />
          Items
        </h3>
        {onToggle && (
          <button
            onClick={onToggle}
            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] transition-colors"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Search */}
      <div className="p-2 shrink-0">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-muted)]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search items..."
            className="w-full rounded-lg pl-8 pr-3 py-2 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
            style={{
              background: 'var(--bg-input)',
              border: '1px solid var(--border-secondary)',
            }}
          />
        </div>
      </div>

      {/* Item List */}
      <div className="flex-1 overflow-y-auto p-2 min-h-0">
        {loading ? (
          <div className="text-center py-8">
            <div className="w-6 h-6 border-2 border-[var(--accent-primary)] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <p className="text-xs text-[var(--text-muted)]">
              Loading items...
            </p>
          </div>
        ) : error ? (
          <div className="text-center py-8">
            <p className="text-xs text-[var(--status-error)]">{error}</p>
          </div>
        ) : (
          <div className="space-y-1">
            {ITEM_CATEGORIES.map((category) => {
              const categoryItems = groupedItems[category] || []
              if (categoryItems.length === 0) return null

              const isExpanded = expandedCategories.has(category)

              return (
                <div key={category}>
                  {/* Category Header */}
                  <button
                    onClick={() => toggleCategory(category)}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--glass-bg-subtle)] transition-colors"
                  >
                    {isExpanded ? (
                      <ChevronDown className="w-3 h-3 text-[var(--accent-primary)] shrink-0" />
                    ) : (
                      <ChevronRight className="w-3 h-3 shrink-0" />
                    )}
                    <span className="flex-1 text-left font-medium truncate">
                      {category}
                    </span>
                    <span className="text-[10px] text-[var(--text-muted)] shrink-0">
                      {categoryItems.length}
                    </span>
                  </button>

                  {/* Category Items */}
                  {isExpanded && (
                    <div className="ml-2 mt-1 space-y-0.5 max-h-48 overflow-y-auto">
                      {categoryItems.map((item) => (
                        <button
                          key={item.itemid}
                          onClick={() => onItemSelect(item.shortname)}
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.setData(
                              'application/x-rust-item',
                              item.shortname
                            )
                            e.dataTransfer.effectAllowed = 'copy'
                          }}
                          className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--accent-primary)]/10 transition-colors cursor-grab active:cursor-grabbing"
                          title={`${item.Name} — drag to slot`}
                        >
                          <img
                            src={getItemImageUrl(item.shortname)}
                            alt={item.shortname}
                            referrerPolicy="no-referrer"
                            draggable={false}
                            className="w-6 h-6 object-contain rounded shrink-0"
                            style={{ background: 'rgba(0,0,0,0.3)' }}
                            onError={(e) => {
                              ;(e.target as HTMLImageElement).style.display =
                                'none'
                            }}
                          />
                          <span className="truncate flex-1 text-left">
                            {item.shortname}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </aside>
  )
}
