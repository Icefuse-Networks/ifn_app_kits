'use client'

import { forwardRef, type HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

// ============================================================================
// Badge Component
// ============================================================================

export type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info' | 'outline' | 'primary' | 'secondary' | 'danger' | 'muted'
export type BadgeSize = 'sm' | 'md' | 'lg'

const variantStyles: Record<BadgeVariant, string> = {
  default: 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)]',
  success: 'bg-[var(--status-success)]/15 text-[var(--status-success)]',
  warning: 'bg-[var(--status-warning)]/15 text-[var(--status-warning)]',
  error: 'bg-[var(--status-error)]/15 text-[var(--status-error)]',
  danger: 'bg-[var(--status-error)]/15 text-[var(--status-error)]',
  info: 'bg-[var(--accent-primary)]/15 text-[var(--accent-primary)]',
  primary: 'bg-[var(--accent-primary)]/15 text-[var(--accent-primary)]',
  secondary: 'bg-[var(--text-muted)]/15 text-[var(--text-tertiary)]',
  outline: 'bg-transparent text-[var(--text-muted)] border border-[var(--border-primary)]',
  muted: 'bg-[var(--text-muted)]/10 text-[var(--text-muted)]',
}

const sizeStyles: Record<BadgeSize, string> = {
  sm: 'px-2 py-1 text-xs',
  md: 'px-2.5 py-1 text-xs',
  lg: 'px-3 py-1.5 text-sm',
}

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
  size?: BadgeSize
  dot?: boolean
}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = 'default', size = 'md', dot = false, children, ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={cn(
          'inline-flex items-center gap-1 font-medium rounded-full',
          variantStyles[variant],
          sizeStyles[size],
          className
        )}
        {...props}
      >
        {dot && (
          <span
            className={cn(
              'w-1.5 h-1.5 rounded-full',
              variant === 'success' && 'bg-[var(--status-success)]',
              variant === 'warning' && 'bg-[var(--status-warning)]',
              variant === 'error' && 'bg-[var(--status-error)]',
              variant === 'danger' && 'bg-[var(--status-error)]',
              variant === 'info' && 'bg-[var(--accent-primary)]',
              variant === 'primary' && 'bg-[var(--accent-primary)]',
              variant === 'secondary' && 'bg-[var(--text-tertiary)]',
              variant === 'default' && 'bg-[var(--text-muted)]',
              variant === 'outline' && 'bg-[var(--text-muted)]',
              variant === 'muted' && 'bg-[var(--text-muted)]'
            )}
          />
        )}
        {children}
      </span>
    )
  }
)

Badge.displayName = 'Badge'

// ============================================================================
// Status Badge
// ============================================================================

export type StatusType = 'active' | 'inactive' | 'pending' | 'completed' | 'failed' | 'cancelled'

const statusConfig: Record<StatusType, { variant: BadgeVariant; label: string }> = {
  active: { variant: 'success', label: 'Active' },
  inactive: { variant: 'outline', label: 'Inactive' },
  pending: { variant: 'warning', label: 'Pending' },
  completed: { variant: 'success', label: 'Completed' },
  failed: { variant: 'error', label: 'Failed' },
  cancelled: { variant: 'outline', label: 'Cancelled' },
}

export interface StatusBadgeProps extends Omit<BadgeProps, 'variant'> {
  status: StatusType
  customLabel?: string
  label?: string // Alias for customLabel
}

export const StatusBadge = forwardRef<HTMLSpanElement, StatusBadgeProps>(
  ({ className, status, customLabel, label, ...props }, ref) => {
    const config = statusConfig[status]
    const displayLabel = customLabel || label || config.label

    return (
      <Badge
        ref={ref}
        variant={config.variant}
        dot
        className={className}
        {...props}
      >
        {displayLabel}
      </Badge>
    )
  }
)

StatusBadge.displayName = 'StatusBadge'
