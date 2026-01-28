'use client'

import { X, Trash2, Package } from 'lucide-react'
import { getItemImageUrl } from '@/lib/rust-items'
import type { KitItem } from '@/types/kit'

// =============================================================================
// Types
// =============================================================================

interface ItemEditorProps {
  item: KitItem
  onUpdate: (updates: Partial<KitItem>) => void
  onDelete: () => void
  onClose: () => void
}

// =============================================================================
// Field Component
// =============================================================================

function Field({
  label,
  type = 'text',
  value,
  onChange,
  placeholder,
  min,
  max,
}: {
  label: string
  type?: 'text' | 'number'
  value: string | number
  onChange: (value: string) => void
  placeholder?: string
  min?: number
  max?: number
}) {
  return (
    <div>
      <label className="block text-[10px] text-[var(--text-muted)] uppercase tracking-wide mb-1">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        min={min}
        max={max}
        className="w-full rounded-lg px-2.5 py-1.5 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
        style={{
          background: 'var(--bg-input)',
          border: '1px solid var(--border-secondary)',
        }}
      />
    </div>
  )
}

// =============================================================================
// Item Editor
// =============================================================================

export function ItemEditor({
  item,
  onUpdate,
  onDelete,
  onClose,
}: ItemEditorProps) {
  return (
    <aside
      className="w-64 flex flex-col shrink-0"
      style={{
        background: 'rgba(255, 255, 255, 0.03)',
        borderLeft: '1px solid rgba(255, 255, 255, 0.10)',
      }}
    >
      {/* Header */}
      <div
        className="h-12 px-3 flex items-center justify-between shrink-0"
        style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.10)' }}
      >
        <h3 className="text-sm font-bold text-[var(--text-primary)]">
          Edit Item
        </h3>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4 min-h-0">
        {/* Item Preview */}
        <div className="flex items-center gap-3">
          <div
            className="w-12 h-12 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: 'rgba(0,0,0,0.4)' }}
          >
            <img
              src={getItemImageUrl(item.Shortname)}
              alt={item.Shortname}
              referrerPolicy="no-referrer"
              className="w-10 h-10 object-contain"
              onError={(e) => {
                ;(e.target as HTMLImageElement).style.display = 'none'
              }}
            />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-medium text-[var(--text-primary)] truncate">
              {item.Shortname}
            </h4>
            <span className="text-xs text-[var(--text-muted)]">
              Slot {item.Position + 1}
            </span>
          </div>
        </div>

        {/* Amount & Position */}
        <div className="grid grid-cols-2 gap-2">
          <Field
            label="Amount"
            type="number"
            value={item.Amount}
            onChange={(v) => onUpdate({ Amount: parseInt(v) || 1 })}
            min={1}
          />
          <Field
            label="Position"
            type="number"
            value={item.Position}
            onChange={(v) => onUpdate({ Position: parseInt(v) || 0 })}
            min={-1}
          />
        </div>

        {/* Skin ID */}
        <Field
          label="Skin ID"
          value={item.Skin}
          onChange={(v) => onUpdate({ Skin: v || 0 })}
          placeholder="0"
        />

        {/* Condition */}
        <div className="grid grid-cols-2 gap-2">
          <Field
            label="Condition %"
            type="number"
            value={Math.round(item.Condition * 100)}
            onChange={(v) =>
              onUpdate({ Condition: (parseFloat(v) || 100) / 100 })
            }
            min={0}
            max={100}
          />
          <Field
            label="Max Cond %"
            type="number"
            value={Math.round(item.MaxCondition * 100)}
            onChange={(v) =>
              onUpdate({ MaxCondition: (parseFloat(v) || 100) / 100 })
            }
            min={0}
            max={100}
          />
        </div>

        {/* Ammo */}
        <div className="grid grid-cols-2 gap-2">
          <Field
            label="Ammo"
            type="number"
            value={item.Ammo}
            onChange={(v) => onUpdate({ Ammo: parseInt(v) || 0 })}
            min={0}
          />
          <Field
            label="Ammo Type"
            value={item.Ammotype || ''}
            onChange={(v) => onUpdate({ Ammotype: v || null })}
            placeholder="ammo.rifle"
          />
        </div>

        {/* Frequency */}
        <Field
          label="Frequency"
          type="number"
          value={item.Frequency}
          onChange={(v) => onUpdate({ Frequency: parseInt(v) || 0 })}
          min={0}
        />

      </div>

      {/* Delete Button */}
      <div
        className="p-3 shrink-0"
        style={{ borderTop: '1px solid var(--glass-border)' }}
      >
        <button
          onClick={onDelete}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
          style={{
            background: 'rgba(var(--status-error-rgb), 0.15)',
            border: '1px solid var(--status-error)',
            color: 'var(--status-error)',
          }}
        >
          <Trash2 className="w-4 h-4" />
          Remove Item
        </button>
      </div>
    </aside>
  )
}

// =============================================================================
// Empty State
// =============================================================================

export function ItemEditorEmpty() {
  return (
    <aside
      className="w-64 flex flex-col items-center justify-center shrink-0"
      style={{
        background: 'rgba(255, 255, 255, 0.03)',
        borderLeft: '1px solid rgba(255, 255, 255, 0.10)',
      }}
    >
      <Package className="w-10 h-10 mb-3 text-[var(--text-muted)] opacity-50" />
      <p className="text-sm text-[var(--text-muted)] text-center px-4">
        Select a kit to start editing
      </p>
    </aside>
  )
}
