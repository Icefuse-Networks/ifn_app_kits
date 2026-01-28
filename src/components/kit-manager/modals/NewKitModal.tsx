/**
 * NewKitModal Component
 *
 * Modal dialog for creating a new kit.
 */

'use client'

import { Plus, X } from 'lucide-react'

interface NewKitModalProps {
  /** Close modal callback */
  onClose: () => void
  /** Create kit callback */
  onCreate: () => void
  /** Kit name value */
  name: string
  /** Set kit name callback */
  setName: (name: string) => void
  /** Kit description value */
  description: string
  /** Set kit description callback */
  setDescription: (description: string) => void
}

export function NewKitModal({
  onClose,
  onCreate,
  name,
  setName,
  description,
  setDescription,
}: NewKitModalProps) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && name.trim()) {
      onCreate()
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
            <Plus className="h-5 w-5 text-[var(--accent-primary)]" />
            New Kit
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
          <div>
            <label className="block text-sm text-[var(--text-secondary)] mb-2">
              Kit Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="e.g., Daily"
              className="w-full rounded-lg px-3 py-3 text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
              style={{
                background: 'var(--bg-input)',
                border: '1px solid var(--border-secondary)',
              }}
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm text-[var(--text-secondary)] mb-2">
              Description (optional)
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="A brief description of this kit"
              className="w-full rounded-lg px-3 py-3 text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
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
            onClick={onCreate}
            disabled={!name.trim()}
            className="flex-1 px-4 py-2 rounded-lg font-medium text-white transition-colors disabled:opacity-50"
            style={{
              background: 'var(--accent-primary)',
            }}
          >
            Create
          </button>
        </div>
      </div>
    </div>
  )
}

export default NewKitModal
