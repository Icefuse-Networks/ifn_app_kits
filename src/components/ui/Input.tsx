'use client'

import { forwardRef, ReactNode, InputHTMLAttributes, TextareaHTMLAttributes } from 'react'

// =============================================================================
// Types
// =============================================================================

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string
  error?: string
  helperText?: string
  leftIcon?: ReactNode
  icon?: ReactNode
  rightIcon?: ReactNode
  size?: 'sm' | 'md' | 'lg'
  variant?: 'default' | 'filled' | 'outlined'
}

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
  helperText?: string
  resize?: boolean
}

// =============================================================================
// Input Component
// =============================================================================

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      helperText,
      leftIcon,
      icon,
      rightIcon,
      size = 'md',
      variant = 'default',
      className = '',
      disabled,
      ...props
    },
    ref
  ) => {
    const resolvedLeftIcon = leftIcon ?? icon
    const sizeClasses = {
      sm: 'px-2.5 py-1.5 text-xs',
      md: 'px-3 py-2 text-sm',
      lg: 'px-4 py-3 text-base',
    }

    const variantStyles = {
      default: {
        background: 'var(--bg-input)',
        border: error ? '1px solid var(--status-error)' : '1px solid var(--border-secondary)',
      },
      filled: {
        background: 'var(--bg-card)',
        border: error ? '1px solid var(--status-error)' : '1px solid transparent',
      },
      outlined: {
        background: 'transparent',
        border: error ? '2px solid var(--status-error)' : '2px solid var(--border-secondary)',
      },
    }

    return (
      <div className={className}>
        {label && (
          <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
            {label}
            {props.required && <span className="text-[var(--status-error)] ml-1">*</span>}
          </label>
        )}

        <div className="relative">
          {resolvedLeftIcon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none">
              {resolvedLeftIcon}
            </div>
          )}

          <input
            ref={ref}
            disabled={disabled}
            className={`w-full rounded-lg text-[var(--text-primary)] placeholder-[var(--text-muted)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] disabled:opacity-50 disabled:cursor-not-allowed ${
              sizeClasses[size]
            } ${resolvedLeftIcon ? 'pl-9' : ''} ${rightIcon ? 'pr-9' : ''}`}
            style={variantStyles[variant]}
            {...props}
          />

          {rightIcon && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none">
              {rightIcon}
            </div>
          )}
        </div>

        {(error || helperText) && (
          <p
            className={`mt-1.5 text-xs ${
              error ? 'text-[var(--status-error)]' : 'text-[var(--text-muted)]'
            }`}
          >
            {error || helperText}
          </p>
        )}
      </div>
    )
  }
)

Input.displayName = 'Input'

// =============================================================================
// Textarea Component
// =============================================================================

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      label,
      error,
      helperText,
      resize = false,
      className = '',
      disabled,
      rows = 3,
      ...props
    },
    ref
  ) => {
    return (
      <div className={className}>
        {label && (
          <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
            {label}
            {props.required && <span className="text-[var(--status-error)] ml-1">*</span>}
          </label>
        )}

        <textarea
          ref={ref}
          disabled={disabled}
          rows={rows}
          className={`w-full rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] disabled:opacity-50 disabled:cursor-not-allowed ${
            !resize ? 'resize-none' : ''
          }`}
          style={{
            background: 'var(--bg-input)',
            border: error ? '1px solid var(--status-error)' : '1px solid var(--border-secondary)',
          }}
          {...props}
        />

        {(error || helperText) && (
          <p
            className={`mt-1.5 text-xs ${
              error ? 'text-[var(--status-error)]' : 'text-[var(--text-muted)]'
            }`}
          >
            {error || helperText}
          </p>
        )}
      </div>
    )
  }
)

Textarea.displayName = 'Textarea'

// =============================================================================
// Number Input with Controls
// =============================================================================

export interface NumberInputProps extends Omit<InputProps, 'type' | 'onChange'> {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  showControls?: boolean
}

export function NumberInput({
  value,
  onChange,
  min,
  max,
  step = 1,
  showControls = true,
  ...props
}: NumberInputProps) {
  const handleIncrement = () => {
    const newValue = value + step
    if (max === undefined || newValue <= max) {
      onChange(newValue)
    }
  }

  const handleDecrement = () => {
    const newValue = value - step
    if (min === undefined || newValue >= min) {
      onChange(newValue)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseFloat(e.target.value)
    if (!isNaN(newValue)) {
      onChange(newValue)
    }
  }

  return (
    <div className="relative">
      <Input
        {...props}
        type="number"
        value={value}
        onChange={handleChange}
        min={min}
        max={max}
        step={step}
        className={showControls ? 'pr-8' : ''}
      />
      {showControls && (
        <div className="absolute right-1 top-1/2 -translate-y-1/2 flex flex-col gap-0.5">
          <button
            type="button"
            onClick={handleIncrement}
            disabled={max !== undefined && value >= max}
            className="w-6 h-4 flex items-center justify-center rounded text-[var(--text-muted)] hover:bg-[var(--glass-bg)] hover:text-[var(--text-primary)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </svg>
          </button>
          <button
            type="button"
            onClick={handleDecrement}
            disabled={min !== undefined && value <= min}
            className="w-6 h-4 flex items-center justify-center rounded text-[var(--text-muted)] hover:bg-[var(--glass-bg)] hover:text-[var(--text-primary)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      )}
    </div>
  )
}
