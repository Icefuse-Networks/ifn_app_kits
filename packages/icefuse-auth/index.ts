/**
 * @icefuse/auth - Icefuse Networks Authentication Package
 *
 * Plug-and-play OIDC authentication for Icefuse applications.
 * Reduces auth setup from ~1,750 lines to ~10 lines per app.
 *
 * Usage:
 *
 * 1. Create src/lib/icefuse-auth.ts:
 *    ```ts
 *    import { createIcefuseAuth } from '@icefuse/auth'
 *
 *    export const { handlers, auth, signIn, signOut } = createIcefuseAuth({
 *      appName: 'store',
 *      clientId: process.env.ICEFUSE_CLIENT_ID!,
 *      clientSecret: process.env.ICEFUSE_CLIENT_SECRET!,
 *    })
 *    ```
 *
 * 2. Create src/app/api/auth/[...nextauth]/route.ts:
 *    ```ts
 *    import { handlers } from '@/lib/icefuse-auth'
 *    export const { GET, POST } = handlers
 *    ```
 *
 * 3. Create src/app/api/auth/logout/route.ts:
 *    ```ts
 *    import { createLogoutHandlers } from '@icefuse/auth/logout'
 *    const { GET, POST } = createLogoutHandlers({ appName: 'store' })
 *    export { GET, POST }
 *    ```
 *
 * 4. Use anywhere:
 *    ```ts
 *    import { auth } from '@/lib/icefuse-auth'
 *    const session = await auth()
 *    ```
 */

import NextAuth, { getServerSession } from 'next-auth'
import type { NextAuthOptions } from 'next-auth'
import type { JWT } from 'next-auth/jwt'
import type {
  IcefuseAuthConfig,
  IcefuseAuthResult,
  IcefuseSession,
  IcefuseUser,
  IcefuseJWT,
} from './types'
import { buildCookieConfig, debugLog } from './config'
import { isSessionRevoked, clearRevocation } from './revocation'

// ============================================================
// CONSTANTS
// ============================================================

const DEFAULT_ISSUER = 'https://auth.icefuse.com'
const DEFAULT_SCOPES = [
  'openid',
  'profile',
  'email',
  'icefuse:platforms',
  'icefuse:admin',
  'icefuse:paynow',
  'offline_access',
]

// ============================================================
// MAIN EXPORT
// ============================================================

/**
 * Create Icefuse authentication configuration
 *
 * @param config - Configuration options
 * @returns handlers and auth function for NextAuth
 *
 * @example
 * ```ts
 * // src/lib/icefuse-auth.ts
 * import { createIcefuseAuth } from '@icefuse/auth'
 *
 * export const { handlers, auth, signIn, signOut } = createIcefuseAuth({
 *   appName: 'store',
 *   clientId: process.env.ICEFUSE_CLIENT_ID!,
 *   clientSecret: process.env.ICEFUSE_CLIENT_SECRET!,
 * })
 * ```
 */
