/**
 * Tooltip Component
 *
 * A centralized tooltip component with the standard Icefuse glass morphism styling.
 * Uses portal rendering to avoid z-index and overflow clipping issues.
 */

'use client'

import { useState, useRef, useEffect, ReactNode, useCallback } from 'react'
import { createPortal } from 'react-dom'

// ============================================================================
// Types
// ============================================================================

export type TooltipPosition = 'top' | 'bottom' | 'left' | 'right'

export interface TooltipProps {
  /** The element that triggers the tooltip on hover */
  children: ReactNode
  /** Main content of the tooltip */
  content: ReactNode
  /** Optional title/header for the tooltip */
  title?: string
  /** Position of the tooltip relative to the trigger */
  position?: TooltipPosition
  /** Delay before showing tooltip (ms) */
  delay?: number
  /** Whether the tooltip is disabled */
  disabled?: boolean
  /** Maximum width of the tooltip */
  maxWidth?: number
  /** Additional CSS class for the wrapper */
  className?: string
}

// ============================================================================
// Helper: Calculate position
// ============================================================================

interface Position {
  top: number
  left: number
}

function calculatePosition(
  triggerRect: DOMRect,
  tooltipRect: DOMRect,
  position: TooltipPosition,
  gap: number = 8
): Position {
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight

  let top = 0
  let left = 0

  switch (position) {
    case 'top':
      top = triggerRect.top - tooltipRect.height - gap
      left = triggerRect.left + (triggerRect.width - tooltipRect.width) / 2
      break
    case 'bottom':
      top = triggerRect.bottom + gap
      left = triggerRect.left + (triggerRect.width - tooltipRect.width) / 2
      break
    case 'left':
      top = triggerRect.top + (triggerRect.height - tooltipRect.height) / 2
      left = triggerRect.left - tooltipRect.width - gap
      break
    case 'right':
      top = triggerRect.top + (triggerRect.height - tooltipRect.height) / 2
      left = triggerRect.right + gap
      break
  }

  // Clamp to viewport bounds with padding
  const padding = 8
  left = Math.max(padding, Math.min(left, viewportWidth - tooltipRect.width - padding))
  top = Math.max(padding, Math.min(top, viewportHeight - tooltipRect.height - padding))

  return { top, left }
}

// ============================================================================
// Tooltip Component
// ============================================================================

export function Tooltip({
  children,
  content,
  title,
  position = 'top',
  delay = 200,
  disabled = false,
  maxWidth = 280,
  className,
}: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [tooltipPosition, setTooltipPosition] = useState<Position>({ top: 0, left: 0 })
  const [mounted, setMounted] = useState(false)
  const triggerRef = useRef<HTMLDivElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Client-side only mounting for portal
  useEffect(() => {
    setMounted(true)
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  // Update tooltip position when visible
  const updatePosition = useCallback(() => {
    if (triggerRef.current && tooltipRef.current) {
      const triggerRect = triggerRef.current.getBoundingClientRect()
      const tooltipRect = tooltipRef.current.getBoundingClientRect()
      const newPosition = calculatePosition(triggerRect, tooltipRect, position)
      setTooltipPosition(newPosition)
    }
  }, [position])

  useEffect(() => {
    if (isVisible) {
      // Small delay to ensure tooltip is rendered before measuring
      requestAnimationFrame(updatePosition)
    }
  }, [isVisible, updatePosition])

  const handleMouseEnter = () => {
    if (disabled) return
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true)
    }, delay)
  }

  const handleMouseLeave = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    setIsVisible(false)
  }

  const handleFocus = () => {
    if (disabled) return
    setIsVisible(true)
  }

  const handleBlur = () => {
    setIsVisible(false)
  }

  if (disabled || !content) {
    return <>{children}</>
  }

  return (
    <>
      <div
        ref={triggerRef}
        className={className}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onFocus={handleFocus}
        onBlur={handleBlur}
        style={{ display: 'inline-flex' }}
      >
        {children}
      </div>

      {mounted && isVisible && createPortal(
        <div
          ref={tooltipRef}
          role="tooltip"
          style={{
            position: 'fixed',
            top: tooltipPosition.top,
            left: tooltipPosition.left,
            maxWidth,
            zIndex: 9999,
            pointerEvents: 'none',
            animation: 'tooltip-fade-in 150ms ease-out',
          }}
        >
          {/* Glass morphism container */}
          <div
            style={{
              background: 'rgba(26, 26, 46, 0.95)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '12px',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
              padding: title ? '10px 14px' : '8px 12px',
            }}
          >
            {title && (
              <div
                style={{
                  fontSize: '14px',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  marginBottom: '4px',
                }}
              >
                {title}
              </div>
            )}
            <div
              style={{
                fontSize: '14px',
                color: title ? 'var(--text-secondary)' : 'var(--text-primary)',
                lineHeight: 1.4,
              }}
            >
              {content}
            </div>
          </div>
        </div>,
        document.body
      )}

      <style jsx global>{`
        @keyframes tooltip-fade-in {
          from {
            opacity: 0;
            transform: translateY(4px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </>
  )
}

// ============================================================================
// Quantity Limit Tooltip - Specialized for product quantity limits
// ============================================================================

export interface QuantityLimitTooltipProps {
  /** The element that triggers the tooltip on hover */
  children: ReactNode
  /** Maximum quantity allowed per cart */
  maxPerCart: number | null | undefined
  /** Current quantity in cart */
  currentQuantity?: number
  /** Position of the tooltip */
  position?: TooltipPosition
}

/**
 * Specialized tooltip for displaying quantity limits on products.
 * Only shows when maxPerCart is set and > 0.
 */
export function QuantityLimitTooltip({
  children,
  maxPerCart,
  currentQuantity,
  position = 'top',
}: QuantityLimitTooltipProps) {
  // Don't show tooltip if no limit is set
  if (!maxPerCart || maxPerCart <= 0) {
    return <>{children}</>
  }

  const isAtLimit = currentQuantity !== undefined && currentQuantity >= maxPerCart

  return (
    <Tooltip
      title="Quantity Limit"
      content={
        <span>
          {isAtLimit ? (
            <>You have reached the maximum of <strong>{maxPerCart}</strong> allowed per cart.</>
          ) : (
            <>Maximum <strong>{maxPerCart}</strong> {maxPerCart === 1 ? 'item' : 'items'} allowed per cart.</>
          )}
        </span>
      }
      position={position}
    >
      {children}
    </Tooltip>
  )
}
