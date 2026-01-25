/**
 * Auth User Helper
 *
 * Fetches user profile data from the Auth Server (ifn_app_auth_v2).
 * Auth Server is the single source of truth for user identity.
 */

import { getAuthUrl, getUserSyncSecret } from '@/services/auth-config-service'

// =============================================================================
// TYPES
// =============================================================================

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
  rank?: string | null
}

// =============================================================================
// CACHE
// =============================================================================

const profileCache = new Map<string, { profile: AuthUserProfile | null; timestamp: number }>()
const CACHE_TTL = 60 * 1000 // 1 minute

const sessionValidCache = new Map<string, { valid: boolean; timestamp: number }>()
const SESSION_VALID_CACHE_TTL = 30 * 1000 // 30 seconds

// =============================================================================
// API HELPERS
// =============================================================================

async function fetchFromAuthApi(userId: string): Promise<AuthUserProfile | null> {
  try {
    const response = await fetch(`${getAuthUrl()}/api/users/${userId}`, {
      headers: {
        'x-sync-secret': getUserSyncSecret(),
        'Accept-Encoding': 'gzip, br',
      },
      signal: AbortSignal.timeout(5000),
    })

    if (!response.ok) {
      if (response.status !== 404) {
        console.warn(`[AuthUser] API fetch failed for ${userId}: ${response.status}`)
      }
      return null
    }

    const data = await response.json()
    return data.user || null
  } catch (error) {
    console.error(`[AuthUser] Failed to fetch from Auth v2 for ${userId}:`, error)
    return null
  }
}

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Fetch user profile from Auth v2 API by user ID
 */
export async function getAuthUserById(userId: string, bypassCache = false): Promise<AuthUserProfile | null> {
  if (!bypassCache) {
    const cached = profileCache.get(userId)
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.profile
    }
  }

  const profile = await fetchFromAuthApi(userId)
  profileCache.set(userId, { profile, timestamp: Date.now() })

  return profile
}

/**
 * Fetch user profile from Auth v2 API by Steam ID
 */
export async function getAuthUserBySteamId(steamId: string): Promise<AuthUserProfile | null> {
  try {
    const response = await fetch(`${getAuthUrl()}/api/users/steam/${steamId}`, {
      headers: { 'x-sync-secret': getUserSyncSecret() },
      signal: AbortSignal.timeout(3000),
    })
    if (response.ok) {
      const data = await response.json()
      if (data.user) {
        profileCache.set(data.user.id, { profile: data.user, timestamp: Date.now() })
        return data.user
      }
    }
  } catch (error) {
    console.error(`[AuthUser] Failed to fetch by Steam ID ${steamId}:`, error)
  }

  return null
}

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

/**
 * Invalidate cached profile
 */
export function invalidateUserCache(userId: string): void {
  profileCache.delete(userId)
}

/**
 * Check if a user's session is still valid in Auth v2
 */
export async function isSessionValid(userId: string): Promise<boolean> {
  const cached = sessionValidCache.get(userId)
  if (cached && Date.now() - cached.timestamp < SESSION_VALID_CACHE_TTL) {
    return cached.valid
  }

  try {
    const response = await fetch(`${getAuthUrl()}/api/users/${userId}/session-valid`, {
      headers: {
        'x-sync-secret': getUserSyncSecret(),
      },
      signal: AbortSignal.timeout(2000),
    })

    if (!response.ok) {
      if (response.status === 404) {
        sessionValidCache.set(userId, { valid: false, timestamp: Date.now() })
        return false
      }
      console.warn(`[AuthUser] Session validation failed for ${userId}: ${response.status}`)
      return true // Fail-open for 5xx errors
    }

    const data = await response.json()
    const isValid = data.valid === true

    sessionValidCache.set(userId, { valid: isValid, timestamp: Date.now() })

    if (!isValid) {
      console.log(`[AuthUser] Session revoked for ${userId}`)
    }

    return isValid
  } catch (error) {
    console.error(`[AuthUser] Session validation error for ${userId}:`, error)
    return true // Fail-open on network errors
  }
}

/**
 * Clear session validation cache for a user
 */
export function clearSessionValidCache(userId: string): void {
  sessionValidCache.delete(userId)
}
