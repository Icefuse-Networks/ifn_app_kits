/**
 * Page Background Component
 *
 * Centralized background that provides consistent dark navy gradient
 * across the entire site. Matches Pay Now store design system.
 */

import { ReactNode } from 'react'

export type PageBackgroundVariant = 'default' | 'glass'

export interface PageBackgroundProps {
  children: ReactNode
  className?: string
  style?: React.CSSProperties
  as?: 'div' | 'main' | 'section'
  variant?: PageBackgroundVariant
}

const DARK_GRADIENT = 'linear-gradient(to bottom right, #0a0a0f 0%, #1a1a2e 50%, #0f1419 100%)'

export function PageBackground({
  children,
  className = '',
  style,
  as: Component = 'div',
  variant = 'default',
}: PageBackgroundProps) {
  // PERF: Removed backgroundAttachment: 'fixed' — it disables GPU compositing
  const bgStyle: React.CSSProperties = {
    background: DARK_GRADIENT,
    ...style,
  }

  return (
    <Component
      className={`relative overflow-x-hidden ${className}`}
      style={bgStyle}
    >
      {children}
    </Component>
  )
}

export default PageBackground
