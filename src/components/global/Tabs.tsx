/**
 * Tabs Component
 *
 * A flexible tabs component for organizing content into switchable panels.
 */

'use client'

import { createContext, useContext, useState, ReactNode } from 'react'
import { cn } from '@/lib/utils'

// ============================================================================
// Types
// ============================================================================

interface TabsContextValue {
  activeTab: string
  setActiveTab: (value: string) => void
}

export interface TabsProps {
  /** Default active tab value */
  defaultValue: string
  /** Controlled active tab value */
  value?: string
  /** Callback when active tab changes */
  onValueChange?: (value: string) => void
  /** Tab content */
  children: ReactNode
  /** Additional class name */
  className?: string
}

export interface TabsListProps {
  children: ReactNode
  className?: string
}

export interface TabsTriggerProps {
  value: string
  children: ReactNode
  disabled?: boolean
  className?: string
}

export interface TabsContentProps {
  value: string
  children: ReactNode
  className?: string
}

// ============================================================================
// Context
// ============================================================================

const TabsContext = createContext<TabsContextValue | null>(null)

function useTabsContext() {
  const context = useContext(TabsContext)
  if (!context) {
    throw new Error('Tabs components must be used within a Tabs provider')
  }
  return context
}

// ============================================================================
// Components
// ============================================================================

export function Tabs({
  defaultValue,
  value,
  onValueChange,
  children,
  className = '',
}: TabsProps) {
  const [internalValue, setInternalValue] = useState(defaultValue)

  const activeTab = value ?? internalValue
  const setActiveTab = (newValue: string) => {
    if (!value) {
      setInternalValue(newValue)
    }
    onValueChange?.(newValue)
  }

  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab }}>
      <div className={className}>
        {children}
      </div>
    </TabsContext.Provider>
  )
}

export function TabsList({ children, className = '' }: TabsListProps) {
  return (
    <div
      className={cn(
        'flex gap-1 p-1',
        'bg-[var(--bg-card)] rounded-lg',
        'border border-[var(--glass-border)]',
        className
      )}
    >
      {children}
    </div>
  )
}

export function TabsTrigger({
  value,
  children,
  disabled = false,
  className = '',
}: TabsTriggerProps) {
  const { activeTab, setActiveTab } = useTabsContext()
  const isActive = activeTab === value

  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      disabled={disabled}
      onClick={() => !disabled && setActiveTab(value)}
      className={cn(
        'flex-1 px-4 py-2 rounded-md',
        'border-none text-sm',
        'transition-all duration-150',
        isActive
          ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)] font-medium'
          : 'bg-transparent text-[var(--text-secondary)] font-normal hover:text-[var(--text-primary)]',
        disabled && 'opacity-50 cursor-not-allowed',
        !disabled && 'cursor-pointer',
        className
      )}
    >
      {children}
    </button>
  )
}

export function TabsContent({
  value,
  children,
  className = '',
}: TabsContentProps) {
  const { activeTab } = useTabsContext()

  if (activeTab !== value) {
    return null
  }

  return (
    <div
      role="tabpanel"
      className={cn('mt-4', className)}
    >
      {children}
    </div>
  )
}
