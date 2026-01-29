'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { Tags, X, Plus, ChevronDown } from 'lucide-react'

// =============================================================================
// Types
// =============================================================================

interface SubcategoryEditorProps {
  subcategories: string[]
  allSubcategories: string[]
  onChange: (subcategories: string[]) => void
}

// =============================================================================
// Component
// =============================================================================

export function SubcategoryEditor({
  subcategories,
  allSubcategories,
  onChange,
}: SubcategoryEditorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const hasSubcategories = subcategories.length > 0

  // Suggestions: all existing subcategories not already selected
  const suggestions = useMemo(() => {
    const selectedSet = new Set(subcategories.map(s => s.toLowerCase()))
    const q = inputValue.toLowerCase().trim()
    return allSubcategories
      .filter(s => !selectedSet.has(s.toLowerCase()))
      .filter(s => !q || s.toLowerCase().includes(q))
      .slice(0, 8)
  }, [allSubcategories, subcategories, inputValue])

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false)
        setInputValue('')
      }
    }
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false)
        setInputValue('')
      }
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen])

  // Focus input when dropdown opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  const addSubcategory = (value: string) => {
    const trimmed = value.trim()
    if (!trimmed) return
    // Case-insensitive duplicate check
    if (subcategories.some(s => s.toLowerCase() === trimmed.toLowerCase())) return
    onChange([...subcategories, trimmed])
    setInputValue('')
  }

  const removeSubcategory = (value: string) => {
    onChange(subcategories.filter(s => s !== value))
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      addSubcategory(inputValue)
    }
  }

  return (
    <div ref={dropdownRef} className="relative shrink-0">
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition cursor-pointer ${
          hasSubcategories
            ? 'text-[var(--accent-primary)]'
            : 'text-[var(--text-muted)]'
        }`}
        style={{
          background: hasSubcategories
            ? 'rgba(var(--accent-primary-rgb), 0.15)'
            : 'var(--glass-bg)',
          border: hasSubcategories
            ? '1px solid var(--accent-primary)'
            : '1px solid var(--glass-border)',
        }}
      >
        <Tags className="w-3 h-3" />
        <span>
          {subcategories.length === 0
            ? 'Subcategories'
            : subcategories.length === 1
              ? subcategories[0]
              : `${subcategories.length} Subcategories`}
        </span>
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
          <div className="p-3">
            {/* Label */}
            <p className="text-xs text-[var(--text-muted)] mb-2">
              Organize kits into UI subcategories
            </p>

            {/* Current Subcategories */}
            {subcategories.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {subcategories.map((sub) => (
                  <span
                    key={sub}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-[var(--accent-primary)]/15 text-[var(--accent-primary)] border border-[var(--accent-primary)]/30"
                  >
                    {sub}
                    <button
                      onClick={() => removeSubcategory(sub)}
                      className="hover:text-[var(--status-error)] transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Input */}
            <div className="relative">
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Add subcategory..."
                maxLength={50}
                className="w-full rounded-lg pl-3 pr-8 py-2 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
                style={{
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-secondary)',
                }}
              />
              <button
                onClick={() => addSubcategory(inputValue)}
                disabled={!inputValue.trim()}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-[var(--accent-primary)]/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <Plus className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
              </button>
            </div>

            {/* Suggestions */}
            {suggestions.length > 0 && (
              <div className="mt-2 pt-2 border-t border-[var(--glass-border)]">
                <p className="text-xs text-[var(--text-muted)] mb-1.5">Existing subcategories</p>
                <div className="flex flex-wrap gap-1">
                  {suggestions.map((sub) => (
                    <button
                      key={sub}
                      onClick={() => addSubcategory(sub)}
                      className="px-2 py-0.5 rounded-full text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--glass-bg-prominent)] transition-colors"
                      style={{
                        background: 'var(--glass-bg)',
                        border: '1px solid var(--glass-border)',
                      }}
                    >
                      + {sub}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default SubcategoryEditor
