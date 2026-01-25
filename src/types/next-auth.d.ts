/**
 * NextAuth Type Extensions
 *
 * Extends the default NextAuth types to include custom session data.
 */

import 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      name?: string | null
      email?: string | null
      image?: string | null
      steamId?: string
      steamUsername?: string
      rank?: string
    }
  }

  interface User {
    id: string
    name?: string | null
    email?: string | null
    image?: string | null
    steamId?: string
    steamUsername?: string
    rank?: string
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    sub?: string
    steamId?: string
    steamUsername?: string
    rank?: string
    refreshedAt?: number
  }
}
