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
  terms: 'https://icefuse.com/terms',
  privacy: 'https://icefuse.com/privacy',
  refunds: 'https://icefuse.com/refunds',
}

// Kit Manager routes
export const kitRoutes = {
  home: '/',
  kits: '/kits',
  configs: '/configs',
}
