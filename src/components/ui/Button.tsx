'use client'

import { forwardRef, ButtonHTMLAttributes, ReactNode } from 'react'
import { Loader2 } from 'lucide-react'

// =============================================================================
// Types
// =============================================================================

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'success' | 'error' | 'warning' | 'ghost' | 'outline'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  loadingText?: string
  leftIcon?: ReactNode
  icon?: ReactNode
  rightIcon?: ReactNode
  fullWidth?: boolean
}

// =============================================================================
// Button Component
// =============================================================================

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      loadingText,
      leftIcon,
      icon,
      rightIcon,
      fullWidth = false,
      className = '',
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const resolvedLeftIcon = leftIcon ?? icon
    const sizeClasses = {
      sm: 'px-2.5 py-1.5 text-xs',
      md: 'px-4 py-2 text-sm',
      lg: 'px-6 py-3 text-base',
    }

    const getVariantStyles = () => {
      const variants = {
        primary: {
          background: 'var(--accent-primary)',
          border: '1px solid var(--accent-primary)',
          color: 'white',
        },
        secondary: {
          background: 'var(--glass-bg)',
          border: '1px solid var(--glass-border)',
          color: 'var(--text-secondary)',
        },
        success: {
          background: 'var(--status-success)',
          border: '1px solid var(--status-success)',
          color: 'white',
        },
        error: {
          background: 'rgba(var(--status-error-rgb), 0.15)',
          border: '1px solid var(--status-error)',
          color: 'var(--status-error)',
        },
        warning: {
          background: 'rgba(var(--status-warning-rgb), 0.15)',
          border: '1px solid var(--status-warning)',
          color: 'var(--status-warning)',
        },
        ghost: {
          background: 'transparent',
          border: '1px solid transparent',
          color: 'var(--text-secondary)',
        },
        outline: {
          background: 'transparent',
          border: '1px solid var(--border-secondary)',
          color: 'var(--text-secondary)',
        },
      }
      return variants[variant]
    }

    const variantStyles = getVariantStyles()

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={`inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] focus:ring-offset-2 focus:ring-offset-[var(--bg-primary)] disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 active:scale-95 ${
          sizeClasses[size]
        } ${fullWidth ? 'w-full' : ''} ${className}`}
        style={variantStyles}
        {...props}
      >
        {loading && <Loader2 className="w-4 h-4 animate-spin shrink-0" />}
        {!loading && resolvedLeftIcon && <span className="shrink-0">{resolvedLeftIcon}</span>}
        <span className={loading && !loadingText ? 'opacity-0' : ''}>
          {loading && loadingText ? loadingText : children}
        </span>
        {!loading && rightIcon && <span className="shrink-0">{rightIcon}</span>}
      </button>
    )
  }
)

Button.displayName = 'Button'

// =============================================================================
// Icon Button Component
// =============================================================================

export interface IconButtonProps extends Omit<ButtonProps, 'leftIcon' | 'rightIcon'> {
  icon?: ReactNode
  label?: string
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ icon, label, size = 'md', className = '', children, ...props }, ref) => {
    const sizeClasses = {
      sm: 'p-1.5',
      md: 'p-2',
      lg: 'p-3',
    }

    return (
      <button
        ref={ref}
        title={label}
        aria-label={label}
        className={`inline-flex items-center justify-center rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[var(--bg-card-hover)] ${
          sizeClasses[size]
        } ${className}`}
        style={{
          background: 'transparent',
          border: '1px solid transparent',
          color: 'var(--text-muted)',
        }}
        {...props}
      >
        {icon || children}
      </button>
    )
  }
)

IconButton.displayName = 'IconButton'

// =============================================================================
// Button Group Component
// =============================================================================

export interface ButtonGroupProps {
  children: ReactNode
  className?: string
  orientation?: 'horizontal' | 'vertical'
}

export function ButtonGroup({
  children,
  className = '',
  orientation = 'horizontal',
}: ButtonGroupProps) {
  return (
    <div
      className={`inline-flex ${
        orientation === 'horizontal' ? 'flex-row' : 'flex-col'
      } ${className}`}
      style={{
        background: 'var(--glass-bg)',
        border: '1px solid var(--glass-border)',
        borderRadius: '0.5rem',
        overflow: 'hidden',
      }}
    >
      {children}
    </div>
  )
}
