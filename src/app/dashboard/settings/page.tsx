/**
 * Settings Page
 *
 * Application settings and API token management.
 */

import { Settings, Key, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function SettingsPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      {/* Page Header */}
      <div className="flex items-center gap-4 mb-8">
        <Link
          href="/dashboard"
          className="p-2 rounded-lg transition-colors hover:bg-[var(--bg-card-hover)]"
          style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}
        >
          <ArrowLeft className="w-5 h-5 text-[var(--text-secondary)]" />
        </Link>
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-1">
            Settings
          </h1>
          <p className="text-[var(--text-secondary)]">
            Configure application preferences and API access.
          </p>
        </div>
      </div>

      {/* Settings Sections */}
      <div className="space-y-6">
        {/* API Tokens Section */}
        <Link
          href="/dashboard/tokens"
          className="block rounded-xl p-6 transition-all hover:scale-[1.01]"
          style={{
            background: 'var(--glass-bg)',
            border: '1px solid var(--glass-border)',
          }}
        >
          <div className="flex items-start gap-4">
            <div
              className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: 'var(--accent-primary)/20' }}
            >
              <Key className="w-6 h-6 text-[var(--accent-primary)]" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-1">
                API Tokens
              </h3>
              <p className="text-sm text-[var(--text-secondary)]">
                Create and manage API tokens for programmatic access to kit configurations.
                Tokens can be used by game server plugins to fetch kit data.
              </p>
            </div>
            <div className="text-[var(--text-muted)]">
              <ArrowLeft className="w-5 h-5 rotate-180" />
            </div>
          </div>
        </Link>

        {/* General Settings Section */}
        <div
          className="rounded-xl p-6"
          style={{
            background: 'var(--glass-bg)',
            border: '1px solid var(--glass-border)',
          }}
        >
          <div className="flex items-start gap-4">
            <div
              className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: 'var(--text-tertiary)/20' }}
            >
              <Settings className="w-6 h-6 text-[var(--text-tertiary)]" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-1">
                General Settings
              </h3>
              <p className="text-sm text-[var(--text-secondary)] mb-4">
                Application preferences and default configurations.
              </p>
              <p className="text-xs text-[var(--text-muted)] italic">
                Coming soon - additional settings will be available here.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
