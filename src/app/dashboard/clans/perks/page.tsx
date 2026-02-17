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
  Sparkles,
  Users,
  Sword,
  Hammer,
  Coins,
  Heart,
} from 'lucide-react'
import Link from 'next/link'
import { Modal } from '@/components/ui/Modal'
import { Input, Textarea, NumberInput } from '@/components/ui/Input'
import { Dropdown } from '@/components/ui/Dropdown'
import { Button, IconButton } from '@/components/ui/Button'
import { Loading } from '@/components/ui/Loading'
import { EmptyState } from '@/components/ui/EmptyState'
import { Badge } from '@/components/ui/Badge'
import { Alert } from '@/components/ui/Alert'

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
        <Button onClick={() => setShowCreateModal(true)} icon={<Plus />}>
          New Perk
        </Button>
      </div>

      {/* Error Message */}
      {error && (
        <Alert variant="error" onDismiss={() => setError(null)} className="mb-6">
          {error}
        </Alert>
      )}

      {/* Create Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => {
          resetCreateForm()
          setShowCreateModal(false)
        }}
        title="Create Perk"
        size="lg"
      >
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Key"
              value={newKey}
              onChange={(e) => setNewKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
              placeholder="e.g., member_capacity_1"
              maxLength={50}
              required
              className="font-mono"
            />
            <Input
              label="Name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g., Member Capacity I"
              maxLength={100}
              required
            />
          </div>

          <Textarea
            label="Description"
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            placeholder="What does this perk do?"
            maxLength={500}
            rows={2}
          />

          <div className="grid grid-cols-2 gap-4">
            <Dropdown
              value={newCategory}
              onChange={(val) => setNewCategory(val ?? '')}
              options={[
                { value: 'capacity', label: 'Capacity' },
                { value: 'resources', label: 'Resources' },
                { value: 'crafting', label: 'Crafting' },
                { value: 'combat', label: 'Combat' },
                { value: 'economy', label: 'Economy' },
                { value: 'social', label: 'Social' },
              ]}
            />
            <NumberInput
              label="Sort Order"
              value={newSortOrder}
              onChange={(value) => setNewSortOrder(value)}
              min={0}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <NumberInput
              label="Level Required"
              value={newLevelRequired}
              onChange={(value) => setNewLevelRequired(value)}
              min={1}
              max={50}
            />
            <Dropdown
              value={String(newPrestigeRequired)}
              onChange={(val) => setNewPrestigeRequired(parseInt(val ?? '0'))}
              options={PRESTIGE_RANKS.map((rank, idx) => ({ value: String(idx), label: rank }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Dropdown
              value={newEffectType}
              onChange={(val) => setNewEffectType(val as 'bonus_percent' | 'flat_bonus' | 'unlock')}
              options={[
                { value: 'bonus_percent', label: 'Bonus Percent' },
                { value: 'flat_bonus', label: 'Flat Bonus' },
                { value: 'unlock', label: 'Unlock' },
              ]}
            />
            <NumberInput
              label="Effect Value"
              value={newEffectValue}
              onChange={(value) => setNewEffectValue(value)}
              step={newEffectType === 'bonus_percent' ? 0.1 : 1}
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-[var(--border-secondary)]">
          <Button
            variant="ghost"
            onClick={() => {
              resetCreateForm()
              setShowCreateModal(false)
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={createPerk}
            disabled={!newKey.trim() || !newName.trim() || creating}
            loading={creating}
          >
            Create
          </Button>
        </div>
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={!!editingPerk}
        onClose={() => setEditingPerk(null)}
        title="Edit Perk"
        size="lg"
      >
        {editingPerk && (
          <>
            <div className="space-y-5">
              <Input
                label="Key (readonly)"
                value={editingPerk.key}
                disabled
                className="font-mono opacity-60"
              />

              <Input
                label="Name"
                value={editingPerk.name}
                onChange={(e) => setEditingPerk({ ...editingPerk, name: e.target.value })}
                maxLength={100}
              />

              <Textarea
                label="Description"
                value={editingPerk.description || ''}
                onChange={(e) => setEditingPerk({ ...editingPerk, description: e.target.value || null })}
                maxLength={500}
                rows={2}
              />

              <div className="grid grid-cols-2 gap-4">
                <NumberInput
                  label="Level Required"
                  value={editingPerk.levelRequired}
                  onChange={(value) => setEditingPerk({ ...editingPerk, levelRequired: value })}
                  min={1}
                  max={50}
                />
                <Dropdown
                  value={String(editingPerk.prestigeRequired)}
                  onChange={(val) => setEditingPerk({ ...editingPerk, prestigeRequired: parseInt(val ?? '0') })}
                  options={PRESTIGE_RANKS.map((rank, idx) => ({ value: String(idx), label: rank }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <NumberInput
                  label="Effect Value"
                  value={editingPerk.effectValue}
                  onChange={(value) => setEditingPerk({ ...editingPerk, effectValue: value })}
                  step={editingPerk.effectType === 'bonus_percent' ? 0.1 : 1}
                />
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                    Active
                  </label>
                  <Button
                    variant={editingPerk.isActive ? 'success' : 'outline'}
                    onClick={() => setEditingPerk({ ...editingPerk, isActive: !editingPerk.isActive })}
                    className="w-full"
                  >
                    {editingPerk.isActive ? 'Active' : 'Inactive'}
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-[var(--border-secondary)]">
              <Button variant="ghost" onClick={() => setEditingPerk(null)}>
                Cancel
              </Button>
              <Button onClick={updatePerk} disabled={saving} loading={saving}>
                Save Changes
              </Button>
            </div>
          </>
        )}
      </Modal>

      {/* Loading State */}
      {loading ? (
        <Loading />
      ) : perks.length === 0 ? (
        /* Empty State */
        <EmptyState
          icon={<Gift />}
          title="No Perks Defined"
          description="Create perk definitions that clans can unlock as they level up."
          action={{
            label: 'Create Perk',
            onClick: () => setShowCreateModal(true),
            icon: <Plus />,
          }}
        />
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
                      <Badge variant="primary">{formatEffectValue(perk)}</Badge>
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
                      <Button
                        variant="outline"
                        onClick={() => setEditingPerk(perk)}
                        icon={<Edit3 />}
                        size="sm"
                        className="flex-1"
                      >
                        Edit
                      </Button>

                      {deleteConfirm === perk.id ? (
                        <>
                          <Button variant="error" size="sm" onClick={() => deletePerk(perk.id)}>
                            Confirm
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setDeleteConfirm(null)}>
                            Cancel
                          </Button>
                        </>
                      ) : (
                        <IconButton
                          icon={<Trash2 />}
                          onClick={() => setDeleteConfirm(perk.id)}
                          title="Delete perk"
                          variant="error"
                        />
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
