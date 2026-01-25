/**
 * NextAuth Configuration - Icefuse Kit Manager
 *
 * Uses external authentication server (ifn_app_auth_v2).
 * Sessions are created via the /api/auth/callback endpoint.
 *
 * ADMIN-ONLY ACCESS:
 * This application requires admin permissions (developer rank or higher).
 * Unauthorized users are redirected to the auth server error page.
 */

import type { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { getAuthUserById, getAuthUserBySteamId, isSessionValid, clearSessionValidCache } from '@/lib/auth-user'
import { getUserSyncSecret, getNextAuthSecret, getCookieDomain, getAuthUrl } from '@/services/auth-config-service'
import { safeCompare } from '@/lib/security'
import { logger } from '@/lib/logger'

const isProduction = process.env.NODE_ENV === 'production'

let AUTH_URL: string

function getAuthServerUrl(): string {
  if (!AUTH_URL) {
    AUTH_URL = getAuthUrl()
  }
  return AUTH_URL
}

/**
 * Create NextAuth options
 */
export function authOptions(): NextAuthOptions {
  const authUrl = getAuthServerUrl()

  return {
    providers: [
      CredentialsProvider({
        id: 'external-auth',
        name: 'External Auth',
        credentials: {
          userId: { label: 'User ID', type: 'text' },
          steamId: { label: 'Steam ID', type: 'text' },
          token: { label: 'Token', type: 'text' },
        },
        async authorize(credentials) {
          if (!credentials?.token) {
            logger.auth.warn('Missing token in credentials')
            return null
          }

          // SECURITY: Validate sync token
          const syncSecret = getUserSyncSecret()
          if (!safeCompare(credentials.token, syncSecret)) {
            logger.auth.warn('Invalid sync token')
            return null
          }

          // Get user from auth server
          let authUser = credentials.userId
            ? await getAuthUserById(credentials.userId)
            : null

          if (!authUser && credentials.steamId) {
            authUser = await getAuthUserBySteamId(credentials.steamId)
          }

          if (!authUser) {
            logger.auth.warn('User not found', {
              userId: credentials.userId || 'none',
              steamId: credentials.steamId || 'none',
            })
            return null
          }

          logger.auth.info('User authorized via credentials', { userId: authUser.id })

          return {
            id: authUser.id,
            name: authUser.steamName || authUser.name,
            email: authUser.email,
            image: authUser.steamAvatar || authUser.image,
            steamId: authUser.steamId,
            steamUsername: authUser.steamName,
            rank: authUser.rank ?? undefined,
          }
        },
      }),
    ],

    secret: getNextAuthSecret(),

    session: {
      strategy: 'jwt',
      maxAge: 30 * 24 * 60 * 60, // 30 days
    },

    cookies: {
      sessionToken: {
        name: `${isProduction ? '__Secure-' : ''}next-auth.session-token`,
        options: {
          httpOnly: true,
          sameSite: 'lax',
          path: '/',
          secure: isProduction,
          domain: getCookieDomain(),
        },
      },
      callbackUrl: {
        name: `${isProduction ? '__Secure-' : ''}next-auth.callback-url`,
        options: {
          httpOnly: true,
          sameSite: 'lax',
          path: '/',
          secure: isProduction,
          domain: getCookieDomain(),
        },
      },
      csrfToken: {
        name: `${isProduction ? '__Host-' : ''}next-auth.csrf-token`,
        options: {
          httpOnly: true,
          sameSite: 'lax',
          path: '/',
          secure: isProduction,
        },
      },
    },

    useSecureCookies: isProduction,

    callbacks: {
      async jwt({ token, user, trigger }) {
        const now = Math.floor(Date.now() / 1000)
        const userId = token.sub || user?.id || 'unknown'

        // On initial sign in
        if (user) {
          logger.jwt.info('Initial sign in', { userId: user.id })
          token.sub = user.id
          token.steamId = (user as { steamId?: string }).steamId
          token.steamUsername = (user as { steamUsername?: string }).steamUsername
          token.rank = (user as { rank?: string }).rank

          // Fetch full profile from auth server
          try {
            const authUser = await getAuthUserById(user.id)
            if (authUser) {
              const displayName = authUser.steamName || authUser.name || undefined
              token.name = displayName
              token.email = authUser.email
              token.picture = authUser.steamAvatar || authUser.image
              token.steamId = authUser.steamId
              token.steamUsername = displayName
              token.rank = authUser.rank ?? undefined
              logger.jwt.info('Profile fetched', { userId: user.id, rank: authUser.rank })
            }
          } catch (error) {
            logger.jwt.error('Initial setup error', error as Error)
          }

          token.refreshedAt = now
          return token
        }

        // SECURITY: Check if session was revoked
        if (token.sub) {
          try {
            const sessionValid = await isSessionValid(token.sub as string)
            if (!sessionValid) {
              logger.session.info('Session revoked - forcing re-auth', { userId })
              clearSessionValidCache(token.sub as string)
              return {}
            }
          } catch (error) {
            logger.session.warn('Session validation error (fail-open)', { userId, error: String(error) })
          }
        }

        // On explicit refresh
        if (trigger === 'update') {
          logger.jwt.info('Explicit refresh triggered', { userId })
          token.refreshedAt = now
          if (token.sub) {
            try {
              const authUser = await getAuthUserById(token.sub as string)
              if (authUser) {
                const displayName = authUser.steamName || authUser.name || null
                token.name = displayName || token.name
                token.email = authUser.email || token.email
                token.picture = authUser.steamAvatar || authUser.image || token.picture
                token.steamId = authUser.steamId || token.steamId
                token.steamUsername = displayName || token.steamUsername
                token.rank = authUser.rank ?? token.rank ?? undefined
              }
            } catch (error) {
              logger.jwt.error('Refresh error', { userId, error: String(error) })
            }
          }
          return token
        }

        // Refresh stale profile data (> 60 min old)
        const refreshedAt = (token.refreshedAt as number) || 0
        const REFRESH_INTERVAL_MINUTES = 60
        const isStale = now - refreshedAt > REFRESH_INTERVAL_MINUTES * 60

        if (isStale && token.sub) {
          token.refreshedAt = now
          try {
            const authUser = await getAuthUserById(token.sub as string)
            if (authUser) {
              const displayName = authUser.steamName || authUser.name || null
              token.name = displayName || token.name
              token.email = authUser.email || token.email
              token.picture = authUser.steamAvatar || authUser.image || token.picture
              token.steamId = authUser.steamId || token.steamId
              token.steamUsername = displayName || token.steamUsername
              token.rank = authUser.rank ?? token.rank ?? undefined
            }
          } catch (error) {
            logger.jwt.warn('Profile refresh error', { userId, error: String(error) })
          }
        }

        return token
      },

      async session({ session, token }) {
        // SECURITY: If token has no user ID, session was invalidated
        if (!token.sub) {
          logger.session.info('Token has no user ID - session invalidated')
          session.user = undefined as unknown as typeof session.user
          return session
        }

        if (session.user) {
          session.user.id = token.sub as string
          session.user.name = token.name as string | null
          session.user.email = token.email as string | null
          session.user.image = token.picture as string | null
          session.user.steamId = token.steamId as string | undefined
          session.user.steamUsername = token.steamUsername as string | undefined
          session.user.rank = token.rank as string | undefined

          logger.session.debug('Session created', {
            userId: session.user.id,
            rank: session.user.rank,
          })
        }
        return session
      },
    },

    pages: {
      signIn: `${authUrl}/signin`,
      error: `${authUrl}/signin`,
    },
  }
}

export { getAuthServerUrl as getAuthUrl }
