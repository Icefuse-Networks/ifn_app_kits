/**
 * Icefuse Auth Configuration - Kits Application
 *
 * OIDC-based authentication using the central Icefuse Auth server.
 */

import { createIcefuseAuth } from '@icefuse/auth'
import { getAuthUrl } from '@icefuse/auth/config'

const isProduction = process.env.NODE_ENV === 'production'

export const { handlers, auth, signIn, signOut, authOptions } = createIcefuseAuth({
  appName: process.env.ICEFUSE_APP_NAME!,
  clientId: process.env.ICEFUSE_CLIENT_ID!,
  clientSecret: process.env.ICEFUSE_CLIENT_SECRET!,
  issuer: getAuthUrl(),
  debug: !isProduction,
})
