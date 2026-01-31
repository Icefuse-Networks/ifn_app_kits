/**
 * Icefuse Kit Manager - Configuration
 *
 * Centralized configuration for all settings.
 * Database and auth credentials are hardcoded - no .env files used.
 */

const isProduction = process.env.NODE_ENV === 'production'

// =============================================================================
// DATABASE CREDENTIALS
// =============================================================================

const DATABASE_CREDENTIALS = {
  // Internal (from Dokploy apps)
  internal: 'postgresql://kits_user:37bf60ec9b098bbf74274d586c0945cbc9df3745105aa0e39486e1db98722d3b@kits-postgres-2wdqyt:5432/ifn_kits',
  // External (from outside Dokploy) - port 5434
  external: 'postgresql://kits_user:37bf60ec9b098bbf74274d586c0945cbc9df3745105aa0e39486e1db98722d3b@104.129.132.73:5434/ifn_kits',
}

// =============================================================================
// SERVICE URL CONFIGURATION
// =============================================================================

// Service URLs - local dev uses localhost, production uses domains
export const services = {
  auth: isProduction ? 'https://auth.icefuse.com' : 'http://localhost:3012',
  cms: isProduction ? 'https://cms.icefuse.com' : 'http://localhost:3001',
  store: isProduction ? 'https://store.icefuse.com' : 'http://localhost:3000',
  kits: isProduction ? 'https://kits.icefuse.com' : 'http://localhost:3020',
  website: isProduction ? 'https://icefuse.com' : 'http://localhost:3002',
}

// Production service URLs (for client-side use)
const productionServices = {
  auth: 'https://auth.icefuse.com',
  cms: 'https://cms.icefuse.com',
  store: 'https://store.icefuse.com',
  kits: 'https://kits.icefuse.com',
  website: 'https://icefuse.com',
}

// Development service URLs (for client-side use)
const developmentServices = {
  auth: 'http://localhost:3012',
  cms: 'http://localhost:3001',
  store: 'http://localhost:3000',
  kits: 'http://localhost:3020',
  website: 'http://localhost:3002',
}

// Production domain patterns for hostname detection
const productionDomains = ['icefuse.com', 'icefuse.net', 'ifn.gg']

/**
 * Check if a hostname is a production domain (client-safe)
 */
export function isProductionHostname(hostname: string): boolean {
  const normalizedHost = hostname.toLowerCase()
  return productionDomains.some(
    domain => normalizedHost === domain || normalizedHost.endsWith(`.${domain}`)
  )
}

/**
 * Get auth URL based on current environment (client-safe)
 */
export function getClientAuthUrl(): string {
  if (typeof window === 'undefined') {
    return services.auth
  }
  return isProductionHostname(window.location.hostname)
    ? productionServices.auth
    : developmentServices.auth
}

// =============================================================================
// SITE CONFIGURATION - Multi-Plugin Dashboard
// =============================================================================

/**
 * Plugin identity configuration
 * Each plugin can override these values for plugin-specific branding
 */
export interface PluginIdentity {
  id: string
  name: string
  shortName: string
  description: string
}

/**
 * Registered plugins for the dashboard
 */
export const REGISTERED_PLUGINS: PluginIdentity[] = [
  { id: 'kits', name: 'Kit Manager', shortName: 'Kits', description: 'Kit management for game servers' },
  // Future plugins (uncomment when adding):
  // { id: 'clans', name: 'Clan Manager', shortName: 'Clans', description: 'Clan management and wars' },
  // { id: 'stats', name: 'Player Stats', shortName: 'Stats', description: 'Player statistics and kills' },
]

/**
 * Get plugin identity by ID
 */
export function getPluginIdentity(pluginId: string): PluginIdentity | undefined {
  return REGISTERED_PLUGINS.find(p => p.id === pluginId)
}

/**
 * Current active plugin (can be set based on route or context)
 * Default to 'kits' for backwards compatibility
 */
export const DEFAULT_PLUGIN = 'kits'

export const siteConfig = {
  // Dashboard identity (unified branding)
  name: 'Icefuse Rust Dashboard',
  description: 'Unified management dashboard for Icefuse Networks Rust servers',
  url: 'https://kits.icefuse.com', // TODO: Update to dashboard.icefuse.com when ready
  devUrl: 'http://localhost:3020',

  // Default plugin context (for backwards compatibility)
  defaultPlugin: DEFAULT_PLUGIN,

  // Branding
  brand: {
    name: 'Icefuse Networks',
    shortName: 'Icefuse',
    logo: '/logo.png',
    favicon: '/favicon.ico',
  },

  // Social links
  social: {
    discord: 'https://discord.gg/icefuse',
    steam: 'https://steamcommunity.com/groups/icefuse',
    twitter: 'https://twitter.com/icefusenet',
  },

  // Plugin-specific names (helper for UI)
  getPluginName: (pluginId: string) => getPluginIdentity(pluginId)?.name ?? 'Unknown Plugin',
  getPluginDescription: (pluginId: string) => getPluginIdentity(pluginId)?.description ?? '',
} as const

