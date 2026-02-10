'use client'

/**
 * @icefuse/auth - React Components
 *
 * Pre-built UI components for Icefuse authentication.
 * Drop-in components that work with CSS variables.
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { signIn, signOut, useSession } from 'next-auth/react'
import { SessionProvider } from 'next-auth/react'
import type {
  IcefuseAuthProviderProps,
  IcefuseSession,
  UserProfileCardProps,
  LoginButtonProps,
  LogoutButtonProps,
} from './types'

// ============================================================
// PROVIDER
// ============================================================

/**
 * Silent auth context for cross-domain SSO
 */
const SilentAuthContext = createContext<{
  isChecking: boolean
  checkSilentAuth: () => void
}>({
  isChecking: false,
  checkSilentAuth: () => {},
})

/**
 * Icefuse Auth Provider
 *
 * Wraps your app with session management and optional silent auth.
 *
 * @example
 * ```tsx
 * // app/layout.tsx
 * import { IcefuseAuthProvider } from '@icefuse/auth'
 *
 * export default function RootLayout({ children }) {
 *   return (
 *     <html>
 *       <body>
 *         <IcefuseAuthProvider>
 *           {children}
 *         </IcefuseAuthProvider>
 *       </body>
 *     </html>
 *   )
 * }
 * ```
 */
export function IcefuseAuthProvider({
  children,
  enableSilentAuth = false,
}: IcefuseAuthProviderProps) {
  const [isChecking, setIsChecking] = useState(false)

  const checkSilentAuth = useCallback(() => {
    if (!enableSilentAuth || isChecking) return

    setIsChecking(true)

    // Create hidden iframe for silent auth check
    const iframe = document.createElement('iframe')
    iframe.style.display = 'none'
    iframe.src = `${process.env.NEXT_PUBLIC_AUTH_URL || 'https://auth.icefuse.com'}/oauth/authorize?` +
      new URLSearchParams({
        client_id: process.env.NEXT_PUBLIC_ICEFUSE_CLIENT_ID || '',
        redirect_uri: `${window.location.origin}/api/auth/callback/icefuse`,
        response_type: 'code',
        scope: 'openid profile email icefuse:platforms',
        prompt: 'none',
      }).toString()

    // Listen for response
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== (process.env.NEXT_PUBLIC_AUTH_URL || 'https://auth.icefuse.com')) {
        return
      }

      if (event.data.type === 'silent_auth_success') {
        // Refresh the session
        window.location.reload()
      }

      setIsChecking(false)
      document.body.removeChild(iframe)
      window.removeEventListener('message', handleMessage)
    }

    window.addEventListener('message', handleMessage)

    // Timeout after 5 seconds
    setTimeout(() => {
      if (iframe.parentNode) {
        document.body.removeChild(iframe)
      }
      setIsChecking(false)
      window.removeEventListener('message', handleMessage)
    }, 5000)

    document.body.appendChild(iframe)
  }, [enableSilentAuth, isChecking])

  return (
    <SessionProvider>
      <SilentAuthContext.Provider value={{ isChecking, checkSilentAuth }}>
        {children}
      </SilentAuthContext.Provider>
    </SessionProvider>
  )
}

// ============================================================
// USER PROFILE CARD
// ============================================================

/**
 * User Profile Card Component
 *
 * Displays user info with optional platform badges and logout button.
 * Uses CSS variables for styling compatibility.
 *
 * @example
 * ```tsx
 * import { UserProfileCard } from '@icefuse/auth'
 *
 * export default function Header() {
 *   return <UserProfileCard showPlatforms showAdminBadge />
 * }
 * ```
 */
