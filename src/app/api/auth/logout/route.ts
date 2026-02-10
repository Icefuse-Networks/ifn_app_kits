/**
 * Logout Route - Cross-App Session Invalidation
 *
 * GET: Browser-initiated logout
 * POST: Auth Server broadcast for cross-app logout
 */

import { createLogoutHandlers } from '@icefuse/auth/logout'

const { GET, POST } = createLogoutHandlers({
  appName: 'kits',
  debug: process.env.NODE_ENV === 'development',
})

export { GET, POST }
