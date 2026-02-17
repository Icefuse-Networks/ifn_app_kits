'use client'

import { forwardRef, InputHTMLAttributes, useState } from 'react'
import { Search, X } from 'lucide-react'

// =============================================================================
// Types
// =============================================================================

export interface SearchInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
  onClear?: () => void
  showClearButton?: boolean
  size?: 'sm' | 'md' | 'lg'
  variant?: 'default' | 'filled'
  label?: string
}

// =============================================================================
// SearchInput Component
// =============================================================================

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  (
    {
      onClear,
      showClearButton = true,
      size = 'md',
      variant = 'default',
      className = '',
      value,
      onChange,
      ...props
    },
    ref
  ) => {
    const [internalValue, setInternalValue] = useState('')
    const displayValue = value !== undefined ? value : internalValue

    const sizeClasses = {
      sm: 'pl-8 pr-2.5 py-1.5 text-xs',
      md: 'pl-9 pr-3 py-2 text-sm',
      lg: 'pl-10 pr-4 py-3 text-base',
    }

    const iconSizeClasses = {
      sm: 'w-3 h-3 left-2.5',
      md: 'w-4 h-4 left-3',
      lg: 'w-5 h-5 left-3.5',
    }

    const variantStyles = {
      default: {
        background: 'var(--bg-input)',
        border: '1px solid var(--border-secondary)',
      },
      filled: {
        background: 'var(--bg-card)',
        border: '1px solid transparent',
      },
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (value === undefined) {
        setInternalValue(e.target.value)
      }
      onChange?.(e)
    }

    const handleClear = () => {
      if (value === undefined) {
        setInternalValue('')
      }
      onClear?.()
      // Trigger onChange with empty value
      const event = {
        target: { value: '' },
      } as React.ChangeEvent<HTMLInputElement>
      onChange?.(event)
    }

    const hasValue = displayValue && String(displayValue).length > 0

    return (
      <div className={`relative ${className}`}>
        {/* Search Icon */}
        <Search
          className={`absolute top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none ${iconSizeClasses[size]}`}
        />

        {/* Input */}
        <input
          ref={ref}
          type="text"
          value={displayValue}
          onChange={handleChange}
          className={`w-full rounded-lg text-[var(--text-primary)] placeholder-[var(--text-muted)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] disabled:opacity-50 disabled:cursor-not-allowed ${
            sizeClasses[size]
          } ${showClearButton && hasValue ? 'pr-9' : ''}`}
          style={variantStyles[variant]}
          {...props}
        />

        {/* Clear Button */}
        {showClearButton && hasValue && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-[var(--glass-bg)] transition-colors"
            title="Clear search"
          >
            <X className="w-3.5 h-3.5 text-[var(--text-muted)]" />
          </button>
        )}
      </div>
    )
  }
)

SearchInput.displayName = 'SearchInput'
