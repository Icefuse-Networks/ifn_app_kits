/**
 * Auth Config Service
 *
 * Simplified configuration service for Kit Manager.
 * Fetches and caches configuration from the central Auth server.
 */

import { getCookieDomainValue } from '@/config/domains'

// =============================================================================
// CONFIGURATION
// =============================================================================

const isProduction = process.env.NODE_ENV === 'production'

// Auth server URL
const AUTH_SERVER_URL = isProduction
  ? 'https://auth.icefuse.com'
  : 'http://localhost:3012'

// Bootstrap token for initial auth (from env or config)
const BOOTSTRAP_TOKEN = process.env.AUTH_BOOTSTRAP_TOKEN ||
  'bt_kits_a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2'

// User sync secret (from env or hardcoded for dev)
const USER_SYNC_SECRET = process.env.AUTH_USER_SYNC_SECRET ||
  '78639315540636787d5b98282181cc8505fb3a933d3aa295c506dd2f520909ab'

// =============================================================================
// LOCAL FALLBACK VALUES
// =============================================================================

// NextAuth secrets (must match auth server)
const DEV_NEXTAUTH_SECRET = '2091cb9f77c7305308a6fc3d22f6c45ddbe70800dff5968241c2b26741a6d072'
const PROD_NEXTAUTH_SECRET = 'cae76e544c394d0dd7b0f9a5f809d7944e25091f371581139aa42ec75353eb10'

const LOCAL_SECRETS = {
  nextAuthSecret: process.env.NEXTAUTH_SECRET || (isProduction ? PROD_NEXTAUTH_SECRET : DEV_NEXTAUTH_SECRET),
  userSyncSecret: USER_SYNC_SECRET,
}

// =============================================================================
// CACHE STATE
// =============================================================================

interface SecretsCache {
  nextAuthSecret: string
  userSyncSecret: string
  timestamp: number
}

let _secretsCache: SecretsCache | null = null
const CACHE_TTL = 60 * 60 * 1000 // 1 hour

// =============================================================================
// SECRETS
// =============================================================================

/**
 * Fetch shared secrets from Auth server
 */
export async function fetchSecrets(): Promise<{ nextAuthSecret: string; userSyncSecret: string }> {
  if (_secretsCache && Date.now() - _secretsCache.timestamp < CACHE_TTL) {
    return {
      nextAuthSecret: _secretsCache.nextAuthSecret,
      userSyncSecret: _secretsCache.userSyncSecret,
    }
  }

  try {
    const response = await fetch(`${AUTH_SERVER_URL}/api/config/secrets`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-bootstrap-token': BOOTSTRAP_TOKEN,
      },
      body: JSON.stringify({ serviceId: 'kits' }),
      signal: AbortSignal.timeout(5000),
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch secrets: ${response.status}`)
    }

    const data = await response.json()

    if (!data.authorized || !data.secrets) {
      throw new Error('Secrets response not authorized or missing data')
    }

    const { nextAuthSecret, userSyncSecret } = data.secrets

    _secretsCache = {
      nextAuthSecret,
      userSyncSecret,
      timestamp: Date.now(),
    }

    console.log('[AuthConfigService] Fetched shared secrets from auth server')
    return { nextAuthSecret, userSyncSecret }
  } catch (error) {
    console.warn('[AuthConfigService] Failed to fetch secrets, using local fallback:', error)
    return LOCAL_SECRETS
  }
}

/**
 * Get NextAuth secret (sync - uses cache or fallback)
 */
export function getNextAuthSecret(): string {
  return _secretsCache?.nextAuthSecret ?? LOCAL_SECRETS.nextAuthSecret
}

/**
 * Get user sync secret (sync - uses cache or fallback)
 */
export function getUserSyncSecret(): string {
  return _secretsCache?.userSyncSecret ?? LOCAL_SECRETS.userSyncSecret
}

/**
 * Get Auth server URL
 */
export function getAuthUrl(): string {
  return AUTH_SERVER_URL
}

/**
 * Get cookie domain
 */
export function getCookieDomain(): string | undefined {
  return getCookieDomainValue()
}

/**
 * Initialize service (call on app startup)
 */
export async function initialize(): Promise<void> {
  console.log('[AuthConfigService] Initializing...')
  await fetchSecrets()
  console.log('[AuthConfigService] Initialization complete')
}

/**
 * Clear caches (for testing)
 */
export function clearCaches(): void {
  _secretsCache = null
}
