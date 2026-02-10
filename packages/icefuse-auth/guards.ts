/**
 * @icefuse/auth - Permission Guards
 *
 * Session-based permission checks using OIDC claims.
 * The Auth Server computes admin/root status and includes it in the ID token,
 * so these checks are synchronous and require no API calls.
 */

import type { Session } from 'next-auth'
import type { IcefuseUser, IcefuseSession } from './types'

// ============================================================
// PERMISSION CHECKS
// ============================================================

/**
 * Check if user has admin access (non-throwing)
 * Admins can access admin panels and perform moderation actions.
 *
 * @param session - NextAuth session
 * @returns true if user is admin or root
 */
export function isAdmin(session: Session | IcefuseSession | null): boolean {
  if (!session?.user) return false
  const user = session.user as IcefuseUser
  return Boolean(user.isRoot || user.isAdmin)
}

/**
 * Check if user has root access (non-throwing)
 * Root users have full system access.
 *
 * @param session - NextAuth session
 * @returns true if user is root
 */
export function isRoot(session: Session | IcefuseSession | null): boolean {
  if (!session?.user) return false
  const user = session.user as IcefuseUser
  return Boolean(user.isRoot)
}

/**
 * Check if user is authenticated (non-throwing)
 *
 * @param session - NextAuth session
 * @returns true if session exists with a user
 */
export function isAuthenticated(session: Session | IcefuseSession | null): boolean {
  return Boolean(session?.user?.id)
}

// ============================================================
// THROWING GUARDS (for route protection)
// ============================================================

/**
 * Require authentication for a route
 * Use in server components or API routes.
 *
 * @param session - NextAuth session
 * @throws Error if user is not authenticated
 *
 * @example
 * ```ts
 * const session = await auth()
 * requireAuth(session)
 * // User is now guaranteed to be authenticated
 * ```
 */
export function requireAuth(session: Session | IcefuseSession | null): asserts session is IcefuseSession {
  if (!session?.user) {
    throw new Error('Authentication required')
  }
}

/**
 * Require admin access for a route
 * Use in server components or API routes.
 *
 * @param session - NextAuth session
 * @throws Error if user is not authenticated or not admin
 *
 * @example
 * ```ts
 * const session = await auth()
 * requireAdmin(session)
 * // User is now guaranteed to be admin
 * ```
 */
export function requireAdmin(session: Session | IcefuseSession | null): asserts session is IcefuseSession {
  // SECURITY: Check authentication first
  if (!session?.user) {
    throw new Error('Authentication required')
  }

  // SECURITY: Check admin status from OIDC claims
  const user = session.user as IcefuseUser
  if (!user.isRoot && !user.isAdmin) {
    throw new Error('Admin access required')
  }
}

/**
 * Require root access for a route
 * Use for highly sensitive operations.
 *
 * @param session - NextAuth session
 * @throws Error if user is not authenticated or not root
 *
 * @example
 * ```ts
 * const session = await auth()
 * requireRoot(session)
 * // User is now guaranteed to be root
 * ```
 */
export function requireRoot(session: Session | IcefuseSession | null): asserts session is IcefuseSession {
  // SECURITY: Check authentication first
  if (!session?.user) {
    throw new Error('Authentication required')
  }

  // SECURITY: Check root status from OIDC claims
  const user = session.user as IcefuseUser
  if (!user.isRoot) {
    throw new Error('Root access required')
  }
}

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

/**
 * Get user from session with proper typing
 *
 * @param session - NextAuth session
 * @returns User if authenticated, null otherwise
 */
export function getUser(session: Session | IcefuseSession | null): IcefuseUser | null {
  if (!session?.user) return null
  return session.user as IcefuseUser
}

/**
 * Get user ID from session
 *
 * @param session - NextAuth session
 * @returns User ID if authenticated, null otherwise
 */
export function getUserId(session: Session | IcefuseSession | null): string | null {
  if (!session?.user?.id) return null
  return session.user.id
}
