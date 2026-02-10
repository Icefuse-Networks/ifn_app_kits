/**
 * Icefuse Auth Configuration - Kits Application
 *
 * OIDC-based authentication using the central Icefuse Auth server.
 */

import { createIcefuseAuth } from '@icefuse/auth'
import { getAuthUrl } from '@icefuse/auth/config'

const isProduction = process.env.NODE_ENV === 'production'

export const { handlers, auth, signIn, signOut, authOptions } = createIcefuseAuth({
  appName: 'kits',
  clientId: process.env.ICEFUSE_CLIENT_ID || 'kits',
  clientSecret: process.env.ICEFUSE_CLIENT_SECRET || '',
  issuer: getAuthUrl(),
  debug: !isProduction,
})

// Re-export for backwards compatibility
export { getAuthUrl }
