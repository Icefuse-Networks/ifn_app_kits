'use client'

import { useState, useEffect, useRef } from 'react'
import { Tags, Folder, FolderPlus, Edit3 } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'

// =============================================================================
// Types
// =============================================================================

export type GroupModalMode =
  | 'create-group'
  | 'edit-group'
  | 'create-subgroup'
  | 'edit-subgroup'

interface GroupModalProps {
  mode: GroupModalMode
  /** Pre-filled name for edit modes */
  initialName?: string
  /** Parent group name — shown as context for subgroup modes */
  parentGroupName?: string
  onClose: () => void
  onSubmit: (name: string) => void
}

// =============================================================================
// Config by mode
// =============================================================================

const MODE_CONFIG: Record<
  GroupModalMode,
  { title: string; label: string; placeholder: string; submitLabel: string }
> = {
  'create-group': {
    title: 'New Group',
    label: 'Group Name',
    placeholder: 'e.g. Paid Kits',
    submitLabel: 'Create Group',
  },
  'edit-group': {
    title: 'Rename Group',
    label: 'Group Name',
    placeholder: 'Enter group name',
    submitLabel: 'Save',
  },
  'create-subgroup': {
    title: 'New Subgroup',
    label: 'Subgroup Name',
    placeholder: 'e.g. Weekly Kits',
    submitLabel: 'Create Subgroup',
  },
  'edit-subgroup': {
    title: 'Rename Subgroup',
    label: 'Subgroup Name',
    placeholder: 'Enter subgroup name',
    submitLabel: 'Save',
  },
}

// =============================================================================
// Component
// =============================================================================

export function GroupModal({
  mode,
  initialName = '',
  parentGroupName,
  onClose,
  onSubmit,
}: GroupModalProps) {
  const [name, setName]   = useState(initialName)
  const inputRef          = useRef<HTMLInputElement>(null)
  const config            = MODE_CONFIG[mode]
  const isEdit            = mode === 'edit-group' || mode === 'edit-subgroup'
  const isSubgroup        = mode === 'create-subgroup' || mode === 'edit-subgroup'

  const canSubmit = name.trim().length > 0 && (!isEdit || name.trim() !== initialName)

  useEffect(() => {
    inputRef.current?.select()
  }, [])

  const handleSubmit = () => {
    if (!canSubmit) return
    onSubmit(name.trim())
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSubmit()
  }

  const icon = isEdit
    ? <Edit3 className="h-5 w-5" />
    : isSubgroup
    ? <FolderPlus className="h-5 w-5" />
    : <Tags className="h-5 w-5" />

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={config.title}
      icon={icon}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} fullWidth>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={!canSubmit}
            fullWidth
          >
            {config.submitLabel}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Parent context — shown for subgroup modes */}
        {isSubgroup && parentGroupName && (
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
            style={{
              background: 'rgba(var(--accent-primary-rgb), 0.08)',
              border: '1px solid rgba(var(--accent-primary-rgb), 0.2)',
            }}
          >
            <Folder className="w-3.5 h-3.5 shrink-0 text-[var(--accent-primary)]" />
            <span className="text-[var(--text-secondary)]">
              Inside{' '}
              <span className="font-medium text-[var(--accent-primary)]">
                {parentGroupName}
              </span>
            </span>
          </div>
        )}

        <Input
          ref={inputRef}
          label={config.label}
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={config.placeholder}
          maxLength={100}
          autoFocus
        />
      </div>
    </Modal>
  )
}
