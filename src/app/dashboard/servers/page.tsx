/**
 * Servers Management Page
 *
 * List, create, edit, and delete game server configurations.
 */

import { Server, Plus, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function ServersPage() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
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
            Game Servers
          </h1>
          <p className="text-[var(--text-secondary)]">
            Manage game server configurations and kit assignments.
          </p>
        </div>
        <button
          className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors"
          style={{
            background: 'var(--accent-primary)',
            color: 'var(--bg-root)',
          }}
        >
          <Plus className="w-4 h-4" />
          Add Server
        </button>
      </div>

      {/* Empty State */}
      <div
        className="rounded-xl p-12 text-center"
        style={{
          background: 'var(--glass-bg)',
          border: '1px solid var(--glass-border)',
        }}
      >
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
          style={{ background: 'var(--status-success)/10' }}
        >
          <Server className="w-8 h-8 text-[var(--status-success)]" />
        </div>
        <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
          No Servers Configured
        </h3>
        <p className="text-[var(--text-secondary)] mb-6 max-w-md mx-auto">
          Add your first game server to assign kit configurations and manage
          server-specific settings.
        </p>
        <button
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors"
          style={{
            background: 'var(--accent-primary)',
            color: 'var(--bg-root)',
          }}
        >
          <Plus className="w-4 h-4" />
          Add Server
        </button>
      </div>
    </div>
  )
}
