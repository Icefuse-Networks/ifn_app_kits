/**
 * Admin Access Verification Endpoint
 *
 * Verifies that the current session belongs to a root user.
 * Copied 1:1 from PayNow store for consistency.
 */

import { NextResponse } from 'next/server'
import { auth } from '@/lib/icefuse-auth'
import { requireAdmin } from '@icefuse/auth'

export async function GET() {
  // SECURITY: Auth check at route start
  const session = await auth()

  try {
    requireAdmin(session)
    return NextResponse.json({ authorized: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: message },
      { status: message === 'Authentication required' ? 401 : 403 }
    )
  }
}
