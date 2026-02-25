/**
 * Custom Select Component
 *
 * A fully styled dropdown select that matches the site's dark theme.
 * Replaces native <select> elements to provide consistent styling across all browsers.
 */

'use client'

import { useState, useRef, useEffect, useId } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Check } from 'lucide-react'

// Removed: store-specific import - createDebugLogger from '@/lib/debug'

// ============================================================================
// Types
// ============================================================================

export interface SelectOption {
  value: string
  label: string
  disabled?: boolean
}

export interface SelectProps {
  /** Currently selected value */
  value: string
  /** Callback when selection changes */
  onChange: (value: string) => void
  /** Available options */
  options: SelectOption[]
  /** Placeholder text when no value selected */
  placeholder?: string
  /** Whether the select is disabled */
  disabled?: boolean
  /** Additional className for the trigger button */
  className?: string
  /** Size variant */
  size?: 'sm' | 'md' | 'lg'
  /** Error state */
  error?: boolean
  /** Full width */
  fullWidth?: boolean
  /** ID for form association */
  id?: string
  /** Name for form association */
  name?: string
  /** Label text */
  label?: string
}

// ============================================================================
// Size Styles
// ============================================================================

const sizeStyles = {
  sm: {
    trigger: 'px-3 py-2 text-sm',
    dropdown: 'py-1',
    option: 'px-3 py-2 text-sm',
  },
  md: {
    trigger: 'px-4 py-3 text-sm',
    dropdown: 'py-1',
    option: 'px-4 py-2.5 text-sm',
  },
  lg: {
    trigger: 'px-4 py-3.5 text-base',
    dropdown: 'py-1.5',
    option: 'px-4 py-3 text-base',
  },
}

// ============================================================================
// Select Component
// ============================================================================

