/**
 * Icefuse Auth - Kits Configuration
 *
 * OIDC-based authentication using the central Icefuse Auth server.
 * Copied from PayNow store for consistency.
 */

import NextAuth, { getServerSession } from 'next-auth'
import type { NextAuthOptions } from 'next-auth'
import type { JWT } from 'next-auth/jwt'
import { getAuthUrl, getNextAuthSecret, getCookieDomain } from './config'
import {
  isSessionRevoked,
  clearRevocation,
  getRevocationInfo,
} from '@icefuse/auth'
import type { IcefuseUser, IcefuseJWT, IcefuseSession } from '@icefuse/auth'

export type { IcefuseUser, IcefuseJWT, IcefuseSession }

const isProduction = process.env.NODE_ENV === 'production'

const OIDC_SCOPES = [
  'openid',
  'profile',
  'email',
  'icefuse:platforms',
  'icefuse:admin',
  'offline_access',
].join(' ')

export function authOptions(): NextAuthOptions {
  const issuer = getAuthUrl()
  const clientId = process.env.ICEFUSE_CLIENT_ID || 'kits'
  const clientSecret = process.env.ICEFUSE_CLIENT_SECRET || ''

  return {
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
            scope: OIDC_SCOPES,
          },
        },
        idToken: true,
        checks: ['pkce'],
        httpOptions: {
          timeout: 30000,
        },
        profile(profile) {
          return {
            id: profile.sub,
            name: profile.name || undefined,
            email: profile.email || undefined,
            image: profile.picture || undefined,
            emailVerified: profile.email_verified || false,
            steamId: profile.steam_id || undefined,
            discordId: profile.discord_id || undefined,
            isAdmin: profile.is_admin || false,
            isRoot: profile.is_root || false,
          }
        },
      },
    ],

    secret: getNextAuthSecret(),

    session: {
      strategy: 'jwt',
      maxAge: 30 * 24 * 60 * 60,
    },

    cookies: {
      sessionToken: {
        name: `${isProduction ? '__Secure-' : ''}icefuse-kits.session-token`,
        options: {
          httpOnly: true,
          sameSite: 'lax',
          path: '/',
          secure: isProduction,
          domain: getCookieDomain(),
        },
      },
      callbackUrl: {
        name: `${isProduction ? '__Secure-' : ''}icefuse-kits.callback-url`,
        options: {
          httpOnly: true,
          sameSite: 'lax',
          path: '/',
          secure: isProduction,
          domain: getCookieDomain(),
        },
      },
      csrfToken: {
        name: `${isProduction ? '__Host-' : ''}icefuse-kits.csrf-token`,
        options: {
          httpOnly: true,
          sameSite: 'lax',
          path: '/',
          secure: isProduction,
        },
      },
      state: {
        name: `${isProduction ? '__Secure-' : ''}icefuse-kits.state`,
        options: {
          httpOnly: true,
          sameSite: 'lax',
          path: '/',
          secure: isProduction,
          maxAge: 900,
        },
      },
      pkceCodeVerifier: {
        name: `${isProduction ? '__Secure-' : ''}icefuse-kits.pkce.code_verifier`,
        options: {
          httpOnly: true,
          sameSite: 'lax',
          path: '/',
          secure: isProduction,
          maxAge: 900,
        },
      },
    },

    useSecureCookies: isProduction,

    callbacks: {
      async jwt({ token, user, account }) {
        if (account && user) {
          const sessionCreatedAt = Date.now()
          clearRevocation(user.id)

          return {
            ...token,
            accessToken: account.access_token!,
            refreshToken: account.refresh_token,
            accessTokenExpires: account.expires_at! * 1000,
            sessionCreatedAt,
            user: user as IcefuseUser,
          }
        }

        const icefuseToken = token as unknown as IcefuseJWT

        if (icefuseToken.user?.id && isSessionRevoked(icefuseToken.user.id, icefuseToken.sessionCreatedAt)) {
          return {
            ...token,
            error: 'SessionRevoked',
          }
        }

        if (Date.now() < icefuseToken.accessTokenExpires) {
          return token
        }

        return refreshAccessToken(icefuseToken, issuer, clientId, clientSecret)
      },

      async session({ session, token }) {
        const jwtToken = token as unknown as IcefuseJWT

        if (!jwtToken.user) {
          return session
        }

        return {
          ...session,
          user: jwtToken.user,
          accessToken: jwtToken.accessToken,
          accessTokenExpires: jwtToken.accessTokenExpires,
          error: jwtToken.error,
        }
      },

      async redirect({ url, baseUrl }) {
        if (url.startsWith('/')) {
          return `${baseUrl}${url}`
        }

        try {
          if (new URL(url).origin === baseUrl) {
            return url
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
  }
}

async function refreshAccessToken(
  token: IcefuseJWT,
  issuer: string,
  clientId: string,
  clientSecret: string
): Promise<JWT> {
  if (!token.refreshToken) {
    return {
      ...token,
      error: 'RefreshAccessTokenError',
    }
  }

  try {
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
      error: undefined,
    }
  } catch (error) {
    console.error('[Auth] Token refresh failed:', error)
    return {
      ...token,
      error: 'RefreshAccessTokenError',
    }
  }
}

const handler = NextAuth(authOptions())

export const handlers = {
  GET: handler,
  POST: handler,
}

export const auth = async (): Promise<IcefuseSession | null> => {
  const session = await getServerSession(authOptions())
  return session as IcefuseSession | null
}
