/**
 * Auth Configuration - Simple Environment Variable Access
 *
 * Copied from PayNow store for consistency.
 */

export {
  getAuthUrl,
  getNextAuthSecret,
  getUserSyncSecret,
  getCookieDomain,
  isAllowedHost,
} from '@icefuse/auth'

const isProduction = process.env.NODE_ENV === 'production'

/**
 * Get session cookie name based on environment
 * Uses unique name 'icefuse-kits' to avoid collision with Auth Server
 */
export function getSessionCookieName(): string {
  return isProduction ? '__Secure-icefuse-kits.session-token' : 'icefuse-kits.session-token'
}

/**
 * Get callback cookie name based on environment
 */
export function getCallbackCookieName(): string {
  return isProduction ? '__Secure-icefuse-kits.callback-url' : 'icefuse-kits.callback-url'
}
