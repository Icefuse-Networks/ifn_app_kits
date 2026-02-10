/**
 * @icefuse/auth - Auth Server Admin API Client
 *
 * Direct API calls to Auth Server for admin operations.
 * These functions require admin privileges and cannot be done through OIDC.
 *
 * For regular user data, use the OIDC session - don't call these functions.
 *
 * Usage:
 * ```ts
 * import { getAuthUserById, searchAuthUsers } from '@icefuse/auth/admin'
 *
 * // Get user by ID
 * const user = await getAuthUserById('user_xxx')
 *
 * // Search users
 * const results = await searchAuthUsers('john@example.com')
 * ```
 */

import { getAuthUrl, getUserSyncSecret } from './config'

// ============================================================
// CONFIGURATION
// ============================================================

const AUTH_API_TIMEOUT = 8000 // 8 seconds

// PERF: In-memory cache for admin lookups
const profileCache = new Map<string, { profile: AuthUserProfile | null; timestamp: number }>()
const CACHE_TTL = 60 * 1000 // 1 minute

// ============================================================
// TYPES
// ============================================================

/**
 * User profile from Auth Server (admin view)
 */
export interface AuthUserProfile {
  id: string
  steamId: string
  steamName: string
  steamAvatar: string | null
  name: string | null
  image: string | null
  email: string | null
  primaryProvider: string | null
  isActive: boolean
  lastLoginAt: string | null
  minecraftUuid?: string | null
  minecraftUsername?: string | null
  xboxXuid?: string | null
  xboxGamertag?: string | null
  paynowCustomerId?: string | null
}

/**
 * Search result with match information
 */
export interface AuthUserSearchResult {
  user: AuthUserProfile
  matchedOn: {
    field: 'email' | 'name' | 'provider' | 'userId'
    value: string
    provider?: string
  }
}

/**
 * Linked account from Auth Server
 */
export interface AuthLinkedAccount {
  provider: string
  providerAccountId: string
  providerUsername: string | null
  providerAvatar: string | null
  isPrimary: boolean
  linkedAt: string
  updatedAt: string
}

/**
 * Game username from Auth Server
 */
export interface AuthGameUsername {
  id: string
  userId: string
  platform: 'minecraft' | 'hytale'
  edition: 'java' | 'bedrock' | null
  username: string
  uuid: string | null
  verifiedAt: string
  createdAt: string
}

/**
 * Result type for Auth API calls
 * Distinguishes between actual 404 and service errors
 */
export type AuthApiResult<T> =
  | { success: true; data: T }
  | { success: false; reason: 'not_found' }
  | { success: false; reason: 'service_unavailable'; error?: Error }

// ============================================================
// INTERNAL HELPERS
// ============================================================

/**
 * Fetch user profile from Auth API
 */
async function fetchFromAuthApi(userId: string): Promise<AuthApiResult<AuthUserProfile>> {
  try {
    const authUrl = getAuthUrl()
    const response = await fetch(`${authUrl}/api/users/${userId}`, {
      headers: {
        'x-sync-secret': getUserSyncSecret(),
        'Accept-Encoding': 'gzip, br',
      },
      signal: AbortSignal.timeout(AUTH_API_TIMEOUT),
    })

    if (!response.ok) {
      if (response.status === 404) {
        return { success: false, reason: 'not_found' }
      }
      // console.warn(`[Icefuse Auth:Admin] API fetch failed for ${userId}: ${response.status}`)
      return { success: false, reason: 'service_unavailable' }
    }

    const data = await response.json()
    const user = data.user
    if (!user) {
      return { success: false, reason: 'not_found' }
    }
    return { success: true, data: user }
  } catch (error) {
    const isTimeout = error instanceof Error && error.name === 'TimeoutError'
    console.error(
      `[Icefuse Auth:Admin] ${isTimeout ? 'Timeout' : 'Failed'} fetching user ${userId}:`,
      error
    )
    return {
      success: false,
      reason: 'service_unavailable',
      error: error instanceof Error ? error : undefined,
    }
  }
}

// ============================================================
// USER LOOKUP
// ============================================================

/**
 * Fetch user profile from Auth Server by user ID
 * ADMIN ONLY - Used for admin operations
 *
 * For regular user data in routes, use session.user from OIDC
 *
 * @param userId - User ID to look up
 * @param bypassCache - Skip cache lookup
 * @returns AuthUserProfile or null
 */
export async function getAuthUserById(
  userId: string,
  bypassCache = false
): Promise<AuthUserProfile | null> {
  const result = await getAuthUserByIdWithResult(userId, bypassCache)
  return result.success ? result.data : null
}

/**
 * Fetch user profile with structured result
 * Distinguishes between user not found (404) vs service unavailable (timeout/error)
 * Uses in-memory caching for performance
 */
export async function getAuthUserByIdWithResult(
  userId: string,
  bypassCache = false
): Promise<AuthApiResult<AuthUserProfile>> {
  // Check cache (unless bypassed)
  if (!bypassCache) {
    const cached = profileCache.get(userId)
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      if (cached.profile) {
        return { success: true, data: cached.profile }
      }
      return { success: false, reason: 'not_found' }
    }
  }

  // Fetch from API
  const result = await fetchFromAuthApi(userId)

  // Update cache only for successful results
  if (result.success) {
    profileCache.set(userId, { profile: result.data, timestamp: Date.now() })
  }

  return result
}

/**
 * Invalidate cached profile (call when profile updates)
 */
export function invalidateUserCache(userId: string): void {
  profileCache.delete(userId)
}

/**
 * Clear entire user cache
 */
export function clearUserCache(): void {
  profileCache.clear()
}

// ============================================================
// USER SEARCH
// ============================================================

