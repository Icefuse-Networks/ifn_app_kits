/**
 * Clans Management Page
 *
 * Admin page for viewing and managing all clans.
 * Includes search, filtering, and CRUD operations.
 */

'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  ArrowLeft,
  Plus,
  Users,
  Shield,
  Trash2,
  AlertCircle,
  Search,
  ChevronRight,
  Crown,
  Ban,
  Gift,
} from 'lucide-react'
import Link from 'next/link'
import { getLevelFromXP, getPrestigeRank } from '@/types/clans'

interface ClanListItem {
  id: string
  tag: string
  description: string | null
  tagColor: string
  ownerId: string
  flags: number
  version: number
  createdAt: string
  updatedAt: string
  _count: {
    members: number
    invites: number
    applications: number
  }
  stats: {
    totalXP: number
    pvpKills: number
  } | null
  prestige: {
    prestigePoints: number
  } | null
}

interface ClanListResponse {
  data: ClanListItem[]
  total: number
  page: number
  limit: number
  hasMore: boolean
}

export default function ClansPage() {
  const [clans, setClans] = useState<ClanListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [hasMore, setHasMore] = useState(false)

  // Create modal state
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newTag, setNewTag] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [newOwnerId, setNewOwnerId] = useState('')
  const [newTagColor, setNewTagColor] = useState('5AF3F3')

  // Delete confirm state
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  const fetchClans = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '50',
      })
      if (search) {
        params.set('search', search)
      }

      const response = await fetch(`/api/admin/clans?${params}`, {
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error('Failed to fetch clans')
      }

      const data: ClanListResponse = await response.json()
      setClans(data.data)
      setTotal(data.total)
      setHasMore(data.hasMore)
    } catch (err) {
      console.error('Failed to fetch clans:', err)
      setError(err instanceof Error ? err.message : 'Failed to load clans')
    } finally {
      setLoading(false)
    }
  }, [page, search])

  useEffect(() => {
    fetchClans()
  }, [fetchClans])

  async function createClan() {
    if (!newTag.trim() || !newOwnerId.trim()) return

    setCreating(true)
    setError(null)

    try {
      const response = await fetch('/api/admin/clans', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tag: newTag.trim(),
          description: newDescription.trim() || undefined,
          ownerId: newOwnerId.trim(),
          tagColor: newTagColor,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to create clan')
      }

      // Refresh list
      await fetchClans()

      // Reset form
      setNewTag('')
      setNewDescription('')
      setNewOwnerId('')
      setNewTagColor('5AF3F3')
      setShowCreateModal(false)
    } catch (err) {
      console.error('Failed to create clan:', err)
      setError(err instanceof Error ? err.message : 'Failed to create clan')
    } finally {
      setCreating(false)
    }
  }

  async function deleteClan(clanId: string) {
    try {
      const response = await fetch(`/api/admin/clans/${clanId}`, {
        method: 'DELETE',
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error('Failed to delete clan')
      }

      setClans((prev) => prev.filter((c) => c.id !== clanId))
      setTotal((prev) => prev - 1)
      setDeleteConfirm(null)
    } catch (err) {
      console.error('Failed to delete clan:', err)
      setError(err instanceof Error ? err.message : 'Failed to delete clan')
    }
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    setPage(1)
    fetchClans()
  }

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
          <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-1">Clans</h1>
          <p className="text-[var(--text-secondary)]">
            Manage clans, banned names, and perks definitions.
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors"
          style={{ background: 'var(--accent-primary)', color: 'var(--bg-root)' }}
        >
          <Plus className="w-4 h-4" />
          <span>New Clan</span>
        </button>
      </div>

      {/* Sub-navigation */}
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/dashboard/clans/banned-names"
          className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors border"
          style={{
            background: 'var(--glass-bg)',
            borderColor: 'var(--glass-border)',
            color: 'var(--text-primary)',
          }}
        >
          <Ban className="w-4 h-4" />
          <span>Banned Names</span>
        </Link>
        <Link
          href="/dashboard/clans/perks"
          className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors border"
          style={{
            background: 'var(--glass-bg)',
            borderColor: 'var(--glass-border)',
            color: 'var(--text-primary)',
          }}
        >
          <Gift className="w-4 h-4" />
          <span>Perks</span>
        </Link>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-muted)]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by tag or description..."
            className="w-full pl-10 pr-4 py-3 rounded-lg bg-[var(--bg-input)] border border-[var(--border-secondary)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)]"
          />
        </div>
      </form>

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

      {/* Create Clan Modal */}
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
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-6">Create Clan</h2>

            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                  Tag *
                </label>
                <input
                  type="text"
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  placeholder="e.g., IFN"
                  maxLength={10}
                  className="w-full px-4 py-3 rounded-lg bg-[var(--bg-input)] border border-[var(--border-secondary)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)]"
                />
                <p className="text-xs text-[var(--text-muted)] mt-1">2-10 characters, alphanumeric and underscores</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                  Owner Steam ID *
                </label>
                <input
                  type="text"
                  value={newOwnerId}
                  onChange={(e) => setNewOwnerId(e.target.value)}
                  placeholder="e.g., 76561198012345678"
                  maxLength={17}
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
                  placeholder="Clan description"
                  maxLength={200}
                  className="w-full px-4 py-3 rounded-lg bg-[var(--bg-input)] border border-[var(--border-secondary)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                  Tag Color
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    value={newTagColor}
                    onChange={(e) => setNewTagColor(e.target.value.replace('#', ''))}
                    placeholder="5AF3F3"
                    maxLength={6}
                    className="flex-1 px-4 py-3 rounded-lg bg-[var(--bg-input)] border border-[var(--border-secondary)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)] font-mono"
                  />
                  <div
                    className="w-12 h-12 rounded-lg border border-[var(--border-secondary)]"
                    style={{ backgroundColor: `#${newTagColor}` }}
                  />
                </div>
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
                onClick={createClan}
                disabled={!newTag.trim() || !newOwnerId.trim() || creating}
                className="px-5 py-2.5 rounded-lg font-medium transition-colors disabled:opacity-50"
                style={{ background: 'var(--accent-primary)', color: 'var(--bg-root)' }}
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
      ) : clans.length === 0 ? (
        /* Empty State */
        <div
          className="rounded-xl p-12 text-center"
          style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}
        >
          <Shield className="w-12 h-12 mx-auto mb-4 text-[var(--text-muted)]" />
          <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
            {search ? 'No clans found' : 'No Clans Yet'}
          </h3>
          <p className="text-[var(--text-secondary)] mb-6">
            {search
              ? 'Try adjusting your search terms.'
              : 'Create your first clan to get started.'}
          </p>
          {!search && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors"
              style={{ background: 'var(--accent-primary)', color: 'var(--bg-root)' }}
            >
              <Plus className="w-4 h-4" />
              <span>Create Clan</span>
            </button>
          )}
        </div>
      ) : (
        /* Clans List */
        <div className="space-y-4">
          <p className="text-sm text-[var(--text-muted)] mb-4">
            Showing {clans.length} of {total} clans
          </p>

          {clans.map((clan) => {
            const level = clan.stats ? getLevelFromXP(clan.stats.totalXP) : 1
            const prestigeRank = clan.prestige ? getPrestigeRank(clan.prestige.prestigePoints) : 'Unranked'

            return (
              <div
                key={clan.id}
                className="rounded-xl p-6 transition-colors hover:bg-[var(--bg-card-hover)]"
                style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}
              >
                <div className="flex items-start gap-4">
                  {/* Clan Tag Badge */}
                  <div
                    className="w-16 h-16 rounded-lg flex items-center justify-center flex-shrink-0 font-bold text-lg"
                    style={{
                      backgroundColor: `#${clan.tagColor}20`,
                      color: `#${clan.tagColor}`,
                    }}
                  >
                    {clan.tag}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-[var(--text-primary)]">
                        [{clan.tag}]
                      </h3>
                      <span className="text-xs px-2 py-1 rounded-full bg-[var(--bg-input)] text-[var(--text-muted)]">
                        Level {level}
                      </span>
                      <span
                        className="text-xs px-2 py-1 rounded-full"
                        style={{
                          backgroundColor:
                            prestigeRank === 'Immortal'
                              ? 'rgba(255, 215, 0, 0.2)'
                              : prestigeRank === 'Unranked'
                                ? 'var(--bg-input)'
                                : 'rgba(90, 243, 243, 0.2)',
                          color:
                            prestigeRank === 'Immortal'
                              ? '#FFD700'
                              : prestigeRank === 'Unranked'
                                ? 'var(--text-muted)'
                                : 'var(--accent-primary)',
                        }}
                      >
                        {prestigeRank}
                      </span>
                    </div>

                    {clan.description && (
                      <p className="text-sm text-[var(--text-secondary)] mb-3">{clan.description}</p>
                    )}

                    <div className="flex items-center gap-4 text-sm text-[var(--text-muted)]">
                      <span className="flex items-center gap-1">
                        <Users className="w-4 h-4" />
                        {clan._count.members} members
                      </span>
                      <span className="flex items-center gap-1">
                        <Crown className="w-4 h-4" />
                        {clan.ownerId}
                      </span>
                      <span>Created {new Date(clan.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Link
                      href={`/dashboard/clans/${clan.id}`}
                      className="p-2 rounded-lg hover:bg-[var(--bg-card-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                      title="View details"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </Link>

                    {deleteConfirm === clan.id ? (
                      <>
                        <button
                          onClick={() => deleteClan(clan.id)}
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
                        onClick={() => setDeleteConfirm(clan.id)}
                        className="p-2 rounded-lg hover:bg-[var(--status-error)]/10 text-[var(--text-muted)] hover:text-[var(--status-error)] transition-colors"
                        title="Disband clan"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}

          {/* Pagination */}
          {(page > 1 || hasMore) && (
            <div className="flex items-center justify-center gap-4 pt-6">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
                style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}
              >
                Previous
              </button>
              <span className="text-[var(--text-secondary)]">Page {page}</span>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={!hasMore}
                className="px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
                style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
