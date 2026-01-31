/**
 * Dashboard Page - Admin Landing
 *
 * Protected route for admin users.
 * Admin verification is done in the layout via Auth Server API.
 */

import { Package, Settings, BarChart2, Shield } from 'lucide-react'
import Link from 'next/link'

export default function DashboardPage() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-2">
          Kit Manager Dashboard
        </h1>
        <p className="text-[var(--text-secondary)]">
          Manage Rust server kits, configurations, and permissions.
        </p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Kits Card */}
        <Link
          href="/dashboard/kits"
          className="group p-6 rounded-xl transition-all duration-300 hover:scale-[1.02]"
          style={{
            background: 'var(--glass-bg)',
            border: '1px solid var(--glass-border)',
          }}
        >
          <div
            className="w-12 h-12 rounded-lg flex items-center justify-center mb-4"
            style={{ background: 'var(--accent-primary)/20' }}
          >
            <Package className="w-6 h-6 text-[var(--accent-primary)]" />
          </div>
          <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2 group-hover:text-[var(--accent-primary)] transition-colors">
            Manage Kits
          </h3>
          <p className="text-sm text-[var(--text-secondary)]">
            View, edit, and create kit configurations for all servers.
          </p>
        </Link>

        {/* Analytics Card */}
        <Link
          href="/dashboard/analytics"
          className="group p-6 rounded-xl transition-all duration-300 hover:scale-[1.02]"
          style={{
            background: 'var(--glass-bg)',
            border: '1px solid var(--glass-border)',
          }}
        >
          <div
            className="w-12 h-12 rounded-lg flex items-center justify-center mb-4"
            style={{ background: 'var(--status-success)/20' }}
          >
            <BarChart2 className="w-6 h-6 text-[var(--status-success)]" />
          </div>
          <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2 group-hover:text-[var(--status-success)] transition-colors">
            Analytics
          </h3>
          <p className="text-sm text-[var(--text-secondary)]">
            View kit usage statistics, trends, and popularity.
          </p>
        </Link>

        {/* Clans Card */}
        <Link
          href="/dashboard/clans"
          className="group p-6 rounded-xl transition-all duration-300 hover:scale-[1.02]"
          style={{
            background: 'var(--glass-bg)',
            border: '1px solid var(--glass-border)',
          }}
        >
          <div
            className="w-12 h-12 rounded-lg flex items-center justify-center mb-4"
            style={{ background: 'var(--status-warning)/20' }}
          >
            <Shield className="w-6 h-6 text-[var(--status-warning)]" />
          </div>
          <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2 group-hover:text-[var(--status-warning)] transition-colors">
            Clans
          </h3>
          <p className="text-sm text-[var(--text-secondary)]">
            Manage clans, perks, and banned names.
          </p>
        </Link>

        {/* Settings Card */}
        <Link
          href="/dashboard/settings"
          className="group p-6 rounded-xl transition-all duration-300 hover:scale-[1.02]"
          style={{
            background: 'var(--glass-bg)',
            border: '1px solid var(--glass-border)',
          }}
        >
          <div
            className="w-12 h-12 rounded-lg flex items-center justify-center mb-4"
            style={{ background: 'var(--text-tertiary)/20' }}
          >
            <Settings className="w-6 h-6 text-[var(--text-tertiary)]" />
          </div>
          <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2 group-hover:text-[var(--text-primary)] transition-colors">
            Settings
          </h3>
          <p className="text-sm text-[var(--text-secondary)]">
            Configure application preferences and permissions.
          </p>
        </Link>
      </div>
    </div>
  )
}
