'use client'

import { useState } from 'react'
import { Edit3, FolderOpen, ArrowRight } from 'lucide-react'
import { Dropdown } from '@/components/ui/Dropdown'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'

// =============================================================================
// Types
// =============================================================================

interface CategoryOption {
  id: string
  name: string
}

interface RenameModalProps {
  onClose: () => void
  onRename: () => void
  onMoveToCategory?: (targetCategoryId: string, newName?: string) => void
  name: string
  setName: (name: string) => void
  originalName: string
  categories?: CategoryOption[]
  currentCategoryId?: string | null
  isMoving?: boolean
}

// =============================================================================
// Component
// =============================================================================

export function RenameModal({
  onClose,
  onRename,
  onMoveToCategory,
  name,
  setName,
  originalName,
  categories,
  currentCategoryId,
  isMoving,
}: RenameModalProps) {
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)

  const hasNameChange = name.trim() !== '' && name !== originalName
  const hasMove = selectedCategoryId !== null && selectedCategoryId !== currentCategoryId
  const canSubmit = (hasNameChange || hasMove) && !isMoving

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && canSubmit) {
      handleSubmit()
    }
  }

  const handleSubmit = () => {
    if (hasMove && onMoveToCategory) {
      // Move handles rename too — pass new name if changed
      onMoveToCategory(selectedCategoryId!, hasNameChange ? name.trim() : undefined)
    } else if (hasNameChange) {
      // Rename only (no move)
      onRename()
    }
  }

  // Filter out current category from the list
  const otherCategories = categories?.filter((c) => c.id !== currentCategoryId) ?? []
  const showCategorySection = otherCategories.length > 0 && onMoveToCategory

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title="Edit Kit"
      leftIcon={<Edit3 className="h-5 w-5" />}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} fullWidth>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={!canSubmit}
            loading={isMoving}
            fullWidth
          >
            {hasMove && hasNameChange
              ? 'Rename & Move'
              : hasMove
              ? 'Move Kit'
              : 'Rename'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Name Field */}
        <Input
          label="Kit Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={originalName}
          helperText={`Current name: "${originalName}"`}
          autoFocus
        />

        {/* Move to Category */}
        {showCategorySection && (
          <div>
            <label className="block text-sm text-[var(--text-secondary)] mb-2">
              <span className="flex items-center gap-1.5">
                <FolderOpen className="w-3.5 h-3.5" />
                Move to Category
              </span>
            </label>
            <Dropdown
              value={selectedCategoryId}
              onChange={(value) => setSelectedCategoryId(value)}
              options={otherCategories.map((cat) => ({
                value: cat.id,
                label: cat.name,
              }))}
              emptyOption="Keep in current category"
            />
            {selectedCategoryId && (
              <div
                className="flex items-center gap-2 mt-2 px-3 py-2 rounded-lg text-xs"
                style={{
                  background: 'rgba(var(--accent-primary-rgb), 0.1)',
                  border: '1px solid rgba(var(--accent-primary-rgb), 0.3)',
                  color: 'var(--accent-primary)',
                }}
              >
                <ArrowRight className="w-3.5 h-3.5 shrink-0" />
                <span>
                  This kit will be moved to &quot;
                  {otherCategories.find((c) => c.id === selectedCategoryId)?.name}
                  &quot;
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}

export default RenameModal
