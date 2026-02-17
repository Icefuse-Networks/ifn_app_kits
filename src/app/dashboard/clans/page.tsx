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
  ChevronRight,
  Crown,
  Ban,
  Gift,
} from 'lucide-react'
import Link from 'next/link'
import { getLevelFromXP, getPrestigeRank } from '@/types/clans'
import { Modal } from '@/components/ui/Modal'
import { Input, Textarea } from '@/components/ui/Input'
import { Button, IconButton } from '@/components/ui/Button'
import { SearchInput } from '@/components/ui/SearchInput'
import { Loading } from '@/components/ui/Loading'
import { EmptyState } from '@/components/ui/EmptyState'
import { SimplePagination } from '@/components/ui/Pagination'
import { Badge } from '@/components/ui/Badge'
import { Alert } from '@/components/ui/Alert'

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
        <Button onClick={() => setShowCreateModal(true)} icon={<Plus />}>
          New Clan
        </Button>
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
        <div className="max-w-md">
          <SearchInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by tag or description..."
          />
        </div>
      </form>

      {/* Error Message */}
      {error && (
        <Alert variant="error" onDismiss={() => setError(null)} className="mb-6">
          {error}
        </Alert>
      )}

      {/* Create Clan Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create Clan"
        size="md"
      >
        <div className="space-y-5">
          <Input
            label="Tag"
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            placeholder="e.g., IFN"
            maxLength={10}
            required
            helperText="2-10 characters, alphanumeric and underscores"
          />

          <Input
            label="Owner Steam ID"
            value={newOwnerId}
            onChange={(e) => setNewOwnerId(e.target.value)}
            placeholder="e.g., 76561198012345678"
            maxLength={17}
            required
          />

          <Input
            label="Description (optional)"
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            placeholder="Clan description"
            maxLength={200}
          />

          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
              Tag Color
            </label>
            <div className="flex items-center gap-3">
              <Input
                value={newTagColor}
                onChange={(e) => setNewTagColor(e.target.value.replace('#', ''))}
                placeholder="5AF3F3"
                maxLength={6}
                className="flex-1 font-mono"
              />
              <div
                className="w-12 h-12 rounded-lg border border-[var(--border-secondary)]"
                style={{ backgroundColor: `#${newTagColor}` }}
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-[var(--border-secondary)]">
          <Button variant="ghost" onClick={() => setShowCreateModal(false)}>
            Cancel
          </Button>
          <Button
            onClick={createClan}
            disabled={!newTag.trim() || !newOwnerId.trim() || creating}
            loading={creating}
          >
            Create
          </Button>
        </div>
      </Modal>

      {/* Loading State */}
      {loading ? (
        <Loading />
      ) : clans.length === 0 ? (
        /* Empty State */
        <EmptyState
          icon={<Shield />}
          title={search ? 'No clans found' : 'No Clans Yet'}
          description={search ? 'Try adjusting your search terms.' : 'Create your first clan to get started.'}
          action={
            !search ? {
              label: 'Create Clan',
              onClick: () => setShowCreateModal(true),
              icon: <Plus />,
            } : undefined
          }
        />
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
                      <Badge variant="secondary">Level {level}</Badge>
                      <Badge
                        variant={prestigeRank === 'Immortal' ? 'warning' : prestigeRank === 'Unranked' ? 'secondary' : 'primary'}
                      >
                        {prestigeRank}
                      </Badge>
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
                    <Link href={`/dashboard/clans/${clan.id}`}>
                      <IconButton icon={<ChevronRight />} title="View details" />
                    </Link>

                    {deleteConfirm === clan.id ? (
                      <>
                        <Button variant="error" size="sm" onClick={() => deleteClan(clan.id)}>
                          Confirm
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setDeleteConfirm(null)}>
                          Cancel
                        </Button>
                      </>
                    ) : (
                      <IconButton
                        icon={<Trash2 />}
                        onClick={() => setDeleteConfirm(clan.id)}
                        title="Disband clan"
                        variant="error"
                      />
                    )}
                  </div>
                </div>
              </div>
            )
          })}

          {/* Pagination */}
          {(page > 1 || hasMore) && (
            <SimplePagination
              currentPage={page}
              onPageChange={setPage}
              totalPages={hasMore ? page + 1 : page}
              className="pt-6"
            />
          )}
        </div>
      )}
    </div>
  )
}
