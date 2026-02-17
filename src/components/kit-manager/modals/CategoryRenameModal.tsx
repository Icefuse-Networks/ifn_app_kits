'use client'

import { useState, useEffect, useRef } from 'react'
import { AlertTriangle, Edit3 } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Input, Textarea } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'

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
  }

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title="Edit Category"
      leftIcon={<Edit3 className="h-5 w-5" />}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} fullWidth>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={() => onRename(name.trim(), description.trim())}
            disabled={!canSubmit}
            loading={isRenaming}
            fullWidth
          >
            Save Changes
          </Button>
        </>
      }
    >
      <div className="space-y-4">
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
            Renaming changes the config name used by game server plugins. Servers
            referencing &quot;{currentName}&quot; will need their CONFIG_NAME updated to
            match.
          </span>
        </div>

        {/* Name */}
        <Input
          ref={inputRef}
          label="Name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={handleKeyDown}
          maxLength={100}
          placeholder="e.g. 5x Alpha"
          autoFocus
        />

        {/* Description */}
        <Textarea
          label="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Brief description..."
          rows={3}
          maxLength={500}
        />
      </div>
    </Modal>
  )
}
