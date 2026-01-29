'use client'

import { AlertCircle, Save, Trash2, X } from 'lucide-react'

// =============================================================================
// Types
// =============================================================================

interface UnsavedChangesModalProps {
  onClose: () => void
  onDiscard: () => void
  onSave: () => void
  categoryName: string
  isSaving: boolean
}

// =============================================================================
// Component
// =============================================================================

export function UnsavedChangesModal({
  onClose,
  onDiscard,
  onSave,
  categoryName,
  isSaving,
}: UnsavedChangesModalProps) {
  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50"
      onClick={onClose}
    >
      <div
        className="rounded-xl w-full max-w-sm"
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
            <AlertCircle className="h-5 w-5 text-[var(--status-warning)]" />
            Unsaved Changes
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
          <p className="text-sm text-[var(--text-secondary)]">
            You have unsaved changes to{' '}
            <span className="font-medium text-[var(--text-primary)]">
              &quot;{categoryName}&quot;
            </span>
            . What would you like to do?
          </p>
        </div>

        {/* Footer */}
        <div
          className="p-4 flex flex-col gap-2"
          style={{ borderTop: '1px solid var(--glass-border)' }}
        >
          <button
            onClick={onSave}
            disabled={isSaving}
            className="flex items-center justify-center gap-2 w-full px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-50"
            style={{ background: 'var(--accent-primary)' }}
          >
            <Save className="w-4 h-4" />
            {isSaving ? 'Saving...' : 'Save & Switch'}
          </button>
          <button
            onClick={onDiscard}
            disabled={isSaving}
            className="flex items-center justify-center gap-2 w-full px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            style={{
              background: 'rgba(var(--status-error-rgb), 0.1)',
              border: '1px solid rgba(var(--status-error-rgb), 0.3)',
              color: 'var(--status-error)',
            }}
          >
            <Trash2 className="w-4 h-4" />
            Discard & Switch
          </button>
          <button
            onClick={onClose}
            disabled={isSaving}
            className="w-full px-4 py-2 rounded-lg text-sm text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-card-hover)] disabled:opacity-50"
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
