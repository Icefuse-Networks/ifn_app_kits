/**
 * NextAuth Route Handler
 *
 * Handles all /api/auth/* routes for OIDC authentication.
 */

import { handlers } from '@/lib/auth/provider'

export const { GET, POST } = handlers
