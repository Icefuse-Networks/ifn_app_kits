/**
 * LoadModal Component
 *
 * Modal dialog for loading saved kit configurations.
 */

'use client'

import { useState } from 'react'
import { FolderOpen, Search, X, Trash2, Check } from 'lucide-react'

interface SavedConfig {
  id: number
  name: string
  description: string | null
  updatedAt: string
}

interface LoadModalProps {
  /** Close modal callback */
  onClose: () => void
  /** Saved configurations */
  configs: SavedConfig[]
  /** Load config callback (by ID) */
  onLoad: (id: number) => void
  /** Delete config callback (by ID) */
  onDelete: (id: number) => void
  /** Whether loading configs */
  loading: boolean
}

export function LoadModal({
  onClose,
  configs,
  onLoad,
  onDelete,
  loading,
}: LoadModalProps) {
  const [search, setSearch] = useState('')
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const filteredConfigs = configs.filter(
    (c) =>
      (c.name || '').toLowerCase().includes(search.toLowerCase()) ||
      (c.description || '').toLowerCase().includes(search.toLowerCase())
  )

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this configuration?')) return
    setDeletingId(id)
    await onDelete(id)
    setDeletingId(null)
  }

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50"
      onClick={onClose}
    >
      <div
        className="rounded-xl w-full max-w-2xl max-h-[80vh] flex flex-col"
        style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--glass-border)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="p-4 flex items-center justify-between"
          style={{ borderBottom: '1px solid var(--glass-border)' }}
        >
          <h3 className="text-lg font-bold text-[var(--text-primary)] flex items-center gap-2">
            <FolderOpen className="h-5 w-5 text-[var(--accent-primary)]" />
            Load Configuration
          </h3>
          <button
            onClick={onClose}
            className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Search */}
        <div
          className="p-4"
          style={{ borderBottom: '1px solid var(--glass-border)' }}
        >
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search saved configs..."
              className="w-full rounded-lg pl-9 pr-3 py-2 text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
              style={{
                background: 'var(--bg-input)',
                border: '1px solid var(--border-secondary)',
              }}
              autoFocus
            />
          </div>
        </div>

        {/* Config List */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="text-center py-12">
              <div className="w-8 h-8 border-2 border-[var(--accent-primary)] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-[var(--text-muted)]">Loading configs...</p>
            </div>
          ) : filteredConfigs.length === 0 ? (
            <div className="text-center py-12 text-[var(--text-muted)]">
              <FolderOpen className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>
                {configs.length === 0
                  ? 'No saved configs yet'
                  : 'No matching configs'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredConfigs.map((config) => (
                <div
                  key={config.id}
                  className="rounded-lg p-4 transition-colors group hover:bg-[var(--bg-card-hover)]"
                  style={{
                    background: 'var(--glass-bg)',
                    border: '1px solid var(--glass-border)',
                  }}
                >
                  <div className="flex items-start justify-between">
                    <div
                      className="flex-1 min-w-0 cursor-pointer"
                      onClick={() => onLoad(config.id)}
                    >
                      <h4 className="text-[var(--text-primary)] font-medium truncate group-hover:text-[var(--accent-primary)] transition-colors">
                        {config.name}
                      </h4>
                      {config.description && (
                        <p className="text-sm text-[var(--text-secondary)] mt-1 line-clamp-2">
                          {config.description}
                        </p>
                      )}
                      <p className="text-xs text-[var(--text-muted)] mt-2">
                        Updated {new Date(config.updatedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <button
                        onClick={() => onLoad(config.id)}
                        className="p-2 rounded-lg text-white transition-colors"
                        style={{ background: 'var(--accent-primary)' }}
                        title="Load"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(config.id)}
                        disabled={deletingId === config.id}
                        className="p-2 rounded-lg text-[var(--status-error)] transition-colors disabled:opacity-50"
                        style={{
                          background: 'rgba(var(--status-error-rgb), 0.1)',
                        }}
                        title="Delete"
                      >
                        {deletingId === config.id ? (
                          <div className="w-4 h-4 border-2 border-[var(--status-error)] border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="p-4"
          style={{ borderTop: '1px solid var(--glass-border)' }}
        >
          <button
            onClick={onClose}
            className="w-full px-4 py-2 rounded-lg text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-card-hover)]"
            style={{
              background: 'var(--glass-bg)',
              border: '1px solid var(--glass-border)',
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

export default LoadModal
