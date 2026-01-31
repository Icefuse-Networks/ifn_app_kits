/**
 * Clan Perks Management Page
 *
 * Admin page for managing clan perk definitions.
 */

'use client'

import { useState, useEffect } from 'react'
import {
  ArrowLeft,
  Plus,
  Gift,
  Trash2,
  Edit3,
  AlertCircle,
  Sparkles,
  Users,
  Sword,
  Hammer,
  Coins,
  Heart,
} from 'lucide-react'
import Link from 'next/link'

const PRESTIGE_RANKS = ['Unranked', 'Bronze', 'Silver', 'Gold', 'Diamond', 'Obsidian', 'Immortal']

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  capacity: <Users className="w-5 h-5" />,
  resources: <Coins className="w-5 h-5" />,
  crafting: <Hammer className="w-5 h-5" />,
  combat: <Sword className="w-5 h-5" />,
  economy: <Coins className="w-5 h-5" />,
  social: <Heart className="w-5 h-5" />,
}

interface PerkDefinition {
  id: string
  key: string
  name: string
  description: string | null
  category: string
  levelRequired: number
  prestigeRequired: number
  effectType: string
  effectValue: number
  sortOrder: number
  isActive: boolean
  createdAt: string
  updatedAt: string
  _count: {
    clans: number
  }
}

