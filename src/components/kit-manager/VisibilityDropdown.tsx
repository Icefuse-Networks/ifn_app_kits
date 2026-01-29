'use client'

import { useState, useRef, useEffect } from 'react'
import { Eye, EyeOff, ChevronDown, Lock, Check } from 'lucide-react'

// =============================================================================
// Types
// =============================================================================

interface VisibilityOption {
  id: 'hidden' | 'hideWithoutPermission'
  label: string
  description: string
  icon: typeof Eye
}

interface VisibilityDropdownProps {
  isHidden: boolean
  hideWithoutPermission: boolean
  onChange: (values: { isHidden: boolean; hideWithoutPermission: boolean }) => void
}

const VISIBILITY_OPTIONS: VisibilityOption[] = [
  {
    id: 'hidden',
    label: 'Hidden',
    description: 'Hide from all players',
    icon: EyeOff,
  },
  {
    id: 'hideWithoutPermission',
    label: 'Hide Without Permission',
    description: 'Hide from players without required permission',
    icon: Lock,
  },
]

// =============================================================================
// Component
// =============================================================================

export function VisibilityDropdown({
  isHidden,
  hideWithoutPermission,
  onChange,
}: VisibilityDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const selectedCount = [isHidden, hideWithoutPermission].filter(Boolean).length
  const hasAnyHidden = isHidden || hideWithoutPermission

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen])

  const toggleOption = (optionId: 'hidden' | 'hideWithoutPermission') => {
    if (optionId === 'hidden') {
      onChange({ isHidden: !isHidden, hideWithoutPermission })
    } else {
      onChange({ isHidden, hideWithoutPermission: !hideWithoutPermission })
    }
  }

  const getOptionChecked = (optionId: 'hidden' | 'hideWithoutPermission') => {
    return optionId === 'hidden' ? isHidden : hideWithoutPermission
  }

  return (
    <div ref={dropdownRef} className="relative shrink-0">
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition cursor-pointer ${
          hasAnyHidden
            ? 'text-[var(--status-warning)]'
            : 'text-[var(--text-muted)]'
        }`}
        style={{
          background: hasAnyHidden
            ? 'rgba(var(--status-warning-rgb), 0.15)'
            : 'var(--glass-bg)',
          border: hasAnyHidden
            ? '1px solid var(--status-warning)'
            : '1px solid var(--glass-border)',
        }}
      >
        {hasAnyHidden ? (
          <EyeOff className="w-3 h-3" />
        ) : (
          <Eye className="w-3 h-3" />
        )}
        <span>
          {selectedCount === 0
            ? 'Visible'
            : selectedCount === 1
              ? isHidden
                ? 'Hidden'
                : 'Permission Only'
              : `${selectedCount} Hidden`}
        </span>
        <ChevronDown
          className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div
          className="absolute left-0 top-full z-[9999] mt-1 w-56 rounded-lg overflow-hidden"
          style={{
            background:
              'linear-gradient(145deg, rgba(20, 35, 60, 0.95) 0%, rgba(15, 28, 50, 0.97) 50%, rgba(12, 22, 42, 0.98) 100%)',
            border: '1px solid rgba(255, 255, 255, 0.20)',
            backdropFilter: 'blur(60px) saturate(150%)',
            WebkitBackdropFilter: 'blur(60px) saturate(150%)',
            boxShadow:
              '0 4px 20px rgba(0, 0, 0, 0.30), 0 8px 32px rgba(0, 0, 0, 0.22), inset 0 1px 0 rgba(255, 255, 255, 0.25)',
          }}
        >
          <div className="p-1">
            {VISIBILITY_OPTIONS.map((option) => {
              const Icon = option.icon
              const isChecked = getOptionChecked(option.id)
              return (
                <button
                  key={option.id}
                  onClick={() => toggleOption(option.id)}
                  className={`w-full flex items-start gap-3 p-2 rounded-md text-left transition-colors ${
                    isChecked
                      ? 'bg-[var(--accent-primary)]/10'
                      : 'hover:bg-[var(--glass-bg-prominent)]'
                  }`}
                >
                  <div
                    className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                      isChecked
                        ? 'bg-[var(--accent-primary)] border-[var(--accent-primary)]'
                        : 'border-[var(--border-secondary)]'
                    }`}
                  >
                    {isChecked && <Check className="w-3 h-3 text-white" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <Icon
                        className={`w-3.5 h-3.5 ${
                          isChecked
                            ? 'text-[var(--accent-primary)]'
                            : 'text-[var(--text-muted)]'
                        }`}
                      />
                      <span
                        className={`text-sm font-medium ${
                          isChecked
                            ? 'text-[var(--text-primary)]'
                            : 'text-[var(--text-secondary)]'
                        }`}
                      >
                        {option.label}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">
                      {option.description}
                    </p>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export default VisibilityDropdown
