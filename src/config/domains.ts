/**
 * Domain Configuration - Centralized Domain Management
 *
 * ALL domain names for the Icefuse platform should be configured here.
 */

const isProduction = process.env.NODE_ENV === 'production'

// =============================================================================
// BASE DOMAIN CONFIGURATION
// =============================================================================

export const domainConfig = {
  baseDomain: 'icefuse.com',
  cdnDomain: 'cdn.icefuse.com',
  websiteDomain: 'icefuse.net',
  shortDomain: 'ifn.gg',

  get cookieDomain(): string {
    return `.${this.baseDomain}`
  },

  get productionDomainPatterns(): string[] {
    return [
      this.baseDomain,
      this.websiteDomain,
      this.shortDomain,
    ]
  },
}

// =============================================================================
// SERVICE SUBDOMAIN CONFIGURATION
// =============================================================================

export const serviceSubdomains = {
  auth: 'auth',
  cms: 'cms',
  store: 'store',
  kits: 'kits',
  www: 'www',
} as const

// =============================================================================
// LOCAL DEVELOPMENT PORTS
// =============================================================================

export const localPorts = {
  auth: 3012,
  cms: 3001,
  store: 3000,
  kits: 3020,
  website: 3002,
} as const

// =============================================================================
// URL BUILDERS
// =============================================================================

export function buildServiceUrl(
  service: 'auth' | 'cms' | 'store' | 'kits' | 'website',
  currentUrl?: string | URL
): string {
  let useProduction = isProduction
  if (currentUrl) {
    const url = typeof currentUrl === 'string' ? new URL(currentUrl) : currentUrl
    useProduction = isProductionHostname(url.hostname)
  } else if (typeof window !== 'undefined') {
    useProduction = isProductionHostname(window.location.hostname)
  }

  if (!useProduction) {
    return `http://localhost:${localPorts[service]}`
  }

  if (service === 'website') {
    return `https://${domainConfig.baseDomain}`
  }

  // Kits uses icefuse.net subdomain
  if (service === 'kits') {
    return `https://kits.${domainConfig.websiteDomain}`
  }

  return `https://${serviceSubdomains[service]}.${domainConfig.baseDomain}`
}

export function buildCdnUrl(path: string): string {
  const cleanPath = path.startsWith('/') ? path.slice(1) : path
  return `https://${domainConfig.cdnDomain}/${cleanPath}`
}

// =============================================================================
// SERVICE URLs
// =============================================================================

export const serviceUrls = {
  get auth(): string {
    return buildServiceUrl('auth')
  },
  get cms(): string {
    return buildServiceUrl('cms')
  },
  get store(): string {
    return buildServiceUrl('store')
  },
  get kits(): string {
    return buildServiceUrl('kits')
  },
  get website(): string {
    return buildServiceUrl('website')
  },
}

// =============================================================================
// HOSTNAME DETECTION
// =============================================================================

export function isProductionHostname(hostname: string): boolean {
  const normalizedHost = hostname.toLowerCase()

  for (const domain of domainConfig.productionDomainPatterns) {
    if (normalizedHost === domain) return true
    if (normalizedHost.endsWith(`.${domain}`)) return true
  }

  return false
}

export function detectProductionFromHostname(): boolean {
  if (typeof window === 'undefined') {
    return process.env.NODE_ENV === 'production'
  }

  return isProductionHostname(window.location.hostname)
}

export function getAllowedHosts(): string[] {
  if (!isProduction) {
    return ['localhost', '127.0.0.1']
  }

  const { baseDomain, websiteDomain } = domainConfig
  return [
    baseDomain,
    `www.${baseDomain}`,
    `${serviceSubdomains.auth}.${baseDomain}`,
    `${serviceSubdomains.kits}.${websiteDomain}`,
  ]
}

export function getCookieDomainValue(): string | undefined {
  if (!isProduction) {
    return undefined
  }
  return domainConfig.cookieDomain
}

// =============================================================================
// COMBINED EXPORT
// =============================================================================

export const domains = {
  config: domainConfig,
  services: serviceUrls,
  localPorts,
  serviceSubdomains,
  buildServiceUrl,
  buildCdnUrl,
  getAllowedHosts,
  getCookieDomainValue,
  isProductionHostname,
  detectProductionFromHostname,
}

export default domains