export function Select({
  value,
  onChange,
  options,
  placeholder = 'Select an option',
  disabled = false,
  className = '',
  size = 'md',
  error = false,
  fullWidth = true,
  id,
  name,
  label,
}: SelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 })
  const containerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const generatedId = useId()
  const selectId = id || generatedId

  // Find selected option
  const selectedOption = options.find(opt => opt.value === value)

  // Update dropdown position when opened
  useEffect(() => {
    if (isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      setDropdownPosition({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
      })
    }
  }, [isOpen])

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node
      if (
        containerRef.current && !containerRef.current.contains(target) &&
        listRef.current && !listRef.current.contains(target)
      ) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  // Close on escape key
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false)
        triggerRef.current?.focus()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      return () => document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen])

  // Keyboard navigation
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (disabled) return

    switch (event.key) {
      case 'Enter':
      case ' ':
        event.preventDefault()
        if (isOpen && highlightedIndex >= 0) {
          const option = options[highlightedIndex]
          if (!option.disabled) {
            onChange(option.value)
            setIsOpen(false)
            triggerRef.current?.focus()
          }
        } else {
          setIsOpen(true)
          setHighlightedIndex(options.findIndex(opt => opt.value === value))
        }
        break
      case 'ArrowDown':
        event.preventDefault()
        if (!isOpen) {
          setIsOpen(true)
          setHighlightedIndex(options.findIndex(opt => opt.value === value))
        } else {
          setHighlightedIndex(prev => {
            const next = prev + 1
            let index = next
            while (index < options.length && options[index]?.disabled) {
              index++
            }
            return index < options.length ? index : prev
          })
        }
        break
      case 'ArrowUp':
        event.preventDefault()
        if (isOpen) {
          setHighlightedIndex(prev => {
            const next = prev - 1
            let index = next
            while (index >= 0 && options[index]?.disabled) {
              index--
            }
            return index >= 0 ? index : prev
          })
        }
        break
      case 'Home':
        event.preventDefault()
        if (isOpen) {
          const firstEnabled = options.findIndex(opt => !opt.disabled)
          setHighlightedIndex(firstEnabled)
        }
        break
      case 'End':
        event.preventDefault()
        if (isOpen) {
          for (let i = options.length - 1; i >= 0; i--) {
            if (!options[i].disabled) {
              setHighlightedIndex(i)
              break
            }
          }
        }
        break
    }
  }

  // Scroll highlighted option into view
  useEffect(() => {
    if (isOpen && highlightedIndex >= 0 && listRef.current) {
      const highlightedElement = listRef.current.children[highlightedIndex] as HTMLElement
      if (highlightedElement) {
        highlightedElement.scrollIntoView({ block: 'nearest' })
      }
    }
  }, [highlightedIndex, isOpen])

  const handleSelect = (optionValue: string) => {
    onChange(optionValue)
    setIsOpen(false)
    triggerRef.current?.focus()
  }

  const styles = sizeStyles[size]

  return (
    <div className="space-y-1.5">
      {label && (
        <label
          htmlFor={selectId}
          className="block text-sm font-medium text-[var(--text-muted)]"
        >
          {label}
        </label>
      )}
      <div
        ref={containerRef}
        className={`relative ${fullWidth ? 'w-full' : 'inline-block'}`}
      >
        {/* Hidden input for form submission */}
        {name && <input type="hidden" name={name} value={value} />}

        {/* Trigger Button */}
        <button
          ref={triggerRef}
          type="button"
          id={selectId}
          role="combobox"
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-controls={`${selectId}-listbox`}
          disabled={disabled}
          onClick={() => {
            if (!disabled) setIsOpen(!isOpen)
          }}
          onKeyDown={handleKeyDown}
          className={`
            ${fullWidth ? 'w-full' : ''}
            ${styles.trigger}
            flex items-center justify-between gap-2
            rounded-lg
            border transition-all duration-200
            text-left
            ${disabled
              ? 'opacity-50 cursor-not-allowed bg-[var(--glass-bg-subtle)] border-[var(--glass-border-subtle)]'
              : 'cursor-pointer hover:border-[var(--glass-border)]'
            }
            ${error
              ? 'border-[var(--status-error)] focus:border-[var(--status-error)]'
              : 'border-[var(--glass-border)] focus:border-[var(--accent-primary)]'
            }
            ${isOpen ? 'border-[var(--accent-primary)]' : ''}
            ${className}
          `}
          style={{
            backgroundColor: 'var(--bg-input)',
          }}
        >
          <span className={selectedOption ? 'text-white' : 'text-[var(--text-muted)]'}>
            {selectedOption?.label || placeholder}
          </span>
          <ChevronDown
            className={`w-4 h-4 text-[var(--text-muted)] transition-transform duration-200 flex-shrink-0 ${
              isOpen ? 'rotate-180' : ''
            }`}
          />
        </button>

        {/* Dropdown - Rendered in portal to avoid overflow clipping */}
        {isOpen && typeof document !== 'undefined' && createPortal(
          <div
            ref={listRef}
            id={`${selectId}-listbox`}
            role="listbox"
            aria-activedescendant={highlightedIndex >= 0 ? `${selectId}-option-${highlightedIndex}` : undefined}
            className={`
              max-h-60 overflow-auto
              rounded-xl
              ${styles.dropdown}
              scrollbar-thin
            `}
            style={{
              position: 'fixed',
              top: dropdownPosition.top,
              left: dropdownPosition.left,
              width: fullWidth ? dropdownPosition.width : 'auto',
              minWidth: fullWidth ? undefined : '200px',
              background: 'rgba(26, 26, 46, 0.95)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
              zIndex: 10100,
            }}
          >
            {options.map((option, index) => (
              <div
                key={option.value}
                id={`${selectId}-option-${index}`}
                role="option"
                aria-selected={option.value === value}
                aria-disabled={option.disabled}
                onClick={() => {
                  if (!option.disabled) handleSelect(option.value)
                }}
                onMouseEnter={() => !option.disabled && setHighlightedIndex(index)}
                className={`
                  ${styles.option}
                  flex items-center justify-between gap-2
                  cursor-pointer
                  transition-colors duration-150
                  ${option.disabled
                    ? 'opacity-40 cursor-not-allowed'
                    : ''
                  }
                  ${option.value === value
                    ? 'text-white bg-[var(--accent-primary)]/15'
                    : 'text-[var(--text-secondary)]'
                  }
                  ${highlightedIndex === index && !option.disabled
                    ? 'bg-[var(--accent-primary)]/20 text-white'
                    : ''
                  }
                  ${!option.disabled && option.value !== value && highlightedIndex !== index
                    ? 'hover:bg-[var(--glass-bg-prominent)] hover:text-white'
                    : ''
                  }
                `}
              >
                <span>{option.label}</span>
                {option.value === value && (
                  <Check className="w-4 h-4 text-[var(--accent-primary)] flex-shrink-0" />
                )}
              </div>
            ))}
          </div>,
          document.body
        )}
      </div>
    </div>
  )
}

export default Select
