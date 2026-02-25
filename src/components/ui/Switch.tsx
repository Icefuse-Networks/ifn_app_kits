'use client'

import { ReactNode } from 'react'
import { Check } from 'lucide-react'

// =============================================================================
// Types
// =============================================================================

export interface SwitchProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label?: string
  description?: string
  disabled?: boolean
  size?: 'sm' | 'md' | 'lg'
  className?: string
  icon?: ReactNode
}

// =============================================================================
// Switch Component (Replaces Checkboxes)
// =============================================================================

export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled = false,
  size = 'md',
  className = '',
  icon,
}: SwitchProps) {
  const sizeClasses = {
    sm: 'w-8 h-4',
    md: 'w-11 h-6',
    lg: 'w-14 h-8',
  }

  const thumbSizeClasses = {
    sm: 'w-3 h-3',
    md: 'w-5 h-5',
    lg: 'w-7 h-7',
  }

  const translateClasses = {
    sm: 'translate-x-4',
    md: 'translate-x-5',
    lg: 'translate-x-6',
  }

  return (
    <label
      className={`flex items-start gap-3 cursor-pointer ${
        disabled ? 'opacity-50 cursor-not-allowed' : ''
      } ${className}`}
    >
      {/* Switch Toggle */}
      <div className="relative shrink-0 mt-0.5">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => !disabled && onChange(e.target.checked)}
          disabled={disabled}
          className="sr-only"
        />
        <div
          className={`${sizeClasses[size]} rounded-full transition-colors ${
            checked
              ? 'bg-[var(--accent-primary)]'
              : 'bg-[var(--bg-card)]'
          } ${
            !disabled && 'focus-within:ring-2 focus-within:ring-[var(--accent-primary)]/50'
          }`}
          style={{
            border: checked
              ? '2px solid var(--accent-primary)'
              : '2px solid var(--border-secondary)',
          }}
        >
          <div
            className={`${thumbSizeClasses[size]} rounded-full bg-white transition-transform ${
              checked ? translateClasses[size] : 'translate-x-0.5'
            } flex items-center justify-center`}
            style={{
              boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
            }}
          >
            {checked && size !== 'sm' && (
              <Check className={`${size === 'lg' ? 'w-4 h-4' : 'w-3 h-3'} text-[var(--accent-primary)]`} />
            )}
          </div>
        </div>
      </div>

      {/* Label and Description */}
      {(label || description) && (
        <div className="flex-1 min-w-0">
          {label && (
            <div className="flex items-center gap-2">
              {icon && <span className="shrink-0 text-[var(--text-muted)]">{icon}</span>}
              <span
                className={`text-sm font-medium ${
                  checked ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'
                }`}
              >
                {label}
              </span>
            </div>
          )}
          {description && (
            <p className="text-xs text-[var(--text-muted)] mt-0.5">{description}</p>
          )}
        </div>
      )}
    </label>
  )
}

// =============================================================================
// Checkbox-style Switch (for forms)
// =============================================================================

export interface CheckboxSwitchProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label?: string
  description?: string
  disabled?: boolean
  className?: string
  error?: string
  variant?: 'default' | 'pill'
  /** Custom color for pill variant (e.g., 'purple-500', 'yellow-500', 'blue-500') */
  pillColor?: string
}

export function CheckboxSwitch({
  checked,
  onChange,
  label,
  description,
  disabled = false,
  className = '',
  error,
  variant = 'default',
  pillColor,
}: CheckboxSwitchProps) {
  // Pill variant (toggle button style)
  if (variant === 'pill') {
    const activeClass = pillColor
      ? `bg-${pillColor}/20 border-${pillColor} text-${pillColor.replace('-500', '-300')}`
      : 'bg-[var(--accent-primary)]/20 border-[var(--accent-primary)] text-[var(--accent-primary)]'

    const inactiveClass = 'bg-white/5 border-white/10 text-[var(--text-muted)]'

    return (
      <label
        className={`cursor-pointer select-none rounded-full border px-4 py-2 text-sm font-medium transition ${
          checked ? activeClass : inactiveClass
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
      >
        <input
          type="checkbox"
          className="sr-only"
          checked={checked}
          onChange={(e) => !disabled && onChange(e.target.checked)}
          disabled={disabled}
        />
        {label}
      </label>
    )
  }

  // Default variant (checkbox style)
  return (
    <div className={className}>
      <label
        className={`flex items-start gap-3 cursor-pointer ${
          disabled ? 'opacity-50 cursor-not-allowed' : ''
        }`}
      >
        {/* Checkbox-style */}
        <div className="relative shrink-0 mt-0.5">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => !disabled && onChange(e.target.checked)}
            disabled={disabled}
            className="sr-only"
          />
          <div
            className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
              checked
                ? 'bg-[var(--accent-primary)] border-[var(--accent-primary)]'
                : 'bg-transparent border-[var(--border-secondary)]'
            } ${
              !disabled && 'focus-within:ring-2 focus-within:ring-[var(--accent-primary)]/50'
            }`}
            style={{
              border: error
                ? '2px solid var(--status-error)'
                : checked
                ? '2px solid var(--accent-primary)'
                : '2px solid var(--border-secondary)',
            }}
          >
            {checked && <Check className="w-3.5 h-3.5 text-white" />}
          </div>
        </div>

        {/* Label and Description */}
        {(label || description) && (
          <div className="flex-1 min-w-0">
            {label && (
              <span
                className={`text-sm font-medium block ${
                  checked ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'
                }`}
              >
                {label}
              </span>
            )}
            {description && (
              <p className="text-xs text-[var(--text-muted)] mt-0.5">{description}</p>
            )}
          </div>
        )}
      </label>
      {error && (
        <p className="mt-1 text-xs text-[var(--status-error)] ml-8">{error}</p>
      )}
    </div>
  )
}
