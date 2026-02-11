/**
 * @icefuse/auth - Configuration
 *
 * Cookie configuration, environment helpers, and domain utilities.
 */

// ============================================================
// TYPES
// ============================================================

export interface CookieConfig {
  sessionToken: string
  callbackUrl: string
  csrfToken: string
  pkceCodeVerifier: string
  state: string
}

export interface CookieSettings {
  httpOnly: boolean
  secure: boolean
  sameSite: 'lax' | 'strict' | 'none'
  path: string
  domain?: string
}

// ============================================================
// ENVIRONMENT HELPERS
// ============================================================

/**
 * Get Auth Server URL
 */
export function getAuthUrl(): string {
  return process.env.AUTH_URL || process.env.NEXT_PUBLIC_AUTH_URL || 'https://auth.icefuse.com'
}

/**
 * Get NextAuth secret
 */
export function getNextAuthSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET
  if (!secret) {
    throw new Error('NEXTAUTH_SECRET environment variable is required')
  }
  return secret
}

/**
 * Get user sync secret for cross-app communication
 */
export function getUserSyncSecret(): string {
  // Support both naming conventions
  const secret = process.env.AUTH_USER_SYNC_SECRET || process.env.USER_SYNC_SECRET
  if (!secret) {
    throw new Error('AUTH_USER_SYNC_SECRET or USER_SYNC_SECRET environment variable is required')
  }
  return secret
}

/**
 * Get OIDC client ID
 */
export function getClientId(): string {
  const clientId = process.env.ICEFUSE_CLIENT_ID
  if (!clientId) {
    throw new Error('ICEFUSE_CLIENT_ID environment variable is required')
  }
  return clientId
}

/**
 * Get OIDC client secret
 */
export function getClientSecret(): string {
  const secret = process.env.ICEFUSE_CLIENT_SECRET
  if (!secret) {
    throw new Error('ICEFUSE_CLIENT_SECRET environment variable is required')
  }
  return secret
}

/**
 * Check if running in production
 */
export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production'
}

/**
 * Check if debug logging is enabled for the @icefuse/auth package.
 * Set ICEFUSE_AUTH_DEBUG=true to enable verbose logging.
 */
export function isDebugEnabled(): boolean {
  return process.env.ICEFUSE_AUTH_DEBUG === 'true'
}

/**
 * Log a debug message if ICEFUSE_AUTH_DEBUG is enabled.
 * All @icefuse/auth log calls should go through this.
 */
export function debugLog(prefix: string, ...args: unknown[]): void {
  if (isDebugEnabled()) {
    console.log(`[Icefuse Auth:${prefix}]`, ...args)
  }
}

/**
 * Log a debug warning if ICEFUSE_AUTH_DEBUG is enabled.
 */
export function debugWarn(prefix: string, ...args: unknown[]): void {
  if (isDebugEnabled()) {
    console.warn(`[Icefuse Auth:${prefix}]`, ...args)
  }
}

// ============================================================
// COOKIE CONFIGURATION
// ============================================================

/**
 * Get cookie domain based on environment
 * Production: .icefuse.com (shared across subdomains)
 * Development: undefined (localhost only)
 */
export function getCookieDomain(): string | undefined {
  if (isProduction()) {
    return process.env.COOKIE_DOMAIN || '.icefuse.com'
  }
  return undefined
}

/**
 * Generate cookie names for an app
 * Each app should have unique cookie names to prevent collision
 *
 * @param appName - Short name for the app (e.g., 'store', 'cms')
 */
export function getCookieNames(appName: string): CookieConfig {
  const prefix = isProduction() ? '__Secure-' : ''
  const hostPrefix = isProduction() ? '__Host-' : ''

  return {
    sessionToken: `${prefix}icefuse-${appName}.session-token`,
    callbackUrl: `${prefix}icefuse-${appName}.callback-url`,
    csrfToken: `${hostPrefix}icefuse-${appName}.csrf-token`,
    pkceCodeVerifier: `${prefix}icefuse-${appName}.pkce.code_verifier`,
    state: `${prefix}icefuse-${appName}.state`,
  }
}

/**
 * Get default cookie settings
 */
export function getCookieSettings(): CookieSettings {
  return {
    httpOnly: true,
    secure: isProduction(),
    sameSite: 'lax',
    path: '/',
    domain: getCookieDomain(),
  }
}

/**
 * Build NextAuth cookie configuration for an app
 *
 * @param appName - Short name for the app
 */
export function buildCookieConfig(appName: string) {
  const names = getCookieNames(appName)
  const settings = getCookieSettings()

  return {
    sessionToken: {
      name: names.sessionToken,
      options: {
        httpOnly: settings.httpOnly,
        sameSite: settings.sameSite,
        path: settings.path,
        secure: settings.secure,
        domain: settings.domain,
      },
    },
    callbackUrl: {
      name: names.callbackUrl,
      options: {
        httpOnly: settings.httpOnly,
        sameSite: settings.sameSite,
        path: settings.path,
        secure: settings.secure,
        domain: settings.domain,
      },
    },
    csrfToken: {
      name: names.csrfToken,
      options: {
        httpOnly: settings.httpOnly,
        sameSite: settings.sameSite,
        path: settings.path,
        secure: settings.secure,
        // __Host- cookies CANNOT have domain (per HTTP spec)
      },
    },
    state: {
      name: names.state,
      options: {
        httpOnly: settings.httpOnly,
        sameSite: settings.sameSite,
        path: settings.path,
        secure: settings.secure,
        domain: settings.domain,
        maxAge: 900, // 15 minutes
      },
    },
    pkceCodeVerifier: {
      name: names.pkceCodeVerifier,
      options: {
        httpOnly: settings.httpOnly,
        sameSite: settings.sameSite,
        path: settings.path,
        secure: settings.secure,
        domain: settings.domain,
        maxAge: 900, // 15 minutes
      },
    },
  }
}

// ============================================================
// HOST VALIDATION
// ============================================================

/**
 * Allowed base domains for redirects
 */
const ALLOWED_BASE_DOMAINS = ['icefuse.com', 'ifn.gg']

/**
 * Check if a hostname is allowed for OAuth redirects
 * Allows: localhost, 127.0.0.1, and any subdomain of allowed domains
 */
export function isAllowedHost(hostname: string): boolean {
  const host = hostname.toLowerCase()

  // Development
  if (host === 'localhost' || host === '127.0.0.1') {
    return true
  }

  // Production: any subdomain of allowed base domains
  for (const base of ALLOWED_BASE_DOMAINS) {
    if (host === base || host.endsWith(`.${base}`)) {
      return true
    }
  }

  return false
}

/**
 * Validate a redirect URL
 * Returns the URL if valid, or fallback if not
 */
export function validateRedirectUrl(url: string, fallback = '/'): string {
  // Allow relative URLs (but not protocol-relative)
  if (url.startsWith('/') && !url.startsWith('//')) {
    return url
  }

  try {
    const parsed = new URL(url)
    if (isAllowedHost(parsed.hostname)) {
      return url
    }
  } catch {
    // Invalid URL
  }

  return fallback
}
