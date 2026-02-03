/**
 * Middleware - Route Protection
 *
 * PUBLIC ROUTES:
 * - Landing page (/) and static assets are publicly accessible
 * - Auth routes (/api/auth/*) for NextAuth callbacks
 *
 * PROTECTED ROUTES:
 * - All other routes require authentication
 * - Admin permission checks are done via /api/admin/verify-access
 *   (NOT in middleware - matches PayNow pattern)
 */

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

// Routes that don't require authentication (prefix matching)
// Note: API routes handle their own auth via authenticateWithScope (Bearer tokens)
// or requireSession, so they bypass session-only middleware checks
const PUBLIC_PATH_PREFIXES = [
  '/api/auth',
  '/api/public',
  '/api/kits',
  '/api/analytics',
  '/api/telemetry',
  '/api/servers',
  '/api/identifiers',
  '/api/redirect',
  '/api/items',
  '/api/skins',
  '/api/lootmanager/download',
  '/_next',
  '/logos',
]

// Exact paths that don't require authentication
const PUBLIC_EXACT_PATHS = [
  '/',
  '/favicon.ico',
  '/logo.png',
  '/leaderboards',
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
 * Get auth URL based on environment
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

  // Allow public paths (exact matches or prefix matches)
  if (
    PUBLIC_EXACT_PATHS.includes(pathname) ||
    PUBLIC_PATH_PREFIXES.some(prefix => pathname.startsWith(prefix))
  ) {
    return NextResponse.next()
  }

  const isProduction = isProductionHostname(hostname)

  // Get the session token using hostname-based secret
  // secureCookie must match auth.ts cookie config — behind a reverse proxy
  // the internal request is HTTP, but cookies are set with __Secure- prefix
  const token = await getToken({
    req: request,
    secret: getNextAuthSecret(hostname),
    secureCookie: isProduction,
  })

  // If no token, redirect to auth server to sign in
  if (!token) {
    // RSC/prefetch requests use fetch() which can't follow cross-origin
    // redirects (CORS). Return 204 so Next.js falls back to browser navigation.
    if (request.headers.get('rsc') === '1' || request.headers.get('next-router-prefetch') === '1') {
      return new NextResponse(null, { status: 204 })
    }

    const authUrl = getAuthUrl(hostname)
    // Build callback URL using forwarded headers for correct URL
    const proto = request.headers.get('x-forwarded-proto') || 'https'
    const callbackUrl = encodeURIComponent(`${proto}://${hostname}${pathname}`)
    return NextResponse.redirect(`${authUrl}/signin?callbackUrl=${callbackUrl}`)
  }

  // User is authenticated - allow access
  // Admin permission checks are done via /api/admin/verify-access endpoint
  // This matches the PayNow pattern where admin checks happen at route/layout level
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
