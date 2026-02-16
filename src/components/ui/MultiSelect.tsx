'use client'

import { useState, useRef, useEffect, ReactNode } from 'react'
import { ChevronDown, Check, X } from 'lucide-react'

// =============================================================================
// Types
// =============================================================================

export interface MultiSelectOption {
  value: string
  label: string
  description?: string
  icon?: ReactNode
  disabled?: boolean
}

export interface MultiSelectProps {
  value: string[]
  options: MultiSelectOption[]
  onChange: (value: string[]) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  error?: string
  maxHeight?: string
  searchable?: boolean
  showSelectAll?: boolean
}

// =============================================================================
// MultiSelect Component
// =============================================================================

export function MultiSelect({
  value = [],
  options,
  onChange,
  placeholder = 'Select items...',
  disabled = false,
  className = '',
  error,
  maxHeight = '240px',
  searchable = false,
  showSelectAll = true,
}: MultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Filter options based on search query
  const filteredOptions = searchable
    ? options.filter((opt) =>
        opt.label.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : options

  // Get display text
  const displayText =
    value.length === 0
      ? placeholder
      : value.length === 1
      ? options.find((o) => o.value === value[0])?.label || placeholder
      : `${value.length} selected`

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return

    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false)
        setSearchQuery('')
      }
    }

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false)
        setSearchQuery('')
      }
    }

    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen])

  // Auto-focus search input when opened
  useEffect(() => {
    if (isOpen && searchable && searchInputRef.current) {
      searchInputRef.current.focus()
    }
  }, [isOpen, searchable])

  const handleToggle = (optionValue: string) => {
    if (value.includes(optionValue)) {
      onChange(value.filter((v) => v !== optionValue))
    } else {
      onChange([...value, optionValue])
    }
  }

  const handleSelectAll = () => {
    const allValues = filteredOptions
      .filter((opt) => !opt.disabled)
      .map((opt) => opt.value)
    onChange(allValues)
  }

  const handleDeselectAll = () => {
    onChange([])
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onChange([])
  }

  const allSelected =
    filteredOptions.length > 0 &&
    filteredOptions.every((opt) => opt.disabled || value.includes(opt.value))

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className="w-full flex items-center justify-between gap-2 px-3 py-3 rounded-lg text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] disabled:opacity-50 disabled:cursor-not-allowed"
        style={{
          background: 'var(--bg-input)',
          border: error ? '1px solid var(--status-error)' : '1px solid var(--border-secondary)',
          color: value.length > 0 ? 'var(--text-primary)' : 'var(--text-muted)',
        }}
      >
        <span className="truncate flex-1 text-left">{displayText}</span>
        <div className="flex items-center gap-1 shrink-0">
          {value.length > 0 && !disabled && (
            <button
              onClick={handleClear}
              className="p-0.5 rounded hover:bg-[var(--glass-bg)] transition-colors"
              title="Clear all"
            >
              <X className="w-3.5 h-3.5 text-[var(--text-muted)]" />
            </button>
          )}
          <ChevronDown
            className={`w-4 h-4 text-[var(--text-muted)] transition-transform ${
              isOpen ? 'rotate-180' : ''
            }`}
          />
        </div>
      </button>

      {/* Error Message */}
      {error && (
        <p className="mt-1 text-xs text-[var(--status-error)]">{error}</p>
      )}

      {/* Dropdown Panel */}
      {isOpen && (
        <div
          className="absolute left-0 top-full z-[9999] mt-1 w-full rounded-lg overflow-hidden"
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
          {/* Search Input */}
          {searchable && (
            <div className="p-2 border-b border-[var(--glass-border)]">
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search..."
                className="w-full px-2 py-1.5 text-sm rounded bg-[var(--bg-input)] border border-[var(--border-secondary)] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
              />
            </div>
          )}

          {/* Select All / Deselect All */}
          {showSelectAll && filteredOptions.length > 0 && (
            <div className="p-1 border-b border-[var(--glass-border)]">
              <button
                type="button"
                onClick={allSelected ? handleDeselectAll : handleSelectAll}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[var(--accent-primary)] hover:bg-[var(--glass-bg)] rounded transition-colors"
              >
                {allSelected ? 'Deselect All' : 'Select All'}
              </button>
            </div>
          )}

          <div className="py-1 overflow-y-auto" style={{ maxHeight }}>
            {/* Options */}
            {filteredOptions.map((option) => {
              const isSelected = value.includes(option.value)

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => !option.disabled && handleToggle(option.value)}
                  disabled={option.disabled}
                  className={`w-full flex items-start gap-3 px-3 py-2.5 text-sm text-left transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                    isSelected
                      ? 'bg-[var(--accent-primary)]/10'
                      : 'hover:bg-[var(--glass-bg)]'
                  }`}
                >
                  {/* Checkbox */}
                  <div
                    className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                      isSelected
                        ? 'bg-[var(--accent-primary)] border-[var(--accent-primary)]'
                        : 'border-[var(--border-secondary)]'
                    }`}
                  >
                    {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                  </div>

                  {/* Content */}
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {option.icon && <span className="shrink-0">{option.icon}</span>}
                    <div className="flex-1 min-w-0">
                      <span
                        className={`truncate block ${
                          isSelected
                            ? 'text-[var(--text-primary)]'
                            : 'text-[var(--text-secondary)]'
                        }`}
                      >
                        {option.label}
                      </span>
                      {option.description && (
                        <span className="text-xs text-[var(--text-muted)] block truncate">
                          {option.description}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              )
            })}

            {/* Empty state */}
            {filteredOptions.length === 0 && (
              <p className="px-3 py-2 text-xs text-[var(--text-muted)] italic">
                {searchable && searchQuery ? 'No results found' : 'No options available'}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
