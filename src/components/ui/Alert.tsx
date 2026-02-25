'use client'

import { ReactNode } from 'react'
import { AlertCircle, CheckCircle, Info, AlertTriangle, X } from 'lucide-react'

// =============================================================================
// Types
// =============================================================================

export interface AlertProps {
  variant?: 'info' | 'success' | 'warning' | 'error'
  title?: string
  children: ReactNode
  icon?: ReactNode
  dismissible?: boolean
  onDismiss?: () => void
  className?: string
}

// =============================================================================
// Alert Component
// =============================================================================

export function Alert({
  variant = 'info',
  title,
  children,
  icon,
  dismissible = false,
  onDismiss,
  className = '',
}: AlertProps) {
  const variantConfig = {
    info: {
      icon: <Info className="w-5 h-5" />,
      background: 'rgba(var(--status-info-rgb), 0.1)',
      border: '1px solid var(--status-info)',
      color: 'var(--status-info)',
      textColor: 'var(--text-primary)',
    },
    success: {
      icon: <CheckCircle className="w-5 h-5" />,
      background: 'rgba(var(--status-success-rgb), 0.1)',
      border: '1px solid var(--status-success)',
      color: 'var(--status-success)',
      textColor: 'var(--text-primary)',
    },
    warning: {
      icon: <AlertTriangle className="w-5 h-5" />,
      background: 'rgba(var(--status-warning-rgb), 0.1)',
      border: '1px solid var(--status-warning)',
      color: 'var(--status-warning)',
      textColor: 'var(--text-primary)',
    },
    error: {
      icon: <AlertCircle className="w-5 h-5" />,
      background: 'rgba(var(--status-error-rgb), 0.1)',
      border: '1px solid var(--status-error)',
      color: 'var(--status-error)',
      textColor: 'var(--text-primary)',
    },
  }

  const config = variantConfig[variant]
  const displayIcon = icon || config.icon

  return (
    <div
      className={`relative flex gap-3 p-4 rounded-lg ${className}`}
      style={{
        background: config.background,
        border: config.border,
      }}
      role="alert"
    >
      <div className="shrink-0" style={{ color: config.color }}>
        {displayIcon}
      </div>

      <div className="flex-1 min-w-0">
        {title && (
          <h4 className="font-semibold text-sm mb-1" style={{ color: config.textColor }}>
            {title}
          </h4>
        )}
        <div className="text-sm" style={{ color: config.textColor }}>
          {children}
        </div>
      </div>

      {dismissible && (
        <button
          onClick={onDismiss}
          className="shrink-0 p-1 rounded hover:bg-black/10 transition-colors"
          aria-label="Dismiss alert"
        >
          <X className="w-4 h-4" style={{ color: config.color }} />
        </button>
      )}
    </div>
  )
}
