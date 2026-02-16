'use client'

import { ReactNode, HTMLAttributes } from 'react'

// =============================================================================
// Types
// =============================================================================

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  variant?: 'default' | 'glass' | 'gradient'
  padding?: 'none' | 'sm' | 'md' | 'lg'
  hoverable?: boolean
  clickable?: boolean
}

export interface CardHeaderProps {
  children: ReactNode
  icon?: ReactNode
  action?: ReactNode
  className?: string
}

export interface CardBodyProps {
  children: ReactNode
  className?: string
}

export interface CardFooterProps {
  children: ReactNode
  className?: string
}

// =============================================================================
// Card Component
// =============================================================================

export function Card({
  children,
  variant = 'default',
  padding = 'md',
  hoverable = false,
  clickable = false,
  className = '',
  ...props
}: CardProps) {
  const paddingClasses = {
    none: 'p-0',
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-6',
  }

  const variantStyles = {
    default: {
      background: 'var(--bg-card)',
      border: '1px solid var(--border-secondary)',
    },
    glass: {
      background:
        'linear-gradient(145deg, rgba(20, 35, 60, 0.95) 0%, rgba(15, 28, 50, 0.97) 50%, rgba(12, 22, 42, 0.98) 100%)',
      border: '1px solid rgba(255, 255, 255, 0.20)',
      backdropFilter: 'blur(60px) saturate(150%)',
      WebkitBackdropFilter: 'blur(60px) saturate(150%)',
      boxShadow:
        '0 4px 20px rgba(0, 0, 0, 0.30), 0 8px 32px rgba(0, 0, 0, 0.22), inset 0 1px 0 rgba(255, 255, 255, 0.25)',
    },
    gradient: {
      background: 'linear-gradient(135deg, rgba(var(--accent-primary-rgb), 0.1) 0%, rgba(var(--accent-primary-rgb), 0.05) 100%)',
      border: '1px solid var(--accent-primary)',
    },
  }

  return (
    <div
      className={`rounded-lg transition-all duration-200 ${paddingClasses[padding]} ${
        hoverable ? 'hover:shadow-lg hover:-translate-y-0.5' : ''
      } ${clickable ? 'cursor-pointer active:scale-[0.98]' : ''} ${className}`}
      style={variantStyles[variant]}
      {...props}
    >
      {children}
    </div>
  )
}

// =============================================================================
// Card Header
// =============================================================================

export function CardHeader({ children, icon, action, className = '' }: CardHeaderProps) {
  return (
    <div
      className={`flex items-center justify-between gap-3 pb-3 ${className}`}
      style={{ borderBottom: '1px solid var(--border-secondary)' }}
    >
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {icon && <span className="text-[var(--accent-primary)] shrink-0">{icon}</span>}
        <div className="flex-1 min-w-0">{children}</div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

// =============================================================================
// Card Body
// =============================================================================

export function CardBody({ children, className = '' }: CardBodyProps) {
  return <div className={`py-3 ${className}`}>{children}</div>
}

// =============================================================================
// Card Footer
// =============================================================================

export function CardFooter({ children, className = '' }: CardFooterProps) {
  return (
    <div
      className={`flex items-center justify-end gap-2 pt-3 ${className}`}
      style={{ borderTop: '1px solid var(--border-secondary)' }}
    >
      {children}
    </div>
  )
}

// =============================================================================
// Stat Card Component
// =============================================================================

export interface StatCardProps {
  icon: ReactNode
  label: string
  value: string | number
  change?: string
  changeType?: 'positive' | 'negative' | 'neutral'
  loading?: boolean
  className?: string
}

export function StatCard({
  icon,
  label,
  value,
  change,
  changeType = 'neutral',
  loading = false,
  className = '',
}: StatCardProps) {
  const changeColors = {
    positive: 'text-[var(--status-success)]',
    negative: 'text-[var(--status-error)]',
    neutral: 'text-[var(--text-muted)]',
  }

  return (
    <Card variant="glass" padding="md" hoverable className={className}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <p className="text-xs text-[var(--text-muted)] uppercase tracking-wide mb-1">
            {label}
          </p>
          {loading ? (
            <div className="w-16 h-8 rounded bg-[var(--glass-bg)] animate-pulse" />
          ) : (
            <p className="text-2xl font-bold text-[var(--text-primary)]">{value}</p>
          )}
          {change && !loading && (
            <p className={`text-xs mt-1 ${changeColors[changeType]}`}>{change}</p>
          )}
        </div>
        <div
          className="p-3 rounded-lg shrink-0"
          style={{
            background: 'rgba(var(--accent-primary-rgb), 0.15)',
            color: 'var(--accent-primary)',
          }}
        >
          {icon}
        </div>
      </div>
    </Card>
  )
}
