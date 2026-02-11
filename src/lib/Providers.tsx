'use client'

import { IcefuseAuthProvider } from '@icefuse/auth/components'
import { type ReactNode } from 'react'

interface ProvidersProps {
  children: ReactNode
}

/**
 * Global Providers Component
 *
 * Wraps the app with Icefuse auth session management.
 */
export function Providers({ children }: ProvidersProps) {
  return (
    <IcefuseAuthProvider>
      {children}
    </IcefuseAuthProvider>
  )
}
