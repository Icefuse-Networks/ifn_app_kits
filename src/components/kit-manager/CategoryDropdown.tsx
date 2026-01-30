'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { FolderTree, ChevronDown, ChevronRight, X } from 'lucide-react'
import type { KitCategory } from '@/types/kit'

// =============================================================================
// Types
// =============================================================================

interface CategoryDropdownProps {
  categoryId: string | undefined
  subcategoryId: string | undefined
  categories: Record<string, KitCategory>
  onChange: (categoryId: string | undefined, subcategoryId: string | undefined) => void
}

// =============================================================================
// Component
// =============================================================================

export function CategoryDropdown({
  categoryId,
  subcategoryId,
  categories,
  onChange,
}: CategoryDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [expandedCategory, setExpandedCategory] = useState<string | null>(categoryId || null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const hasAssignment = !!categoryId

  // Get display name for current assignment
  const displayName = useMemo(() => {
    if (!categoryId) return 'Category'
    const cat = categories[categoryId]
    if (!cat) return 'Category'
    if (!subcategoryId) return cat.name
    const sub = cat.subcategories?.[subcategoryId]
    return sub ? `${cat.name} / ${sub.name}` : cat.name
  }, [categoryId, subcategoryId, categories])

  // Sort categories by order
  const sortedCategories = useMemo(() => {
    return Object.entries(categories)
      .map(([id, cat]) => ({ id, ...cat }))
      .sort((a, b) => a.order - b.order)
  }, [categories])

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen])

  const handleCategoryClick = (catId: string) => {
    if (expandedCategory === catId) {
      // Already expanded, select the category (no subcategory)
      onChange(catId, undefined)
      setIsOpen(false)
    } else {
      // Expand to show subcategories
      setExpandedCategory(catId)
    }
  }

  const handleSubcategoryClick = (catId: string, subId: string) => {
    onChange(catId, subId)
    setIsOpen(false)
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onChange(undefined, undefined)
    setIsOpen(false)
  }

  return (
    <div ref={dropdownRef} className="relative shrink-0">
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition cursor-pointer ${
          hasAssignment
            ? 'text-[var(--accent-primary)]'
            : 'text-[var(--text-muted)]'
        }`}
        style={{
          background: hasAssignment
            ? 'rgba(var(--accent-primary-rgb), 0.15)'
            : 'var(--glass-bg)',
          border: hasAssignment
            ? '1px solid var(--accent-primary)'
            : '1px solid var(--glass-border)',
        }}
      >
        <FolderTree className="w-3 h-3" />
        <span className="max-w-[150px] truncate">{displayName}</span>
        {hasAssignment && (
          <button
            onClick={handleClear}
            className="hover:text-[var(--status-error)] transition-colors ml-0.5"
            title="Remove category assignment"
          >
            <X className="w-3 h-3" />
          </button>
        )}
        <ChevronDown
          className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div
          className="absolute left-0 top-full z-[9999] mt-1 w-64 rounded-lg overflow-hidden"
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
          <div className="p-3 max-h-[300px] overflow-y-auto">
            {/* Label */}
            <p className="text-xs text-[var(--text-muted)] mb-2">
              Assign kit to a category
            </p>

            {sortedCategories.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)] italic py-2">
                No categories defined. Create categories in the sidebar.
              </p>
            ) : (
              <div className="space-y-0.5">
                {/* Uncategorized option */}
                <button
                  onClick={() => {
                    onChange(undefined, undefined)
                    setIsOpen(false)
                  }}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs text-left transition-colors ${
                    !categoryId
                      ? 'bg-[var(--accent-primary)]/15 text-[var(--accent-primary)]'
                      : 'text-[var(--text-secondary)] hover:bg-[var(--glass-bg)]'
                  }`}
                >
                  <span className="italic">Uncategorized</span>
                </button>

                {/* Categories */}
                {sortedCategories.map((cat) => {
                  const isExpanded = expandedCategory === cat.id
                  const isSelected = categoryId === cat.id
                  const subcats = Object.entries(cat.subcategories || {})
                    .map(([id, sub]) => ({ id, ...sub }))
                    .sort((a, b) => a.order - b.order)

                  return (
                    <div key={cat.id}>
                      <button
                        onClick={() => handleCategoryClick(cat.id)}
                        className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs text-left transition-colors ${
                          isSelected && !subcategoryId
                            ? 'bg-[var(--accent-primary)]/15 text-[var(--accent-primary)]'
                            : 'text-[var(--text-secondary)] hover:bg-[var(--glass-bg)]'
                        }`}
                      >
                        {subcats.length > 0 ? (
                          <ChevronRight
                            className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                          />
                        ) : (
                          <span className="w-3" />
                        )}
                        <FolderTree className="w-3 h-3" />
                        <span className="flex-1 truncate">{cat.name}</span>
                      </button>

                      {/* Subcategories */}
                      {isExpanded && subcats.length > 0 && (
                        <div className="ml-5 mt-0.5 space-y-0.5">
                          {subcats.map((sub) => (
                            <button
                              key={sub.id}
                              onClick={() => handleSubcategoryClick(cat.id, sub.id)}
                              className={`w-full flex items-center gap-2 px-2 py-1 rounded text-xs text-left transition-colors ${
                                categoryId === cat.id && subcategoryId === sub.id
                                  ? 'bg-[var(--accent-primary)]/15 text-[var(--accent-primary)]'
                                  : 'text-[var(--text-tertiary)] hover:bg-[var(--glass-bg)] hover:text-[var(--text-secondary)]'
                              }`}
                            >
                              <span className="truncate">{sub.name}</span>
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
        </div>
      )}
    </div>
  )
}

export default CategoryDropdown
