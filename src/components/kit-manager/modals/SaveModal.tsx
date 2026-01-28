/**
 * SaveModal Component
 *
 * Modal dialog for saving kit configuration.
 */

'use client'

import { Save, X } from 'lucide-react'

interface SaveModalProps {
  /** Close modal callback */
  onClose: () => void
  /** Save callback */
  onSave: () => void
  /** Config name value */
  name: string
  /** Set config name callback */
  setName: (name: string) => void
  /** Config description value */
  description: string
  /** Set config description callback */
  setDescription: (description: string) => void
  /** Whether save is in progress */
  isSaving: boolean
}

export function SaveModal({
  onClose,
  onSave,
  name,
  setName,
  description,
  setDescription,
  isSaving,
}: SaveModalProps) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && name.trim() && !isSaving) {
      onSave()
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
            <Save className="h-5 w-5 text-[var(--status-success)]" />
            Save Configuration
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
              Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="e.g., 5x Server Kits"
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
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description..."
              rows={3}
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
            onClick={onSave}
            disabled={isSaving || !name.trim()}
            className="flex-1 px-4 py-2 rounded-lg font-medium text-white transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            style={{
              background: 'var(--status-success)',
            }}
          >
            {isSaving ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <Save className="h-4 w-4" />
                Save
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

export default SaveModal
