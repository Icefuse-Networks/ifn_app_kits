"use client";

import { SessionProvider } from "next-auth/react";
import { type ReactNode } from "react";

interface ProvidersProps {
  children: ReactNode;
}

/**
 * Global Providers Component
 *
 * Wraps the app with necessary providers:
 * - SessionProvider: NextAuth session management
 */
export function Providers({ children }: ProvidersProps) {
  return (
    <SessionProvider>
      {children}
    </SessionProvider>
  );
}
