/**
 * Banned Clan Names Management Page
 *
 * Admin page for managing banned clan name patterns.
 */

'use client'

import { useState, useEffect } from 'react'
import { ArrowLeft, Plus, Ban, Trash2, Code, Check, X } from 'lucide-react'
import Link from 'next/link'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Button, IconButton } from '@/components/ui/Button'
import { Loading } from '@/components/ui/Loading'
import { EmptyState } from '@/components/ui/EmptyState'
import { Badge } from '@/components/ui/Badge'
import { Alert } from '@/components/ui/Alert'

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
        <Button onClick={() => setShowCreateModal(true)} icon={<Plus />}>
          Add Pattern
        </Button>
      </div>

      {/* Test Tag */}
      <div
        className="mb-6 p-4 rounded-xl"
        style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}
      >
        <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-3">Test a Tag</h3>
        <div className="flex items-center gap-3">
          <Input
            value={testTag}
            onChange={(e) => {
              setTestTag(e.target.value)
              setTestResult(null)
            }}
            placeholder="Enter a clan tag to test..."
            maxLength={10}
            className="flex-1"
          />
          <Button
            onClick={testTagBanned}
            disabled={!testTag.trim() || testing}
            loading={testing}
            variant="outline"
          >
            Check
          </Button>
          {testResult && (
            <Badge variant={testResult.isBanned ? 'error' : 'success'}>
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
            </Badge>
          )}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <Alert variant="error" onClose={() => setError(null)} className="mb-6">
          {error}
        </Alert>
      )}

      {/* Create Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Add Banned Pattern"
        size="md"
      >
        <div className="space-y-5">
          <Input
            label="Pattern"
            value={newPattern}
            onChange={(e) => setNewPattern(e.target.value)}
            placeholder={newIsRegex ? 'e.g., ^admin.*$' : 'e.g., admin'}
            maxLength={50}
            required
            className="font-mono"
          />

          <div className="flex items-center gap-3">
            <Button
              variant={newIsRegex ? 'primary' : 'outline'}
              onClick={() => setNewIsRegex(!newIsRegex)}
              icon={<Code />}
              size="sm"
            >
              Regex
            </Button>
            <span className="text-sm text-[var(--text-muted)]">
              {newIsRegex
                ? 'Pattern is a regular expression'
                : 'Pattern is an exact match (case-insensitive)'}
            </span>
          </div>

          <Input
            label="Reason (optional)"
            value={newReason}
            onChange={(e) => setNewReason(e.target.value)}
            placeholder="Why is this pattern banned?"
            maxLength={200}
          />
        </div>

        <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-[var(--border-secondary)]">
          <Button variant="ghost" onClick={() => setShowCreateModal(false)}>
            Cancel
          </Button>
          <Button
            onClick={createBannedName}
            disabled={!newPattern.trim() || creating}
            loading={creating}
          >
            Add Pattern
          </Button>
        </div>
      </Modal>

      {/* Loading State */}
      {loading ? (
        <Loading />
      ) : bannedNames.length === 0 ? (
        /* Empty State */
        <EmptyState
          icon={<Ban />}
          title="No Banned Patterns"
          description="Add patterns to prevent certain clan tags from being used."
          action={
            <Button onClick={() => setShowCreateModal(true)} icon={<Plus />}>
              Add Pattern
            </Button>
          }
        />
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
                    <Badge variant={banned.isRegex ? 'primary' : 'neutral'}>
                      {banned.isRegex ? 'Regex' : 'Exact'}
                    </Badge>
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
                      <Button variant="danger" size="sm" onClick={() => deleteBannedName(banned.id)}>
                        Confirm
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setDeleteConfirm(null)}>
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <IconButton
                      icon={<Trash2 />}
                      onClick={() => setDeleteConfirm(banned.id)}
                      title="Delete pattern"
                      variant="danger"
                    />
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