export function UserProfileCard({
  className = '',
  showPlatforms = true,
  showAdminBadge = true,
  compact = false,
  onLogout,
}: UserProfileCardProps) {
  const { data: session, status } = useSession() as {
    data: IcefuseSession | null
    status: 'loading' | 'authenticated' | 'unauthenticated'
  }

  if (status === 'loading') {
    return (
      <div className={`icefuse-profile-card icefuse-profile-card--loading ${className}`}>
        <div className="icefuse-profile-card__skeleton" />
      </div>
    )
  }

  if (status === 'unauthenticated' || !session?.user) {
    return <LoginButton className={className}>Sign In</LoginButton>
  }

  const user = session.user

  const handleLogout = async () => {
    if (onLogout) {
      onLogout()
    } else {
      await signOut()
    }
  }

  if (compact) {
    return (
      <div className={`icefuse-profile-card icefuse-profile-card--compact ${className}`}>
        {user.image && (
          <img
            src={user.image}
            alt={user.name || 'User'}
            className="icefuse-profile-card__avatar icefuse-profile-card__avatar--small"
          />
        )}
        <span className="icefuse-profile-card__name">{user.name}</span>
        <button
          onClick={handleLogout}
          className="icefuse-profile-card__logout-btn icefuse-profile-card__logout-btn--icon"
          aria-label="Sign out"
        >
          <LogoutIcon />
        </button>
      </div>
    )
  }

  return (
    <div className={`icefuse-profile-card ${className}`}>
      <div className="icefuse-profile-card__header">
        {user.image && (
          <img
            src={user.image}
            alt={user.name || 'User'}
            className="icefuse-profile-card__avatar"
          />
        )}
        <div className="icefuse-profile-card__info">
          <span className="icefuse-profile-card__name">
            {user.name}
            {showAdminBadge && user.isAdmin && (
              <span className="icefuse-profile-card__badge icefuse-profile-card__badge--admin">
                {user.isRoot ? 'Root' : 'Admin'}
              </span>
            )}
          </span>
          {user.email && (
            <span className="icefuse-profile-card__email">{user.email}</span>
          )}
        </div>
      </div>

      {showPlatforms && (
        <div className="icefuse-profile-card__platforms">
          {user.steamId && (
            <span className="icefuse-profile-card__platform" title={`Steam: ${user.steamId}`}>
              <SteamIcon /> Steam
            </span>
          )}
          {user.discordId && (
            <span className="icefuse-profile-card__platform" title={`Discord: ${user.discordId}`}>
              <DiscordIcon /> Discord
            </span>
          )}
          {user.minecraftUuid && (
            <span className="icefuse-profile-card__platform" title={`Minecraft: ${user.minecraftUuid}`}>
              <MinecraftIcon /> Minecraft
            </span>
          )}
          {user.xboxXuid && (
            <span className="icefuse-profile-card__platform" title={`Xbox: ${user.xboxXuid}`}>
              <XboxIcon /> Xbox
            </span>
          )}
        </div>
      )}

      <button onClick={handleLogout} className="icefuse-profile-card__logout-btn">
        Sign Out
      </button>
    </div>
  )
}

// ============================================================
// LOGIN BUTTON
// ============================================================

/**
 * Login Button Component
 *
 * @example
 * ```tsx
 * import { LoginButton } from '@icefuse/auth'
 *
 * <LoginButton>Sign in with Icefuse</LoginButton>
 * ```
 */
export function LoginButton({
  children = 'Sign In',
  className = '',
  callbackUrl,
}: LoginButtonProps) {
  const handleClick = () => {
    signIn('icefuse', { callbackUrl: callbackUrl || window.location.href })
  }

  return (
    <button onClick={handleClick} className={`icefuse-login-btn ${className}`}>
      {children}
    </button>
  )
}

// ============================================================
// LOGOUT BUTTON
// ============================================================

/**
 * Logout Button Component
 *
 * @example
 * ```tsx
 * import { LogoutButton } from '@icefuse/auth'
 *
 * <LogoutButton>Sign Out</LogoutButton>
 * ```
 */
export function LogoutButton({
  children = 'Sign Out',
  className = '',
  callbackUrl,
}: LogoutButtonProps) {
  const handleClick = () => {
    signOut({ callbackUrl: callbackUrl || '/' })
  }

  return (
    <button onClick={handleClick} className={`icefuse-logout-btn ${className}`}>
      {children}
    </button>
  )
}

// ============================================================
// HOOKS
// ============================================================

/**
 * Hook to access silent auth functionality
 */
export function useSilentAuth() {
  return useContext(SilentAuthContext)
}

/**
 * Hook to get the current Icefuse session
 */
export function useIcefuseSession() {
  const { data, status } = useSession()
  return {
    session: data as IcefuseSession | null,
    status,
    isLoading: status === 'loading',
    isAuthenticated: status === 'authenticated',
    user: (data as IcefuseSession | null)?.user || null,
  }
}