export function createIcefuseAuth(config: IcefuseAuthConfig): IcefuseAuthResult {
  const {
    appName,
    clientId,
    clientSecret,
    // enableSilentAuth is reserved for future cross-domain SSO implementation
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    enableSilentAuth: _enableSilentAuth = false,
    issuer = DEFAULT_ISSUER,
    scopes = DEFAULT_SCOPES,
    debug = false,
    onLogin,
    onLogout,
    onError,
  } = config

  debugLog('Init', `Creating auth config for app: ${appName}`, {
    clientId,
    issuer,
    scopes: scopes.join(', '),
    debug,
  })

  // Build cookie configuration for this app
  const cookieConfig = buildCookieConfig(appName)

  // Build NextAuth options
  const authOptions: NextAuthOptions = {
    debug,
    providers: [
      {
        id: 'icefuse',
        name: 'Icefuse',
        type: 'oauth',
        wellKnown: `${issuer}/.well-known/openid-configuration`,
        clientId,
        clientSecret,
        authorization: {
          params: {
            scope: scopes.join(' '),
          },
        },
        idToken: true,
        checks: ['pkce', 'state'],
        httpOptions: {
          timeout: 30000,
        },
        profile(profile) {
          debugLog('Profile', `OIDC profile received for: ${profile.sub}`, {
            name: profile.name,
            email: profile.email,
            steamId: profile.steam_id,
            isAdmin: profile.is_admin,
            isRoot: profile.is_root,
          })

          return {
            id: profile.sub,
            name: profile.name,
            email: profile.email,
            image: profile.picture,
            emailVerified: profile.email_verified,
            steamId: profile.steam_id,
            discordId: profile.discord_id,
            minecraftUuid: profile.minecraft_uuid,
            xboxXuid: profile.xbox_xuid,
            hytaleId: profile.hytale_id,
            isAdmin: profile.is_admin || false,
            isRoot: profile.is_root || false,
            paynowCustomerId: profile.paynow_customer_id,
          }
        },
      },
    ],
    callbacks: {
      async jwt({ token, user, account }): Promise<JWT> {
        // Initial sign in
        if (account && user) {
          const icefuseUser = user as IcefuseUser

          debugLog('JWT', `Initial sign-in for user: ${icefuseUser.id}`, {
            name: icefuseUser.name,
            isAdmin: icefuseUser.isAdmin,
            isRoot: icefuseUser.isRoot,
            hasAccessToken: !!account.access_token,
            hasRefreshToken: !!account.refresh_token,
            expiresAt: account.expires_at,
          })

          // Clear any existing revocation for this user (they just logged in)
          clearRevocation(icefuseUser.id)

          // Call onLogin callback
          if (onLogin) {
            try {
              await Promise.resolve(onLogin(icefuseUser))
            } catch (error) {
              console.error('[Icefuse Auth] onLogin callback error:', error)
            }
          }

          return {
            ...token,
            accessToken: account.access_token!,
            refreshToken: account.refresh_token,
            accessTokenExpires: account.expires_at! * 1000,
            sessionCreatedAt: Date.now(),
            user: icefuseUser,
          } as JWT
        }

        // Check if session has been revoked (cross-app logout)
        const icefuseToken = token as unknown as IcefuseJWT
        if (icefuseToken.user?.id && isSessionRevoked(icefuseToken.user.id, icefuseToken.sessionCreatedAt)) {
          debugLog('JWT', `Session revoked for user: ${icefuseToken.user.id}`)

          // Call onLogout callback
          if (onLogout) {
            try {
              await Promise.resolve(onLogout())
            } catch (error) {
              console.error('[Icefuse Auth] onLogout callback error:', error)
            }
          }

          return {
            ...token,
            error: 'SessionRevoked',
          } as JWT
        }

        // Return previous token if the access token has not expired yet
        if (Date.now() < icefuseToken.accessTokenExpires) {
          return token
        }

        // Access token has expired, try to refresh it
        debugLog('JWT', `Token expired for user: ${icefuseToken.user?.id}, attempting refresh`)
        const refreshedToken = await refreshAccessToken(
          icefuseToken,
          issuer,
          clientId,
          clientSecret,
          onError
        )

        if (refreshedToken.error) {
          debugLog('JWT', `Token refresh failed: ${refreshedToken.error}`)
        } else {
          debugLog('JWT', `Token refreshed for user: ${refreshedToken.user?.id}`)
        }

        return refreshedToken as JWT
      },

      async session({ session, token }) {
        const jwtToken = token as unknown as IcefuseJWT

        debugLog('Session', `Building session for user: ${jwtToken.user?.id}`, {
          hasUser: !!jwtToken.user,
          error: jwtToken.error || 'none',
        })

        return {
          ...session,
          user: jwtToken.user,
          accessToken: jwtToken.accessToken,
          accessTokenExpires: jwtToken.accessTokenExpires,
          error: jwtToken.error,
        }
      },

      async redirect({ url, baseUrl }) {
        debugLog('Redirect', `url=${url}, baseUrl=${baseUrl}`)

        // Allow relative URLs
        if (url.startsWith('/')) {
          return `${baseUrl}${url}`
        }

        // Allow same origin
        if (new URL(url).origin === baseUrl) {
          return url
        }

        // Allow icefuse domains
        try {
          const parsed = new URL(url)
          const hostname = parsed.hostname.toLowerCase()
          const allowedDomains = ['icefuse.com', 'icefuse.net', 'ifn.gg']

          for (const domain of allowedDomains) {
            if (hostname === domain || hostname.endsWith(`.${domain}`)) {
              return url
            }
          }
        } catch {
          // Invalid URL
        }

        return baseUrl
      },
    },
    pages: {
      signIn: '/auth/signin',
      error: '/auth/error',
    },
    session: {
      strategy: 'jwt',
      maxAge: 30 * 24 * 60 * 60, // 30 days
    },
    cookies: cookieConfig,
  }

  // Create NextAuth handler
  const handler = NextAuth(authOptions)

  // Auth function for server-side session retrieval
  const auth = async (): Promise<IcefuseSession | null> => {
    const session = await getServerSession(authOptions)
    return session as IcefuseSession | null
  }

  // Sign in function
  const signIn = async (options?: { callbackUrl?: string }) => {
    const callbackUrl = options?.callbackUrl || '/'
    const url = `/api/auth/signin/icefuse?callbackUrl=${encodeURIComponent(callbackUrl)}`
    if (typeof window !== 'undefined') {
      window.location.href = url
    }
  }

  // Sign out function
  const signOut = async (options?: { callbackUrl?: string }) => {
    const callbackUrl = options?.callbackUrl || '/'
    const url = `/api/auth/logout?returnUrl=${encodeURIComponent(callbackUrl)}`
    if (typeof window !== 'undefined') {
      window.location.href = url
    }
  }

  return {
    handlers: {
      GET: handler,
      POST: handler,
    },
    auth,
    signIn,
    signOut,
    authOptions,
  }
}

