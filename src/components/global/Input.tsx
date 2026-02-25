'use client'

import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

// ============================================================================
// Input Component
// ============================================================================

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
  icon?: React.ReactNode // Alias for leftIcon
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, leftIcon, rightIcon, icon, id, ...props }, ref) => {
    const effectiveLeftIcon = leftIcon || icon
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-')

    return (
      <div className="space-y-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-[var(--text-muted)]"
          >
            {label}
          </label>
        )}
        <div className="relative">
          {effectiveLeftIcon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">
              {effectiveLeftIcon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            className={cn(
              'w-full px-4 py-2.5 rounded-lg',
              'bg-[var(--glass-bg)] backdrop-blur-sm',
              'border border-[var(--glass-border)]',
              'text-white placeholder:text-[var(--text-muted)]',
              'transition-all duration-300',
              'focus:outline-none focus:border-[var(--accent-primary)]/50',
              'focus:shadow-[0_0_0_3px_var(--accent-primary-glow)]',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              error && 'border-[var(--status-error)]/50 focus:border-[var(--status-error)]/50 focus:shadow-[0_0_0_3px_rgba(239,68,68,0.2)]',
              !!effectiveLeftIcon && 'pl-10',
              !!rightIcon && 'pr-10',
              className
            )}
            {...props}
          />
          {rightIcon && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">
              {rightIcon}
            </div>
          )}
        </div>
        {error && <p className="text-sm text-[var(--status-error)]">{error}</p>}
        {hint && !error && <p className="text-sm text-[var(--text-muted)]">{hint}</p>}
      </div>
    )
  }
)

Input.displayName = 'Input'

// ============================================================================
// Textarea Component
// ============================================================================

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
  hint?: string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, hint, id, ...props }, ref) => {
    const textareaId = id || label?.toLowerCase().replace(/\s+/g, '-')

    return (
      <div className="space-y-1.5">
        {label && (
          <label
            htmlFor={textareaId}
            className="block text-sm font-medium text-[var(--text-muted)]"
          >
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          className={cn(
            'w-full px-4 py-2.5 rounded-lg',
            'bg-[var(--glass-bg)] backdrop-blur-sm',
            'border border-[var(--glass-border)]',
            'text-white placeholder:text-[var(--text-muted)]',
            'transition-all duration-300',
            'focus:outline-none focus:border-[var(--accent-primary)]/50',
            'focus:shadow-[0_0_0_3px_var(--accent-primary-glow)]',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            'resize-y min-h-[100px]',
            error && 'border-[var(--status-error)]/50 focus:border-[var(--status-error)]/50 focus:shadow-[0_0_0_3px_rgba(239,68,68,0.2)]',
            className
          )}
          {...props}
        />
        {error && <p className="text-sm text-[var(--status-error)]">{error}</p>}
        {hint && !error && <p className="text-sm text-[var(--text-muted)]">{hint}</p>}
      </div>
    )
  }
)

Textarea.displayName = 'Textarea'

// ============================================================================
// Checkbox Component
// ============================================================================

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string
  description?: string
  error?: string
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, description, error, id, ...props }, ref) => {
    const checkboxId = id || label?.toLowerCase().replace(/\s+/g, '-')

    return (
      <div className="space-y-1">
        <label
          htmlFor={checkboxId}
          className={cn('flex items-start gap-3 cursor-pointer group', className)}
        >
          <div className="relative mt-0.5">
            <input
              ref={ref}
              type="checkbox"
              id={checkboxId}
              className="peer sr-only"
              {...props}
            />
            <div
              className={cn(
                'w-5 h-5 rounded border-2',
                'bg-[var(--glass-bg)] border-[var(--glass-border)]',
                'transition-all duration-200',
                'peer-focus:ring-2 peer-focus:ring-[var(--accent-primary)]/30',
                'peer-checked:bg-[var(--accent-primary)] peer-checked:border-[var(--accent-primary)]',
                'peer-disabled:opacity-50 peer-disabled:cursor-not-allowed',
                'group-hover:border-[var(--accent-primary)]/50'
              )}
            />
            <svg
              className={cn(
                'absolute top-0.5 left-0.5 w-4 h-4 text-white',
                'opacity-0 transition-opacity duration-200',
                'peer-checked:opacity-100'
              )}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={3}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div className="space-y-0.5">
            {label && <span className="text-sm font-medium text-white">{label}</span>}
            {description && <p className="text-sm text-[var(--text-muted)]">{description}</p>}
          </div>
        </label>
        {error && <p className="text-sm text-[var(--status-error)] ml-8">{error}</p>}
      </div>
    )
  }
)

Checkbox.displayName = 'Checkbox'

// ============================================================================
// Switch Component
// ============================================================================

export interface SwitchProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string
  description?: string
}

export const Switch = forwardRef<HTMLInputElement, SwitchProps>(
  ({ className, label, description, id, ...props }, ref) => {
    const switchId = id || label?.toLowerCase().replace(/\s+/g, '-')

    return (
      <label
        htmlFor={switchId}
        className={cn('flex items-start gap-3 cursor-pointer group', className)}
      >
        <div className="relative">
          <input
            ref={ref}
            type="checkbox"
            id={switchId}
            className="peer sr-only"
            {...props}
          />
          <div
            className={cn(
              'w-11 h-6 rounded-full',
              'bg-[var(--glass-bg)] border border-[var(--glass-border)]',
              'transition-all duration-200',
              'peer-focus:ring-2 peer-focus:ring-[var(--accent-primary)]/30',
              'peer-checked:bg-[var(--accent-primary)] peer-checked:border-[var(--accent-primary)]',
              'peer-disabled:opacity-50 peer-disabled:cursor-not-allowed'
            )}
          />
          <div
            className={cn(
              'absolute top-0.5 left-0.5 w-5 h-5 rounded-full',
              'bg-white shadow-sm',
              'transition-transform duration-200',
              'peer-checked:translate-x-5'
            )}
          />
        </div>
        {(label || description) && (
          <div className="space-y-0.5">
            {label && <span className="text-sm font-medium text-white">{label}</span>}
            {description && <p className="text-sm text-[var(--text-muted)]">{description}</p>}
          </div>
        )}
      </label>
    )
  }
)

Switch.displayName = 'Switch'