export default function PerksPage() {
  const [perks, setPerks] = useState<PerkDefinition[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Create modal state
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newKey, setNewKey] = useState('')
  const [newName, setNewName] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [newCategory, setNewCategory] = useState('capacity')
  const [newLevelRequired, setNewLevelRequired] = useState(1)
  const [newPrestigeRequired, setNewPrestigeRequired] = useState(0)
  const [newEffectType, setNewEffectType] = useState<'bonus_percent' | 'flat_bonus' | 'unlock'>('bonus_percent')
  const [newEffectValue, setNewEffectValue] = useState(0)
  const [newSortOrder, setNewSortOrder] = useState(0)

  // Edit modal state
  const [editingPerk, setEditingPerk] = useState<PerkDefinition | null>(null)
  const [saving, setSaving] = useState(false)

  // Delete confirm state
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  useEffect(() => {
    fetchPerks()
  }, [])

  async function fetchPerks() {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/admin/clans/perks', {
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error('Failed to fetch perks')
      }

      const data = await response.json()
      setPerks(data)
    } catch (err) {
      console.error('Failed to fetch perks:', err)
      setError(err instanceof Error ? err.message : 'Failed to load perks')
    } finally {
      setLoading(false)
    }
  }

  async function createPerk() {
    if (!newKey.trim() || !newName.trim()) return

    setCreating(true)
    setError(null)

    try {
      const response = await fetch('/api/admin/clans/perks', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: newKey.trim(),
          name: newName.trim(),
          description: newDescription.trim() || undefined,
          category: newCategory,
          levelRequired: newLevelRequired,
          prestigeRequired: newPrestigeRequired,
          effectType: newEffectType,
          effectValue: newEffectValue,
          sortOrder: newSortOrder,
          isActive: true,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to create perk')
      }

      const newPerk = await response.json()
      setPerks((prev) => [...prev, { ...newPerk, _count: { clans: 0 } }])

      // Reset form
      resetCreateForm()
      setShowCreateModal(false)
    } catch (err) {
      console.error('Failed to create perk:', err)
      setError(err instanceof Error ? err.message : 'Failed to create perk')
    } finally {
      setCreating(false)
    }
  }

  function resetCreateForm() {
    setNewKey('')
    setNewName('')
    setNewDescription('')
    setNewCategory('capacity')
    setNewLevelRequired(1)
    setNewPrestigeRequired(0)
    setNewEffectType('bonus_percent')
    setNewEffectValue(0)
    setNewSortOrder(0)
  }

  async function updatePerk() {
    if (!editingPerk) return

    setSaving(true)
    setError(null)

    try {
      const response = await fetch(`/api/admin/clans/perks/${editingPerk.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editingPerk.name,
          description: editingPerk.description || undefined,
          category: editingPerk.category,
          levelRequired: editingPerk.levelRequired,
          prestigeRequired: editingPerk.prestigeRequired,
          effectType: editingPerk.effectType,
          effectValue: editingPerk.effectValue,
          sortOrder: editingPerk.sortOrder,
          isActive: editingPerk.isActive,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to update perk')
      }

      const updatedPerk = await response.json()
      setPerks((prev) => prev.map((p) => (p.id === updatedPerk.id ? { ...updatedPerk, _count: p._count } : p)))
      setEditingPerk(null)
    } catch (err) {
      console.error('Failed to update perk:', err)
      setError(err instanceof Error ? err.message : 'Failed to update perk')
    } finally {
      setSaving(false)
    }
  }

  async function deletePerk(id: string) {
    try {
      const response = await fetch(`/api/admin/clans/perks/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error('Failed to delete perk')
      }

      setPerks((prev) => prev.filter((p) => p.id !== id))
      setDeleteConfirm(null)
    } catch (err) {
      console.error('Failed to delete perk:', err)
      setError(err instanceof Error ? err.message : 'Failed to delete perk')
    }
  }

  // Group perks by category
  const groupedPerks = perks.reduce(
    (acc, perk) => {
      const cat = perk.category
      if (!acc[cat]) acc[cat] = []
      acc[cat].push(perk)
      return acc
    },
    {} as Record<string, PerkDefinition[]>
  )

  function formatEffectValue(perk: PerkDefinition) {
    switch (perk.effectType) {
      case 'bonus_percent':
        return `+${perk.effectValue}%`
      case 'flat_bonus':
        return `+${perk.effectValue}`
      case 'unlock':
        return 'Unlock'
      default:
        return perk.effectValue.toString()
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
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
          <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-1">Clan Perks</h1>
          <p className="text-[var(--text-secondary)]">
            Define perks that clans can unlock based on level and prestige.
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors"
          style={{ background: 'var(--accent-primary)', color: 'var(--bg-root)' }}
        >
          <Plus className="w-4 h-4" />
          <span>New Perk</span>
        </button>
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
            className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl p-8"
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-6">Create Perk</h2>

            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                    Key *
                  </label>
                  <input
                    type="text"
                    value={newKey}
                    onChange={(e) => setNewKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                    placeholder="e.g., member_capacity_1"
                    maxLength={50}
                    className="w-full px-4 py-3 rounded-lg bg-[var(--bg-input)] border border-[var(--border-secondary)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)] font-mono"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                    Name *
                  </label>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g., Member Capacity I"
                    maxLength={100}
                    className="w-full px-4 py-3 rounded-lg bg-[var(--bg-input)] border border-[var(--border-secondary)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                  Description
                </label>
                <textarea
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="What does this perk do?"
                  maxLength={500}
                  rows={2}
                  className="w-full px-4 py-3 rounded-lg bg-[var(--bg-input)] border border-[var(--border-secondary)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)] resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                    Category
                  </label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg bg-[var(--bg-input)] border border-[var(--border-secondary)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
                  >
                    <option value="capacity">Capacity</option>
                    <option value="resources">Resources</option>
                    <option value="crafting">Crafting</option>
                    <option value="combat">Combat</option>
                    <option value="economy">Economy</option>
                    <option value="social">Social</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                    Sort Order
                  </label>
                  <input
                    type="number"
                    value={newSortOrder}
                    onChange={(e) => setNewSortOrder(parseInt(e.target.value) || 0)}
                    min={0}
                    className="w-full px-4 py-3 rounded-lg bg-[var(--bg-input)] border border-[var(--border-secondary)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                    Level Required
                  </label>
                  <input
                    type="number"
                    value={newLevelRequired}
                    onChange={(e) => setNewLevelRequired(parseInt(e.target.value) || 1)}
                    min={1}
                    max={50}
                    className="w-full px-4 py-3 rounded-lg bg-[var(--bg-input)] border border-[var(--border-secondary)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                    Prestige Required
                  </label>
                  <select
                    value={newPrestigeRequired}
                    onChange={(e) => setNewPrestigeRequired(parseInt(e.target.value))}
                    className="w-full px-4 py-3 rounded-lg bg-[var(--bg-input)] border border-[var(--border-secondary)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
                  >
                    {PRESTIGE_RANKS.map((rank, idx) => (
                      <option key={rank} value={idx}>
                        {rank}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                    Effect Type
                  </label>
                  <select
                    value={newEffectType}
                    onChange={(e) => setNewEffectType(e.target.value as 'bonus_percent' | 'flat_bonus' | 'unlock')}
                    className="w-full px-4 py-3 rounded-lg bg-[var(--bg-input)] border border-[var(--border-secondary)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
                  >
                    <option value="bonus_percent">Bonus Percent</option>
                    <option value="flat_bonus">Flat Bonus</option>
                    <option value="unlock">Unlock</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                    Effect Value
                  </label>
                  <input
                    type="number"
                    value={newEffectValue}
                    onChange={(e) => setNewEffectValue(parseFloat(e.target.value) || 0)}
                    step={newEffectType === 'bonus_percent' ? 0.1 : 1}
                    className="w-full px-4 py-3 rounded-lg bg-[var(--bg-input)] border border-[var(--border-secondary)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-[var(--border-secondary)]">
              <button
                onClick={() => {
                  resetCreateForm()
                  setShowCreateModal(false)
                }}
                className="px-5 py-2.5 rounded-lg font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={createPerk}
                disabled={!newKey.trim() || !newName.trim() || creating}
                className="px-5 py-2.5 rounded-lg font-medium transition-colors disabled:opacity-50"
                style={{ background: 'var(--accent-primary)', color: 'var(--bg-root)' }}
              >
                {creating ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingPerk && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50"
          onClick={() => setEditingPerk(null)}
        >
          <div
            className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl p-8"
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-6">Edit Perk</h2>

            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                  Key (readonly)
                </label>
                <input
                  type="text"
                  value={editingPerk.key}
                  disabled
                  className="w-full px-4 py-3 rounded-lg bg-[var(--bg-input)] border border-[var(--border-secondary)] text-[var(--text-muted)] font-mono opacity-60"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                  Name
                </label>
                <input
                  type="text"
                  value={editingPerk.name}
                  onChange={(e) => setEditingPerk({ ...editingPerk, name: e.target.value })}
                  maxLength={100}
                  className="w-full px-4 py-3 rounded-lg bg-[var(--bg-input)] border border-[var(--border-secondary)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                  Description
                </label>
                <textarea
                  value={editingPerk.description || ''}
                  onChange={(e) => setEditingPerk({ ...editingPerk, description: e.target.value || null })}
                  maxLength={500}
                  rows={2}
                  className="w-full px-4 py-3 rounded-lg bg-[var(--bg-input)] border border-[var(--border-secondary)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)] resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                    Level Required
                  </label>
                  <input
                    type="number"
                    value={editingPerk.levelRequired}
                    onChange={(e) =>
                      setEditingPerk({ ...editingPerk, levelRequired: parseInt(e.target.value) || 1 })
                    }
                    min={1}
                    max={50}
                    className="w-full px-4 py-3 rounded-lg bg-[var(--bg-input)] border border-[var(--border-secondary)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                    Prestige Required
                  </label>
                  <select
                    value={editingPerk.prestigeRequired}
                    onChange={(e) =>
                      setEditingPerk({ ...editingPerk, prestigeRequired: parseInt(e.target.value) })
                    }
                    className="w-full px-4 py-3 rounded-lg bg-[var(--bg-input)] border border-[var(--border-secondary)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
                  >
                    {PRESTIGE_RANKS.map((rank, idx) => (
                      <option key={rank} value={idx}>
                        {rank}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                    Effect Value
                  </label>
                  <input
                    type="number"
                    value={editingPerk.effectValue}
                    onChange={(e) =>
                      setEditingPerk({ ...editingPerk, effectValue: parseFloat(e.target.value) || 0 })
                    }
                    step={editingPerk.effectType === 'bonus_percent' ? 0.1 : 1}
                    className="w-full px-4 py-3 rounded-lg bg-[var(--bg-input)] border border-[var(--border-secondary)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                    Active
                  </label>
                  <button
                    type="button"
                    onClick={() => setEditingPerk({ ...editingPerk, isActive: !editingPerk.isActive })}
                    className={`w-full px-4 py-3 rounded-lg font-medium transition-colors border ${
                      editingPerk.isActive
                        ? 'bg-[var(--status-success)]/20 border-[var(--status-success)] text-[var(--status-success)]'
                        : 'border-[var(--border-secondary)] text-[var(--text-muted)]'
                    }`}
                  >
                    {editingPerk.isActive ? 'Active' : 'Inactive'}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-[var(--border-secondary)]">
              <button
                onClick={() => setEditingPerk(null)}
                className="px-5 py-2.5 rounded-lg font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={updatePerk}
                disabled={saving}
                className="px-5 py-2.5 rounded-lg font-medium transition-colors disabled:opacity-50"
                style={{ background: 'var(--accent-primary)', color: 'var(--bg-root)' }}
              >
                {saving ? 'Saving...' : 'Save Changes'}
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
      ) : perks.length === 0 ? (
        /* Empty State */
        <div
          className="rounded-xl p-12 text-center"
          style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}
        >
          <Gift className="w-12 h-12 mx-auto mb-4 text-[var(--text-muted)]" />
          <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">No Perks Defined</h3>
          <p className="text-[var(--text-secondary)] mb-6">
            Create perk definitions that clans can unlock as they level up.
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors"
            style={{ background: 'var(--accent-primary)', color: 'var(--bg-root)' }}
          >
            <Plus className="w-4 h-4" />
            <span>Create Perk</span>
          </button>
        </div>
      ) : (
        /* Perks grouped by category */
        <div className="space-y-8">
          {Object.entries(groupedPerks).map(([category, categoryPerks]) => (
            <div key={category}>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[var(--accent-primary)]/20 text-[var(--accent-primary)]">
                  {CATEGORY_ICONS[category] || <Sparkles className="w-5 h-5" />}
                </div>
                <h2 className="text-lg font-semibold text-[var(--text-primary)] capitalize">{category}</h2>
                <span className="text-sm text-[var(--text-muted)]">({categoryPerks.length})</span>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {categoryPerks.map((perk) => (
                  <div
                    key={perk.id}
                    className={`rounded-xl p-5 transition-colors ${!perk.isActive ? 'opacity-50' : ''}`}
                    style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-semibold text-[var(--text-primary)]">{perk.name}</h3>
                        <code className="text-xs text-[var(--text-muted)] font-mono">{perk.key}</code>
                      </div>
                      <span
                        className="text-sm font-medium px-2 py-1 rounded-lg"
                        style={{
                          backgroundColor: 'var(--accent-primary)/20',
                          color: 'var(--accent-primary)',
                        }}
                      >
                        {formatEffectValue(perk)}
                      </span>
                    </div>

                    {perk.description && (
                      <p className="text-sm text-[var(--text-secondary)] mb-3">{perk.description}</p>
                    )}

                    <div className="flex items-center gap-3 text-xs text-[var(--text-muted)] mb-3">
                      <span>Level {perk.levelRequired}+</span>
                      <span>•</span>
                      <span>{PRESTIGE_RANKS[perk.prestigeRequired]}+</span>
                      <span>•</span>
                      <span>{perk._count.clans} clans</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setEditingPerk(perk)}
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors border"
                        style={{
                          background: 'var(--glass-bg-subtle)',
                          borderColor: 'var(--glass-border)',
                          color: 'var(--text-primary)',
                        }}
                      >
                        <Edit3 className="w-4 h-4" />
                        Edit
                      </button>

                      {deleteConfirm === perk.id ? (
                        <>
                          <button
                            onClick={() => deletePerk(perk.id)}
                            className="px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                            style={{ background: 'var(--status-error)', color: 'white' }}
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(null)}
                            className="px-3 py-2 rounded-lg text-sm font-medium text-[var(--text-secondary)]"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirm(perk.id)}
                          className="p-2 rounded-lg hover:bg-[var(--status-error)]/10 text-[var(--text-muted)] hover:text-[var(--status-error)] transition-colors"
                          title="Delete perk"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
