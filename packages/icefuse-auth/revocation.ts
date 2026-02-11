/**
 * @icefuse/auth - Session Revocation Cache
 *
 * In-memory cache for immediate session invalidation during cross-app logout.
 * When Auth Server broadcasts a logout, apps store the userId here.
 * The JWT callback checks this cache to reject sessions immediately
 * instead of waiting for token expiry.
 *
 * Note: For multi-instance deployments, this should be replaced with Redis.
 * See Phase 4 in the implementation roadmap.
 */

import { debugLog } from './config'

// ============================================================
// TYPES
// ============================================================

interface RevokedSession {
  userId: string
  revokedAt: number
  expiresAt: number
}

// ============================================================
// CONFIGURATION
// ============================================================

// TTL for revoked sessions (1 hour) - after this, JWT will have expired anyway
const REVOCATION_TTL_MS = 60 * 60 * 1000

// Cleanup interval (10 minutes)
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000

// ============================================================
// IN-MEMORY STORE
// ============================================================

// Map for O(1) lookup performance
const revokedSessions = new Map<string, RevokedSession>()

// Track if cleanup interval is set (for SSR environments)
let cleanupIntervalId: ReturnType<typeof setInterval> | null = null

// ============================================================
// PUBLIC API
// ============================================================

/**
 * Add a user to the revocation cache
 * Called when receiving a cross-app logout broadcast.
 *
 * @param userId - User ID to revoke
 */
export function revokeUserSession(userId: string): void {
  const now = Date.now()
  revokedSessions.set(userId, {
    userId,
    revokedAt: now,
    expiresAt: now + REVOCATION_TTL_MS,
  })
  debugLog('Revocation', `Added user to revocation cache: ${userId}`)
}

/**
 * Check if a user's session has been revoked
 * Use this in JWT callback to detect cross-app logouts.
 *
 * @param userId - User ID to check
 * @param sessionCreatedAt - Optional timestamp when session was created (for race condition protection)
 * @returns true if session is revoked
 *
 * @example
 * ```ts
 * // In JWT callback
 * if (isSessionRevoked(token.sub, token.sessionCreatedAt)) {
 *   return { ...token, error: 'SessionRevoked' }
 * }
 * ```
 */
export function isSessionRevoked(userId: string, sessionCreatedAt?: number): boolean {
  const entry = revokedSessions.get(userId)
  if (!entry) return false

  // Check if revocation has expired (auto-cleanup)
  if (Date.now() > entry.expiresAt) {
    revokedSessions.delete(userId)
    return false
  }

  // If sessionCreatedAt is provided, check if the session was created after the revocation
  // This handles the race condition where user logs back in before old JWT expires
  if (sessionCreatedAt !== undefined && sessionCreatedAt > entry.revokedAt) {
    return false // Session was created after revocation, so it's valid
  }

  return true
}

/**
 * Remove a user from the revocation cache
 * Called when user logs back in.
 *
 * @param userId - User ID to clear
 */
export function clearRevocation(userId: string): void {
  if (revokedSessions.delete(userId)) {
    debugLog('Revocation', `Cleared revocation for user: ${userId}`)
  }
}

/**
 * Get revocation info for a user
 * Useful for debugging.
 *
 * @param userId - User ID to check
 * @returns Revocation info or null
 */
export function getRevocationInfo(userId: string): RevokedSession | null {
  return revokedSessions.get(userId) || null
}

/**
 * Get count of currently revoked sessions
 * Useful for monitoring.
 *
 * @returns Number of revoked sessions in cache
 */
export function getRevocationCount(): number {
  return revokedSessions.size
}

// ============================================================
// CLEANUP
// ============================================================

/**
 * Cleanup expired revocations
 * Called periodically to prevent memory leaks.
 */
export function cleanupExpiredRevocations(): number {
  const now = Date.now()
  let cleaned = 0

  for (const [userId, entry] of revokedSessions.entries()) {
    if (now > entry.expiresAt) {
      revokedSessions.delete(userId)
      cleaned++
    }
  }

  if (cleaned > 0) {
    debugLog('Revocation', `Cleaned up ${cleaned} expired revocations`)
  }

  return cleaned
}

/**
 * Start the cleanup interval
 * Called automatically when module is imported in Node.js environment.
 */
export function startCleanupInterval(): void {
  if (cleanupIntervalId === null && typeof setInterval !== 'undefined') {
    cleanupIntervalId = setInterval(cleanupExpiredRevocations, CLEANUP_INTERVAL_MS)
    // Unref to not prevent process exit
    if (cleanupIntervalId && typeof cleanupIntervalId === 'object' && 'unref' in cleanupIntervalId) {
      cleanupIntervalId.unref()
    }
  }
}

/**
 * Stop the cleanup interval
 * Call this for graceful shutdown.
 */
export function stopCleanupInterval(): void {
  if (cleanupIntervalId !== null) {
    clearInterval(cleanupIntervalId)
    cleanupIntervalId = null
  }
}

// Auto-start cleanup in Node.js environment
if (typeof process !== 'undefined' && process.env) {
  startCleanupInterval()
}