// =============================================================================
// AUTH CONFIGURATION
// =============================================================================

export const authConfig = {
  // Bootstrap token for initial auth with Auth server (must match auth server's BOOTSTRAP_TOKENS.kits)
  bootstrapToken: 'bt_kits_k1t5m4n4g3r_s3cr3t_t0k3n_2025_pr0d_r34dy_4c71v3',

  // User sync secret for webhook verification and admin user fetching (must match auth server's secrets.userSyncSecret)
  userSyncSecret: '78639315540636787d5b98282181cc8505fb3a933d3aa295c506dd2f520909ab',

  // Session settings
  session: {
    maxAge: 30 * 24 * 60 * 60, // 30 days
    updateAge: 24 * 60 * 60, // 24 hours
  },
} as const

// =============================================================================
// SESSION CONFIGURATION
// =============================================================================

export const session = {
  maxAge: 30 * 24 * 60 * 60, // 30 days in seconds
  strategy: 'jwt' as const,
}

// =============================================================================
// DATABASE CONFIGURATION
// =============================================================================

export const databaseConfig = {
  // PostgreSQL connection URL - use internal for production (Dokploy), external for dev
  url: isProduction ? DATABASE_CREDENTIALS.internal : DATABASE_CREDENTIALS.external,

  // Connection pool settings
  pool: {
    min: 2,
    max: 10,
  },
} as const

// =============================================================================
// REDIS CONFIGURATION
// =============================================================================

export const redisConfig = {
  // Redis connection URL
  url: process.env.REDIS_URL || '',

  // Cache TTLs (in seconds)
  ttl: {
    session: 30 * 60, // 30 minutes
    kits: 5 * 60, // 5 minutes
    config: 5 * 60, // 5 minutes
  },
} as const

// =============================================================================
// API CONFIGURATION - Multi-Plugin Support
// =============================================================================

/**
 * Token prefix format: ifn_{plugin}_
 * This allows different plugins to have identifiable tokens
 */
export function getTokenPrefix(pluginId: string = DEFAULT_PLUGIN): string {
  return `ifn_${pluginId}_`
}

export const apiConfig = {
  // Base token prefix (for backwards compatibility)
  tokenPrefix: getTokenPrefix(DEFAULT_PLUGIN),

  // Get token prefix for a specific plugin
  getTokenPrefix,

  // CDN URL for Rust item images
  itemCdn: 'https://cdn.icefuse.com/rust/items',

  // Rate limiting defaults
  rateLimit: {
    windowMs: 60 * 1000, // 1 minute
    max: 60, // 60 requests per minute
  },

  // Pagination defaults
  pagination: {
    defaultLimit: 50,
    maxLimit: 100,
  },
} as const

// =============================================================================
// ANALYTICS CONFIGURATION
// =============================================================================

export const analyticsConfig = {
  retentionDays: 90,
  batch: {
    maxEventsPerRequest: 100,
  },
  dashboard: {
    defaultDays: 30,
    maxDays: 365,
  },
} as const

// =============================================================================
// IFN ADMIN CONFIGURATION (migrated from ifn_admin)
// =============================================================================

export const adminConfig = {
  steamApiKey: '069EB5169F9068C548B8368B38D1CC1B',
  mutesApiKey: 'hMuUffRKfQEkHZaSxj6MkUh7ybpzqY2r3nGbuGfCz85V74N7EKa97YcZ3gKJYvVi',
  staffApiKey: 'WBiwFVcDf2thkZh5X3peyWgfBo8VJmjnZmYEcyPemKodmpik9EnEK8tEfcb4LzyH',
} as const

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

// Check if running in development mode
export function isDev(): boolean {
  return process.env.NODE_ENV === 'development'
}

// Get the current base URL
export function getBaseUrl(): string {
  return isDev() ? siteConfig.devUrl : siteConfig.url
}

// Get full URL for a path
export function getFullUrl(path: string): string {
  const base = getBaseUrl().replace(/\/$/, '')
  const cleanPath = path.startsWith('/') ? path : `/${path}`
  return `${base}${cleanPath}`
}

// Validate required environment variables
export function validateConfig(): { valid: boolean; missing: string[] } {
  const required = [
    'DATABASE_URL',
    'NEXTAUTH_SECRET',
    'NEXTAUTH_URL',
  ]

  const missing = required.filter(key => !process.env[key])

  if (missing.length > 0) {
    console.warn(`[Config] Missing required environment variables:\n  - ${missing.join('\n  - ')}`)
  }

  return {
    valid: missing.length === 0,
    missing,
  }
}

// =============================================================================
// COMBINED CONFIG EXPORT
// =============================================================================

export const config = {
  isProduction,
  services,
  session,
  siteConfig,
  authConfig,
  databaseConfig,
  redisConfig,
  apiConfig,
  analytics: analyticsConfig,
  admin: adminConfig,
}
