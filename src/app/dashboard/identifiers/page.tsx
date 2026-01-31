/**
 * Server Identifiers Management Page
 *
 * Create and manage server identifiers for plugin analytics.
 * Each identifier has a name and a hashed ID that plugins use.
 */

'use client'

import { useState, useEffect } from 'react'
import { ArrowLeft, Plus, Copy, Trash2, Server, Check, AlertCircle } from 'lucide-react'
import Link from 'next/link'

interface ServerIdentifier {
  id: string
  name: string
  hashedId: string
  description: string | null
  createdAt: string
  updatedAt: string
  _count: {
    usageEvents: number
  }
}

export default function IdentifiersPage() {
  const [identifiers, setIdentifiers] = useState<ServerIdentifier[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  useEffect(() => {
    fetchIdentifiers()
  }, [])

  async function fetchIdentifiers() {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/identifiers', {
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error('Failed to fetch identifiers')
      }

      const data = await response.json()
      setIdentifiers(data)
    } catch (err) {
      console.error('Failed to fetch identifiers:', err)
      setError(err instanceof Error ? err.message : 'Failed to load identifiers')
    } finally {
      setLoading(false)
    }
  }

  async function createIdentifier() {
    if (!newName.trim()) return

    setCreating(true)
    setError(null)

    try {
      const response = await fetch('/api/identifiers', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName.trim(),
          description: newDescription.trim() || undefined,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to create identifier')
      }

      const newIdentifier = await response.json()
      setIdentifiers((prev) => [{ ...newIdentifier, _count: { usageEvents: 0 } }, ...prev])
      setNewName('')
      setNewDescription('')
      setShowCreateForm(false)
    } catch (err) {
      console.error('Failed to create identifier:', err)
      setError(err instanceof Error ? err.message : 'Failed to create identifier')
    } finally {
      setCreating(false)
    }
  }

  async function deleteIdentifier(id: string) {
    try {
      const response = await fetch(`/api/identifiers/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error('Failed to delete identifier')
      }

      setIdentifiers((prev) => prev.filter((i) => i.id !== id))
      setDeleteConfirm(null)
    } catch (err) {
      console.error('Failed to delete identifier:', err)
      setError(err instanceof Error ? err.message : 'Failed to delete identifier')
    }
  }

  async function copyHashedId(hashedId: string) {
    try {
      await navigator.clipboard.writeText(hashedId)
      setCopiedId(hashedId)
      setTimeout(() => setCopiedId(null), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      {/* Page Header */}
      <div className="flex items-center gap-4 mb-8">
        <Link
          href="/dashboard/settings"
          className="p-2 rounded-lg transition-colors hover:bg-[var(--bg-card-hover)]"
          style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}
        >
          <ArrowLeft className="w-5 h-5 text-[var(--text-secondary)]" />
        </Link>
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-1">
            Server Identifiers
          </h1>
          <p className="text-[var(--text-secondary)]">
            Create identifiers for your game server plugins to report analytics.
          </p>
        </div>
        <button
          onClick={() => setShowCreateForm(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors"
          style={{
            background: 'var(--accent-primary)',
            color: 'var(--bg-root)',
          }}
        >
          <Plus className="w-4 h-4" />
          <span>New Identifier</span>
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div
          className="mb-6 p-4 rounded-lg flex items-start gap-3"
          style={{
            background: 'var(--status-error)/10',
            border: '1px solid var(--status-error)/30',
          }}
        >
          <AlertCircle className="w-5 h-5 text-[var(--status-error)] flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-[var(--status-error)] font-medium">{error}</p>
          </div>
          <button
            onClick={() => setError(null)}
            className="text-[var(--status-error)] hover:opacity-70"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Create Form Modal */}
      {showCreateForm && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50"
          onClick={() => setShowCreateForm(false)}
        >
          <div
            className="w-full max-w-md rounded-xl p-8"
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-6">
              Create Server Identifier
            </h2>

            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                  Name
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g., US Main 1"
                  className="w-full px-4 py-3 rounded-lg bg-[var(--bg-input)] border border-[var(--border-secondary)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                  Description (optional)
                </label>
                <input
                  type="text"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="e.g., Primary US server"
                  className="w-full px-4 py-3 rounded-lg bg-[var(--bg-input)] border border-[var(--border-secondary)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)]"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-[var(--border-secondary)]">
              <button
                onClick={() => setShowCreateForm(false)}
                className="px-5 py-2.5 rounded-lg font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={createIdentifier}
                disabled={!newName.trim() || creating}
                className="px-5 py-2.5 rounded-lg font-medium transition-colors disabled:opacity-50"
                style={{
                  background: 'var(--accent-primary)',
                  color: 'var(--bg-root)',
                }}
              >
                {creating ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-[var(--accent-primary)] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : identifiers.length === 0 ? (
        /* Empty State */
        <div
          className="rounded-xl p-12 text-center mb-6"
          style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}
        >
          <Server className="w-12 h-12 mx-auto mb-4 text-[var(--text-muted)]" />
          <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
            No Server Identifiers
          </h3>
          <p className="text-[var(--text-secondary)] mb-6">
            Create your first server identifier to start tracking analytics from your plugins.
          </p>
          <button
            onClick={() => setShowCreateForm(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors"
            style={{
              background: 'var(--accent-primary)',
              color: 'var(--bg-root)',
            }}
          >
            <Plus className="w-4 h-4" />
            <span>Create Identifier</span>
          </button>
        </div>
      ) : (
        /* Identifiers List */
        <div className="space-y-4">
          {identifiers.map((identifier) => (
            <div
              key={identifier.id}
              className="rounded-xl p-6 transition-colors"
              style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 bg-[var(--accent-primary)]/20">
                  <Server className="w-6 h-6 text-[var(--accent-primary)]" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-[var(--text-primary)]">
                      {identifier.name}
                    </h3>
                    <span className="text-xs px-2 py-1 rounded-full bg-[var(--bg-input)] text-[var(--text-muted)]">
                      {identifier._count.usageEvents.toLocaleString()} events
                    </span>
                  </div>

                  {identifier.description && (
                    <p className="text-sm text-[var(--text-secondary)] mb-4">
                      {identifier.description}
                    </p>
                  )}

                  <div className="flex items-center gap-3 mt-4">
                    <code className="px-4 py-2 rounded-lg text-sm font-mono bg-[var(--bg-input)] text-[var(--accent-primary)]">
                      {identifier.hashedId}
                    </code>
                    <button
                      onClick={() => copyHashedId(identifier.hashedId)}
                      className="p-2 rounded-lg hover:bg-[var(--bg-card-hover)] transition-colors"
                      title="Copy identifier"
                    >
                      {copiedId === identifier.hashedId ? (
                        <Check className="w-4 h-4 text-[var(--status-success)]" />
                      ) : (
                        <Copy className="w-4 h-4 text-[var(--text-muted)]" />
                      )}
                    </button>
                  </div>

                  <p className="text-xs text-[var(--text-muted)] mt-4">
                    Created {new Date(identifier.createdAt).toLocaleDateString()}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {deleteConfirm === identifier.id ? (
                    <>
                      <button
                        onClick={() => deleteIdentifier(identifier.id)}
                        className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                        style={{ background: 'var(--status-error)', color: 'white' }}
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(null)}
                        className="px-3 py-1.5 rounded-lg text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setDeleteConfirm(identifier.id)}
                      className="p-2 rounded-lg hover:bg-[var(--status-error)]/10 text-[var(--text-muted)] hover:text-[var(--status-error)] transition-colors"
                      title="Delete identifier"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Usage Instructions */}
      {!loading && (
        <div
          className="mt-10 rounded-xl p-6"
          style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}
        >
          <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
            Plugin Configuration
          </h3>
          <p className="text-sm text-[var(--text-secondary)] mb-5">
            Use the hashed ID in your plugin configuration to report analytics for this server:
          </p>
          <pre className="p-5 rounded-lg bg-[var(--bg-input)] overflow-x-auto">
            <code className="text-sm text-[var(--text-primary)] leading-relaxed">
{`{
  "Analytics": {
    "Enabled": true,
    "ApiBaseUrl": "https://kits.icefuse.com",
    "ApiToken": "ifn_kit_xxxxx",
    "ServerIdentifier": "${identifiers[0]?.hashedId || 'your_hashed_id'}"
  }
}`}
            </code>
          </pre>
        </div>
      )}
    </div>
  )
}
