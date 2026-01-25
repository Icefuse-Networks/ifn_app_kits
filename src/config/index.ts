/**
 * Icefuse Kit Manager - Configuration
 *
 * Centralized configuration for all environment variables and settings.
 * All env vars are documented in .env.example
 */

const isProduction = process.env.NODE_ENV === 'production'

// =============================================================================
// ENVIRONMENT VARIABLES (Single Source of Truth)
// =============================================================================

export const env = {
  // Node environment
  NODE_ENV: process.env.NODE_ENV || 'development',

  // NextAuth
  NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET || '',
  NEXTAUTH_URL: process.env.NEXTAUTH_URL || 'http://localhost:3020',

  // Auth Server Integration
  AUTH_BOOTSTRAP_TOKEN: process.env.AUTH_BOOTSTRAP_TOKEN || '',
  AUTH_USER_SYNC_SECRET: process.env.AUTH_USER_SYNC_SECRET || '',

  // Database
  DATABASE_URL: process.env.DATABASE_URL || '',

  // Redis (optional)
  REDIS_URL: process.env.REDIS_URL || '',

  // Steam API (optional)
  STEAM_API_KEY: process.env.STEAM_API_KEY || '',

  // Analytics (optional)
  GTM_ID: process.env.GTM_ID || '',

  // Data storage path for JSON files (writable in container)
  DATA_PATH: process.env.DATA_PATH || './data',
} as const

// =============================================================================
// SERVICE URL CONFIGURATION
// =============================================================================

export const services = {
  auth: isProduction ? 'https://auth.icefuse.com' : 'http://localhost:3012',
  cms: isProduction ? 'https://cms.icefuse.com' : 'http://localhost:3001',
  store: isProduction ? 'https://store.icefuse.com' : 'http://localhost:3000',
  kits: isProduction ? 'https://kits.icefuse.net' : 'http://localhost:3020',
  website: isProduction ? 'https://icefuse.com' : 'http://localhost:3002',
}

// Production service URLs (for client-side use)
const productionServices = {
  auth: 'https://auth.icefuse.com',
  cms: 'https://cms.icefuse.com',
  store: 'https://store.icefuse.com',
  kits: 'https://kits.icefuse.net',
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
// SITE CONFIGURATION
// =============================================================================

export const siteConfig = {
  name: 'Icefuse Kit Manager',
  description: 'Kit management system for Icefuse Networks game servers',
  url: 'https://kits.icefuse.net',
  devUrl: 'http://localhost:3020',

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
} as const

// =============================================================================
// AUTH CONFIGURATION
// =============================================================================

export const authConfig = {
  // Bootstrap token for initial auth with Auth server
  bootstrapToken: process.env.AUTH_BOOTSTRAP_TOKEN || '',

  // User sync secret for webhook verification
  userSyncSecret: process.env.AUTH_USER_SYNC_SECRET || '',

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
  // PostgreSQL connection URL
  url: process.env.DATABASE_URL || '',

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
  env,
  services,
  session,
  siteConfig,
  authConfig,
  databaseConfig,
  redisConfig,
}
