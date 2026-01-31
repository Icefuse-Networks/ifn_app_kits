/**
 * Banned Clan Names Management Page
 *
 * Admin page for managing banned clan name patterns.
 */

'use client'

import { useState, useEffect } from 'react'
import { ArrowLeft, Plus, Ban, Trash2, AlertCircle, Code, Check, X } from 'lucide-react'
import Link from 'next/link'

interface BannedName {
  id: string
  pattern: string
  isRegex: boolean
  reason: string | null
  createdBy: string
  createdAt: string
}

export default function BannedNamesPage() {
  const [bannedNames, setBannedNames] = useState<BannedName[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Create modal state
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newPattern, setNewPattern] = useState('')
  const [newIsRegex, setNewIsRegex] = useState(false)
  const [newReason, setNewReason] = useState('')

  // Test modal state
  const [testTag, setTestTag] = useState('')
  const [testResult, setTestResult] = useState<{ tag: string; isBanned: boolean } | null>(null)
  const [testing, setTesting] = useState(false)

  // Delete confirm state
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  useEffect(() => {
    fetchBannedNames()
  }, [])

  async function fetchBannedNames() {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/admin/clans/banned-names', {
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error('Failed to fetch banned names')
      }

      const data = await response.json()
      setBannedNames(data)
    } catch (err) {
      console.error('Failed to fetch banned names:', err)
      setError(err instanceof Error ? err.message : 'Failed to load banned names')
    } finally {
      setLoading(false)
    }
  }

  async function createBannedName() {
    if (!newPattern.trim()) return

    setCreating(true)
    setError(null)

    try {
      const response = await fetch('/api/admin/clans/banned-names', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pattern: newPattern.trim(),
          isRegex: newIsRegex,
          reason: newReason.trim() || undefined,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to create banned name')
      }

      const newBannedName = await response.json()
      setBannedNames((prev) => [newBannedName, ...prev])

      // Reset form
      setNewPattern('')
      setNewIsRegex(false)
      setNewReason('')
      setShowCreateModal(false)
    } catch (err) {
      console.error('Failed to create banned name:', err)
      setError(err instanceof Error ? err.message : 'Failed to create banned name')
    } finally {
      setCreating(false)
    }
  }

  async function deleteBannedName(id: string) {
    try {
      const response = await fetch(`/api/admin/clans/banned-names/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error('Failed to delete banned name')
      }

      setBannedNames((prev) => prev.filter((b) => b.id !== id))
      setDeleteConfirm(null)
    } catch (err) {
      console.error('Failed to delete banned name:', err)
      setError(err instanceof Error ? err.message : 'Failed to delete banned name')
    }
  }

  async function testTagBanned() {
    if (!testTag.trim()) return

    setTesting(true)
    setTestResult(null)

    try {
      const response = await fetch('/api/admin/clans/banned-names/check', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tag: testTag.trim() }),
      })

      if (!response.ok) {
        throw new Error('Failed to check tag')
      }

      const result = await response.json()
      setTestResult(result)
    } catch (err) {
      console.error('Failed to check tag:', err)
      setError(err instanceof Error ? err.message : 'Failed to check tag')
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      {/* Page Header */}
      <div className="flex items-center gap-4 mb-8">
        <Link
          href="/dashboard/clans"
          className="p-2 rounded-lg transition-colors hover:bg-[var(--bg-card-hover)]"
          style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}
        >
          <ArrowLeft className="w-5 h-5 text-[var(--text-secondary)]" />
        </Link>
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-1">Banned Clan Names</h1>
          <p className="text-[var(--text-secondary)]">
            Manage patterns that are not allowed for clan tags.
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors"
          style={{ background: 'var(--accent-primary)', color: 'var(--bg-root)' }}
        >
          <Plus className="w-4 h-4" />
          <span>Add Pattern</span>
        </button>
      </div>

      {/* Test Tag */}
      <div
        className="mb-6 p-4 rounded-xl"
        style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}
      >
        <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-3">Test a Tag</h3>
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={testTag}
            onChange={(e) => {
              setTestTag(e.target.value)
              setTestResult(null)
            }}
            placeholder="Enter a clan tag to test..."
            maxLength={10}
            className="flex-1 px-4 py-2 rounded-lg bg-[var(--bg-input)] border border-[var(--border-secondary)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)]"
          />
          <button
            onClick={testTagBanned}
            disabled={!testTag.trim() || testing}
            className="px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
            style={{ background: 'var(--glass-bg-subtle)', border: '1px solid var(--glass-border)' }}
          >
            {testing ? 'Checking...' : 'Check'}
          </button>
          {testResult && (
            <div
              className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
                testResult.isBanned
                  ? 'bg-[var(--status-error)]/20 text-[var(--status-error)]'
                  : 'bg-[var(--status-success)]/20 text-[var(--status-success)]'
              }`}
            >
              {testResult.isBanned ? (
                <>
                  <X className="w-4 h-4" />
                  <span>Banned</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Allowed</span>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div
          className="mb-6 p-4 rounded-lg flex items-start gap-3"
          style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
          }}
        >
          <AlertCircle className="w-5 h-5 text-[var(--status-error)] flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-[var(--status-error)] font-medium">{error}</p>
          </div>
          <button onClick={() => setError(null)} className="text-[var(--status-error)] hover:opacity-70">
            Dismiss
          </button>
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50"
          onClick={() => setShowCreateModal(false)}
        >
          <div
            className="w-full max-w-md rounded-xl p-8"
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-6">
              Add Banned Pattern
            </h2>

            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                  Pattern *
                </label>
                <input
                  type="text"
                  value={newPattern}
                  onChange={(e) => setNewPattern(e.target.value)}
                  placeholder={newIsRegex ? 'e.g., ^admin.*$' : 'e.g., admin'}
                  maxLength={50}
                  className="w-full px-4 py-3 rounded-lg bg-[var(--bg-input)] border border-[var(--border-secondary)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)] font-mono"
                />
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setNewIsRegex(!newIsRegex)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg font-medium transition-colors border ${
                    newIsRegex
                      ? 'bg-[var(--accent-primary)]/20 border-[var(--accent-primary)] text-[var(--accent-primary)]'
                      : 'border-[var(--border-secondary)] text-[var(--text-secondary)]'
                  }`}
                >
                  <Code className="w-4 h-4" />
                  <span>Regex</span>
                </button>
                <span className="text-sm text-[var(--text-muted)]">
                  {newIsRegex
                    ? 'Pattern is a regular expression'
                    : 'Pattern is an exact match (case-insensitive)'}
                </span>
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                  Reason (optional)
                </label>
                <input
                  type="text"
                  value={newReason}
                  onChange={(e) => setNewReason(e.target.value)}
                  placeholder="Why is this pattern banned?"
                  maxLength={200}
                  className="w-full px-4 py-3 rounded-lg bg-[var(--bg-input)] border border-[var(--border-secondary)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)]"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-[var(--border-secondary)]">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-5 py-2.5 rounded-lg font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={createBannedName}
                disabled={!newPattern.trim() || creating}
                className="px-5 py-2.5 rounded-lg font-medium transition-colors disabled:opacity-50"
                style={{ background: 'var(--accent-primary)', color: 'var(--bg-root)' }}
              >
                {creating ? 'Adding...' : 'Add Pattern'}
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
      ) : bannedNames.length === 0 ? (
        /* Empty State */
        <div
          className="rounded-xl p-12 text-center"
          style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}
        >
          <Ban className="w-12 h-12 mx-auto mb-4 text-[var(--text-muted)]" />
          <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
            No Banned Patterns
          </h3>
          <p className="text-[var(--text-secondary)] mb-6">
            Add patterns to prevent certain clan tags from being used.
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors"
            style={{ background: 'var(--accent-primary)', color: 'var(--bg-root)' }}
          >
            <Plus className="w-4 h-4" />
            <span>Add Pattern</span>
          </button>
        </div>
      ) : (
        /* Banned Names List */
        <div className="space-y-4">
          {bannedNames.map((banned) => (
            <div
              key={banned.id}
              className="rounded-xl p-5 transition-colors"
              style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}
            >
              <div className="flex items-start gap-4">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{
                    backgroundColor: banned.isRegex
                      ? 'rgba(147, 51, 234, 0.2)'
                      : 'rgba(239, 68, 68, 0.2)',
                  }}
                >
                  {banned.isRegex ? (
                    <Code className="w-5 h-5" style={{ color: 'rgb(147, 51, 234)' }} />
                  ) : (
                    <Ban className="w-5 h-5 text-[var(--status-error)]" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <code className="text-lg font-mono text-[var(--text-primary)]">
                      {banned.pattern}
                    </code>
                    <span
                      className="text-xs px-2 py-0.5 rounded-full"
                      style={{
                        backgroundColor: banned.isRegex
                          ? 'rgba(147, 51, 234, 0.2)'
                          : 'var(--bg-input)',
                        color: banned.isRegex ? 'rgb(147, 51, 234)' : 'var(--text-muted)',
                      }}
                    >
                      {banned.isRegex ? 'Regex' : 'Exact'}
                    </span>
                  </div>

                  {banned.reason && (
                    <p className="text-sm text-[var(--text-secondary)] mb-2">{banned.reason}</p>
                  )}

                  <p className="text-xs text-[var(--text-muted)]">
                    Added {new Date(banned.createdAt).toLocaleDateString()} by {banned.createdBy}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {deleteConfirm === banned.id ? (
                    <>
                      <button
                        onClick={() => deleteBannedName(banned.id)}
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
                      onClick={() => setDeleteConfirm(banned.id)}
                      className="p-2 rounded-lg hover:bg-[var(--status-error)]/10 text-[var(--text-muted)] hover:text-[var(--status-error)] transition-colors"
                      title="Delete pattern"
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
    </div>
  )
}