/**
 * Search users in Auth Server by query string
 * ADMIN ONLY - requires x-sync-secret header
 *
 * @param query - Search query (email, name, Steam ID, etc.)
 * @param limit - Maximum results (default 10, max 100)
 */
export async function searchAuthUsers(
  query: string,
  limit: number = 10
): Promise<AuthUserSearchResult[]> {
  // SECURITY: Sanitize and validate input
  const sanitizedQuery = query.trim().slice(0, 100)
  if (sanitizedQuery.length < 2) {
    return []
  }

  // SECURITY: Limit max results
  const safeLimit = Math.min(Math.max(1, limit), 100)

  try {
    const authUrl = getAuthUrl()
    const response = await fetch(`${authUrl}/api/users/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-sync-secret': getUserSyncSecret(),
        'Accept-Encoding': 'gzip, br',
      },
      body: JSON.stringify({ query: sanitizedQuery, limit: safeLimit }),
      signal: AbortSignal.timeout(AUTH_API_TIMEOUT),
    })

    if (!response.ok) {
      // console.warn(`[Icefuse Auth:Admin] Search API failed: ${response.status}`)
      return []
    }

    const data = await response.json()
    return data.results || []
  } catch (error) {
    console.error('[Icefuse Auth:Admin] Search API error:', error)
    return []
  }
}

// ============================================================
// LINKED ACCOUNTS
// ============================================================

/**
 * Fetch user's linked accounts from Auth Server
 * ADMIN ONLY - requires x-sync-secret header
 */
export async function getAuthUserAccounts(userId: string): Promise<AuthLinkedAccount[]> {
  try {
    const authUrl = getAuthUrl()
    const response = await fetch(`${authUrl}/api/users/${userId}/accounts`, {
      headers: {
        'x-sync-secret': getUserSyncSecret(),
        'Accept-Encoding': 'gzip, br',
      },
      signal: AbortSignal.timeout(AUTH_API_TIMEOUT),
    })

    if (!response.ok) {
      if (response.status !== 404) {
        // console.warn(`[Icefuse Auth:Admin] Failed to fetch accounts for ${userId}: ${response.status}`)
      }
      return []
    }

    const data = await response.json()
    return data.accounts || []
  } catch (error) {
    console.error(`[Icefuse Auth:Admin] Failed to fetch accounts for ${userId}:`, error)
    return []
  }
}

// ============================================================
// GAME USERNAMES
// ============================================================

/**
 * Fetch user's game usernames from Auth Server
 */
export async function getAuthUserGameUsernames(
  userId: string,
  platform?: 'minecraft' | 'hytale'
): Promise<AuthGameUsername[]> {
  try {
    const authUrl = getAuthUrl()
    const url = new URL(`${authUrl}/api/users/${userId}/game-usernames`)
    if (platform) {
      url.searchParams.set('platform', platform)
    }

    const response = await fetch(url.toString(), {
      headers: {
        'x-sync-secret': getUserSyncSecret(),
        'Accept-Encoding': 'gzip, br',
      },
      signal: AbortSignal.timeout(AUTH_API_TIMEOUT),
    })

    if (!response.ok) {
      if (response.status !== 404) {
        // console.warn(`[Icefuse Auth:Admin] Failed to fetch game usernames for ${userId}: ${response.status}`)
      }
      return []
    }

    const data = await response.json()
    return data.usernames || []
  } catch (error) {
    console.error(`[Icefuse Auth:Admin] Failed to fetch game usernames for ${userId}:`, error)
    return []
  }
}

/**
 * Add a verified game username to Auth Server
 */
export async function addAuthGameUsername(
  userId: string,
  platform: 'minecraft' | 'hytale',
  username: string,
  edition?: 'java' | 'bedrock',
  uuid?: string
): Promise<AuthGameUsername | null> {
  try {
    const authUrl = getAuthUrl()
    const response = await fetch(`${authUrl}/api/users/${userId}/game-usernames`, {
      method: 'POST',
      headers: {
        'x-sync-secret': getUserSyncSecret(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ platform, username, edition, uuid }),
      signal: AbortSignal.timeout(AUTH_API_TIMEOUT),
    })

    if (!response.ok) {
      console.error(`[Icefuse Auth:Admin] Failed to add game username for ${userId}: ${response.status}`)
      return null
    }

    const data = await response.json()
    return data.gameUsername || null
  } catch (error) {
    console.error(`[Icefuse Auth:Admin] Failed to add game username for ${userId}:`, error)
    return null
  }
}

/**
 * Remove a game username from Auth Server
 */
export async function removeAuthGameUsername(
  userId: string,
  platform: 'minecraft' | 'hytale',
  username: string
): Promise<boolean> {
  try {
    const authUrl = getAuthUrl()
    const response = await fetch(`${authUrl}/api/users/${userId}/game-usernames`, {
      method: 'DELETE',
      headers: {
        'x-sync-secret': getUserSyncSecret(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ platform, username }),
      signal: AbortSignal.timeout(AUTH_API_TIMEOUT),
    })

    if (!response.ok) {
      console.error(`[Icefuse Auth:Admin] Failed to remove game username for ${userId}: ${response.status}`)
      return false
    }

    return true
  } catch (error) {
    console.error(`[Icefuse Auth:Admin] Failed to remove game username for ${userId}:`, error)
    return false
  }
}

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

/**
 * Get user's display name
 */
export function getDisplayName(user: AuthUserProfile): string {
  return user.steamName || user.name || `User ${user.id.slice(0, 8)}`
}

/**
 * Get user's avatar URL
 */
export function getAvatarUrl(user: AuthUserProfile): string | null {
  return user.steamAvatar || user.image
}
