/**
 * UserProfileCard - Global User Profile Component
 *
 * A unified profile card component used across all pages.
 * Uses useSession() from NextAuth for consistent session handling.
 *
 * FEATURES:
 * - Consistent styling with theme tokens
 * - Customizable dropdown with header and grouped sections
 * - Loading and unauthenticated states
 * - Responsive design (compact on mobile)
 *
 * SECURITY:
 * - Uses session-derived data only (no client-supplied IDs)
 * - All user data comes from JWT token
 *
 * @example
 * // Basic usage (Site header style)
 * <UserProfileCard showHeader showHeaderEmail />
 *
 * // Compact variant
 * <UserProfileCard variant="compact" signOutRedirect="portal" />
 */

'use client'

import { useState, useRef, useEffect } from 'react'
import { useSession, signIn } from 'next-auth/react'
import Image from 'next/image'
import Link from 'next/link'
import { createPortal } from 'react-dom'
import {
  User,
  ChevronDown,
  LogIn,
  LogOut,
  HelpCircle,
  LayoutDashboard,
  Package,
  HardDrive,
  Shield,
  Gift,
  BarChart2,
} from 'lucide-react'
import { accountRoutes } from '@/config/routes'

// ============================================================================
// Types
// ============================================================================

export type UserProfileVariant = 'default' | 'compact' | 'minimal'

export interface UserProfileMenuItem {
  id: string
  label: string
  icon?: React.ReactNode
  href?: string
  onClick?: () => void
  divider?: boolean
  danger?: boolean
  /** Highlight with brand color */
  highlight?: boolean
}

export interface UserProfileCardProps {
  /** Visual variant */
  variant?: UserProfileVariant
  /** Custom menu items (replaces defaults) */
  menuItems?: UserProfileMenuItem[]
  /** Additional menu items (appends to defaults) */
  extraMenuItems?: UserProfileMenuItem[]
  /** Show user info header in dropdown (name/email) */
  showHeader?: boolean
  /** Show email in the header */
  showHeaderEmail?: boolean
  /** Show help link */
  showHelpLink?: boolean
  /** Custom sign out handler */
  onSignOut?: () => void
  /** Sign out redirect location ('current' = stay on page if public) */
  signOutRedirect?: 'signin' | 'portal' | 'current' | string
  /** Custom class name */
  className?: string
}

// ============================================================================
// Component
// ============================================================================

