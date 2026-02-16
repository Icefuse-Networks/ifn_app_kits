'use client'

import { Loader2 } from 'lucide-react'

// =============================================================================
// Types
// =============================================================================

export interface SpinnerProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  color?: 'primary' | 'secondary' | 'success' | 'error' | 'warning' | 'white'
  className?: string
}

export interface LoadingProps extends SpinnerProps {
  text?: string
  fullScreen?: boolean
  overlay?: boolean
}

// =============================================================================
// Spinner Component
// =============================================================================

export function Spinner({ size = 'md', color = 'primary', className = '' }: SpinnerProps) {
  const sizeClasses = {
    xs: 'w-3 h-3',
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
    xl: 'w-12 h-12',
  }

  const colorClasses = {
    primary: 'text-[var(--accent-primary)]',
    secondary: 'text-[var(--text-secondary)]',
    success: 'text-[var(--status-success)]',
    error: 'text-[var(--status-error)]',
    warning: 'text-[var(--status-warning)]',
    white: 'text-white',
  }

  return (
    <Loader2
      className={`animate-spin ${sizeClasses[size]} ${colorClasses[color]} ${className}`}
    />
  )
}

// =============================================================================
// Border Spinner Component (Alternative Style)
// =============================================================================

export function BorderSpinner({ size = 'md', color = 'primary', className = '' }: SpinnerProps) {
  const sizeClasses = {
    xs: 'w-3 h-3 border',
    sm: 'w-4 h-4 border-2',
    md: 'w-6 h-6 border-2',
    lg: 'w-8 h-8 border-2',
    xl: 'w-12 h-12 border-3',
  }

  const colorStyles = {
    primary: {
      borderColor: 'var(--accent-primary)',
      borderTopColor: 'transparent',
    },
    secondary: {
      borderColor: 'var(--text-secondary)',
      borderTopColor: 'transparent',
    },
    success: {
      borderColor: 'var(--status-success)',
      borderTopColor: 'transparent',
    },
    error: {
      borderColor: 'var(--status-error)',
      borderTopColor: 'transparent',
    },
    warning: {
      borderColor: 'var(--status-warning)',
      borderTopColor: 'transparent',
    },
    white: {
      borderColor: 'white',
      borderTopColor: 'transparent',
    },
  }

  return (
    <div
      className={`rounded-full animate-spin ${sizeClasses[size]} ${className}`}
      style={colorStyles[color]}
    />
  )
}

// =============================================================================
// Loading Component (with text)
// =============================================================================

export function Loading({
  size = 'md',
  color = 'primary',
  text,
  fullScreen = false,
  overlay = false,
  className = '',
}: LoadingProps) {
  const content = (
    <div className={`flex flex-col items-center justify-center gap-3 ${className}`}>
      <Spinner size={size} color={color} />
      {text && (
        <p
          className={`font-medium ${
            size === 'xs' || size === 'sm' ? 'text-xs' : size === 'md' ? 'text-sm' : 'text-base'
          } ${color === 'white' ? 'text-white' : 'text-[var(--text-secondary)]'}`}
        >
          {text}
        </p>
      )}
    </div>
  )

  if (fullScreen) {
    return (
      <div
        className="fixed inset-0 z-[9999] flex items-center justify-center"
        style={{
          background: overlay
            ? 'rgba(0, 0, 0, 0.70)'
            : 'var(--bg-primary)',
          backdropFilter: overlay ? 'blur(8px)' : undefined,
          WebkitBackdropFilter: overlay ? 'blur(8px)' : undefined,
        }}
      >
        {content}
      </div>
    )
  }

  return content
}

// =============================================================================
// Skeleton Loader Component
// =============================================================================

export interface SkeletonProps {
  width?: string | number
  height?: string | number
  variant?: 'text' | 'circular' | 'rectangular'
  className?: string
  animate?: boolean
}

export function Skeleton({
  width = '100%',
  height = '1rem',
  variant = 'text',
  className = '',
  animate = true,
}: SkeletonProps) {
  const variantClasses = {
    text: 'rounded',
    circular: 'rounded-full',
    rectangular: 'rounded-lg',
  }

  const style: React.CSSProperties = {
    width: typeof width === 'number' ? `${width}px` : width,
    height: typeof height === 'number' ? `${height}px` : height,
    background: 'linear-gradient(90deg, rgba(255,255,255,0.05) 25%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.05) 75%)',
    backgroundSize: '200% 100%',
  }

  return (
    <div
      className={`${variantClasses[variant]} ${animate ? 'animate-pulse' : ''} ${className}`}
      style={style}
    />
  )
}

// =============================================================================
// Progress Bar Component
// =============================================================================

export interface ProgressBarProps {
  value: number
  max?: number
  size?: 'sm' | 'md' | 'lg'
  color?: 'primary' | 'success' | 'error' | 'warning'
  showLabel?: boolean
  className?: string
}

export function ProgressBar({
  value,
  max = 100,
  size = 'md',
  color = 'primary',
  showLabel = false,
  className = '',
}: ProgressBarProps) {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100))

  const sizeClasses = {
    sm: 'h-1',
    md: 'h-2',
    lg: 'h-3',
  }

  const colorStyles = {
    primary: 'var(--accent-primary)',
    success: 'var(--status-success)',
    error: 'var(--status-error)',
    warning: 'var(--status-warning)',
  }

  return (
    <div className={className}>
      {showLabel && (
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-[var(--text-secondary)]">{Math.round(percentage)}%</span>
        </div>
      )}
      <div
        className={`w-full rounded-full overflow-hidden ${sizeClasses[size]}`}
        style={{
          background: 'var(--bg-card)',
        }}
      >
        <div
          className="h-full transition-all duration-300 ease-out"
          style={{
            width: `${percentage}%`,
            background: colorStyles[color],
          }}
        />
      </div>
    </div>
  )
}

// =============================================================================
// Dots Loader Component
// =============================================================================

export interface DotsLoaderProps {
  size?: 'sm' | 'md' | 'lg'
  color?: 'primary' | 'secondary' | 'white'
  className?: string
}

export function DotsLoader({ size = 'md', color = 'primary', className = '' }: DotsLoaderProps) {
  const sizeClasses = {
    sm: 'w-1.5 h-1.5',
    md: 'w-2 h-2',
    lg: 'w-3 h-3',
  }

  const colorStyles = {
    primary: 'var(--accent-primary)',
    secondary: 'var(--text-secondary)',
    white: 'white',
  }

  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className={`rounded-full ${sizeClasses[size]}`}
          style={{
            background: colorStyles[color],
            animation: 'pulse 1.5s ease-in-out infinite',
            animationDelay: `${i * 0.15}s`,
          }}
        />
      ))}
    </div>
  )
}
