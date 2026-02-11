/**
 * @icefuse/auth - TypeScript Types
 *
 * Type definitions for Icefuse Authentication
 */

// ============================================================
// CONFIGURATION TYPES
// ============================================================

/**
 * Configuration options for createIcefuseAuth
 */
export interface IcefuseAuthConfig {
  /**
   * App name for cookie naming (e.g., 'store', 'cms')
   * This ensures unique cookie names per app to prevent collision.
   */
  appName: string

  /**
   * Your application's client ID from the Icefuse auth server.
   * Get this from the Icefuse admin panel.
   */
  clientId: string

  /**
   * Your application's client secret.
   * Keep this secret! Use environment variables.
   */
  clientSecret: string

  /**
   * Enable silent authentication for cross-domain SSO.
   * Use this for apps on icefuse.com or ifn.gg domains.
   * Default: false
   */
  enableSilentAuth?: boolean

  /**
   * Custom issuer URL (auth server).
   * Default: https://auth.icefuse.com
   */
  issuer?: string

  /**
   * Additional scopes to request.
   * Default: ['openid', 'profile', 'email', 'icefuse:platforms', 'icefuse:admin', 'icefuse:paynow', 'offline_access']
   */
  scopes?: string[]

  /**
   * Enable debug logging
   * Default: false
   */
  debug?: boolean

  /**
   * Callback when user logs in
   */
  onLogin?: (user: IcefuseUser) => void | Promise<void>

  /**
   * Callback when user logs out (including cross-app logout)
   */
  onLogout?: () => void | Promise<void>

  /**
   * Callback when an error occurs (e.g., token refresh failure)
   */
  onError?: (error: string) => void

  /**
   * Callback when session is updated
   */
  onSessionUpdate?: (session: IcefuseSession) => void
}

// ============================================================
// USER & SESSION TYPES
// ============================================================

/**
 * Icefuse user profile
 */
export interface IcefuseUser {
  /** Unique user ID */
  id: string

  /** Display name */
  name: string | null

  /** Email address */
  email: string | null

  /** Whether email is verified */
  emailVerified: boolean

  /** Avatar URL */
  image: string | null

  /** Steam ID (if linked) */
  steamId: string | null

  /** Discord ID (if linked) */
  discordId: string | null

  /** Minecraft UUID (if linked) */
  minecraftUuid: string | null

  /** Xbox XUID (if linked) */
  xboxXuid: string | null

  /** Hytale ID (if linked) */
  hytaleId: string | null

  /** Whether user is an admin (requires icefuse:admin scope, included in defaults) */
  isAdmin: boolean

  /** Whether user is a root user (requires icefuse:admin scope, included in defaults) */
  isRoot: boolean

  /** PayNow customer ID (if store scope granted) */
  paynowCustomerId: string | null
}

/**
 * Error types that can occur in sessions
 */
export type IcefuseSessionError = 'RefreshAccessTokenError' | 'SessionRevoked'

/**
 * Icefuse session
 */
export interface IcefuseSession {
  user: IcefuseUser
  accessToken: string
  accessTokenExpires: number
  error?: IcefuseSessionError
  expires: string
}

/**
 * Icefuse JWT token
 */
export interface IcefuseJWT {
  accessToken: string
  refreshToken?: string
  accessTokenExpires: number
  sessionCreatedAt?: number // Timestamp when session was created, for revocation race condition protection
  user: IcefuseUser
  error?: IcefuseSessionError
  // Standard JWT fields
  name?: string | null
  email?: string | null
  picture?: string | null
  sub?: string
}

// ============================================================
// COMPONENT PROPS
// ============================================================

/**
 * Props for UserProfileCard component
 */
export interface UserProfileCardProps {
  /** Custom class name */
  className?: string

  /** Show linked platforms */
  showPlatforms?: boolean

  /** Show admin badge if applicable */
  showAdminBadge?: boolean

  /** Compact mode (smaller) */
  compact?: boolean

  /** Custom logout handler */
  onLogout?: () => void
}

/**
 * Props for LoginButton component
 */
export interface LoginButtonProps {
  /** Button text */
  children?: React.ReactNode

  /** Custom class name */
  className?: string

  /** Redirect URL after login */
  callbackUrl?: string
}

/**
 * Props for LogoutButton component
 */
export interface LogoutButtonProps {
  /** Button text */
  children?: React.ReactNode

  /** Custom class name */
  className?: string

  /** Redirect URL after logout */
  callbackUrl?: string
}

/**
 * Props for IcefuseAuthProvider
 */
export interface IcefuseAuthProviderProps {
  children: React.ReactNode

  /** Enable silent auth for cross-domain SSO */
  enableSilentAuth?: boolean
}

// ============================================================
// RETURN TYPES
// ============================================================

/**
 * Return type of createIcefuseAuth
 */
export interface IcefuseAuthResult {
  /** Route handlers for /api/auth/[...nextauth] */
  handlers: {
    GET: (request: Request) => Promise<Response>
    POST: (request: Request) => Promise<Response>
  }

  /** Get session on server side */
  auth: () => Promise<IcefuseSession | null>

  /** Sign in function */
  signIn: (options?: { callbackUrl?: string }) => Promise<void>

  /** Sign out function */
  signOut: (options?: { callbackUrl?: string }) => Promise<void>

  /** Raw NextAuth options (for advanced use cases) */
  authOptions: import('next-auth').NextAuthOptions
}

// ============================================================
// COOKIE TYPES
// ============================================================

/**
 * Cookie names for an app
 */
export interface CookieConfig {
  sessionToken: string
  callbackUrl: string
  csrfToken: string
  pkceCodeVerifier: string
  state: string
}

/**
 * Cookie settings
 */
export interface CookieSettings {
  httpOnly: boolean
  secure: boolean
  sameSite: 'lax' | 'strict' | 'none'
  path: string
  domain?: string
}

// ============================================================
// MODULE AUGMENTATION
// ============================================================

// Augment next-auth types to include Icefuse fields
declare module 'next-auth' {
  interface Session {
    user: IcefuseUser
    accessToken: string
    accessTokenExpires: number
    error?: IcefuseSessionError
  }

  interface User {
    id: string
    name: string | null
    email: string | null
    emailVerified?: boolean
    image: string | null
    steamId?: string | null
    discordId?: string | null
    minecraftUuid?: string | null
    xboxXuid?: string | null
    hytaleId?: string | null
    isAdmin?: boolean
    isRoot?: boolean
    paynowCustomerId?: string | null
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    accessToken: string
    refreshToken?: string
    accessTokenExpires: number
    sessionCreatedAt?: number
    user: IcefuseUser
    error?: IcefuseSessionError
  }
}
