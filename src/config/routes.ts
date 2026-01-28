/**
 * Route Configuration
 *
 * Centralized route definitions for the Kit Manager.
 */

// Account routes for the user profile dropdown
export const accountRoutes = {
  dashboard: '/dashboard',
  settings: '/dashboard?tab=settings',
}

// Legal/policy routes (external links to main site)
export const legalRoutes = {
  terms: 'https://icefuse.net/terms',
  privacy: 'https://icefuse.net/privacy',
  refunds: 'https://icefuse.net/refunds',
}

// Kit Manager routes
export const kitRoutes = {
  home: '/',
  kits: '/kits',
  configs: '/configs',
}
