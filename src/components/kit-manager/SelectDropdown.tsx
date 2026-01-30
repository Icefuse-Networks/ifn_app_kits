'use client'

import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Check } from 'lucide-react'

// =============================================================================
// Types
// =============================================================================

export interface SelectOption {
  value: string
  label: string
}

interface SelectDropdownProps {
  value: string | null
  options: SelectOption[]
  onChange: (value: string | null) => void
  placeholder?: string
  emptyOption?: string
  disabled?: boolean
  className?: string
}

// =============================================================================
// Component
// =============================================================================

export function SelectDropdown({
  value,
  options,
  onChange,
  placeholder = 'Select...',
  emptyOption,
  disabled = false,
  className = '',
}: SelectDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Get display label for current value
  const displayLabel =
    value === null || value === ''
      ? emptyOption || placeholder
      : options.find((o) => o.value === value)?.label || placeholder

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

  const handleSelect = (optionValue: string | null) => {
    onChange(optionValue)
    setIsOpen(false)
  }

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className="w-full flex items-center justify-between gap-2 px-3 py-3 rounded-lg text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--portal-accent)] disabled:opacity-50 disabled:cursor-not-allowed"
        style={{
          background: 'var(--bg-input)',
          border: '1px solid var(--border-secondary)',
          color:
            value === null || value === ''
              ? 'var(--text-muted)'
              : 'var(--text-primary)',
        }}
      >
        <span className="truncate">{displayLabel}</span>
        <ChevronDown
          className={`w-4 h-4 shrink-0 text-[var(--text-muted)] transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

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
          <div className="py-1 max-h-[240px] overflow-y-auto">
            {/* Empty/Default option */}
            {emptyOption && (
              <button
                type="button"
                onClick={() => handleSelect(null)}
                className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 text-sm text-left transition-colors ${
                  value === null || value === ''
                    ? 'bg-[var(--portal-accent)]/15 text-[var(--portal-accent)]'
                    : 'text-[var(--portal-text-secondary)] hover:bg-[var(--portal-glass-bg-hover)]'
                }`}
              >
                <span>{emptyOption}</span>
                {(value === null || value === '') && (
                  <Check className="w-4 h-4 shrink-0" />
                )}
              </button>
            )}

            {/* Options */}
            {options.map((option) => {
              const isSelected = value === option.value

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleSelect(option.value)}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 text-sm text-left transition-colors ${
                    isSelected
                      ? 'bg-[var(--portal-accent)]/15 text-[var(--portal-accent)]'
                      : 'text-[var(--portal-text-secondary)] hover:bg-[var(--portal-glass-bg-hover)]'
                  }`}
                >
                  <span className="truncate">{option.label}</span>
                  {isSelected && <Check className="w-4 h-4 shrink-0" />}
                </button>
              )
            })}

            {/* Empty state */}
            {options.length === 0 && !emptyOption && (
              <p className="px-3 py-2 text-xs text-[var(--portal-text-muted)] italic">
                No options available
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default SelectDropdown
