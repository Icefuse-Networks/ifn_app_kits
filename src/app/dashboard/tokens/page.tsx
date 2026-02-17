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
  ArrowLeft,
  Edit,
  FolderOpen,
  Tag,
} from 'lucide-react'
import type { ApiTokenInfo, ApiScope, ApiTokenCreateResponse, TokenCategory } from '@/types/api'
import { API_SCOPES, SCOPE_DESCRIPTIONS, DEFAULT_SCOPES } from '@/types/api'
import {
  Modal,
  Input,
  Button,
  IconButton,
  Loading,
  EmptyState,
  Alert,
  Dropdown
} from "@/components/ui"
import { CheckboxSwitch } from "@/components/ui/Switch"

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
      const res = await fetch('/api/tokens')
      if (!res.ok) throw new Error('Failed to fetch tokens')
      const json = await res.json()
      setTokens(json.data || [])
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
      const res = await fetch('/api/token-categories')
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

      const res = await fetch('/api/tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const err = await res.json()
        const details = err.error?.details?.fieldErrors
        const detailMsg = details
          ? Object.entries(details)
              .map(([field, errors]) => `${field}: ${(errors as string[]).join(', ')}`)
              .join('; ')
          : null
        throw new Error(detailMsg || err.error?.message || 'Failed to create token')
      }

      const json = await res.json()
      setNewToken(json.data as ApiTokenCreateResponse)
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
      const res = await fetch(`/api/tokens/${editToken.id}`, {
        method: 'PUT',
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
      const res = await fetch('/api/token-categories', {
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
      const res = await fetch(`/api/tokens/${id}`, { method: 'DELETE' })
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
          <Button
            variant="secondary"
            onClick={() => setShowCategoryModal(true)}
            icon={<FolderOpen className="w-4 h-4" />}
          >
            New Category
          </Button>
          <Button
            variant="primary"
            onClick={() => setShowCreateModal(true)}
            icon={<Plus className="w-4 h-4" />}
          >
            Create Token
          </Button>
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
        <Alert variant="error" dismissible onDismiss={() => setError(null)} className="mb-6">
          {error}
        </Alert>
      )}

      {/* New token display modal */}
      <Modal
        isOpen={!!newToken}
        onClose={() => setNewToken(null)}
        title="Token Created"
        icon={<Check className="w-5 h-5 text-[var(--status-success)]" />}
        size="lg"
        footer={
          <Button variant="secondary" onClick={() => setNewToken(null)} fullWidth>
            Done
          </Button>
        }
      >
        {newToken && (
          <>
            <Alert variant="warning" className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4" />
                <span className="text-sm font-medium">
                  Copy this token now - it won&apos;t be shown again!
                </span>
              </div>
              <div className="flex items-center gap-2 mt-3">
                <code className="flex-1 p-3 bg-[var(--bg-input)] rounded-lg text-sm font-mono text-[var(--text-primary)] break-all">
                  {newToken.token}
                </code>
                <IconButton
                  icon={copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  onClick={copyToken}
                  label="Copy token"
                />
              </div>
            </Alert>

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
          </>
        )}
      </Modal>

      {/* Create token modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create API Token"
        icon={<Key className="h-5 w-5" />}
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleCreate}
              disabled={creating || !createName.trim() || createScopes.length === 0}
              loading={creating}
               icon={<Plus className="h-4 w-4" />}
            >
              Create Token
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Token Name"
            value={createName}
            onChange={(e) => setCreateName(e.target.value)}
            placeholder="e.g., Rust Plugin"
          />

          {categories.length > 0 && (
            <Dropdown
              value={createCategoryId}
              onChange={setCreateCategoryId}
              options={categories.map((cat) => ({ value: cat.id, label: cat.name }))}
              emptyOption="No category"
              placeholder="Select category..."
            />
          )}

          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
              Permissions
            </label>
            <div className="space-y-2">
              {API_SCOPES.map((scope) => (
                <CheckboxSwitch
                  key={scope}
                  checked={createScopes.includes(scope)}
                  onChange={() => toggleCreateScope(scope)}
                  label={scope}
                  description={SCOPE_DESCRIPTIONS[scope]}
                />
              ))}
            </div>
          </div>

          <Input
            label="Expiration (Optional)"
            type="datetime-local"
            value={createExpiry}
            onChange={(e) => setCreateExpiry(e.target.value)}
          />
        </div>
      </Modal>

      {/* Edit token modal */}
      <Modal
        isOpen={showEditModal && !!editToken}
        onClose={() => setShowEditModal(false)}
        title="Edit Token"
        icon={<Edit className="h-5 w-5" />}
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowEditModal(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleUpdate}
              disabled={updating || !editName.trim() || editScopes.length === 0}
              loading={updating}
               icon={<Check className="h-4 w-4" />}
            >
              Save Changes
            </Button>
          </>
        }
      >
        {editToken && (
          <div className="space-y-4">
            <Input
              label="Token Name"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="e.g., Rust Plugin"
            />

            <Dropdown
              value={editCategoryId}
              onChange={setEditCategoryId}
              options={categories.map((cat) => ({ value: cat.id, label: cat.name }))}
              emptyOption="No category"
              placeholder="Select category..."
            />

            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                Permissions
              </label>
              <div className="space-y-2">
                {API_SCOPES.map((scope) => (
                  <CheckboxSwitch
                    key={scope}
                    checked={editScopes.includes(scope)}
                    onChange={() => toggleEditScope(scope)}
                    label={scope}
                    description={SCOPE_DESCRIPTIONS[scope]}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Create category modal */}
      <Modal
        isOpen={showCategoryModal}
        onClose={() => setShowCategoryModal(false)}
        title="Create Category"
        icon={<FolderOpen className="h-5 w-5" />}
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowCategoryModal(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleCreateCategory}
              disabled={!categoryName.trim() || creatingCategory}
              loading={creatingCategory}
              loadingText="Creating..."
            >
              Create
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          <Input
            label="Name"
            value={categoryName}
            onChange={(e) => setCategoryName(e.target.value)}
            placeholder="e.g., Kits Plugin"
          />

          <Input
            label="Description (Optional)"
            value={categoryDescription}
            onChange={(e) => setCategoryDescription(e.target.value)}
            placeholder="e.g., Tokens for kit management plugin"
          />

          <Input
            label="Color (Optional)"
            value={categoryColor}
            onChange={(e) => setCategoryColor(e.target.value)}
            placeholder="e.g., #3b82f6"
          />
        </div>
      </Modal>

      {/* Tokens list */}
      {loading ? (
        <Loading text="Loading tokens..." />
      ) : tokens.length === 0 ? (
        <EmptyState
          icon={<Key className="w-12 h-12" />}
          title="No API Tokens"
          description="Create your first token to enable programmatic access."
          action={{
            label: "Create Token",
            onClick: () => setShowCreateModal(true),
            icon: <Plus className="w-4 h-4" />
          }}
        />
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
            <span className="font-mono">ifn_rust_{token.tokenPrefix}...</span>
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
