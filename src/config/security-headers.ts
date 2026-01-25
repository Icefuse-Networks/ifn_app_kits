/**
 * Security Headers Configuration
 *
 * Centralized configuration for all HTTP security headers.
 * Applied via next.config.ts headers() function.
 */

import { domainConfig } from './domains'

// =============================================================================
// TYPES
// =============================================================================

interface CSPDirectives {
  'default-src': string[]
  'script-src': string[]
  'style-src': string[]
  'img-src': string[]
  'font-src': string[]
  'connect-src': string[]
  'frame-src': string[]
  'frame-ancestors': string[]
  'object-src': string[]
  'base-uri': string[]
  'form-action': string[]
  'upgrade-insecure-requests'?: boolean
  'block-all-mixed-content'?: boolean
}

// =============================================================================
// ENVIRONMENT DETECTION
// =============================================================================

const isProduction = process.env.NODE_ENV === 'production'
const isDevelopment = process.env.NODE_ENV === 'development'

// =============================================================================
// TRUSTED DOMAINS
// =============================================================================

const trustedDomains = {
  self: ["'self'"],
  ownDomains: [
    `https://*.${domainConfig.baseDomain}`,
    `https://${domainConfig.cdnDomain}`,
    `https://${domainConfig.websiteDomain}`,
    `https://*.${domainConfig.websiteDomain}`,
    `https://${domainConfig.shortDomain}`,
    `https://*.${domainConfig.shortDomain}`,
  ],

  cloudflare: [
    'https://static.cloudflareinsights.com',
    'https://cloudflareinsights.com',
    'https://*.cloudflare.com',
    'https://*.r2.cloudflarestorage.com',
  ],

  google: [
    'https://www.googletagmanager.com',
    'https://www.google-analytics.com',
    'https://analytics.google.com',
    'https://*.google-analytics.com',
    'https://*.googletagmanager.com',
  ],

  images: [
    'https://avatars.steamstatic.com',
    'https://steamcdn-a.akamaihd.net',
    'https://cdn.discordapp.com',
    'https://*.r2.cloudflarestorage.com',
    'https://rustlabs.com',
    'https://wiki.rustclash.com',
  ],

  websocket: isDevelopment
    ? ['ws://localhost:*', 'wss://localhost:*']
    : [`wss://*.${domainConfig.baseDomain}`],
}

// =============================================================================
// CSP CONFIGURATION
// =============================================================================

function buildCSPDirectives(): CSPDirectives {
  const directives: CSPDirectives = {
    'default-src': ["'self'"],

    'script-src': [
      "'self'",
      ...trustedDomains.cloudflare,
      ...trustedDomains.google,
      "'unsafe-inline'",
      ...(isDevelopment ? ["'unsafe-eval'"] : []),
    ],

    'style-src': ["'self'", "'unsafe-inline'"],

    'img-src': [
      "'self'",
      'data:',
      'blob:',
      ...trustedDomains.ownDomains,
      ...trustedDomains.google,
      ...trustedDomains.images,
    ],

    'font-src': ["'self'", 'data:'],

    'connect-src': [
      "'self'",
      ...trustedDomains.ownDomains,
      ...trustedDomains.cloudflare,
      ...trustedDomains.google,
      ...trustedDomains.websocket,
      ...(isDevelopment ? ['http://localhost:*'] : []),
    ],

    'frame-src': [
      "'self'",
      ...trustedDomains.cloudflare,
    ],

    'frame-ancestors': ["'none'"],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
  }

  if (isProduction) {
    directives['upgrade-insecure-requests'] = true
    directives['block-all-mixed-content'] = true
  }

  return directives
}

function buildCSPHeader(): string {
  const directives = buildCSPDirectives()

  const parts: string[] = []

  for (const [key, value] of Object.entries(directives)) {
    if (typeof value === 'boolean') {
      if (value) parts.push(key)
    } else if (Array.isArray(value) && value.length > 0) {
      parts.push(`${key} ${value.join(' ')}`)
    }
  }

  return parts.join('; ')
}

// =============================================================================
// PERMISSIONS POLICY
// =============================================================================

function buildPermissionsPolicy(): string {
  const policies = [
    'camera=()',
    'microphone=()',
    'geolocation=()',
    'usb=()',
    'bluetooth=()',
    'midi=()',
    'magnetometer=()',
    'gyroscope=()',
    'accelerometer=()',
    'payment=()',
    'fullscreen=(self)',
  ]

  return policies.join(', ')
}

// =============================================================================
// HEADER BUILDERS
// =============================================================================

interface SecurityHeader {
  key: string
  value: string
}

export function getSecurityHeaders(): SecurityHeader[] {
  const headers: SecurityHeader[] = [
    {
      key: 'X-Content-Type-Options',
      value: 'nosniff',
    },
    {
      key: 'X-Frame-Options',
      value: 'DENY',
    },
    {
      key: 'X-XSS-Protection',
      value: '1; mode=block',
    },
    {
      key: 'Referrer-Policy',
      value: 'strict-origin-when-cross-origin',
    },
    {
      key: 'Permissions-Policy',
      value: buildPermissionsPolicy(),
    },
    {
      key: 'Content-Security-Policy',
      value: buildCSPHeader(),
    },
    {
      key: 'X-DNS-Prefetch-Control',
      value: 'on',
    },
    {
      key: 'X-Permitted-Cross-Domain-Policies',
      value: 'none',
    },
  ]

  if (isProduction) {
    headers.push({
      key: 'Strict-Transport-Security',
      value: 'max-age=31536000; includeSubDomains; preload',
    })

    headers.push({
      key: 'Cross-Origin-Opener-Policy',
      value: 'same-origin',
    })

    headers.push({
      key: 'Cross-Origin-Resource-Policy',
      value: 'same-origin',
    })
  }

  return headers
}

export function getAPISecurityHeaders(): SecurityHeader[] {
  return [
    {
      key: 'X-Content-Type-Options',
      value: 'nosniff',
    },
    {
      key: 'X-Frame-Options',
      value: 'DENY',
    },
    {
      key: 'Cache-Control',
      value: 'no-store, no-cache, must-revalidate, proxy-revalidate',
    },
    {
      key: 'Pragma',
      value: 'no-cache',
    },
    {
      key: 'Expires',
      value: '0',
    },
  ]
}

export function getStaticAssetHeaders(): SecurityHeader[] {
  return [
    {
      key: 'X-Content-Type-Options',
      value: 'nosniff',
    },
    {
      key: 'Cache-Control',
      value: 'public, max-age=31536000, immutable',
    },
  ]
}

export const securityHeaders = {
  getSecurityHeaders,
  getAPISecurityHeaders,
  getStaticAssetHeaders,
  buildCSPHeader,
  trustedDomains,
}

export default securityHeaders
