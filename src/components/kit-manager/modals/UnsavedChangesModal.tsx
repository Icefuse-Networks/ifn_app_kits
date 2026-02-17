'use client'

import { AlertCircle, Save, Trash2 } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'

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
    <Modal
      isOpen={true}
      onClose={onClose}
      title="Unsaved Changes"
      leftIcon={<AlertCircle className="h-5 w-5 text-[var(--status-warning)]" />}
      size="sm"
    >
      <div className="space-y-4">
        <p className="text-sm text-[var(--text-secondary)]">
          You have unsaved changes to{' '}
          <span className="font-medium text-[var(--text-primary)]">
            &quot;{categoryName}&quot;
          </span>
          . What would you like to do?
        </p>

        <div className="flex flex-col gap-2">
          <Button
            variant="primary"
            onClick={onSave}
            disabled={isSaving}
            loading={isSaving}
            loadingText="Saving..."
            leftIcon={<Save className="w-4 h-4" />}
            fullWidth
          >
            Save & Switch
          </Button>
          <Button
            variant="error"
            onClick={onDiscard}
            disabled={isSaving}
            leftIcon={<Trash2 className="w-4 h-4" />}
            fullWidth
          >
            Discard & Switch
          </Button>
          <Button variant="secondary" onClick={onClose} disabled={isSaving} fullWidth>
            Cancel
          </Button>
        </div>
      </div>
    </Modal>
  )
}
