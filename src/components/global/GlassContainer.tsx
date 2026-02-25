'use client'

import { forwardRef, useState, type HTMLAttributes, type ReactNode } from 'react'

// ============================================================================
// Types
// ============================================================================

export type GlassContainerVariant = 'default' | 'subtle' | 'prominent' | 'elevated' | 'static'

export interface GlassContainerFeatures {
  gradient?: boolean
  blur?: boolean
  shadow?: boolean
  hoverGlow?: boolean
  hoverLift?: boolean
  frostHighlight?: boolean
}

export interface GlassContainerProps extends HTMLAttributes<HTMLDivElement> {
  variant?: GlassContainerVariant
  padding?: 'none' | 'sm' | 'md' | 'lg' | 'xl'
  radius?: 'sm' | 'md' | 'lg' | 'xl' | '2xl'
  features?: GlassContainerFeatures
  interactive?: boolean
  as?: 'div' | 'section' | 'article' | 'aside'
}

// ============================================================================
// Style Constants — Auth-aligned flat glass (no 3D embossing)
// ============================================================================

const defaultFeatures: Required<GlassContainerFeatures> = {
  gradient: true,
  blur: false,
  shadow: true,
  hoverGlow: true,
  hoverLift: false,
  frostHighlight: false,
}

const backgrounds: Record<GlassContainerVariant, string> = {
  default: 'rgba(255, 255, 255, 0.03)',
  subtle: 'rgba(255, 255, 255, 0.02)',
  prominent: 'rgba(255, 255, 255, 0.05)',
  elevated: 'rgba(255, 255, 255, 0.04)',
  static: 'rgba(255, 255, 255, 0.03)',
}

const hoverBackgrounds: Record<GlassContainerVariant, string> = {
  default: 'rgba(255, 255, 255, 0.05)',
  subtle: 'rgba(255, 255, 255, 0.04)',
  prominent: 'rgba(255, 255, 255, 0.07)',
  elevated: 'rgba(255, 255, 255, 0.06)',
  static: 'rgba(255, 255, 255, 0.03)',
}

const borders: Record<GlassContainerVariant, string> = {
  default: 'rgba(255, 255, 255, 0.08)',
  subtle: 'rgba(255, 255, 255, 0.06)',
  prominent: 'rgba(255, 255, 255, 0.10)',
  elevated: 'rgba(255, 255, 255, 0.08)',
  static: 'rgba(255, 255, 255, 0.08)',
}

const hoverBorder = 'rgba(59, 130, 246, 0.3)'

const shadows: Record<GlassContainerVariant, string> = {
  default: '0 20px 60px rgba(0, 0, 0, 0.3)',
  subtle: '0 8px 24px rgba(0, 0, 0, 0.2)',
  prominent: '0 20px 60px rgba(0, 0, 0, 0.35)',
  elevated: '0 20px 60px rgba(0, 0, 0, 0.3)',
  static: '0 20px 60px rgba(0, 0, 0, 0.3)',
}

const hoverShadowEffect = '0 20px 60px rgba(0, 0, 0, 0.4)'

const paddings: Record<string, string> = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
  xl: 'p-8',
}

const radiuses: Record<string, string> = {
  sm: 'rounded-lg',
  md: 'rounded-xl',
  lg: 'rounded-2xl',
  xl: 'rounded-[20px]',
  '2xl': 'rounded-[28px]',
}

// ============================================================================
// GlassContainer Component
// ============================================================================

export const GlassContainer = forwardRef<HTMLDivElement, GlassContainerProps>(
  (
    {
      className = '',
      variant = 'default',
      padding = 'none',
      radius = 'lg',
      features: featureOverrides,
      interactive = false,
      as: Component = 'div',
      style,
      children,
      ...props
    },
    ref
  ) => {
    const [isHovered, setIsHovered] = useState(false)

    const features = { ...defaultFeatures, ...featureOverrides }

    if (variant === 'static') {
      if (featureOverrides?.hoverGlow === undefined) features.hoverGlow = false
    }

    const shadowParts: string[] = []
    if (features.shadow) {
      shadowParts.push(shadows[variant])
    }
    if (isHovered && features.hoverGlow) {
      shadowParts.push(hoverShadowEffect)
    }

    const computedStyle: React.CSSProperties = {
      background: isHovered && features.hoverGlow
        ? hoverBackgrounds[variant]
        : backgrounds[variant],
      border: `1px solid ${isHovered && features.hoverGlow ? hoverBorder : borders[variant]}`,
      boxShadow: shadowParts.length > 0 ? shadowParts.join(', ') : undefined,
      transform: isHovered && features.hoverLift ? 'scale(1.01)' : undefined,
      ...style,
    }

    const classNames = [
      radiuses[radius],
      paddings[padding],
      'relative overflow-hidden transition-all duration-300',
      interactive ? 'cursor-pointer' : '',
      className,
    ].filter(Boolean).join(' ')

    return (
      <Component
        ref={ref}
        className={classNames}
        style={computedStyle}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        {...props}
      >
        {children}
      </Component>
    )
  }
)

GlassContainer.displayName = 'GlassContainer'

// ============================================================================
// Sub-Components
// ============================================================================

export interface GlassContainerHeaderProps extends HTMLAttributes<HTMLDivElement> {
  title?: string
  description?: string
  action?: ReactNode
}

export const GlassContainerHeader = forwardRef<HTMLDivElement, GlassContainerHeaderProps>(
  ({ className = '', title, description, action, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`flex items-start justify-between gap-4 px-6 py-5 border-b border-[rgba(255,255,255,0.08)] ${className}`}
        {...props}
      >
        {children ? (
          children
        ) : (
          <div className="space-y-1">
            {title && <h3 className="text-base font-semibold text-white">{title}</h3>}
            {description && <p className="text-sm text-[var(--text-muted)]">{description}</p>}
          </div>
        )}
        {action && <div className="flex-shrink-0">{action}</div>}
      </div>
    )
  }
)

GlassContainerHeader.displayName = 'GlassContainerHeader'

export const GlassContainerContent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className = '', children, ...props }, ref) => {
    return (
      <div ref={ref} className={`px-6 py-5 ${className}`} {...props}>
        {children}
      </div>
    )
  }
)

GlassContainerContent.displayName = 'GlassContainerContent'

export const GlassContainerFooter = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className = '', children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`flex items-center gap-3 px-6 py-4 border-t border-[rgba(255,255,255,0.08)] ${className}`}
        {...props}
      >
        {children}
      </div>
    )
  }
)

GlassContainerFooter.displayName = 'GlassContainerFooter'

export function GlassContainerDivider() {
  return <div className="border-t border-[rgba(255,255,255,0.08)]" />
}

export default GlassContainer
