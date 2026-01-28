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

// Auth server URL - local dev on 3012, production on auth.icefuse.com
const AUTH_SERVER_URL = isProduction
  ? 'https://auth.icefuse.com'
  : 'http://localhost:3012'

// Bootstrap token for initial auth (must match auth server's BOOTSTRAP_TOKENS.kits)
const BOOTSTRAP_TOKEN = 'bt_kits_k1t5m4n4g3r_s3cr3t_t0k3n_2025_pr0d_r34dy_4c71v3'

// User sync secret (must match auth server's secrets.userSyncSecret)
const USER_SYNC_SECRET = '78639315540636787d5b98282181cc8505fb3a933d3aa295c506dd2f520909ab'

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
