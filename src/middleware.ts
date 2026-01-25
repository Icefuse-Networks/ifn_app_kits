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

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow public paths
  if (PUBLIC_PATHS.some(path => pathname.startsWith(path))) {
    return NextResponse.next()
  }

  // Get the session token
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  })

  // If no token, redirect to auth server
  if (!token) {
    const authUrl = process.env.NODE_ENV === 'production'
      ? 'https://auth.icefuse.com'
      : 'http://localhost:3012'

    const callbackUrl = encodeURIComponent(request.url)
    return NextResponse.redirect(`${authUrl}/signin?callbackUrl=${callbackUrl}`)
  }

  // SECURITY: Check for admin rank
  const userRank = token.rank as string | undefined

  if (!userRank || !ADMIN_RANKS.includes(userRank.toLowerCase())) {
    // Not an admin - redirect to unauthorized page
    const authUrl = process.env.NODE_ENV === 'production'
      ? 'https://auth.icefuse.com'
      : 'http://localhost:3012'

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