// ============================================================
// ICONS (Simple inline SVGs)
// ============================================================

function LogoutIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16,17 21,12 16,7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  )
}

function SteamIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15H8v-3h2V9.5C10 7.57 11.57 6 13.5 6H16v3h-2c-.55 0-1 .45-1 1v2h3l-.5 3H13v6.95c5.05-.5 9-4.76 9-9.95 0-5.52-4.48-10-10-10z"/>
    </svg>
  )
}

function DiscordIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
    </svg>
  )
}

function MinecraftIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M4 4h16v16H4V4zm2 2v12h12V6H6zm2 2h2v2H8V8zm6 0h2v2h-2V8zm-3 4h2v4h-2v-4z"/>
    </svg>
  )
}

function XboxIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-5-9l3 3-3 3v-6zm10 0v6l-3-3 3-3z"/>
    </svg>
  )
}

// ============================================================
// CSS (Injected at runtime)
// ============================================================

// Inject minimal CSS styles
if (typeof window !== 'undefined') {
  const styleId = 'icefuse-auth-styles'
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style')
    style.id = styleId
    style.textContent = `
      .icefuse-profile-card {
        display: flex;
        flex-direction: column;
        gap: 12px;
        padding: 16px;
        background: var(--glass-bg, rgba(255,255,255,0.1));
        border: 1px solid var(--glass-border, rgba(255,255,255,0.1));
        border-radius: var(--radius-lg, 12px);
        backdrop-filter: blur(10px);
      }

      .icefuse-profile-card--compact {
        flex-direction: row;
        align-items: center;
        padding: 8px 12px;
      }

      .icefuse-profile-card--loading .icefuse-profile-card__skeleton {
        height: 60px;
        background: linear-gradient(90deg, var(--bg-card, #1a1a2e) 25%, var(--bg-card-hover, #242442) 50%, var(--bg-card, #1a1a2e) 75%);
        background-size: 200% 100%;
        animation: shimmer 1.5s infinite;
        border-radius: var(--radius-md, 8px);
      }

      @keyframes shimmer {
        0% { background-position: 200% 0; }
        100% { background-position: -200% 0; }
      }

      .icefuse-profile-card__header {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .icefuse-profile-card__avatar {
        width: 48px;
        height: 48px;
        border-radius: 50%;
        object-fit: cover;
      }

      .icefuse-profile-card__avatar--small {
        width: 32px;
        height: 32px;
      }

      .icefuse-profile-card__info {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .icefuse-profile-card__name {
        font-weight: 600;
        color: var(--text-primary, #fff);
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .icefuse-profile-card__email {
        font-size: 0.875rem;
        color: var(--text-secondary, #a0a0a0);
      }

      .icefuse-profile-card__badge {
        font-size: 0.625rem;
        font-weight: 700;
        text-transform: uppercase;
        padding: 2px 6px;
        border-radius: 4px;
      }

      .icefuse-profile-card__badge--admin {
        background: var(--status-warning, #f59e0b);
        color: #000;
      }

      .icefuse-profile-card__platforms {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }

      .icefuse-profile-card__platform {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: 0.75rem;
        padding: 4px 8px;
        background: var(--bg-input, rgba(255,255,255,0.05));
        border-radius: var(--radius-sm, 4px);
        color: var(--text-secondary, #a0a0a0);
      }

      .icefuse-profile-card__logout-btn,
      .icefuse-login-btn,
      .icefuse-logout-btn {
        padding: 8px 16px;
        background: var(--accent-primary, #06b6d4);
        color: #000;
        border: none;
        border-radius: var(--radius-md, 8px);
        font-weight: 600;
        cursor: pointer;
        transition: opacity 0.2s;
      }

      .icefuse-profile-card__logout-btn:hover,
      .icefuse-login-btn:hover,
      .icefuse-logout-btn:hover {
        opacity: 0.9;
      }

      .icefuse-profile-card__logout-btn--icon {
        padding: 6px;
        background: transparent;
        color: var(--text-secondary, #a0a0a0);
      }

      .icefuse-profile-card__logout-btn--icon:hover {
        color: var(--text-primary, #fff);
      }
    `
    document.head.appendChild(style)
  }
}
