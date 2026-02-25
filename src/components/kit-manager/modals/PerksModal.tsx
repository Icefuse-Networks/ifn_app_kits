'use client'

import { useState, useRef, useCallback } from 'react'
import { Gift, Plus, Trash2, GripVertical, FolderOpen, ChevronDown, ChevronRight } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'

// =============================================================================
// Types
// =============================================================================

export interface Perk {
  id: string
  text: string
}

export interface PerkCategory {
  id: string
  name: string
  perks: Perk[]
  collapsed?: boolean
}

export interface PerksData {
  categories: PerkCategory[]
  uncategorized: Perk[]
}

interface PerksModalProps {
  onClose: () => void
  perksData: PerksData
  onSave: (data: PerksData) => void
}

// =============================================================================
// Helpers
// =============================================================================

let _idCounter = 0
function uid() {
  return `perk_${Date.now()}_${++_idCounter}`
}

// =============================================================================
// PerksModal Component
// =============================================================================

export function PerksModal({ onClose, perksData, onSave }: PerksModalProps) {
  const [data, setData] = useState<PerksData>(() => ({
    categories: perksData.categories.map((c) => ({ ...c, perks: [...c.perks] })),
    uncategorized: [...perksData.uncategorized],
  }))

  // Drag state
  const [dragPerk, setDragPerk] = useState<{ perkId: string; sourceCategory: string | null } | null>(null)
  const [dropTarget, setDropTarget] = useState<{ categoryId: string | null; index: number } | null>(null)
  const dragCounter = useRef(0)

  // Category name editing
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null)
  const [editingCategoryName, setEditingCategoryName] = useState('')

  // -------------------------------------------------------------------------
  // Category actions
  // -------------------------------------------------------------------------

  const addCategory = useCallback(() => {
    setData((prev) => ({
      ...prev,
      categories: [
        ...prev.categories,
        { id: uid(), name: 'New Category', perks: [], collapsed: false },
      ],
    }))
  }, [])

  const removeCategory = useCallback((catId: string) => {
    setData((prev) => {
      const cat = prev.categories.find((c) => c.id === catId)
      const orphanedPerks = cat ? cat.perks : []
      return {
        categories: prev.categories.filter((c) => c.id !== catId),
        uncategorized: [...prev.uncategorized, ...orphanedPerks],
      }
    })
  }, [])

  const renameCategory = useCallback((catId: string, name: string) => {
    setData((prev) => ({
      ...prev,
      categories: prev.categories.map((c) =>
        c.id === catId ? { ...c, name } : c
      ),
    }))
  }, [])

  const toggleCategoryCollapse = useCallback((catId: string) => {
    setData((prev) => ({
      ...prev,
      categories: prev.categories.map((c) =>
        c.id === catId ? { ...c, collapsed: !c.collapsed } : c
      ),
    }))
  }, [])

  // -------------------------------------------------------------------------
  // Perk actions
  // -------------------------------------------------------------------------

  const addPerk = useCallback((categoryId: string | null) => {
    const newPerk: Perk = { id: uid(), text: '' }
    setData((prev) => {
      if (categoryId === null) {
        return { ...prev, uncategorized: [...prev.uncategorized, newPerk] }
      }
      return {
        ...prev,
        categories: prev.categories.map((c) =>
          c.id === categoryId ? { ...c, perks: [...c.perks, newPerk] } : c
        ),
      }
    })
  }, [])

  const updatePerkText = useCallback((perkId: string, text: string, categoryId: string | null) => {
    setData((prev) => {
      if (categoryId === null) {
        return {
          ...prev,
          uncategorized: prev.uncategorized.map((p) =>
            p.id === perkId ? { ...p, text } : p
          ),
        }
      }
      return {
        ...prev,
        categories: prev.categories.map((c) =>
          c.id === categoryId
            ? { ...c, perks: c.perks.map((p) => (p.id === perkId ? { ...p, text } : p)) }
            : c
        ),
      }
    })
  }, [])

  const removePerk = useCallback((perkId: string, categoryId: string | null) => {
    setData((prev) => {
      if (categoryId === null) {
        return { ...prev, uncategorized: prev.uncategorized.filter((p) => p.id !== perkId) }
      }
      return {
        ...prev,
        categories: prev.categories.map((c) =>
          c.id === categoryId
            ? { ...c, perks: c.perks.filter((p) => p.id !== perkId) }
            : c
        ),
      }
    })
  }, [])

  // -------------------------------------------------------------------------
  // Drag and drop
  // -------------------------------------------------------------------------

  const handleDragStart = useCallback((e: React.DragEvent, perkId: string, sourceCategory: string | null) => {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', perkId)
    setDragPerk({ perkId, sourceCategory })
  }, [])

  const handleDragEnd = useCallback(() => {
    setDragPerk(null)
    setDropTarget(null)
    dragCounter.current = 0
  }, [])

  const handleDragEnterCategory = useCallback((e: React.DragEvent, categoryId: string | null) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounter.current++
    setDropTarget({ categoryId, index: -1 })
  }, [])

  const handleDragLeaveCategory = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounter.current--
    if (dragCounter.current <= 0) {
      setDropTarget(null)
      dragCounter.current = 0
    }
  }, [])

  const handleDragOverCategory = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }, [])

  const handleDrop = useCallback((e: React.DragEvent, targetCategoryId: string | null) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounter.current = 0

    if (!dragPerk) return

    setData((prev) => {
      // Remove perk from source
      let perkObj: Perk | null = null
      let newCategories = prev.categories.map((c) => {
        if (c.id === dragPerk.sourceCategory) {
          const perk = c.perks.find((p) => p.id === dragPerk.perkId)
          if (perk) perkObj = perk
          return { ...c, perks: c.perks.filter((p) => p.id !== dragPerk.perkId) }
        }
        return c
      })
      let newUncategorized = [...prev.uncategorized]
      if (dragPerk.sourceCategory === null) {
        const perk = newUncategorized.find((p) => p.id === dragPerk.perkId)
        if (perk) perkObj = perk
        newUncategorized = newUncategorized.filter((p) => p.id !== dragPerk.perkId)
      }

      if (!perkObj) return prev

      // Add perk to target
      if (targetCategoryId === null) {
        newUncategorized.push(perkObj)
      } else {
        newCategories = newCategories.map((c) =>
          c.id === targetCategoryId ? { ...c, perks: [...c.perks, perkObj!] } : c
        )
      }

      return { categories: newCategories, uncategorized: newUncategorized }
    })

    setDragPerk(null)
    setDropTarget(null)
  }, [dragPerk])

  // -------------------------------------------------------------------------
  // Render: Perk row
  // -------------------------------------------------------------------------

  const renderPerkRow = (perk: Perk, categoryId: string | null) => {
    const isDragging = dragPerk?.perkId === perk.id
    return (
      <div
        key={perk.id}
        draggable
        onDragStart={(e) => handleDragStart(e, perk.id, categoryId)}
        onDragEnd={handleDragEnd}
        className={`flex items-center gap-1.5 ${isDragging ? 'opacity-30' : ''}`}
      >
        <div className="cursor-grab active:cursor-grabbing p-0.5 text-[var(--text-muted)] hover:text-[var(--text-secondary)] shrink-0">
          <GripVertical className="w-3 h-3" />
        </div>
        <input
          type="text"
          value={perk.text}
          onChange={(e) => updatePerkText(perk.id, e.target.value, categoryId)}
          placeholder="Enter perk description..."
          className="flex-1 rounded px-2 py-1 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
          style={{
            background: 'var(--bg-input)',
            border: '1px solid var(--border-secondary)',
          }}
        />
        <button
          onClick={() => removePerk(perk.id, categoryId)}
          className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--status-error)] hover:bg-[rgba(var(--status-error-rgb),0.1)] transition-all cursor-pointer shrink-0"
          title="Remove perk"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    )
  }

  // -------------------------------------------------------------------------
  // Render: Category section
  // -------------------------------------------------------------------------

  const renderCategory = (cat: PerkCategory) => {
    const isDropTarget = dropTarget?.categoryId === cat.id && dragPerk && dragPerk.sourceCategory !== cat.id
    const isEditing = editingCategoryId === cat.id

    return (
      <div
        key={cat.id}
        className={`rounded-lg overflow-hidden transition-all ${isDropTarget ? 'ring-1 ring-[var(--accent-primary)]' : ''}`}
        style={{
          background: isDropTarget ? 'rgba(var(--accent-primary-rgb), 0.05)' : 'var(--glass-bg)',
          border: `1px solid ${isDropTarget ? 'var(--accent-primary)' : 'var(--glass-border)'}`,
        }}
        onDragEnter={(e) => handleDragEnterCategory(e, cat.id)}
        onDragLeave={handleDragLeaveCategory}
        onDragOver={handleDragOverCategory}
        onDrop={(e) => handleDrop(e, cat.id)}
      >
        {/* Category header */}
        <div
          className="flex items-center gap-2 px-2.5 py-2"
          style={{ borderBottom: cat.collapsed ? 'none' : '1px solid var(--glass-border)' }}
        >
          <button
            onClick={() => toggleCategoryCollapse(cat.id)}
            className="p-0.5 text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors cursor-pointer shrink-0"
          >
            {cat.collapsed
              ? <ChevronRight className="w-3.5 h-3.5" />
              : <ChevronDown className="w-3.5 h-3.5" />
            }
          </button>
          <FolderOpen className="w-3.5 h-3.5 text-[var(--accent-primary)] shrink-0" />
          {isEditing ? (
            <input
              autoFocus
              value={editingCategoryName}
              onChange={(e) => setEditingCategoryName(e.target.value)}
              onBlur={() => {
                if (editingCategoryName.trim()) {
                  renameCategory(cat.id, editingCategoryName.trim())
                }
                setEditingCategoryId(null)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  if (editingCategoryName.trim()) {
                    renameCategory(cat.id, editingCategoryName.trim())
                  }
                  setEditingCategoryId(null)
                }
                if (e.key === 'Escape') setEditingCategoryId(null)
              }}
              onClick={(e) => e.stopPropagation()}
              className="flex-1 rounded px-1.5 py-0.5 text-xs font-medium text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
              style={{
                background: 'var(--bg-input)',
                border: '1px solid var(--accent-primary)',
              }}
            />
          ) : (
            <span
              className="flex-1 text-xs font-medium text-[var(--text-primary)] cursor-text select-text"
              onDoubleClick={(e) => {
                e.stopPropagation()
                setEditingCategoryId(cat.id)
                setEditingCategoryName(cat.name)
              }}
              title="Double-click to rename"
            >
              {cat.name}
            </span>
          )}
          <span className="text-[10px] text-[var(--text-muted)] tabular-nums shrink-0">
            {cat.perks.length}
          </span>
          <button
            onClick={() => addPerk(cat.id)}
            className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--accent-primary)] hover:bg-[rgba(var(--accent-primary-rgb),0.1)] transition-all cursor-pointer shrink-0"
            title="Add perk to this category"
          >
            <Plus className="w-3 h-3" />
          </button>
          <button
            onClick={() => removeCategory(cat.id)}
            className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--status-error)] hover:bg-[rgba(var(--status-error-rgb),0.1)] transition-all cursor-pointer shrink-0"
            title="Delete category (perks move to uncategorized)"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>

        {/* Category perks */}
        {!cat.collapsed && (
          <div className="px-2.5 py-2 space-y-1.5">
            {cat.perks.length === 0 ? (
              <p className="text-[10px] text-[var(--text-muted)] italic px-5 py-2">
                Drag perks here or click + to add
              </p>
            ) : (
              cat.perks.map((perk) => renderPerkRow(perk, cat.id))
            )}
          </div>
        )}
      </div>
    )
  }

  // -------------------------------------------------------------------------
  // Render: Uncategorized section
  // -------------------------------------------------------------------------

  const renderUncategorized = () => {
    const isDropTarget = dropTarget?.categoryId === null && dragPerk && dragPerk.sourceCategory !== null
    return (
      <div
        className={`rounded-lg overflow-hidden transition-all ${isDropTarget ? 'ring-1 ring-[var(--accent-primary)]' : ''}`}
        style={{
          background: isDropTarget ? 'rgba(var(--accent-primary-rgb), 0.05)' : 'var(--glass-bg)',
          border: `1px solid ${isDropTarget ? 'var(--accent-primary)' : 'var(--glass-border)'}`,
        }}
        onDragEnter={(e) => handleDragEnterCategory(e, null)}
        onDragLeave={handleDragLeaveCategory}
        onDragOver={handleDragOverCategory}
        onDrop={(e) => handleDrop(e, null)}
      >
        <div
          className="flex items-center gap-2 px-2.5 py-2"
          style={{ borderBottom: '1px solid var(--glass-border)' }}
        >
          <Gift className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />
          <span className="flex-1 text-xs font-medium text-[var(--text-secondary)]">
            Uncategorized Perks
          </span>
          <span className="text-[10px] text-[var(--text-muted)] tabular-nums">
            {data.uncategorized.length}
          </span>
          <button
            onClick={() => addPerk(null)}
            className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--accent-primary)] hover:bg-[rgba(var(--accent-primary-rgb),0.1)] transition-all"
            title="Add uncategorized perk"
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>
        <div className="px-2.5 py-2 space-y-1.5">
          {data.uncategorized.length === 0 ? (
            <p className="text-[10px] text-[var(--text-muted)] italic px-5 py-2">
              No uncategorized perks
            </p>
          ) : (
            data.uncategorized.map((perk) => renderPerkRow(perk, null))
          )}
        </div>
      </div>
    )
  }

  // -------------------------------------------------------------------------
  // Main render
  // -------------------------------------------------------------------------

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title="Kit Perks"
      description="Define perks for this kit. Organize them into categories and drag to reorder."
      icon={<Gift className="h-5 w-5" />}
      size="xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              onSave(data)
              onClose()
            }}
          >
            Save Perks
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {/* Add category button */}
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<FolderOpen className="w-3.5 h-3.5" />}
            onClick={addCategory}
          >
            Add Category
          </Button>
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<Plus className="w-3.5 h-3.5" />}
            onClick={() => addPerk(null)}
          >
            Add Perk
          </Button>
        </div>

        {/* Categories */}
        {data.categories.map((cat) => renderCategory(cat))}

        {/* Uncategorized */}
        {renderUncategorized()}
      </div>
    </Modal>
  )
}

export default PerksModal
