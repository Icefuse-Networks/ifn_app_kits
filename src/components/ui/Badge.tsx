'use client'

import { ReactNode } from 'react'

// =============================================================================
// Types
// =============================================================================

export interface BadgeProps {
  children: ReactNode
  variant?: 'primary' | 'secondary' | 'success' | 'error' | 'warning' | 'info'
  size?: 'sm' | 'md' | 'lg'
  icon?: ReactNode
  rounded?: boolean
  className?: string
}

// =============================================================================
// Badge Component
// =============================================================================

export function Badge({
  children,
  variant = 'secondary',
  size = 'md',
  icon,
  rounded = true,
  className = '',
}: BadgeProps) {
  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-sm',
    lg: 'px-3 py-1.5 text-base',
  }

  const variantStyles = {
    primary: {
      background: 'rgba(var(--accent-primary-rgb), 0.15)',
      border: '1px solid var(--accent-primary)',
      color: 'var(--accent-primary)',
    },
    secondary: {
      background: 'var(--glass-bg)',
      border: '1px solid var(--border-secondary)',
      color: 'var(--text-secondary)',
    },
    success: {
      background: 'rgba(var(--status-success-rgb), 0.15)',
      border: '1px solid var(--status-success)',
      color: 'var(--status-success)',
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
    info: {
      background: 'rgba(var(--status-info-rgb), 0.15)',
      border: '1px solid var(--status-info)',
      color: 'var(--status-info)',
    },
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium ${
        rounded ? 'rounded-full' : 'rounded'
      } ${sizeClasses[size]} ${className}`}
      style={variantStyles[variant]}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      {children}
    </span>
  )
}

// =============================================================================
// Status Badge Component
// =============================================================================

export interface StatusBadgeProps {
  status: 'online' | 'offline' | 'busy' | 'away' | 'active' | 'inactive'
  showDot?: boolean
  text?: string
  className?: string
}

export function StatusBadge({
  status,
  showDot = true,
  text,
  className = '',
}: StatusBadgeProps) {
  const statusConfig = {
    online: {
      color: 'var(--status-success)',
      label: 'Online',
    },
    offline: {
      color: 'var(--text-muted)',
      label: 'Offline',
    },
    busy: {
      color: 'var(--status-error)',
      label: 'Busy',
    },
    away: {
      color: 'var(--status-warning)',
      label: 'Away',
    },
    active: {
      color: 'var(--status-success)',
      label: 'Active',
    },
    inactive: {
      color: 'var(--text-muted)',
      label: 'Inactive',
    },
  }

  const config = statusConfig[status]
  const displayText = text || config.label

  return (
    <span className={`inline-flex items-center gap-1.5 text-xs ${className}`}>
      {showDot && (
        <span
          className="w-2 h-2 rounded-full animate-pulse"
          style={{ background: config.color }}
        />
      )}
      <span style={{ color: config.color }}>{displayText}</span>
    </span>
  )
}

// =============================================================================
// Count Badge Component
// =============================================================================

export interface CountBadgeProps {
  count: number
  max?: number
  variant?: 'primary' | 'error'
  size?: 'sm' | 'md'
  className?: string
}

export function CountBadge({
  count,
  max = 99,
  variant = 'primary',
  size = 'sm',
  className = '',
}: CountBadgeProps) {
  const displayCount = count > max ? `${max}+` : count.toString()

  const sizeClasses = {
    sm: 'min-w-[1.25rem] h-5 text-xs',
    md: 'min-w-[1.5rem] h-6 text-sm',
  }

  const variantStyles = {
    primary: {
      background: 'var(--accent-primary)',
      color: 'white',
    },
    error: {
      background: 'var(--status-error)',
      color: 'white',
    },
  }

  return (
    <span
      className={`inline-flex items-center justify-center px-1.5 rounded-full font-bold ${sizeClasses[size]} ${className}`}
      style={variantStyles[variant]}
    >
      {displayCount}
    </span>
  )
}
