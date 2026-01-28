/**
 * NextAuth Type Extensions
 *
 * Extends the default NextAuth types to include custom session fields:
 *
 * Platform IDs (from Auth Server):
 * - steamId: Steam profile ID (64-bit)
 * - steamUsername: Steam display name
 *
 * Note: Admin status is NOT stored in session.
 * Admin checks are done via Auth Server API at request time.
 */

import 'next-auth'
import 'next-auth/jwt'

declare module 'next-auth' {
  interface User {
    id: string
    name?: string | null
    email?: string | null
    image?: string | null
    // Platform IDs
    steamId?: string
    steamUsername?: string
  }

  interface Session {
    user: {
      id: string
      name?: string | null
      email?: string | null
      image?: string | null
      // Platform IDs
      steamId?: string
      steamUsername?: string
    }
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    sub?: string
    name?: string | null
    email?: string | null
    picture?: string | null
    // Platform IDs
    steamId?: string
    steamUsername?: string
    // Cache control
    refreshedAt?: number
  }
}
