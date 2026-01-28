/**
 * Admin Access Verification Endpoint
 *
 * Verifies that the current session belongs to a root user.
 * Copied 1:1 from PayNow store for consistency.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { requireAdmin } from '@/services/admin-auth'

export async function GET(_req: NextRequest) {
  // SECURITY: Auth check at route start
  const session = await getServerSession(authOptions())

  try {
    await requireAdmin(session)
    return NextResponse.json({ authorized: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: message },
      { status: message === 'Authentication required' ? 401 : 403 }
    )
  }
}
