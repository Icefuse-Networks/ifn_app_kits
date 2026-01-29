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
  Check,
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
}: CategorySelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [copiedId, setCopiedId] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const copyIdToClipboard = useCallback(async () => {
    if (!activeCategoryId) return
    try {
      await navigator.clipboard.writeText(activeCategoryId)
      setCopiedId(true)
      setTimeout(() => setCopiedId(false), 2000)
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea')
      textArea.value = activeCategoryId
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      setCopiedId(true)
      setTimeout(() => setCopiedId(false), 2000)
    }
  }, [activeCategoryId])

  const activeCategory = categories.find((c) => c.id === activeCategoryId)

  // Close dropdown on outside click
  useEffect(() => {
    if (!isOpen) return
    const handleClick = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
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
      className="relative"
      style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}
    >
      {/* Active Category Display */}
      <div className="px-3 py-3">
        {/* Category name + dropdown toggle */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          disabled={loading}
          className="w-full flex items-center gap-2 p-2 rounded-lg transition-colors hover:bg-[var(--bg-card-hover)]"
          style={{
            background: isOpen ? 'var(--bg-card-hover)' : 'transparent',
          }}
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

        {/* Action buttons */}
        {activeCategory && (
          <div className="flex items-center gap-1 mt-1.5 px-1">
            <button
              onClick={onRename}
              disabled={loading}
              className="p-1.5 rounded-md transition-colors hover:bg-[var(--bg-card-hover)] disabled:opacity-40"
              title="Rename category"
            >
              <Edit3 className="w-3.5 h-3.5 text-[var(--text-muted)]" />
            </button>
            <button
              onClick={onDuplicate}
              disabled={loading}
              className="p-1.5 rounded-md transition-colors hover:bg-[var(--bg-card-hover)] disabled:opacity-40"
              title="Duplicate category"
            >
              <Copy className="w-3.5 h-3.5 text-[var(--text-muted)]" />
            </button>
            <button
              onClick={() => {
                if (
                  confirm(
                    `Delete category "${activeCategory.name}" and all its kits? This cannot be undone.`
                  )
                ) {
                  onDelete()
                }
              }}
              disabled={loading}
              className="p-1.5 rounded-md transition-colors hover:bg-[var(--status-error)]/10 disabled:opacity-40"
              title="Delete category"
            >
              <Trash2 className="w-3.5 h-3.5 text-[var(--status-error)]" />
            </button>
            <div className="flex-1" />
            <button
              onClick={() => {
                onCreateNew()
                setIsOpen(false)
              }}
              disabled={loading}
              className="flex items-center gap-1 px-2 py-1 rounded-md text-xs text-[var(--accent-primary)] transition-colors hover:bg-[var(--accent-primary)]/10 disabled:opacity-40"
              title="New category"
            >
              <Plus className="w-3 h-3" />
              New
            </button>
          </div>
        )}

        {/* Category ID Display */}
        {activeCategory && activeCategoryId && (
          <div className="mt-2 px-1">
            <button
              onClick={copyIdToClipboard}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left transition-colors hover:bg-[var(--bg-card-hover)] group"
              title="Click to copy category ID"
            >
              <span className="text-[10px] text-[var(--text-muted)] font-medium uppercase tracking-wider">
                ID
              </span>
              <code className="flex-1 text-[10px] text-[var(--text-secondary)] font-mono truncate">
                {activeCategoryId}
              </code>
              {copiedId ? (
                <Check className="w-3 h-3 text-[var(--status-success)] shrink-0" />
              ) : (
                <Copy className="w-3 h-3 text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
              )}
            </button>
          </div>
        )}

        {/* No category state */}
        {!activeCategory && !loading && (
          <div className="mt-2 text-center">
            <p className="text-xs text-[var(--text-muted)] mb-2">
              {categories.length === 0
                ? 'No categories yet'
                : 'Select a category to start editing'}
            </p>
            <button
              onClick={() => {
                onCreateNew()
                setIsOpen(false)
              }}
              className="text-xs text-[var(--accent-primary)] hover:underline"
            >
              Create your first category
            </button>
          </div>
        )}
      </div>

      {/* Dropdown Panel */}
      {isOpen && categories.length > 0 && (
        <div
          className="absolute left-2 right-2 top-full z-50 mt-1 rounded-xl overflow-hidden max-h-80 overflow-y-auto"
          style={{
            background:
              'linear-gradient(145deg, rgba(20, 35, 60, 0.95) 0%, rgba(15, 28, 50, 0.97) 50%, rgba(12, 22, 42, 0.98) 100%)',
            border: '1px solid rgba(255, 255, 255, 0.20)',
            backdropFilter: 'blur(60px) saturate(150%)',
            WebkitBackdropFilter: 'blur(60px) saturate(150%)',
            boxShadow:
              '0 4px 20px rgba(0, 0, 0, 0.30), 0 8px 32px rgba(0, 0, 0, 0.22), inset 0 1px 0 rgba(255, 255, 255, 0.25)',
          }}
        >
          {categories.map((cat) => {
            const isActive = cat.id === activeCategoryId
            return (
              <button
                key={cat.id}
                onClick={() => {
                  onSwitch(cat.id)
                  setIsOpen(false)
                }}
                className={`w-full text-left px-3 py-2.5 transition-colors duration-150 ${
                  isActive
                    ? 'bg-[var(--accent-primary)]/10'
                    : 'hover:bg-[var(--glass-bg-prominent)]'
                }`}
                style={{
                  borderLeft: isActive
                    ? '2px solid var(--accent-primary)'
                    : '2px solid transparent',
                }}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`text-sm font-medium truncate ${
                      isActive
                        ? 'text-[var(--accent-primary)]'
                        : 'text-[var(--text-primary)]'
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
  )
}
