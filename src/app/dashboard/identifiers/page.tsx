/**
 * Server Identifiers Management Page
 *
 * Create and manage server identifiers for plugin analytics.
 * Supports categories for organizing identifiers.
 */

'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  ArrowLeft,
  Plus,
  Copy,
  Trash2,
  Server,
  Check,
  AlertCircle,
  Edit3,
  FolderPlus,
  Folder,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'
import Link from 'next/link'

interface IdentifierCategory {
  id: string
  name: string
}

interface ServerIdentifier {
  id: string
  name: string
  hashedId: string
  description: string | null
  categoryId: string | null
  createdAt: string
  updatedAt: string
  category: IdentifierCategory | null
  _count: {
    usageEvents: number
  }
}

interface Category {
  id: string
  name: string
  description: string | null
  createdAt: string
  updatedAt: string
  _count: {
    identifiers: number
  }
}

export default function IdentifiersPage() {
  const [identifiers, setIdentifiers] = useState<ServerIdentifier[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Create identifier state
  const [creating, setCreating] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [newCategoryId, setNewCategoryId] = useState<string | null>(null)

  // Create category state
  const [showCreateCategoryForm, setShowCreateCategoryForm] = useState(false)
  const [creatingCategory, setCreatingCategory] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [newCategoryDescription, setNewCategoryDescription] = useState('')

  // Edit identifier state
  const [editingIdentifier, setEditingIdentifier] = useState<ServerIdentifier | null>(null)
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editCategoryId, setEditCategoryId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Edit category state
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [editCategoryName, setEditCategoryName] = useState('')
  const [editCategoryDescription, setEditCategoryDescription] = useState('')

  // UI state
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [deleteCategoryConfirm, setDeleteCategoryConfirm] = useState<string | null>(null)
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    setLoading(true)
    setError(null)

    try {
      // PERF: Parallel fetch
      const [identifiersRes, categoriesRes] = await Promise.all([
        fetch('/api/identifiers', { credentials: 'include' }),
        fetch('/api/identifier-categories', { credentials: 'include' }),
      ])

      if (!identifiersRes.ok || !categoriesRes.ok) {
        throw new Error('Failed to fetch data')
      }

      const [identifiersData, categoriesData] = await Promise.all([
        identifiersRes.json(),
        categoriesRes.json(),
      ])

      setIdentifiers(identifiersData)
      setCategories(categoriesData)
    } catch (err) {
      console.error('Failed to fetch data:', err)
      setError(err instanceof Error ? err.message : 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  // Group identifiers by category
  const groupedIdentifiers = useMemo(() => {
    const groups: Record<string, ServerIdentifier[]> = { uncategorized: [] }

    // Initialize groups for each category
    categories.forEach((cat) => {
      groups[cat.id] = []
    })

    // Sort identifiers into groups
    identifiers.forEach((identifier) => {
      if (identifier.categoryId && groups[identifier.categoryId]) {
        groups[identifier.categoryId].push(identifier)
      } else {
        groups.uncategorized.push(identifier)
      }
    })

    return groups
  }, [identifiers, categories])

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

      // If a category was selected, update it immediately
      if (newCategoryId) {
        const updateRes = await fetch(`/api/identifiers/${newIdentifier.id}`, {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ categoryId: newCategoryId }),
        })

        if (updateRes.ok) {
          const updated = await updateRes.json()
          setIdentifiers((prev) => [updated, ...prev])
        } else {
          setIdentifiers((prev) => [
            { ...newIdentifier, categoryId: null, category: null, _count: { usageEvents: 0 } },
            ...prev,
          ])
        }
      } else {
        setIdentifiers((prev) => [
          { ...newIdentifier, categoryId: null, category: null, _count: { usageEvents: 0 } },
          ...prev,
        ])
      }

      setNewName('')
      setNewDescription('')
      setNewCategoryId(null)
      setShowCreateForm(false)
    } catch (err) {
      console.error('Failed to create identifier:', err)
      setError(err instanceof Error ? err.message : 'Failed to create identifier')
    } finally {
      setCreating(false)
    }
  }

  async function createCategory() {
    if (!newCategoryName.trim()) return

    setCreatingCategory(true)
    setError(null)

    try {
      const response = await fetch('/api/identifier-categories', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newCategoryName.trim(),
          description: newCategoryDescription.trim() || undefined,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to create category')
      }

      const newCategory = await response.json()
      setCategories((prev) => [...prev, { ...newCategory, _count: { identifiers: 0 } }])
      setNewCategoryName('')
      setNewCategoryDescription('')
      setShowCreateCategoryForm(false)
    } catch (err) {
      console.error('Failed to create category:', err)
      setError(err instanceof Error ? err.message : 'Failed to create category')
    } finally {
      setCreatingCategory(false)
    }
  }

  async function updateIdentifier() {
    if (!editingIdentifier) return

    setSaving(true)
    setError(null)

    try {
      const response = await fetch(`/api/identifiers/${editingIdentifier.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName.trim() || undefined,
          description: editDescription.trim() || null,
          categoryId: editCategoryId,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to update identifier')
      }

      const updated = await response.json()
      setIdentifiers((prev) => prev.map((i) => (i.id === updated.id ? updated : i)))
      setEditingIdentifier(null)
    } catch (err) {
      console.error('Failed to update identifier:', err)
      setError(err instanceof Error ? err.message : 'Failed to update identifier')
    } finally {
      setSaving(false)
    }
  }

  async function updateCategory() {
    if (!editingCategory) return

    setSaving(true)
    setError(null)

    try {
      const response = await fetch(`/api/identifier-categories/${editingCategory.id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editCategoryName.trim() || undefined,
          description: editCategoryDescription.trim() || null,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to update category')
      }

      const updated = await response.json()
      setCategories((prev) =>
        prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c))
      )
      setEditingCategory(null)
    } catch (err) {
      console.error('Failed to update category:', err)
      setError(err instanceof Error ? err.message : 'Failed to update category')
    } finally {
      setSaving(false)
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

  async function deleteCategory(id: string) {
    try {
      const response = await fetch(`/api/identifier-categories/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error('Failed to delete category')
      }

      setCategories((prev) => prev.filter((c) => c.id !== id))
      // Update identifiers that were in this category
      setIdentifiers((prev) =>
        prev.map((i) => (i.categoryId === id ? { ...i, categoryId: null, category: null } : i))
      )
      setDeleteCategoryConfirm(null)
    } catch (err) {
      console.error('Failed to delete category:', err)
      setError(err instanceof Error ? err.message : 'Failed to delete category')
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

  function toggleCategoryCollapse(categoryId: string) {
    setCollapsedCategories((prev) => {
      const next = new Set(prev)
      if (next.has(categoryId)) {
        next.delete(categoryId)
      } else {
        next.add(categoryId)
      }
      return next
    })
  }

  function openEditIdentifier(identifier: ServerIdentifier) {
    setEditingIdentifier(identifier)
    setEditName(identifier.name)
    setEditDescription(identifier.description || '')
    setEditCategoryId(identifier.categoryId)
  }

  function openEditCategory(category: Category) {
    setEditingCategory(category)
    setEditCategoryName(category.name)
    setEditCategoryDescription(category.description || '')
  }

  function renderIdentifierCard(identifier: ServerIdentifier) {
    return (
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
            <button
              onClick={() => openEditIdentifier(identifier)}
              className="p-2 rounded-lg hover:bg-[var(--bg-card-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
              title="Edit identifier"
            >
              <Edit3 className="w-5 h-5" />
            </button>

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
    )
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
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCreateCategoryForm(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors border"
            style={{
              background: 'var(--glass-bg)',
              borderColor: 'var(--glass-border)',
              color: 'var(--text-primary)',
            }}
          >
            <FolderPlus className="w-4 h-4" />
            <span>New Category</span>
          </button>
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
          <button
            onClick={() => setError(null)}
            className="text-[var(--status-error)] hover:opacity-70"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Create Identifier Modal */}
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

              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                  Category (optional)
                </label>
                <select
                  value={newCategoryId || ''}
                  onChange={(e) => setNewCategoryId(e.target.value || null)}
                  className="w-full px-4 py-3 rounded-lg bg-[var(--bg-input)] border border-[var(--border-secondary)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
                >
                  <option value="">No category</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
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

      {/* Create Category Modal */}
      {showCreateCategoryForm && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50"
          onClick={() => setShowCreateCategoryForm(false)}
        >
          <div
            className="w-full max-w-md rounded-xl p-8"
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-6">
              Create Category
            </h2>

            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                  Name
                </label>
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="e.g., Production Servers"
                  className="w-full px-4 py-3 rounded-lg bg-[var(--bg-input)] border border-[var(--border-secondary)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                  Description (optional)
                </label>
                <input
                  type="text"
                  value={newCategoryDescription}
                  onChange={(e) => setNewCategoryDescription(e.target.value)}
                  placeholder="e.g., Live production game servers"
                  className="w-full px-4 py-3 rounded-lg bg-[var(--bg-input)] border border-[var(--border-secondary)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)]"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-[var(--border-secondary)]">
              <button
                onClick={() => setShowCreateCategoryForm(false)}
                className="px-5 py-2.5 rounded-lg font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={createCategory}
                disabled={!newCategoryName.trim() || creatingCategory}
                className="px-5 py-2.5 rounded-lg font-medium transition-colors disabled:opacity-50"
                style={{
                  background: 'var(--accent-primary)',
                  color: 'var(--bg-root)',
                }}
              >
                {creatingCategory ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Identifier Modal */}
      {editingIdentifier && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50"
          onClick={() => setEditingIdentifier(null)}
        >
          <div
            className="w-full max-w-md rounded-xl p-8"
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-6">
              Edit Identifier
            </h2>

            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                  Name
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg bg-[var(--bg-input)] border border-[var(--border-secondary)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                  Description
                </label>
                <input
                  type="text"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="Optional description"
                  className="w-full px-4 py-3 rounded-lg bg-[var(--bg-input)] border border-[var(--border-secondary)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                  Category
                </label>
                <select
                  value={editCategoryId || ''}
                  onChange={(e) => setEditCategoryId(e.target.value || null)}
                  className="w-full px-4 py-3 rounded-lg bg-[var(--bg-input)] border border-[var(--border-secondary)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
                >
                  <option value="">No category</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-[var(--border-secondary)]">
              <button
                onClick={() => setEditingIdentifier(null)}
                className="px-5 py-2.5 rounded-lg font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={updateIdentifier}
                disabled={saving}
                className="px-5 py-2.5 rounded-lg font-medium transition-colors disabled:opacity-50"
                style={{
                  background: 'var(--accent-primary)',
                  color: 'var(--bg-root)',
                }}
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Category Modal */}
      {editingCategory && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50"
          onClick={() => setEditingCategory(null)}
        >
          <div
            className="w-full max-w-md rounded-xl p-8"
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-6">
              Edit Category
            </h2>

            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                  Name
                </label>
                <input
                  type="text"
                  value={editCategoryName}
                  onChange={(e) => setEditCategoryName(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg bg-[var(--bg-input)] border border-[var(--border-secondary)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                  Description
                </label>
                <input
                  type="text"
                  value={editCategoryDescription}
                  onChange={(e) => setEditCategoryDescription(e.target.value)}
                  placeholder="Optional description"
                  className="w-full px-4 py-3 rounded-lg bg-[var(--bg-input)] border border-[var(--border-secondary)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)]"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-[var(--border-secondary)]">
              <button
                onClick={() => setEditingCategory(null)}
                className="px-5 py-2.5 rounded-lg font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={updateCategory}
                disabled={saving}
                className="px-5 py-2.5 rounded-lg font-medium transition-colors disabled:opacity-50"
                style={{
                  background: 'var(--accent-primary)',
                  color: 'var(--bg-root)',
                }}
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
      ) : identifiers.length === 0 && categories.length === 0 ? (
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
        /* Identifiers List Grouped by Category */
        <div className="space-y-6">
          {/* Categories with their identifiers */}
          {categories.map((category) => {
            const categoryIdentifiers = groupedIdentifiers[category.id] || []
            const isCollapsed = collapsedCategories.has(category.id)

            return (
              <div
                key={category.id}
                className="rounded-xl overflow-hidden"
                style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}
              >
                {/* Category Header */}
                <div
                  className="flex items-center gap-3 p-4 cursor-pointer hover:bg-[var(--bg-card-hover)] transition-colors"
                  onClick={() => toggleCategoryCollapse(category.id)}
                >
                  <button className="p-1">
                    {isCollapsed ? (
                      <ChevronRight className="w-5 h-5 text-[var(--text-muted)]" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-[var(--text-muted)]" />
                    )}
                  </button>
                  <Folder className="w-5 h-5 text-[var(--accent-primary)]" />
                  <div className="flex-1">
                    <h3 className="font-semibold text-[var(--text-primary)]">{category.name}</h3>
                    {category.description && (
                      <p className="text-sm text-[var(--text-muted)]">{category.description}</p>
                    )}
                  </div>
                  <span className="text-xs px-2 py-1 rounded-full bg-[var(--bg-input)] text-[var(--text-muted)]">
                    {categoryIdentifiers.length} identifier{categoryIdentifiers.length !== 1 ? 's' : ''}
                  </span>
                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => openEditCategory(category)}
                      className="p-2 rounded-lg hover:bg-[var(--bg-card-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                      title="Edit category"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    {deleteCategoryConfirm === category.id ? (
                      <>
                        <button
                          onClick={() => deleteCategory(category.id)}
                          className="px-2 py-1 rounded text-xs font-medium"
                          style={{ background: 'var(--status-error)', color: 'white' }}
                        >
                          Delete
                        </button>
                        <button
                          onClick={() => setDeleteCategoryConfirm(null)}
                          className="px-2 py-1 rounded text-xs font-medium text-[var(--text-muted)]"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => setDeleteCategoryConfirm(category.id)}
                        className="p-2 rounded-lg hover:bg-[var(--status-error)]/10 text-[var(--text-muted)] hover:text-[var(--status-error)] transition-colors"
                        title="Delete category"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Category Identifiers */}
                {!isCollapsed && (
                  <div className="border-t border-[var(--glass-border)] p-4 space-y-4">
                    {categoryIdentifiers.length === 0 ? (
                      <p className="text-center text-[var(--text-muted)] py-4">
                        No identifiers in this category
                      </p>
                    ) : (
                      categoryIdentifiers.map(renderIdentifierCard)
                    )}
                  </div>
                )}
              </div>
            )
          })}

          {/* Uncategorized Identifiers */}
          {groupedIdentifiers.uncategorized.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-[var(--text-muted)] mb-3 px-1">
                Uncategorized ({groupedIdentifiers.uncategorized.length})
              </h3>
              <div className="space-y-4">
                {groupedIdentifiers.uncategorized.map(renderIdentifierCard)}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Usage Instructions */}
      {!loading && identifiers.length > 0 && (
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