export function UserProfileCard({
  variant = 'default',
  menuItems,
  extraMenuItems,
  showHeader = false,
  showHeaderEmail = false,
  showHelpLink = false,
  onSignOut,
  signOutRedirect = 'current',
  className,
}: UserProfileCardProps) {
  const { data: session, status } = useSession()
  const [isOpen, setIsOpen] = useState(false)
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 })
  const containerRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  // Get user display info from session
  const user = session?.user
  const displayName = user?.name || 'User'
  const displayEmail = user?.email || ''
  const displaySubtext = (user as { steamId?: string })?.steamId || displayEmail
  const avatarUrl = user?.image

  // Handle sign out
  const handleSignOut = () => {
    console.log('[UserProfileCard] Sign out clicked')
    setIsOpen(false)
    if (onSignOut) {
      console.log('[UserProfileCard] Calling custom onSignOut handler')
      onSignOut()
    } else {
      // Build logout URL with redirect and current URL for 'current' mode
      const params = new URLSearchParams()
      params.set('redirect', signOutRedirect)

      // Pass current URL so logout route can determine if it's a protected page
      if (signOutRedirect === 'current' && typeof window !== 'undefined') {
        params.set('returnUrl', window.location.href)
      }

      const logoutUrl = `/api/auth/logout?${params.toString()}`
      console.log('[UserProfileCard] Navigating to:', logoutUrl)
      window.location.href = logoutUrl
    }
  }

  // Calculate menu position synchronously when opening
  const handleToggleMenu = () => {
    if (!isOpen && triggerRef.current) {
      // Calculate position before opening to avoid flash at (0,0)
      const rect = triggerRef.current.getBoundingClientRect()
      const menuWidth = 240
      setMenuPosition({
        top: rect.bottom + 8,
        left: rect.right - menuWidth,
      })
    }
    setIsOpen(!isOpen)
  }

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node
      if (
        containerRef.current && !containerRef.current.contains(target) &&
        menuRef.current && !menuRef.current.contains(target)
      ) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  // Close on escape key
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      return () => document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen])

  // Check admin status from session
  const userAny = user as Record<string, unknown> | undefined
  const isUserAdmin = Boolean(userAny?.isAdmin || userAny?.isRoot)

  // Build menu items
  const buildMenuItems = (): UserProfileMenuItem[] => {
    if (menuItems) {
      return menuItems
    }

    const items: UserProfileMenuItem[] = [
      {
        id: 'dashboard',
        label: 'Dashboard',
        icon: <LayoutDashboard className="w-4 h-4" />,
        href: accountRoutes.dashboard,
        highlight: true,
      },
    ]

    // Admin-only pages
    if (isUserAdmin) {
      items.push(
        { id: 'divider-admin', label: '', divider: true },
        {
          id: 'kits',
          label: 'Kits',
          icon: <Package className="w-4 h-4" />,
          href: '/dashboard/kits',
        },
        {
          id: 'servers',
          label: 'Servers',
          icon: <HardDrive className="w-4 h-4" />,
          href: '/dashboard/servers',
        },
        {
          id: 'clans',
          label: 'Clans',
          icon: <Shield className="w-4 h-4" />,
          href: '/dashboard/clans',
        },
        {
          id: 'giveaways',
          label: 'Giveaways',
          icon: <Gift className="w-4 h-4" />,
          href: '/dashboard/giveaways',
        },
        {
          id: 'analytics',
          label: 'Player Analytics',
          icon: <BarChart2 className="w-4 h-4" />,
          href: '/dashboard/player-analytics',
        },
      )
    }

    // Add help link if enabled
    if (showHelpLink) {
      items.push({
        id: 'help',
        label: 'Help & Support',
        icon: <HelpCircle className="w-4 h-4" />,
        href: '/docs',
      })
    }

    // Add extra items
    if (extraMenuItems && extraMenuItems.length > 0) {
      items.push(...extraMenuItems)
    }

    return items
  }

  const finalMenuItems = buildMenuItems()

  // Loading state - h-12 to match consistent height
  // Shows a realistic skeleton with placeholder avatar and pulse animation
  if (status === 'loading') {
    return (
      <div
        className={`flex items-center gap-2 h-12 rounded-xl overflow-hidden ${className || ''}`}
        style={{
          paddingLeft: '6px',
          paddingRight: variant === 'minimal' ? '6px' : '12px',
          background: 'var(--glass-bg-prominent)',
          border: '1px solid var(--glass-border)',
        }}
      >
        {/* Skeleton Avatar with gradient placeholder */}
        <div
          className="w-9 h-9 rounded-full flex-shrink-0 relative overflow-hidden animate-pulse"
          style={{
            background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.25), rgba(99, 102, 241, 0.25))',
          }}
        >
          {/* User icon silhouette */}
          <User
            className="w-5 h-5 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
            style={{ color: 'rgba(255,255,255,0.3)' }}
          />
        </div>

        {/* Skeleton Name */}
        {variant !== 'minimal' && (
          <div className="hidden sm:flex items-center gap-2">
            <div
              className="h-4 w-[72px] rounded animate-pulse"
              style={{
                background: 'rgba(255,255,255,0.08)',
              }}
            />
            <ChevronDown
              className="w-4 h-4 flex-shrink-0"
              style={{ color: 'rgba(255,255,255,0.2)' }}
            />
          </div>
        )}
      </div>
    )
  }

  // Handle sign in - use NextAuth OIDC flow (not direct auth server redirect)
  const handleSignIn = () => {
    const callbackUrl = typeof window !== 'undefined' ? window.location.pathname : '/'
    signIn('icefuse', { callbackUrl, redirect: true })
  }

  // Not logged in - show sign in button - h-12 to match consistent height
  if (!session?.user) {
    return (
      <button
        onClick={handleSignIn}
        className={`flex items-center justify-center gap-2 h-12 rounded-xl transition-all duration-200 hover:scale-105 ${className || ''}`}
        style={{
          paddingLeft: variant === 'minimal' ? '12px' : '16px',
          paddingRight: variant === 'minimal' ? '12px' : '16px',
          background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
          boxShadow: '0 4px 20px rgba(59, 130, 246, 0.4)',
        }}
        aria-label="Sign in"
      >
        {variant === 'minimal' ? (
          <LogIn className="w-5 h-5 text-white" />
        ) : (
          <>
            <User className="w-4 h-4 text-white" />
            <span className="text-sm font-medium text-white">Sign In</span>
          </>
        )}
      </button>
    )
  }

  // Logged in - show profile with dropdown
  return (
    <div ref={containerRef} className="relative">
      {/* Trigger Button - h-12 (48px) for consistent height */}
      <button
        ref={triggerRef}
        onClick={handleToggleMenu}
        className={`flex items-center gap-2 h-12 rounded-xl transition-all hover:bg-[var(--glass-bg-prominent)] ${className || ''}`}
        style={{
          paddingLeft: variant === 'minimal' ? '6px' : '6px',
          paddingRight: variant === 'minimal' ? '6px' : '12px',
          background: 'var(--glass-bg-prominent)',
          border: '1px solid var(--glass-border)',
        }}
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-label="User menu"
      >
        {/* Avatar */}
        {avatarUrl ? (
          <Image
            src={avatarUrl}
            alt={displayName}
            width={36}
            height={36}
            className="w-9 h-9 rounded-full object-cover"
          />
        ) : (
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))' }}
          >
            <User className="w-5 h-5 text-white" />
          </div>
        )}

        {/* Name (hidden on minimal) */}
        {variant !== 'minimal' && (
          <span className="hidden sm:block text-sm text-white font-medium max-w-[120px] truncate">
            {displayName}
          </span>
        )}

        {/* Chevron */}
        {variant !== 'minimal' && (
          <ChevronDown
            className={`hidden sm:block w-4 h-4 transition-transform flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`}
            style={{ color: 'var(--text-tertiary)' }}
          />
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && typeof document !== 'undefined' && createPortal(
        <div
          ref={menuRef}
          className="rounded-xl overflow-hidden"
          style={{
            position: 'fixed',
            top: menuPosition.top,
            left: menuPosition.left,
            width: 240,
            zIndex: 9999,
            background: 'linear-gradient(145deg, rgba(20, 35, 60, 0.95) 0%, rgba(15, 28, 50, 0.97) 50%, rgba(12, 22, 42, 0.98) 100%)',
            border: '1px solid rgba(255, 255, 255, 0.20)',
            backdropFilter: 'blur(60px) saturate(150%)',
            WebkitBackdropFilter: 'blur(60px) saturate(150%)',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.30), 0 8px 32px rgba(0, 0, 0, 0.22), inset 0 1px 0 rgba(255, 255, 255, 0.25)',
          }}
        >
          {/* User Info Header */}
          {showHeader && (
            <div className="p-3" style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.10)' }}>
              <p className="font-medium text-white">{displayName}</p>
              {showHeaderEmail && displayEmail && (
                <p className="text-sm text-[var(--text-tertiary)]">{displayEmail}</p>
              )}
              {!showHeaderEmail && displaySubtext && displaySubtext !== displayEmail && (
                <p className="text-sm text-[var(--text-tertiary)]">{displaySubtext}</p>
              )}
            </div>
          )}

          {/* Menu Items */}
          <div className="py-1 max-h-60 overflow-auto">
            {finalMenuItems.map((item, index) => {
              if (item.divider) {
                return (
                  <div
                    key={item.id}
                    style={{ borderTop: '1px solid rgba(255, 255, 255, 0.10)' }}
                  />
                )
              }

              const isHighlight = item.highlight
              const linkProps = {
                className: `flex items-center gap-3 px-4 py-2.5 text-sm transition-colors duration-150 ${
                  isHighlight
                    ? 'text-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/20 hover:text-white'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--glass-bg-prominent)] hover:text-white'
                }`,
                onClick: () => {
                  setIsOpen(false)
                  item.onClick?.()
                },
              }

              // Add divider before highlighted link if needed
              const needsDivider = isHighlight && index > 0 && !finalMenuItems[index - 1]?.divider

              return (
                <div key={item.id}>
                  {needsDivider && (
                    <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.10)' }} />
                  )}
                  {item.href ? (
                    <Link href={item.href} {...linkProps}>
                      {item.icon}
                      <span className={isHighlight ? 'font-medium' : ''}>{item.label}</span>
                    </Link>
                  ) : (
                    <button {...linkProps} className={`w-full ${linkProps.className}`}>
                      {item.icon}
                      <span className={isHighlight ? 'font-medium' : ''}>{item.label}</span>
                    </button>
                  )}
                </div>
              )
            })}
          </div>

          {/* Sign Out */}
          <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.10)' }}>
            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors duration-150 text-[var(--status-error)] hover:bg-[var(--status-error)]/15"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

export default UserProfileCard
