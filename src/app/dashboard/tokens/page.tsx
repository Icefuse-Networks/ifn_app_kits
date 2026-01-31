'use client'

/**
 * Token Management Dashboard
 *
 * Allows admins to create, view, edit, and revoke API tokens.
 * Supports token categories for organization.
 * IMPORTANT: Full token is only shown once on creation.
 */

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Key,
  Plus,
  Trash2,
  Copy,
  Check,
  AlertTriangle,
  Clock,
  Shield,
  X,
  ArrowLeft,
  Edit,
  FolderOpen,
  Tag,
} from 'lucide-react'
import type { ApiTokenInfo, ApiScope, ApiTokenCreateResponse, TokenCategory } from '@/types/api'
import { API_SCOPES, SCOPE_DESCRIPTIONS, DEFAULT_SCOPES } from '@/types/api'
import { SelectDropdown } from '@/components/kit-manager/SelectDropdown'

export default function TokensPage() {
  const router = useRouter()
  const [tokens, setTokens] = useState<ApiTokenInfo[]>([])
  const [categories, setCategories] = useState<TokenCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Create modal state
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createName, setCreateName] = useState('')
  const [createScopes, setCreateScopes] = useState<ApiScope[]>([...DEFAULT_SCOPES])
  const [createExpiry, setCreateExpiry] = useState('')
  const [createCategoryId, setCreateCategoryId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  // Edit modal state
  const [showEditModal, setShowEditModal] = useState(false)
  const [editToken, setEditToken] = useState<ApiTokenInfo | null>(null)
  const [editName, setEditName] = useState('')
  const [editScopes, setEditScopes] = useState<ApiScope[]>([])
  const [editCategoryId, setEditCategoryId] = useState<string | null>(null)
  const [updating, setUpdating] = useState(false)

  // Category modal state
  const [showCategoryModal, setShowCategoryModal] = useState(false)
  const [categoryName, setCategoryName] = useState('')
  const [categoryDescription, setCategoryDescription] = useState('')
  const [categoryColor, setCategoryColor] = useState('')
  const [creatingCategory, setCreatingCategory] = useState(false)

  // New token display state
  const [newToken, setNewToken] = useState<ApiTokenCreateResponse | null>(null)
  const [copied, setCopied] = useState(false)

  // Revoke state
  const [revoking, setRevoking] = useState<string | null>(null)

  // Filter state
  const [filterCategory, setFilterCategory] = useState<string | null>(null)

  // Fetch tokens
  const fetchTokens = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/tokens')
      if (!res.ok) throw new Error('Failed to fetch tokens')
      const data = await res.json()
      setTokens(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch tokens')
    } finally {
      setLoading(false)
    }
  }, [])

  // Fetch categories
  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/token-categories')
      if (!res.ok) throw new Error('Failed to fetch categories')
      const data = await res.json()
      setCategories(data)
    } catch (err) {
      console.error('Failed to fetch categories:', err)
    }
  }, [])

  useEffect(() => {
    fetchTokens()
    fetchCategories()
  }, [fetchTokens, fetchCategories])

  // Create token
  const handleCreate = async () => {
    if (!createName.trim()) return

    setCreating(true)
    try {
      const body: { name: string; scopes: string[]; categoryId?: string | null; expiresAt?: string } = {
        name: createName.trim(),
        scopes: createScopes,
        categoryId: createCategoryId,
      }

      if (createExpiry) {
        body.expiresAt = new Date(createExpiry).toISOString()
      }

      const res = await fetch('/api/v1/tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to create token')
      }

      const data: ApiTokenCreateResponse = await res.json()
      setNewToken(data)
      setShowCreateModal(false)
      setCreateName('')
      setCreateScopes([...DEFAULT_SCOPES])
      setCreateExpiry('')
      setCreateCategoryId(null)
      fetchTokens()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create token')
    } finally {
      setCreating(false)
    }
  }

  // Update token
  const handleUpdate = async () => {
    if (!editToken || !editName.trim()) return

    setUpdating(true)
    try {
      const res = await fetch(`/api/v1/tokens/${editToken.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName.trim(),
          scopes: editScopes,
          categoryId: editCategoryId,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to update token')
      }

      setShowEditModal(false)
      setEditToken(null)
      fetchTokens()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update token')
    } finally {
      setUpdating(false)
    }
  }

  // Create category
  const handleCreateCategory = async () => {
    if (!categoryName.trim()) return

    setCreatingCategory(true)
    try {
      const res = await fetch('/api/v1/token-categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: categoryName.trim(),
          description: categoryDescription.trim() || null,
          color: categoryColor.trim() || null,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to create category')
      }

      setShowCategoryModal(false)
      setCategoryName('')
      setCategoryDescription('')
      setCategoryColor('')
      fetchCategories()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create category')
    } finally {
      setCreatingCategory(false)
    }
  }

  // Revoke token
  const handleRevoke = async (id: string) => {
    if (!confirm('Are you sure you want to revoke this token? This action cannot be undone.')) {
      return
    }

    setRevoking(id)
    try {
      const res = await fetch(`/api/v1/tokens/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to revoke token')
      fetchTokens()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke token')
    } finally {
      setRevoking(null)
    }
  }

  // Open edit modal
  const openEditModal = (token: ApiTokenInfo) => {
    setEditToken(token)
    setEditName(token.name)
    setEditScopes([...token.scopes])
    setEditCategoryId(token.categoryId)
    setShowEditModal(true)
  }

  // Copy token to clipboard
  const copyToken = async () => {
    if (!newToken) return
    await navigator.clipboard.writeText(newToken.token)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Toggle scope for create
  const toggleCreateScope = (scope: ApiScope) => {
    setCreateScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]
    )
  }

  // Toggle scope for edit
  const toggleEditScope = (scope: ApiScope) => {
    setEditScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]
    )
  }

  // Format date
  const formatDate = (date: Date | string | null) => {
    if (!date) return 'Never'
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  // Get token status
  const getTokenStatus = (token: ApiTokenInfo) => {
    if (token.isRevoked) return { label: 'Revoked', color: 'var(--status-error)' }
    if (token.isExpired) return { label: 'Expired', color: 'var(--status-warning)' }
    return { label: 'Active', color: 'var(--status-success)' }
  }

  // Filter tokens by category
  const filteredTokens = filterCategory
    ? tokens.filter((t) => t.categoryId === filterCategory)
    : tokens

  // Group tokens by category
  const uncategorizedTokens = filteredTokens.filter((t) => !t.categoryId)
  const categorizedTokens = categories
    .map((cat) => ({
      category: cat,
      tokens: filteredTokens.filter((t) => t.categoryId === cat.id),
    }))
    .filter((group) => group.tokens.length > 0 || filterCategory === null)

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors mb-3"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <h1 className="text-2xl font-bold text-[var(--text-primary)] flex items-center gap-3">
            <Key className="w-7 h-7 text-[var(--accent-primary)]" />
            API Tokens
          </h1>
          <p className="text-[var(--text-secondary)] mt-1">
            Manage API tokens for programmatic access to kit configurations.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowCategoryModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-card-hover)]"
            style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}
          >
            <FolderOpen className="w-4 h-4" />
            New Category
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[var(--accent-primary)] hover:bg-[var(--accent-secondary)] text-white rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Token
          </button>
        </div>
      </div>

      {/* Category filter */}
      {categories.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-2">
          <button
            onClick={() => setFilterCategory(null)}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
              filterCategory === null
                ? 'bg-[var(--accent-primary)] text-white'
                : 'bg-[var(--glass-bg)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
            style={filterCategory === null ? {} : { border: '1px solid var(--glass-border)' }}
          >
            All Tokens
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setFilterCategory(cat.id)}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors flex items-center gap-2 ${
                filterCategory === cat.id
                  ? 'bg-[var(--accent-primary)] text-white'
                  : 'bg-[var(--glass-bg)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
              style={filterCategory === cat.id ? {} : { border: '1px solid var(--glass-border)' }}
            >
              {cat.color && (
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ background: cat.color }}
                />
              )}
              {cat.name}
            </button>
          ))}
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="mb-6 p-4 bg-[var(--status-error)]/10 border border-[var(--status-error)]/30 rounded-lg flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-[var(--status-error)]" />
          <span className="text-[var(--status-error)]">{error}</span>
          <button
            onClick={() => setError(null)}
            className="ml-auto text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* New token display modal */}
      {newToken && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setNewToken(null)}
        >
          <div
            className="rounded-xl max-w-lg w-full mx-4 shadow-xl"
            style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--glass-border)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-[var(--status-success)]/20 rounded-full">
                  <Check className="w-5 h-5 text-[var(--status-success)]" />
                </div>
                <h2 className="text-xl font-semibold text-[var(--text-primary)]">Token Created</h2>
              </div>

              <div className="p-4 bg-[var(--status-warning)]/10 border border-[var(--status-warning)]/30 rounded-lg mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-4 h-4 text-[var(--status-warning)]" />
                  <span className="text-sm font-medium text-[var(--status-warning)]">
                    Copy this token now - it won&apos;t be shown again!
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <code className="flex-1 p-3 bg-[var(--bg-input)] rounded-lg text-sm font-mono text-[var(--text-primary)] break-all">
                    {newToken.token}
                  </code>
                  <button
                    onClick={copyToken}
                    className="p-2 bg-[var(--accent-primary)] hover:bg-[var(--accent-secondary)] text-white rounded-lg transition-colors"
                  >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2 text-sm">
                <p className="text-[var(--text-secondary)]">
                  <strong>Name:</strong> {newToken.name}
                </p>
                <p className="text-[var(--text-secondary)]">
                  <strong>Scopes:</strong> {newToken.scopes.join(', ')}
                </p>
                {newToken.expiresAt && (
                  <p className="text-[var(--text-secondary)]">
                    <strong>Expires:</strong> {formatDate(newToken.expiresAt)}
                  </p>
                )}
              </div>
            </div>

            <div className="p-4" style={{ borderTop: '1px solid var(--glass-border)' }}>
              <button
                onClick={() => setNewToken(null)}
                className="w-full py-2 rounded-lg text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-card-hover)]"
                style={{
                  background: 'var(--glass-bg)',
                  border: '1px solid var(--glass-border)',
                }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create token modal */}
      {showCreateModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setShowCreateModal(false)}
        >
          <div
            className="rounded-xl w-full max-w-md mx-4"
            style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--glass-border)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--glass-border)' }}>
              <h3 className="text-lg font-bold text-[var(--text-primary)] flex items-center gap-2">
                <Key className="h-5 w-5 text-[var(--accent-primary)]" />
                Create API Token
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
              {/* Token name */}
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                  Token Name
                </label>
                <input
                  type="text"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  placeholder="e.g., Rust Plugin"
                  className="w-full px-4 py-3 bg-[var(--bg-input)] border border-[var(--border-secondary)] rounded-lg text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent-primary)] focus:outline-none"
                />
              </div>

              {/* Category */}
              {categories.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                    Category (Optional)
                  </label>
                  <SelectDropdown
                    value={createCategoryId}
                    onChange={(value) => setCreateCategoryId(value)}
                    options={categories.map((cat) => ({ value: cat.id, label: cat.name }))}
                    emptyOption="No category"
                    placeholder="Select category..."
                  />
                </div>
              )}

              {/* Scopes */}
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                  Permissions
                </label>
                <div className="space-y-2">
                  {API_SCOPES.map((scope) => (
                    <label
                      key={scope}
                      className="flex items-center gap-3 p-3 bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-lg cursor-pointer hover:bg-[var(--glass-bg-prominent)] transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={createScopes.includes(scope)}
                        onChange={() => toggleCreateScope(scope)}
                        className="w-4 h-4 accent-[var(--accent-primary)]"
                      />
                      <div>
                        <div className="text-sm font-medium text-[var(--text-primary)]">{scope}</div>
                        <div className="text-xs text-[var(--text-muted)]">
                          {SCOPE_DESCRIPTIONS[scope]}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Expiry */}
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                  Expiration (Optional)
                </label>
                <input
                  type="datetime-local"
                  value={createExpiry}
                  onChange={(e) => setCreateExpiry(e.target.value)}
                  className="w-full px-4 py-3 bg-[var(--bg-input)] border border-[var(--border-secondary)] rounded-lg text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:outline-none"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 flex gap-3" style={{ borderTop: '1px solid var(--glass-border)' }}>
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex-1 px-4 py-2.5 rounded-lg text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-card-hover)]"
                style={{
                  background: 'var(--glass-bg)',
                  border: '1px solid var(--glass-border)',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={creating || !createName.trim() || createScopes.length === 0}
                className="flex-1 px-4 py-2.5 rounded-lg font-medium text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                style={{ background: 'var(--accent-primary)' }}
              >
                {creating ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    Create Token
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit token modal */}
      {showEditModal && editToken && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setShowEditModal(false)}
        >
          <div
            className="rounded-xl w-full max-w-md mx-4"
            style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--glass-border)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--glass-border)' }}>
              <h3 className="text-lg font-bold text-[var(--text-primary)] flex items-center gap-2">
                <Edit className="h-5 w-5 text-[var(--accent-primary)]" />
                Edit Token
              </h3>
              <button
                onClick={() => setShowEditModal(false)}
                className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
              {/* Token name */}
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                  Token Name
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="e.g., Rust Plugin"
                  className="w-full px-4 py-3 bg-[var(--bg-input)] border border-[var(--border-secondary)] rounded-lg text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent-primary)] focus:outline-none"
                />
              </div>

              {/* Category */}
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                  Category
                </label>
                <SelectDropdown
                  value={editCategoryId}
                  onChange={(value) => setEditCategoryId(value)}
                  options={categories.map((cat) => ({ value: cat.id, label: cat.name }))}
                  emptyOption="No category"
                  placeholder="Select category..."
                />
              </div>

              {/* Scopes */}
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                  Permissions
                </label>
                <div className="space-y-2">
                  {API_SCOPES.map((scope) => (
                    <label
                      key={scope}
                      className="flex items-center gap-3 p-3 bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-lg cursor-pointer hover:bg-[var(--glass-bg-prominent)] transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={editScopes.includes(scope)}
                        onChange={() => toggleEditScope(scope)}
                        className="w-4 h-4 accent-[var(--accent-primary)]"
                      />
                      <div>
                        <div className="text-sm font-medium text-[var(--text-primary)]">{scope}</div>
                        <div className="text-xs text-[var(--text-muted)]">
                          {SCOPE_DESCRIPTIONS[scope]}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 flex gap-3" style={{ borderTop: '1px solid var(--glass-border)' }}>
              <button
                onClick={() => setShowEditModal(false)}
                className="flex-1 px-4 py-2.5 rounded-lg text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-card-hover)]"
                style={{
                  background: 'var(--glass-bg)',
                  border: '1px solid var(--glass-border)',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleUpdate}
                disabled={updating || !editName.trim() || editScopes.length === 0}
                className="flex-1 px-4 py-2.5 rounded-lg font-medium text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                style={{ background: 'var(--accent-primary)' }}
              >
                {updating ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    Save Changes
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create category modal */}
      {showCategoryModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setShowCategoryModal(false)}
        >
          <div
            className="rounded-xl w-full max-w-md mx-4 p-8"
            style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--glass-border)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-semibold text-[var(--text-primary)] mb-6 flex items-center gap-2">
              <FolderOpen className="h-5 w-5 text-[var(--accent-primary)]" />
              Create Category
            </h3>

            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                  Name
                </label>
                <input
                  type="text"
                  value={categoryName}
                  onChange={(e) => setCategoryName(e.target.value)}
                  placeholder="e.g., Kits Plugin"
                  className="w-full px-4 py-3 bg-[var(--bg-input)] border border-[var(--border-secondary)] rounded-lg text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent-primary)] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                  Description (Optional)
                </label>
                <input
                  type="text"
                  value={categoryDescription}
                  onChange={(e) => setCategoryDescription(e.target.value)}
                  placeholder="e.g., Tokens for kit management plugin"
                  className="w-full px-4 py-3 bg-[var(--bg-input)] border border-[var(--border-secondary)] rounded-lg text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent-primary)] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                  Color (Optional)
                </label>
                <input
                  type="text"
                  value={categoryColor}
                  onChange={(e) => setCategoryColor(e.target.value)}
                  placeholder="e.g., #3b82f6"
                  className="w-full px-4 py-3 bg-[var(--bg-input)] border border-[var(--border-secondary)] rounded-lg text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent-primary)] focus:outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-[var(--border-secondary)]">
              <button
                onClick={() => setShowCategoryModal(false)}
                className="px-5 py-2.5 rounded-lg font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateCategory}
                disabled={!categoryName.trim() || creatingCategory}
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

      {/* Tokens list */}
      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block w-8 h-8 border-2 border-[var(--accent-primary)] border-t-transparent rounded-full animate-spin" />
          <p className="mt-4 text-[var(--text-muted)]">Loading tokens...</p>
        </div>
      ) : tokens.length === 0 ? (
        <div className="text-center py-12 bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-xl">
          <Key className="w-12 h-12 mx-auto text-[var(--text-muted)] mb-4" />
          <h3 className="text-lg font-medium text-[var(--text-primary)] mb-2">No API Tokens</h3>
          <p className="text-[var(--text-muted)] mb-4">
            Create your first token to enable programmatic access.
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--accent-primary)] hover:bg-[var(--accent-secondary)] text-white rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Token
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Uncategorized tokens */}
          {uncategorizedTokens.length > 0 && !filterCategory && (
            <div>
              <h2 className="text-sm font-medium text-[var(--text-muted)] mb-3 flex items-center gap-2">
                <Tag className="w-4 h-4" />
                Uncategorized
              </h2>
              <div className="space-y-3">
                {uncategorizedTokens.map((token) => (
                  <TokenCard
                    key={token.id}
                    token={token}
                    onEdit={() => openEditModal(token)}
                    onRevoke={() => handleRevoke(token.id)}
                    revoking={revoking === token.id}
                    formatDate={formatDate}
                    getTokenStatus={getTokenStatus}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Categorized tokens */}
          {categorizedTokens.map(({ category, tokens: catTokens }) => (
            catTokens.length > 0 && (
              <div key={category.id}>
                <h2 className="text-sm font-medium text-[var(--text-muted)] mb-3 flex items-center gap-2">
                  {category.color && (
                    <span
                      className="w-3 h-3 rounded-full"
                      style={{ background: category.color }}
                    />
                  )}
                  {!category.color && <FolderOpen className="w-4 h-4" />}
                  {category.name}
                  {category.description && (
                    <span className="text-xs text-[var(--text-muted)]">
                      — {category.description}
                    </span>
                  )}
                </h2>
                <div className="space-y-3">
                  {catTokens.map((token) => (
                    <TokenCard
                      key={token.id}
                      token={token}
                      onEdit={() => openEditModal(token)}
                      onRevoke={() => handleRevoke(token.id)}
                      revoking={revoking === token.id}
                      formatDate={formatDate}
                      getTokenStatus={getTokenStatus}
                    />
                  ))}
                </div>
              </div>
            )
          ))}

          {/* Filtered but no results */}
          {filterCategory && filteredTokens.length === 0 && (
            <div className="text-center py-12 bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-xl">
              <FolderOpen className="w-12 h-12 mx-auto text-[var(--text-muted)] mb-4" />
              <h3 className="text-lg font-medium text-[var(--text-primary)] mb-2">No tokens in this category</h3>
              <p className="text-[var(--text-muted)]">
                Create a token and assign it to this category.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Token card component
function TokenCard({
  token,
  onEdit,
  onRevoke,
  revoking,
  formatDate,
  getTokenStatus,
}: {
  token: ApiTokenInfo
  onEdit: () => void
  onRevoke: () => void
  revoking: boolean
  formatDate: (date: Date | string | null) => string
  getTokenStatus: (token: ApiTokenInfo) => { label: string; color: string }
}) {
  const status = getTokenStatus(token)
  const isDisabled = token.isRevoked || token.isExpired

  return (
    <div
      className={`p-4 bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-xl ${
        isDisabled ? 'opacity-60' : ''
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="font-medium text-[var(--text-primary)]">{token.name}</h3>
            <span
              className="px-2 py-0.5 text-xs font-medium rounded-full"
              style={{
                backgroundColor: `${status.color}20`,
                color: status.color,
              }}
            >
              {status.label}
            </span>
          </div>

          <div className="flex items-center gap-4 text-sm text-[var(--text-muted)]">
            <span className="font-mono">ifn_kit_{token.tokenPrefix}...</span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Created {formatDate(token.createdAt)}
            </span>
            {token.lastUsedAt && <span>Last used {formatDate(token.lastUsedAt)}</span>}
          </div>

          <div className="flex items-center gap-2 mt-2">
            <Shield className="w-4 h-4 text-[var(--text-muted)]" />
            <div className="flex flex-wrap gap-1">
              {token.scopes.map((scope) => (
                <span
                  key={scope}
                  className="px-2 py-0.5 text-xs bg-[var(--accent-primary)]/20 text-[var(--accent-primary)] rounded-full"
                >
                  {scope}
                </span>
              ))}
            </div>
          </div>

          {token.expiresAt && (
            <p className="mt-2 text-sm text-[var(--text-muted)]">
              {token.isExpired ? 'Expired' : 'Expires'} {formatDate(token.expiresAt)}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          {!token.isRevoked && (
            <>
              <button
                onClick={onEdit}
                className="p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] rounded-lg transition-colors"
                title="Edit token"
              >
                <Edit className="w-4 h-4" />
              </button>
              <button
                onClick={onRevoke}
                disabled={revoking}
                className="p-2 text-[var(--status-error)] hover:bg-[var(--status-error)]/10 rounded-lg transition-colors disabled:opacity-50"
                title="Revoke token"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
