/**
 * @icefuse/auth - Logout Route Handler Factory
 *
 * Creates logout route handlers with cross-app session invalidation.
 *
 * GET: Browser-initiated logout - clears cookies and redirects
 * POST: Auth Server broadcast - receives cross-app logout notifications
 *
 * Usage:
 * ```ts
 * // src/app/api/auth/logout/route.ts
 * import { createLogoutHandlers } from '@icefuse/auth/logout'
 *
 * const { GET, POST, isSessionRevoked } = createLogoutHandlers({
 *   appName: 'store',
 *   onLogout: async (userId) => {
 *     // Clear app-specific caches
 *   },
 * })
 *
 * export { GET, POST }
 * ```
 */

import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { decode } from 'next-auth/jwt'
import { timingSafeEqual } from 'crypto'
import {
  getCookieDomain,
  getNextAuthSecret,
  getAuthUrl,
  getUserSyncSecret,
  getCookieNames,
  isProduction,
  validateRedirectUrl,
  debugLog,
  debugWarn,
} from './config'
import { revokeUserSession, isSessionRevoked } from './revocation'

// ============================================================
// TYPES
// ============================================================

export interface LogoutHandlerConfig {
  /**
   * App name for cookie naming (e.g., 'store', 'cms')
   */
  appName: string

  /**
   * Source identifier for logout broadcasts
   * Defaults to appName
   */
  source?: string

  /**
   * Callback when user logs out locally
   * Use this to clear app-specific caches
   */
  onLogout?: (userId: string) => void | Promise<void>

  /**
   * Callback when receiving cross-app logout broadcast
   */
  onBroadcast?: (userId: string) => void | Promise<void>

  /**
   * Protected route prefixes to prevent redirects to
   * Defaults to ['/admin', '/api']
   */
  protectedPrefixes?: string[]

  /**
   * Enable debug logging
   */
  debug?: boolean
}