// ============================================================
// TOKEN REFRESH
// ============================================================

/**
 * Refresh an expired access token using the refresh token
 */
async function refreshAccessToken(
  token: IcefuseJWT,
  issuer: string,
  clientId: string,
  clientSecret: string,
  onError?: (error: string) => void
): Promise<IcefuseJWT> {
  try {
    if (!token.refreshToken) {
      throw new Error('No refresh token available')
    }

    const response = await fetch(`${issuer}/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: token.refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    })

    const tokens = await response.json()

    if (!response.ok) {
      throw new Error(tokens.error_description || tokens.error || 'Token refresh failed')
    }

    return {
      ...token,
      accessToken: tokens.access_token,
      accessTokenExpires: Date.now() + tokens.expires_in * 1000,
      refreshToken: tokens.refresh_token ?? token.refreshToken,
    }
  } catch (error) {
    console.error('[Icefuse Auth] Error refreshing access token:', error)

    if (onError) {
      onError('RefreshAccessTokenError')
    }

    return {
      ...token,
      error: 'RefreshAccessTokenError',
    }
  }
}

// ============================================================
// RE-EXPORTS
// ============================================================

// Components
export { IcefuseAuthProvider } from './components'

// Guards
export {
  isAdmin,
  isRoot,
  isAuthenticated,
  requireAuth,
  requireAdmin,
  requireRoot,
  getUser,
  getUserId,
} from './guards'

// Config
export {
  getAuthUrl,
  getNextAuthSecret,
  getUserSyncSecret,
  getClientId,
  getClientSecret,
  getCookieDomain,
  getCookieNames,
  getCookieSettings,
  buildCookieConfig,
  isProduction,
  isAllowedHost,
  validateRedirectUrl,
  isDebugEnabled,
  debugLog,
  debugWarn,
} from './config'

// Revocation
export {
  isSessionRevoked,
  revokeUserSession,
  clearRevocation,
  getRevocationInfo,
  getRevocationCount,
} from './revocation'

// Types
export type {
  IcefuseAuthConfig,
  IcefuseAuthResult,
  IcefuseSession,
  IcefuseSessionError,
  IcefuseUser,
  IcefuseJWT,
  UserProfileCardProps,
  LoginButtonProps,
  LogoutButtonProps,
  IcefuseAuthProviderProps,
  CookieConfig,
  CookieSettings,
} from './types'
