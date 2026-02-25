'use client'

import { forwardRef, type HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

// ============================================================================
// Spinner Component
// ============================================================================

export type SpinnerSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

const spinnerSizes: Record<SpinnerSize, string> = {
  xs: 'w-3 h-3',
  sm: 'w-4 h-4',
  md: 'w-6 h-6',
  lg: 'w-8 h-8',
  xl: 'w-12 h-12',
}

export interface SpinnerProps extends HTMLAttributes<SVGElement> {
  size?: SpinnerSize
}

export const Spinner = forwardRef<SVGSVGElement, SpinnerProps>(
  ({ className, size = 'md', ...props }, ref) => {
    return (
      <svg
        ref={ref}
        className={cn('animate-spin text-[var(--accent-primary)]', spinnerSizes[size], className)}
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        {...props}
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
    )
  }
)

Spinner.displayName = 'Spinner'

// Alias for backwards compatibility
export const Loading = Spinner

// ============================================================================
// Loading Overlay
// ============================================================================

export interface LoadingOverlayProps extends HTMLAttributes<HTMLDivElement> {
  visible: boolean
  text?: string
}

export const LoadingOverlay = forwardRef<HTMLDivElement, LoadingOverlayProps>(
  ({ className, visible, text, ...props }, ref) => {
    if (!visible) return null

    return (
      <div
        ref={ref}
        className={cn(
          'absolute inset-0 z-50',
          'flex flex-col items-center justify-center gap-3',
          'bg-[var(--bg-primary)]/80 backdrop-blur-sm',
          className
        )}
        {...props}
      >
        <Spinner size="lg" />
        {text && <p className="text-sm text-[var(--text-muted)]">{text}</p>}
      </div>
    )
  }
)

LoadingOverlay.displayName = 'LoadingOverlay'

// ============================================================================
// Skeleton Component
// ============================================================================

export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'text' | 'circular' | 'rectangular'
  width?: string | number
  height?: string | number
}

export const Skeleton = forwardRef<HTMLDivElement, SkeletonProps>(
  ({ className, variant = 'text', width, height, style, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'animate-pulse bg-[var(--bg-tertiary)]/50',
          variant === 'text' && 'h-4 rounded',
          variant === 'circular' && 'rounded-full',
          variant === 'rectangular' && 'rounded-lg',
          className
        )}
        style={{
          width: width,
          height: height,
          ...style,
        }}
        {...props}
      />
    )
  }
)

Skeleton.displayName = 'Skeleton'

// ============================================================================
// Skeleton Text
// ============================================================================

export interface SkeletonTextProps extends HTMLAttributes<HTMLDivElement> {
  lines?: number
  lastLineWidth?: string
}

export const SkeletonText = forwardRef<HTMLDivElement, SkeletonTextProps>(
  ({ className, lines = 3, lastLineWidth = '60%', ...props }, ref) => {
    return (
      <div ref={ref} className={cn('space-y-2', className)} {...props}>
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton
            key={i}
            variant="text"
            style={{
              width: i === lines - 1 ? lastLineWidth : '100%',
            }}
          />
        ))}
      </div>
    )
  }
)

SkeletonText.displayName = 'SkeletonText'

// ============================================================================
// Page Loading
// ============================================================================

export interface PageLoadingProps extends HTMLAttributes<HTMLDivElement> {
  title?: string
  description?: string
}

export const PageLoading = forwardRef<HTMLDivElement, PageLoadingProps>(
  ({ className, title = 'Loading...', description, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'flex flex-col items-center justify-center min-h-[400px]',
          className
        )}
        {...props}
      >
        <div className="relative">
          <Spinner size="xl" />
          <div className="absolute inset-0 animate-ping">
            <Spinner size="xl" className="opacity-30" />
          </div>
        </div>
        <div className="mt-6 text-center">
          <h3 className="text-lg font-medium text-white">{title}</h3>
          {description && (
            <p className="mt-1 text-sm text-[var(--text-muted)]">{description}</p>
          )}
        </div>
      </div>
    )
  }
)

PageLoading.displayName = 'PageLoading'

// ============================================================================
// Progress Bar
// ============================================================================

export interface ProgressBarProps extends HTMLAttributes<HTMLDivElement> {
  value: number
  max?: number
  showLabel?: boolean
  variant?: 'default' | 'success' | 'warning' | 'error'
}

const progressVariants = {
  default: 'bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)]',
  success: 'bg-[var(--status-success)]',
  warning: 'bg-[var(--status-warning)]',
  error: 'bg-[var(--status-error)]',
}

export const ProgressBar = forwardRef<HTMLDivElement, ProgressBarProps>(
  (
    { className, value, max = 100, showLabel = false, variant = 'default', ...props },
    ref
  ) => {
    const percentage = Math.min(Math.max((value / max) * 100, 0), 100)

    return (
      <div ref={ref} className={cn('space-y-1', className)} {...props}>
        {showLabel && (
          <div className="flex justify-between text-sm">
            <span className="text-[var(--text-muted)]">Progress</span>
            <span className="text-white font-medium">{Math.round(percentage)}%</span>
          </div>
        )}
        <div className="h-2 bg-[var(--bg-tertiary)]/50 rounded-full overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-500',
              progressVariants[variant]
            )}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    )
  }
)

ProgressBar.displayName = 'ProgressBar'
