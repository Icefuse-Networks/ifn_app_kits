/**
 * RenameModal Component
 *
 * Modal dialog for renaming a kit.
 */

'use client'

import { Edit3, X } from 'lucide-react'

interface RenameModalProps {
  /** Close modal callback */
  onClose: () => void
  /** Rename callback */
  onRename: () => void
  /** New name value */
  name: string
  /** Set name callback */
  setName: (name: string) => void
  /** Original kit name */
  originalName: string
}

export function RenameModal({
  onClose,
  onRename,
  name,
  setName,
  originalName,
}: RenameModalProps) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && name.trim() && name !== originalName) {
      onRename()
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
            Rename Kit
          </h3>
          <button
            onClick={onClose}
            className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4">
          <label className="block text-sm text-[var(--text-secondary)] mb-2">
            New Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={originalName}
            className="w-full rounded-lg px-3 py-3 text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
            style={{
              background: 'var(--bg-input)',
              border: '1px solid var(--border-secondary)',
            }}
            autoFocus
          />
          <p className="text-xs text-[var(--text-muted)] mt-2">
            Renaming from &quot;{originalName}&quot;
          </p>
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
            onClick={onRename}
            disabled={!name.trim() || name === originalName}
            className="flex-1 px-4 py-2 rounded-lg font-medium text-white transition-colors disabled:opacity-50"
            style={{
              background: 'var(--accent-primary)',
            }}
          >
            Rename
          </button>
        </div>
      </div>
    </div>
  )
}

export default RenameModal
