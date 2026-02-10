/**
 * Admin Authentication Service
 *
 * Verifies root user status via Auth Server API.
 * Copied 1:1 from PayNow store for consistency.
 */

import { getAuthUrl, getUserSyncSecret } from '@icefuse/auth/config'
import type { IcefuseSession } from '@icefuse/auth'

// In-memory cache (5 min TTL)
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

interface AdminUsersCache {
  rootUsers: {
    steamIds: string[]
    emails: string[]
  }
  adminUsers: {
    steamIds: string[]
    emails: string[]
  }
  timestamp: number
}

let _adminUsersCache: AdminUsersCache | null = null

/**
 * Fetch admin users from Auth Server (internal)
 */
async function fetchAdminUsers(): Promise<AdminUsersCache> {
  // Check cache
  if (_adminUsersCache && Date.now() - _adminUsersCache.timestamp < CACHE_TTL) {
    return _adminUsersCache
  }

  try {
    // SECURITY: Call Auth Server with sync secret (GET method)
    const response = await fetch(`${getAuthUrl()}/api/config/admin-users`, {
      headers: {
        'x-sync-secret': getUserSyncSecret(),
      },
      signal: AbortSignal.timeout(5000),
    })

    if (!response.ok) {
      console.error('[AdminAuth] Failed to fetch admin users:', response.status)
      throw new Error(`Failed to fetch admin users: ${response.status}`)
    }

    const data = await response.json()

    // SECURITY: Verify response authorization
    if (!data.authorized || !data.rootUsers || !data.adminUsers) {
      console.error('[AdminAuth] Admin users response not authorized or missing data')
      throw new Error('Admin users response not authorized or missing data')
    }

    // Normalize emails to lowercase
    _adminUsersCache = {
      rootUsers: {
        steamIds: data.rootUsers.steamIds || [],
        emails: (data.rootUsers.emails || []).map((e: string) => e.toLowerCase()),
      },
      adminUsers: {
        steamIds: data.adminUsers.steamIds || [],
        emails: (data.adminUsers.emails || []).map((e: string) => e.toLowerCase()),
      },
      timestamp: Date.now(),
    }

    return _adminUsersCache
  } catch (error) {
    console.error('[AdminAuth] Root user check failed:', error)
    // Fail-closed: return empty admin list on error
    return {
      rootUsers: { steamIds: [], emails: [] },
      adminUsers: { steamIds: [], emails: [] },
      timestamp: Date.now(),
    }
  }
}

/**
 * Check if a user is a root user via Auth Server
 *
 * @param steamId - User's Steam ID
 * @param email - User's email address
 * @returns Promise<boolean> - True if user is root user
 */
export async function isRootUser(steamId?: string | null, email?: string | null): Promise<boolean> {
  const cache = await fetchAdminUsers()

  // Check Steam ID
  if (steamId && cache.rootUsers.steamIds.includes(steamId)) {
    return true
  }

  // Check email (normalized to lowercase)
  if (email && cache.rootUsers.emails.includes(email.toLowerCase())) {
    return true
  }

  return false
}

/**
 * Check if a user is an admin user via Auth Server
 * (includes both root users and regular admins)
 *
 * @param steamId - User's Steam ID
 * @param email - User's email address
 * @returns Promise<boolean> - True if user is admin
 */
export async function isAdminUser(steamId?: string | null, email?: string | null): Promise<boolean> {
  const cache = await fetchAdminUsers()

  // Check if root user first
  if (await isRootUser(steamId, email)) {
    return true
  }

  // Check Steam ID in admin list
  if (steamId && cache.adminUsers.steamIds.includes(steamId)) {
    return true
  }

  // Check email in admin list (normalized to lowercase)
  if (email && cache.adminUsers.emails.includes(email.toLowerCase())) {
    return true
  }

  return false
}

/**
 * Require admin access for a route
 *
 * @param session - NextAuth session
 * @throws Error if user is not authenticated or not admin
 */
export async function requireAdmin(session: IcefuseSession | null): Promise<void> {
  // SECURITY: Check authentication
  if (!session?.user) {
    throw new Error('Authentication required')
  }

  // SECURITY: Check admin status (root users for kit manager)
  const isRoot = await isRootUser(session.user.steamId, session.user.email)

  if (!isRoot) {
    throw new Error('Admin access required')
  }
}

/**
 * Clear the admin users cache (useful for testing)
 */
export function clearAdminUsersCache(): void {
  _adminUsersCache = null
}