export interface LogoutHandlers {
  GET: (request: NextRequest) => Promise<NextResponse>
  POST: (request: NextRequest) => Promise<NextResponse>
  isSessionRevoked: (userId: string) => boolean
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Build a Set-Cookie header string for clearing a cookie
 */
function buildClearCookieHeader(
  name: string,
  options: { domain?: string; secure: boolean; httpOnly: boolean }
): string {
  const parts = [
    `${name}=`,
    'Expires=Thu, 01 Jan 1970 00:00:00 GMT',
    'Path=/',
    'SameSite=Lax',
  ]

  if (options.domain) {
    parts.push(`Domain=${options.domain}`)
  }
  if (options.secure) {
    parts.push('Secure')
  }
  if (options.httpOnly) {
    parts.push('HttpOnly')
  }

  return parts.join('; ')
}

/**
 * Clear a cookie with both domain and non-domain variants
 * CRITICAL: NextResponse.cookies.set() only keeps ONE Set-Cookie header per name.
 * Use Headers API directly to append MULTIPLE Set-Cookie headers.
 */
function clearCookieWithHeaders(
  response: NextResponse,
  name: string,
  domain: string | undefined,
  canHaveDomain: boolean = true
): void {
  const isProd = isProduction()

  // Always clear without domain first (handles dev cookies and edge cases)
  response.headers.append('Set-Cookie', buildClearCookieHeader(name, {
    secure: isProd,
    httpOnly: true,
  }))

  // Also clear WITH domain if applicable (handles production cookies)
  if (canHaveDomain && domain) {
    response.headers.append('Set-Cookie', buildClearCookieHeader(name, {
      domain,
      secure: isProd,
      httpOnly: true,
    }))
  }
}

/**
 * Notify Auth Server to invalidate the session
 * This ensures cross-app logout (CMS, Store, etc.)
 */
async function notifyAuthServerLogout(
  userId: string,
  source: string,
  debug: boolean
): Promise<void> {
  try {
    const authUrl = getAuthUrl()
    const syncSecret = getUserSyncSecret()

    if (debug) {
      debugLog('Logout', `Notifying auth server at: ${authUrl}/api/auth/logout`)
    }

    const response = await fetch(`${authUrl}/api/auth/logout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-sync-secret': syncSecret,
      },
      body: JSON.stringify({
        userId,
        source,
        reason: 'user-logout',
      }),
      signal: AbortSignal.timeout(3000),
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'unknown')
      debugWarn('Logout', `Auth server notification failed: ${response.status}`, { errorText })
    } else if (debug) {
      const result = await response.json().catch(() => ({}))
      debugLog('Logout', `Auth server notified of logout for ${userId}`, result)
    }
  } catch (error) {
    // Don't block logout if auth server is unavailable
    debugWarn('Logout', 'Failed to notify auth server:', error)
  }
}

/**
 * Validate the sync secret from Auth Server
 * Uses timing-safe comparison to prevent timing attacks
 */
function validateSyncSecret(request: NextRequest): boolean {
  const receivedSecret = request.headers.get('x-sync-secret')
  if (!receivedSecret) {
    return false
  }

  try {
    const expectedSecret = getUserSyncSecret()
    if (receivedSecret.length !== expectedSecret.length) {
      return false
    }
    // SECURITY: Timing-safe comparison
    return timingSafeEqual(Buffer.from(receivedSecret), Buffer.from(expectedSecret))
  } catch {
    return false
  }
}

// ============================================================
// FACTORY FUNCTION
// ============================================================

/**
 * Create logout route handlers for an app
 *
 * @param config - Handler configuration
 * @returns GET and POST handlers for /api/auth/logout
 */
export function createLogoutHandlers(config: LogoutHandlerConfig): LogoutHandlers {
  const {
    appName,
    source = appName,
    onLogout,
    onBroadcast,
    protectedPrefixes = ['/admin', '/api'],
    debug = false,
  } = config

  const cookieNames = getCookieNames(appName)

  /**
   * GET /api/auth/logout
   * Browser-initiated logout - clears cookies and redirects
   */
  async function GET(request: NextRequest): Promise<NextResponse> {
    if (debug) {
      debugLog('Logout', 'GET === LOGOUT ROUTE HIT ===')
    }

    const searchParams = request.nextUrl.searchParams
    const redirectOption = searchParams.get('redirect') || 'current'
    const returnUrl = searchParams.get('returnUrl')

    // Get forwarded host for redirect URL (handles reverse proxy/Docker)
    const forwardedHost = request.headers.get('x-forwarded-host')
    const forwardedProto = request.headers.get('x-forwarded-proto') || 'https'
    const appBaseUrl = forwardedHost
      ? `${forwardedProto}://${forwardedHost}`
      : request.nextUrl.origin

    if (debug) {
      debugLog('Logout', 'Processing logout', { redirect: redirectOption, returnUrl: returnUrl || 'none', isProduction: isProduction(), appBaseUrl })
    }

    // Get the session token to extract user ID
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get(cookieNames.sessionToken)?.value

    // If we have a session, notify auth server and clear caches
    if (sessionToken) {
      try {
        const nextAuthSecret = getNextAuthSecret()
        const decoded = await decode({ token: sessionToken, secret: nextAuthSecret })

        if (decoded?.sub) {
          const userId = decoded.sub as string

          if (debug) {
            debugLog('Logout', `Logging out user: ${userId}`)
          }

          // Run onLogout callback
          if (onLogout) {
            await Promise.resolve(onLogout(userId))
          }

          // Notify auth server for cross-app logout
          await notifyAuthServerLogout(userId, source, debug)
        }
      } catch (error) {
        debugWarn('Logout', 'Failed to decode session token:', error)
      }
    }

    // Determine redirect URL
    let redirectUrl = appBaseUrl

    switch (redirectOption) {
      case 'signin':
        const authBaseUrl = getAuthUrl()
        redirectUrl = `${authBaseUrl}/signin`
        break
      case 'portal':
        redirectUrl = appBaseUrl
        break
      case 'current':
        if (returnUrl) {
          const validated = validateRedirectUrl(returnUrl, '/')
          redirectUrl = validated.startsWith('http') ? validated : `${appBaseUrl}${validated}`
        }
        break
      default:
        if (redirectOption.startsWith('/')) {
          // Validate against protected prefixes
          const isProtected = protectedPrefixes.some(prefix =>
            redirectOption.startsWith(prefix)
          )
          redirectUrl = isProtected ? appBaseUrl : `${appBaseUrl}${redirectOption}`
        } else if (redirectOption.startsWith('http')) {
          redirectUrl = validateRedirectUrl(redirectOption, appBaseUrl)
        }
    }

    if (debug) {
      debugLog('Logout', `Redirecting to: ${redirectUrl}`)
    }

    // Create the redirect response
    const response = NextResponse.redirect(redirectUrl)
    const cookieDomain = getCookieDomain()

    // Build list of cookies to clear
    // Must include BOTH dev (no prefix) and prod (__Secure-/__Host-) cookie names
    const isProd = isProduction()
    const cookiesToClear = [
      // Legacy next-auth cookies
      { name: 'next-auth.session-token', canHaveDomain: true },
      { name: '__Secure-next-auth.session-token', canHaveDomain: true },
      { name: 'next-auth.callback-url', canHaveDomain: true },
      { name: '__Secure-next-auth.callback-url', canHaveDomain: true },
      { name: 'next-auth.csrf-token', canHaveDomain: true },
      { name: '__Host-next-auth.csrf-token', canHaveDomain: false },
      { name: 'next-auth.pkce.code_verifier', canHaveDomain: true },
      { name: '__Secure-next-auth.pkce.code_verifier', canHaveDomain: true },
      { name: 'next-auth.state', canHaveDomain: true },
      { name: '__Secure-next-auth.state', canHaveDomain: true },
      // App-specific cookies (dev - no prefix)
      { name: `icefuse-${appName}.session-token`, canHaveDomain: true },
      { name: `icefuse-${appName}.callback-url`, canHaveDomain: true },
      { name: `icefuse-${appName}.csrf-token`, canHaveDomain: true },
      { name: `icefuse-${appName}.state`, canHaveDomain: true },
      { name: `icefuse-${appName}.pkce.code_verifier`, canHaveDomain: true },
      // App-specific cookies (prod - __Secure-/__Host- prefix)
      { name: `__Secure-icefuse-${appName}.session-token`, canHaveDomain: true },
      { name: `__Secure-icefuse-${appName}.callback-url`, canHaveDomain: true },
      { name: `__Host-icefuse-${appName}.csrf-token`, canHaveDomain: false },
      { name: `__Secure-icefuse-${appName}.state`, canHaveDomain: true },
      { name: `__Secure-icefuse-${appName}.pkce.code_verifier`, canHaveDomain: true },
    ]

    // Clear all cookies
    for (const { name, canHaveDomain } of cookiesToClear) {
      clearCookieWithHeaders(response, name, cookieDomain, canHaveDomain)
    }

    if (debug) {
      debugLog('Logout', `Cleared ${cookiesToClear.length} cookies`, { domain: cookieDomain || 'none (localhost)' })
    }

    return response
  }

  /**
   * POST /api/auth/logout
   * Receives cross-app logout broadcasts from Auth Server
   */
  async function POST(request: NextRequest): Promise<NextResponse> {
    try {
      // SECURITY: Validate sync secret from Auth Server
      if (!validateSyncSecret(request)) {
        debugWarn('Logout', 'Invalid or missing sync secret')
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      const body = await request.json()
      const { userId, source: logoutSource, reason, timestamp } = body

      // Validate required fields
      if (!userId || typeof userId !== 'string') {
        return NextResponse.json({ error: 'Missing or invalid userId' }, { status: 400 })
      }

      debugLog('Logout', 'Received cross-app logout broadcast', { userId, source: logoutSource || 'unknown', reason: reason || 'cross-app-logout' })

      // Add user to revocation cache for immediate session invalidation
      revokeUserSession(userId)

      // Run onBroadcast callback
      if (onBroadcast) {
        await Promise.resolve(onBroadcast(userId))
      }

      debugLog('Logout', `Session revoked and cached for user: ${userId}`)

      return NextResponse.json({
        success: true,
        message: 'Logout broadcast acknowledged and session revoked',
        userId,
        revoked: true,
      })
    } catch (error) {
      console.error('[Icefuse Auth:Logout:POST] Error processing broadcast:', error)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
  }

  return {
    GET,
    POST,
    isSessionRevoked,
  }
}

// Re-export for convenience
export { isSessionRevoked } from './revocation'
