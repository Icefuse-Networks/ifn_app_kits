'use client'

import { useState } from 'react'
import { Folder, ChevronDown, ChevronRight } from 'lucide-react'

interface CategoryDropdownProps {
  categoryId: string | null
  subcategoryId: string | null
  categories: Record<string, { name: string; subcategories?: Record<string, { name: string }> }>
  onChange: (categoryId: string | null, subcategoryId: string | null) => void
}

export function CategoryDropdown({
  categoryId,
  subcategoryId,
  categories,
  onChange,
}: CategoryDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())

  const getCategoryLabel = () => {
    if (!categoryId) return 'Uncategorized'
    const category = categories[categoryId]
    if (!category) return 'Unknown'
    if (!subcategoryId) return category.name
    const subcategory = category.subcategories?.[subcategoryId]
    return subcategory ? `${category.name} / ${subcategory.name}` : category.name
  }

  const toggleCategory = (catId: string) => {
    const newExpanded = new Set(expandedCategories)
    if (newExpanded.has(catId)) {
      newExpanded.delete(catId)
    } else {
      newExpanded.add(catId)
    }
    setExpandedCategories(newExpanded)
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg transition-colors hover:bg-[var(--bg-card-hover)] w-full"
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--glass-border)',
        }}
      >
        <Folder className="w-4 h-4 text-[var(--text-secondary)]" />
        <span className="text-sm text-[var(--text-primary)] flex-1 text-left truncate">
          {getCategoryLabel()}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-[var(--text-muted)] transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div
            className="absolute top-full left-0 mt-1 w-full rounded-lg py-2 shadow-lg z-20 max-h-64 overflow-y-auto"
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--glass-border)',
            }}
          >
            {/* Uncategorized option */}
            <button
              onClick={() => {
                onChange(null, null)
                setIsOpen(false)
              }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-[var(--bg-card-hover)] transition-colors ${
                !categoryId ? 'bg-[var(--accent-primary)]/20 text-[var(--accent-primary)]' : 'text-[var(--text-primary)]'
              }`}
            >
              <Folder className="w-4 h-4" />
              Uncategorized
            </button>

            {/* Categories */}
            {Object.entries(categories).map(([catId, category]) => (
              <div key={catId}>
                <div className="flex items-center">
                  <button
                    onClick={() => {
                      if (category.subcategories && Object.keys(category.subcategories).length > 0) {
                        toggleCategory(catId)
                      } else {
                        onChange(catId, null)
                        setIsOpen(false)
                      }
                    }}
                    className={`flex-1 flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-[var(--bg-card-hover)] transition-colors ${
                      categoryId === catId && !subcategoryId
                        ? 'bg-[var(--accent-primary)]/20 text-[var(--accent-primary)]'
                        : 'text-[var(--text-primary)]'
                    }`}
                  >
                    {category.subcategories && Object.keys(category.subcategories).length > 0 ? (
                      <ChevronRight
                        className={`w-4 h-4 transition-transform ${
                          expandedCategories.has(catId) ? 'rotate-90' : ''
                        }`}
                      />
                    ) : (
                      <div className="w-4" />
                    )}
                    <Folder className="w-4 h-4" />
                    {category.name}
                  </button>
                </div>

                {/* Subcategories */}
                {expandedCategories.has(catId) &&
                  category.subcategories &&
                  Object.entries(category.subcategories).map(([subId, subcategory]) => (
                    <button
                      key={subId}
                      onClick={() => {
                        onChange(catId, subId)
                        setIsOpen(false)
                      }}
                      className={`w-full flex items-center gap-2 px-3 py-2 pl-12 text-left text-sm hover:bg-[var(--bg-card-hover)] transition-colors ${
                        categoryId === catId && subcategoryId === subId
                          ? 'bg-[var(--accent-primary)]/20 text-[var(--accent-primary)]'
                          : 'text-[var(--text-secondary)]'
                      }`}
                    >
                      <Folder className="w-3.5 h-3.5" />
                      {subcategory.name}
                    </button>
                  ))}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
