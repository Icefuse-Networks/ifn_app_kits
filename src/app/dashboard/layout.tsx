/**
 * Dashboard Layout - Admin Access Verification
 *
 * This layout wraps all dashboard pages and verifies admin access
 * via the Auth Server API before rendering.
 *
 * Pattern copied from PayNow store for consistency.
 */

import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { requireAdmin } from '@/services/admin-auth'
import { Header } from '@/components/global/Header'
import { Footer } from '@/components/global/Footer'
import Sidebar from './Sidebar'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // SECURITY: Get session on server
  const session = await getServerSession(authOptions())

  // If no session, redirect to sign in
  if (!session?.user) {
    redirect('/')
  }

  // SECURITY: Verify admin access via Auth Server API
  try {
    await requireAdmin(session)
  } catch {
    // Not an admin - redirect to landing page with error
    redirect('/?error=AccessDenied')
  }

  // User is authenticated admin - render dashboard
  return (
    <div className="portal-root">
      <Header />
      <Sidebar />
      <main className="pt-20 pl-56 min-h-screen">
        {children}
      </main>
      <Footer />
    </div>
  )
}
