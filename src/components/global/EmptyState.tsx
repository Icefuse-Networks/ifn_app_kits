'use client'

import { forwardRef, type HTMLAttributes } from 'react'
import { type LucideIcon, Package } from 'lucide-react'

// ============================================================================
// EmptyState Component
// ============================================================================

export interface EmptyStateProps extends HTMLAttributes<HTMLDivElement> {
  /** Icon to display (defaults to Package) */
  icon?: LucideIcon
  /** Main title text */
  title: string
  /** Optional description text */
  description?: string
  /** Optional action button configuration */
  action?: {
    label: string
    onClick: () => void
    icon?: LucideIcon
  }
  /** Display variant */
  variant?: 'default' | 'minimal'
}

export const EmptyState = forwardRef<HTMLDivElement, EmptyStateProps>(
  (
    {
      icon: Icon = Package,
      title,
      description,
      action,
      variant = 'default',
      className,
      ...props
    },
    ref
  ) => {
    const ActionIcon = action?.icon

    if (variant === 'minimal') {
      return (
        <div
          ref={ref}
          className={`flex flex-col items-center justify-center py-8 text-center ${className ?? ''}`}
          {...props}
        >
          <Icon className="w-8 h-8 mb-3 text-[var(--text-tertiary)]" />
          <p className="text-sm text-[var(--text-secondary)]">{title}</p>
          {action && (
            <button
              onClick={action.onClick}
              className="mt-3 text-sm font-medium text-[var(--accent-primary)] transition-colors hover:text-[var(--accent-primary)]/80"
            >
              {action.label}
            </button>
          )}
        </div>
      )
    }

    return (
      <div
        ref={ref}
        className={`flex flex-col items-center justify-center py-16 text-center ${className ?? ''}`}
        {...props}
      >
        {/* Icon */}
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 bg-gradient-to-br from-[var(--accent-primary)]/10 to-[var(--accent-secondary)]/10">
          <Icon className="w-8 h-8 text-[var(--accent-primary)]" />
        </div>

        {/* Text */}
        <h3 className="text-lg font-semibold mb-2 text-[var(--text-primary)]">
          {title}
        </h3>
        {description && (
          <p className="text-sm mb-6 max-w-sm text-[var(--text-secondary)]">
            {description}
          </p>
        )}

        {/* Action */}
        {action && (
          <button
            onClick={action.onClick}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-white font-medium transition-all shadow-lg bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)] hover:opacity-90"
          >
            {ActionIcon && <ActionIcon className="w-4 h-4" />}
            {action.label}
          </button>
        )}
      </div>
    )
  }
)

EmptyState.displayName = 'EmptyState'
