'use client'

import { useState, useMemo } from 'react'
import { Edit3, X, FolderOpen, ArrowRight, Loader2 } from 'lucide-react'
import { SelectDropdown } from '../SelectDropdown'

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
    if (e.key === 'Escape') {
      onClose()
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
            Edit Kit
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
          {/* Name Field */}
          <div>
            <label className="block text-sm text-[var(--text-secondary)] mb-2">
              Kit Name
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
            <p className="text-xs text-[var(--text-muted)] mt-1.5">
              Current name: &quot;{originalName}&quot;
            </p>
          </div>

          {/* Move to Category */}
          {showCategorySection && (
            <div>
              <label className="block text-sm text-[var(--text-secondary)] mb-2">
                <span className="flex items-center gap-1.5">
                  <FolderOpen className="w-3.5 h-3.5" />
                  Move to Category
                </span>
              </label>
              <SelectDropdown
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
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="flex-1 px-4 py-2 rounded-lg font-medium text-white transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            style={{
              background: 'var(--accent-primary)',
            }}
          >
            {isMoving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : hasMove && hasNameChange ? (
              'Rename & Move'
            ) : hasMove ? (
              'Move Kit'
            ) : (
              'Rename'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

export default RenameModal
