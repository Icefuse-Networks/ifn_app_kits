/**
 * NextAuth Route Handler
 *
 * Handles all /api/auth/* routes for OIDC authentication.
 */

import { handlers } from '@/lib/icefuse-auth'

export const { GET, POST } = handlers
