'use client'

import { ReactNode, useState } from 'react'
import { ChevronDown } from 'lucide-react'

// =============================================================================
// Types
// =============================================================================

export interface AccordionItem {
  id: string
  title: string
  content: ReactNode
  icon?: ReactNode
  disabled?: boolean
  defaultOpen?: boolean
}

export interface AccordionProps {
  items: AccordionItem[]
  allowMultiple?: boolean
  className?: string
}

export interface SingleAccordionProps {
  title: string
  children: ReactNode
  icon?: ReactNode
  isOpen: boolean
  onToggle: () => void
  disabled?: boolean
  className?: string
}

// =============================================================================
// Single Accordion Item
// =============================================================================

export function AccordionItem({
  title,
  children,
  icon,
  isOpen,
  onToggle,
  disabled = false,
  className = '',
}: SingleAccordionProps) {
  return (
    <div
      className={`rounded-lg overflow-hidden ${className}`}
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-secondary)',
      }}
    >
      <button
        onClick={() => !disabled && onToggle()}
        disabled={disabled}
        className={`w-full flex items-center justify-between gap-3 px-4 py-3 text-left transition-colors ${
          disabled
            ? 'opacity-50 cursor-not-allowed'
            : 'hover:bg-[var(--glass-bg)] cursor-pointer'
        }`}
      >
        <div className="flex items-center gap-2 flex-1">
          {icon && <span className="text-[var(--accent-primary)] shrink-0">{icon}</span>}
          <span className="font-medium text-[var(--text-primary)]">{title}</span>
        </div>
        <ChevronDown
          className={`w-4 h-4 text-[var(--text-muted)] transition-transform shrink-0 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {isOpen && (
        <div
          className="px-4 py-3"
          style={{
            borderTop: '1px solid var(--border-secondary)',
          }}
        >
          {children}
        </div>
      )}
    </div>
  )
}

// =============================================================================
// Accordion Component (Multiple Items)
// =============================================================================

export function Accordion({
  items,
  allowMultiple = false,
  className = '',
}: AccordionProps) {
  const [openItems, setOpenItems] = useState<Set<string>>(() => {
    const defaultOpen = new Set<string>()
    items.forEach((item) => {
      if (item.defaultOpen) {
        defaultOpen.add(item.id)
      }
    })
    return defaultOpen
  })

  const toggleItem = (id: string) => {
    setOpenItems((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        if (!allowMultiple) {
          next.clear()
        }
        next.add(id)
      }
      return next
    })
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {items.map((item) => (
        <AccordionItem
          key={item.id}
          title={item.title}
          icon={item.icon}
          isOpen={openItems.has(item.id)}
          onToggle={() => toggleItem(item.id)}
          disabled={item.disabled}
        >
          {item.content}
        </AccordionItem>
      ))}
    </div>
  )
}
