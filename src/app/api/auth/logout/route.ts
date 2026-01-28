/**
 * Logout Route - Sign Out Handler
 *
 * Clears the NextAuth session and redirects to appropriate page.
 * Supports configurable redirect destinations.
 */

import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

// Production domain patterns for hostname detection
const PRODUCTION_DOMAINS = ['icefuse.com', 'icefuse.net', 'ifn.gg']

function isProductionHostname(hostname: string): boolean {
  const normalizedHost = hostname.toLowerCase()
  return PRODUCTION_DOMAINS.some(
    domain => normalizedHost === domain || normalizedHost.endsWith(`.${domain}`)
  )
}

function getRealHostname(request: NextRequest): string {
  const forwardedHost = request.headers.get('x-forwarded-host')
  if (forwardedHost) {
    return forwardedHost.split(',')[0].trim().toLowerCase()
  }
  const hostHeader = request.headers.get('host')
  if (hostHeader) {
    return hostHeader.split(':')[0].toLowerCase()
  }
  return request.nextUrl.hostname.toLowerCase()
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const redirectParam = searchParams.get('redirect') || '/'
  const returnUrl = searchParams.get('returnUrl')
  const hostname = getRealHostname(request)
  const isProduction = isProductionHostname(hostname)

  // Build cookie options based on environment
  const cookieDomain = isProduction ? '.icefuse.net' : undefined

  // Clear NextAuth session cookies
  const cookieStore = await cookies()

  // Session token cookie names (NextAuth uses different names in dev vs prod)
  const cookieNames = [
    'next-auth.session-token',
    '__Secure-next-auth.session-token',
    'next-auth.csrf-token',
    '__Secure-next-auth.csrf-token',
    'next-auth.callback-url',
    '__Secure-next-auth.callback-url',
  ]

  for (const name of cookieNames) {
    cookieStore.delete({
      name,
      path: '/',
      domain: cookieDomain,
    })
    // Also delete without domain for local dev
    if (cookieDomain) {
      cookieStore.delete({
        name,
        path: '/',
      })
    }
  }

  // Determine redirect URL
  let redirectUrl: string

  switch (redirectParam) {
    case 'signin':
      // Use appropriate auth server based on environment
      redirectUrl = isProduction
        ? 'https://auth.icefuse.com/signin'
        : 'http://localhost:3012/signin'
      break
    case 'portal':
      redirectUrl = '/'
      break
    case 'current':
      // Check if returnUrl is a protected route, if so go to portal
      if (returnUrl) {
        const url = new URL(returnUrl)
        // If returning to dashboard or other protected routes, go to landing
        if (url.pathname !== '/') {
          redirectUrl = '/'
        } else {
          redirectUrl = returnUrl
        }
      } else {
        redirectUrl = '/'
      }
      break
    default:
      // Custom redirect path
      redirectUrl = redirectParam.startsWith('http') ? redirectParam : redirectParam
  }

  // Build absolute URL for redirect
  const proto = request.headers.get('x-forwarded-proto') || (isProduction ? 'https' : 'http')
  const absoluteRedirect = redirectUrl.startsWith('http')
    ? redirectUrl
    : `${proto}://${hostname}${redirectUrl}`

  return NextResponse.redirect(absoluteRedirect)
}
