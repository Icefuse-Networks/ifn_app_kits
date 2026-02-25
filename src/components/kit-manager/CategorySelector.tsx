'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import {
  FolderOpen,
  ChevronDown,
  Edit3,
  Copy,
  Trash2,
  Plus,
  Loader2,
  Server,
} from 'lucide-react'

// =============================================================================
// Types
// =============================================================================

export interface CategorySummary {
  id: string
  name: string
  description: string | null
  kitCount: number
  updatedAt: string
}

interface CategorySelectorProps {
  categories: CategorySummary[]
  activeCategoryId: string | null
  onSwitch: (id: string) => void
  onCreateNew: () => void
  onRename: () => void
  onDuplicate: () => void
  onDelete: () => void
  loading: boolean
  onOpenMappings?: () => void
}

// =============================================================================
// Component
// =============================================================================

export function CategorySelector({
  categories,
  activeCategoryId,
  onSwitch,
  onCreateNew,
  onRename,
  onDuplicate,
  onDelete,
  loading,
  onOpenMappings,
}: CategorySelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const activeCategory = categories.find((c) => c.id === activeCategoryId)

  // Close on outside click / Escape
  useEffect(() => {
    if (!isOpen) return
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen])

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)
    if (minutes < 1) return 'Just now'
    if (minutes < 60) return `${minutes}m ago`
    if (hours < 24) return `${hours}h ago`
    if (days < 30) return `${days}d ago`
    return date.toLocaleDateString()
  }

  return (
    <div
      ref={dropdownRef}
      className="px-3 py-2"
      style={{ borderBottom: '1px solid var(--glass-border)' }}
    >
      {/* Row 1: Name + dropdown — full width, name never truncated */}
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          disabled={loading}
          className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors hover:bg-[var(--bg-card-hover)]"
          style={{ background: isOpen ? 'var(--bg-card-hover)' : 'transparent' }}
        >
          <FolderOpen className="w-4 h-4 text-[var(--accent-primary)] shrink-0" />
          <span className="flex-1 text-sm font-medium text-[var(--text-primary)] text-left truncate">
            {activeCategory ? activeCategory.name : 'No Category'}
          </span>
          {loading ? (
            <Loader2 className="w-3.5 h-3.5 text-[var(--text-muted)] animate-spin shrink-0" />
          ) : (
            <ChevronDown
              className={`w-3.5 h-3.5 text-[var(--text-muted)] shrink-0 transition-transform ${
                isOpen ? 'rotate-180' : ''
              }`}
            />
          )}
        </button>

        {/* Dropdown Panel */}
        {isOpen && categories.length > 0 && (
          <div
            className="absolute left-0 right-0 top-full z-50 mt-1 rounded-2xl overflow-hidden max-h-80 overflow-y-auto"
            style={{
              background: 'linear-gradient(to bottom right, #0a0a0f 0%, #1a1a2e 50%, #0f1419 100%)',
              border: '1px solid var(--glass-border)',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
            }}
          >
            {categories.map((cat) => {
              const isActive = cat.id === activeCategoryId
              return (
                <button
                  key={cat.id}
                  onClick={() => { onSwitch(cat.id); setIsOpen(false) }}
                  className={`w-full text-left px-3 py-2.5 transition-colors duration-150 ${
                    isActive ? 'bg-[var(--accent-primary)]/10' : 'hover:bg-[var(--glass-bg-prominent)]'
                  }`}
                  style={{
                    borderLeft: isActive ? '2px solid var(--accent-primary)' : '2px solid transparent',
                  }}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-sm font-medium truncate ${
                        isActive ? 'text-[var(--accent-primary)]' : 'text-[var(--text-primary)]'
                      }`}
                    >
                      {cat.name}
                    </span>
                    <span className="text-[10px] text-[var(--text-muted)] shrink-0">
                      {cat.kitCount} kit{cat.kitCount !== 1 ? 's' : ''}
                    </span>
                  </div>
                  {cat.description && (
                    <p className="text-xs text-[var(--text-muted)] truncate mt-0.5">
                      {cat.description}
                    </p>
                  )}
                  <p className="text-[10px] text-[var(--text-muted)] mt-0.5">
                    {formatDate(cat.updatedAt)}
                  </p>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Row 2: Action strip — always visible when a category is loaded */}
      {activeCategory && !loading && (
        <div className="flex items-center gap-0.5 mt-0.5 px-1">
          <button
            onClick={onRename}
            className="p-1.5 rounded-md transition-colors hover:bg-[var(--bg-card-hover)]"
            title="Rename"
          >
            <Edit3 className="w-3 h-3 text-[var(--text-muted)]" />
          </button>
          <button
            onClick={onDuplicate}
            className="p-1.5 rounded-md transition-colors hover:bg-[var(--bg-card-hover)]"
            title="Duplicate"
          >
            <Copy className="w-3 h-3 text-[var(--text-muted)]" />
          </button>
          <button
            onClick={() => {
              if (confirm(`Delete "${activeCategory.name}" and all its kits? This cannot be undone.`)) {
                onDelete()
              }
            }}
            className="p-1.5 rounded-md transition-colors hover:bg-[var(--status-error)]/10"
            title="Delete"
          >
            <Trash2 className="w-3 h-3 text-[var(--status-error)]" />
          </button>
          <div className="flex-1" />
          {onOpenMappings && (
            <button
              onClick={onOpenMappings}
              className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] text-[var(--accent-primary)] transition-colors hover:bg-[var(--accent-primary)]/10"
              title="Server Mappings"
            >
              <Server className="w-3 h-3" />
              <span>Mappings</span>
            </button>
          )}
          <button
            onClick={() => { onCreateNew(); setIsOpen(false) }}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] text-[var(--accent-primary)] transition-colors hover:bg-[var(--accent-primary)]/10"
            title="New Category"
          >
            <Plus className="w-3 h-3" />
            <span>New</span>
          </button>
        </div>
      )}

      {/* No category state */}
      {!activeCategory && !loading && (
        <div className="mt-2 text-center">
          <p className="text-xs text-[var(--text-muted)] mb-2">
            {categories.length === 0 ? 'No categories yet' : 'Select a category to start editing'}
          </p>
          <button
            onClick={() => { onCreateNew(); setIsOpen(false) }}
            className="text-xs text-[var(--accent-primary)] hover:underline"
          >
            Create your first category
          </button>
        </div>
      )}
    </div>
  )
}
