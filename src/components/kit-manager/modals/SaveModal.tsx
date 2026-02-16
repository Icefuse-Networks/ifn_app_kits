/**
 * SaveModal Component
 *
 * Modal dialog for saving kit configuration.
 */

'use client'

import { Save } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Input, Textarea } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'

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
  }

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title="Save Configuration"
      icon={<Save className="h-5 w-5 text-[var(--status-success)]" />}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} fullWidth>
            Cancel
          </Button>
          <Button
            variant="success"
            onClick={onSave}
            disabled={!name.trim()}
            loading={isSaving}
            leftIcon={<Save className="h-4 w-4" />}
            fullWidth
          >
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input
          label="Name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="e.g., 5x Server Kits"
          autoFocus
        />
        <Textarea
          label="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Brief description..."
          rows={3}
        />
      </div>
    </Modal>
  )
}

export default SaveModal
