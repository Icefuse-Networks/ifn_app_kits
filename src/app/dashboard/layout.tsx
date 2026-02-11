/**
 * Dashboard Layout - Admin Access Verification
 *
 * This layout wraps all dashboard pages and verifies admin access
 * via the Auth Server API before rendering.
 *
 * Pattern copied from PayNow store for consistency.
 */

import { redirect } from 'next/navigation'
import { auth } from '@/lib/icefuse-auth'
import { requireAdmin } from '@icefuse/auth'
import { Header } from '@/components/global/Header'
import { Footer } from '@/components/global/Footer'
import { SidebarProvider } from '@/contexts/SidebarContext'
import Sidebar from './Sidebar'
import DashboardContent from './DashboardContent'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()

  if (!session?.user) {
    // Redirect to OIDC signin flow
    redirect('/api/auth/signin/icefuse?callbackUrl=/dashboard')
  }

  try {
    requireAdmin(session)
  } catch {
    redirect('/?error=AccessDenied')
  }

  return (
    <SidebarProvider>
      <div className="portal-root">
        <Header />
        <Sidebar />
        <DashboardContent>{children}</DashboardContent>
        <Footer />
      </div>
    </SidebarProvider>
  )
}
