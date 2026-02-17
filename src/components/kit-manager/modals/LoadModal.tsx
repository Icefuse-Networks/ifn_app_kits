/**
 * LoadModal Component
 *
 * Modal dialog for loading saved kit configurations.
 */

'use client'

import { useState } from 'react'
import { FolderOpen, Trash2, Check } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { SearchInput } from '@/components/ui/SearchInput'
import { Button, IconButton } from '@/components/ui/Button'
import { Loading } from '@/components/ui/Loading'

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
    <Modal
      isOpen={true}
      onClose={onClose}
      title="Load Configuration"
      icon={<FolderOpen className="h-5 w-5" />}
      size="xl"
      footer={
        <Button variant="secondary" onClick={onClose} fullWidth>
          Cancel
        </Button>
      }
    >
      <div className="space-y-4">
        {/* Search */}
        <SearchInput
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search saved configs..."
          autoFocus
        />

        {/* Config List */}
        <div className="min-h-[300px]">
          {loading ? (
            <Loading text="Loading configs..." size="lg" />
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
                      <IconButton
                        icon={<Check className="h-4 w-4" />}
                        onClick={() => onLoad(config.id)}
                        label="Load"
                        className="!bg-[var(--accent-primary)] !text-white hover:!opacity-90"
                      />
                      <IconButton
                        icon={
                          deletingId === config.id ? (
                            <div className="w-4 h-4 border-2 border-[var(--status-error)] border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )
                        }
                        onClick={() => handleDelete(config.id)}
                        disabled={deletingId === config.id}
                        label="Delete"
                        className="!bg-[rgba(var(--status-error-rgb),0.1)] !text-[var(--status-error)]"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}

export default LoadModal
