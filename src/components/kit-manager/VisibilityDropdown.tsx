'use client'

import { useState } from 'react'
import { Eye, EyeOff, ChevronDown } from 'lucide-react'

interface VisibilityDropdownProps {
  isHidden: boolean
  hideWithoutPermission: boolean
  onChange: (values: { isHidden: boolean; hideWithoutPermission: boolean }) => void
}

export function VisibilityDropdown({
  isHidden,
  hideWithoutPermission,
  onChange,
}: VisibilityDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg transition-colors hover:bg-[var(--bg-card-hover)]"
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--glass-border)',
        }}
      >
        {isHidden ? (
          <EyeOff className="w-4 h-4 text-[var(--text-secondary)]" />
        ) : (
          <Eye className="w-4 h-4 text-[var(--text-secondary)]" />
        )}
        <span className="text-sm text-[var(--text-primary)]">
          {isHidden ? 'Hidden' : 'Visible'}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-[var(--text-muted)] transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div
            className="absolute top-full left-0 mt-1 w-64 rounded-lg py-2 shadow-lg z-20"
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--glass-border)',
            }}
          >
            <label className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-[var(--bg-card-hover)] transition-colors">
              <input
                type="checkbox"
                checked={isHidden}
                onChange={(e) =>
                  onChange({ isHidden: e.target.checked, hideWithoutPermission })
                }
                className="rounded"
              />
              <div className="flex-1">
                <div className="text-sm text-[var(--text-primary)]">Hidden</div>
                <div className="text-xs text-[var(--text-muted)]">
                  Kit won't appear in lists
                </div>
              </div>
            </label>
            <label className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-[var(--bg-card-hover)] transition-colors">
              <input
                type="checkbox"
                checked={hideWithoutPermission}
                onChange={(e) =>
                  onChange({ isHidden, hideWithoutPermission: e.target.checked })
                }
                className="rounded"
              />
              <div className="flex-1">
                <div className="text-sm text-[var(--text-primary)]">
                  Hide Without Permission
                </div>
                <div className="text-xs text-[var(--text-muted)]">
                  Only show to users with permission
                </div>
              </div>
            </label>
          </div>
        </>
      )}
    </div>
  )
}
