/**
 * Middleware - Route Protection
 *
 * ADMIN-ONLY ACCESS:
 * All routes except /api/auth/* require authentication and admin permissions.
 * Unauthenticated users are redirected to the auth server.
 */

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

// Admin ranks that can access this application
const ADMIN_RANKS = ['developer', 'admin', 'owner', 'superadmin']

// Routes that don't require authentication
const PUBLIC_PATHS = [
  '/api/auth',
  '/_next',
  '/favicon.ico',
  '/logo.png',
]

// Production domain patterns for hostname detection
const PRODUCTION_DOMAINS = ['icefuse.com', 'icefuse.net', 'ifn.gg']

// NextAuth secrets (must match auth server)
const DEV_NEXTAUTH_SECRET = '2091cb9f77c7305308a6fc3d22f6c45ddbe70800dff5968241c2b26741a6d072'
const PROD_NEXTAUTH_SECRET = 'cae76e544c394d0dd7b0f9a5f809d7944e25091f371581139aa42ec75353eb10'

/**
 * Check if hostname is a production domain
 */
function isProductionHostname(hostname: string): boolean {
  const normalizedHost = hostname.toLowerCase()
  return PRODUCTION_DOMAINS.some(
    domain => normalizedHost === domain || normalizedHost.endsWith(`.${domain}`)
  )
}

/**
 * Get auth URL based on request hostname
 */
function getAuthUrl(hostname: string): string {
  return isProductionHostname(hostname)
    ? 'https://auth.icefuse.com'
    : 'http://localhost:3012'
}

/**
 * Get NextAuth secret based on request hostname
 */
function getNextAuthSecret(hostname: string): string {
  return isProductionHostname(hostname)
    ? PROD_NEXTAUTH_SECRET
    : DEV_NEXTAUTH_SECRET
}

/**
 * Get the real hostname from request (handles reverse proxy)
 */
function getRealHostname(request: NextRequest): string {
  // Check X-Forwarded-Host first (set by reverse proxy like Traefik)
  const forwardedHost = request.headers.get('x-forwarded-host')
  if (forwardedHost) {
    // May contain multiple hosts, take the first one
    return forwardedHost.split(',')[0].trim().toLowerCase()
  }

  // Check Host header
  const hostHeader = request.headers.get('host')
  if (hostHeader) {
    // Remove port if present
    return hostHeader.split(':')[0].toLowerCase()
  }

  // Fallback to URL hostname
  return request.nextUrl.hostname.toLowerCase()
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const hostname = getRealHostname(request)

  // Allow public paths
  if (PUBLIC_PATHS.some(path => pathname.startsWith(path))) {
    return NextResponse.next()
  }

  // Get the session token using hostname-based secret
  const token = await getToken({
    req: request,
    secret: getNextAuthSecret(hostname),
  })

  // If no token, redirect to auth server
  if (!token) {
    const authUrl = getAuthUrl(hostname)
    // Build callback URL using forwarded headers for correct URL
    const proto = request.headers.get('x-forwarded-proto') || 'https'
    const callbackUrl = encodeURIComponent(`${proto}://${hostname}${pathname}`)
    return NextResponse.redirect(`${authUrl}/signin?callbackUrl=${callbackUrl}`)
  }

  // SECURITY: Check for admin rank
  const userRank = token.rank as string | undefined

  if (!userRank || !ADMIN_RANKS.includes(userRank.toLowerCase())) {
    // Not an admin - redirect to unauthorized page
    const authUrl = getAuthUrl(hostname)
    return NextResponse.redirect(`${authUrl}/error?error=AccessDenied`)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
