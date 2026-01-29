'use client'

import { useState, useEffect, useRef } from 'react'
import { AlertTriangle, Edit3, X } from 'lucide-react'

// =============================================================================
// Types
// =============================================================================

interface CategoryRenameModalProps {
  onClose: () => void
  onRename: (newName: string, newDescription: string) => void
  currentName: string
  currentDescription: string
  isRenaming: boolean
}

// =============================================================================
// Component
// =============================================================================

export function CategoryRenameModal({
  onClose,
  onRename,
  currentName,
  currentDescription,
  isRenaming,
}: CategoryRenameModalProps) {
  const [name, setName] = useState(currentName)
  const [description, setDescription] = useState(currentDescription)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.select()
  }, [])

  const hasChanges =
    (name.trim() !== currentName || description.trim() !== currentDescription) &&
    name.trim().length > 0

  const canSubmit = hasChanges && !isRenaming

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && canSubmit) {
      onRename(name.trim(), description.trim())
    }
    if (e.key === 'Escape') {
      onClose()
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50"
      onClick={onClose}
    >
      <div
        className="rounded-xl w-full max-w-md"
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
            <Edit3 className="h-5 w-5 text-[var(--accent-primary)]" />
            Edit Category
          </h3>
          <button
            onClick={onClose}
            className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4">
          {/* Warning */}
          <div
            className="flex items-start gap-2 px-3 py-2.5 rounded-lg text-xs"
            style={{
              background: 'rgba(var(--status-warning-rgb), 0.1)',
              border: '1px solid rgba(var(--status-warning-rgb), 0.3)',
              color: 'var(--status-warning)',
            }}
          >
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              Renaming changes the config name used by game server plugins.
              Servers referencing &quot;{currentName}&quot; will need their
              CONFIG_NAME updated to match.
            </span>
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm text-[var(--text-secondary)] mb-2">
              Name *
            </label>
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={handleKeyDown}
              maxLength={100}
              placeholder="e.g. 5x Alpha"
              className="w-full rounded-lg px-3 py-3 text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
              style={{
                background: 'var(--bg-input)',
                border: '1px solid var(--border-secondary)',
              }}
              autoFocus
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm text-[var(--text-secondary)] mb-2">
              Description (optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description..."
              rows={3}
              maxLength={500}
              className="w-full rounded-lg px-3 py-3 text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] resize-none"
              style={{
                background: 'var(--bg-input)',
                border: '1px solid var(--border-secondary)',
              }}
            />
          </div>
        </div>

        {/* Footer */}
        <div
          className="p-4 flex gap-3"
          style={{ borderTop: '1px solid var(--glass-border)' }}
        >
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-card-hover)]"
            style={{
              background: 'var(--glass-bg)',
              border: '1px solid var(--glass-border)',
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => onRename(name.trim(), description.trim())}
            disabled={!canSubmit}
            className="flex-1 px-4 py-2 rounded-lg font-medium text-white transition-colors disabled:opacity-50"
            style={{
              background: 'var(--accent-primary)',
            }}
          >
            {isRenaming ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto" />
            ) : (
              'Save Changes'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
