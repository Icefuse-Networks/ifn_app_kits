/**
 * MultiplierModal Component
 *
 * Modal dialog for applying multiplier to item amounts.
 */

'use client'

import { Percent, X } from 'lucide-react'

interface MultiplierModalProps {
  /** Close modal callback */
  onClose: () => void
  /** Apply multiplier callback */
  onApply: () => void
  /** Multiplier value */
  value: number
  /** Set multiplier value callback */
  setValue: (value: number) => void
  /** Whether to apply to amounts */
  applyAmount: boolean
  /** Set apply to amounts callback */
  setApplyAmount: (apply: boolean) => void
  /** Skip items with amount 1 */
  skipOnes: boolean
  /** Set skip ones callback */
  setSkipOnes: (skip: boolean) => void
  /** Scope: current kit or all kits */
  scope: 'current' | 'all'
  /** Set scope callback */
  setScope: (scope: 'current' | 'all') => void
  /** Whether a kit is selected */
  hasSelectedKit: boolean
}

export function MultiplierModal({
  onClose,
  onApply,
  value,
  setValue,
  applyAmount,
  setApplyAmount,
  skipOnes,
  setSkipOnes,
  scope,
  setScope,
  hasSelectedKit,
}: MultiplierModalProps) {
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
            <Percent className="h-5 w-5 text-[var(--accent-primary)]" />
            Multiplier
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
          {/* Multiplier Value */}
          <div>
            <label className="block text-sm text-[var(--text-secondary)] mb-2">
              Multiplier Value
            </label>
            <input
              type="number"
              value={value}
              onChange={(e) => setValue(parseFloat(e.target.value) || 1)}
              min={0.1}
              step={0.1}
              className="w-full rounded-lg px-3 py-2 text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
              style={{
                background: 'var(--bg-input)',
                border: '1px solid var(--border-secondary)',
              }}
            />
          </div>

          {/* Apply To */}
          <div>
            <label className="block text-sm text-[var(--text-secondary)] mb-2">
              Apply To
            </label>
            <label
              className={`cursor-pointer select-none rounded-full px-4 py-2 text-sm font-medium transition inline-block ${
                applyAmount
                  ? 'text-[var(--accent-primary)]'
                  : 'text-[var(--text-muted)]'
              }`}
              style={{
                background: applyAmount
                  ? 'rgba(var(--accent-primary-rgb), 0.15)'
                  : 'var(--glass-bg)',
                border: applyAmount
                  ? '1px solid var(--accent-primary)'
                  : '1px solid var(--glass-border)',
              }}
            >
              <input
                type="checkbox"
                className="sr-only"
                checked={applyAmount}
                onChange={() => setApplyAmount(!applyAmount)}
              />
              Amount
            </label>
          </div>

          {/* Options */}
          <div>
            <label className="block text-sm text-[var(--text-secondary)] mb-2">
              Options
            </label>
            <label
              className={`cursor-pointer select-none rounded-full px-4 py-2 text-sm font-medium transition inline-block ${
                skipOnes
                  ? 'text-[var(--status-warning)]'
                  : 'text-[var(--text-muted)]'
              }`}
              style={{
                background: skipOnes
                  ? 'rgba(var(--status-warning-rgb), 0.15)'
                  : 'var(--glass-bg)',
                border: skipOnes
                  ? '1px solid var(--status-warning)'
                  : '1px solid var(--glass-border)',
              }}
            >
              <input
                type="checkbox"
                className="sr-only"
                checked={skipOnes}
                onChange={() => setSkipOnes(!skipOnes)}
              />
              Skip items at 1
            </label>
          </div>

          {/* Scope */}
          <div>
            <label className="block text-sm text-[var(--text-secondary)] mb-2">
              Scope
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => setScope('current')}
                disabled={!hasSelectedKit}
                className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition ${
                  scope === 'current' && hasSelectedKit
                    ? 'text-white'
                    : 'text-[var(--text-muted)]'
                } disabled:opacity-50`}
                style={{
                  background:
                    scope === 'current' && hasSelectedKit
                      ? 'var(--accent-primary)'
                      : 'var(--glass-bg)',
                  border: '1px solid var(--glass-border)',
                }}
              >
                Current Kit
              </button>
              <button
                onClick={() => setScope('all')}
                className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition ${
                  scope === 'all'
                    ? 'text-white'
                    : 'text-[var(--text-muted)]'
                }`}
                style={{
                  background:
                    scope === 'all' ? 'var(--accent-primary)' : 'var(--glass-bg)',
                  border: '1px solid var(--glass-border)',
                }}
              >
                All Kits
              </button>
            </div>
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
            onClick={onApply}
            className="flex-1 px-4 py-2 rounded-lg font-medium text-white transition-colors"
            style={{
              background: 'var(--accent-primary)',
            }}
          >
            Apply {value}x
          </button>
        </div>
      </div>
    </div>
  )
}

export default MultiplierModal
