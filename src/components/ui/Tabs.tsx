'use client'

import { ReactNode } from 'react'

// =============================================================================
// Types
// =============================================================================

export interface Tab {
  id: string
  label: string
  icon?: ReactNode
  disabled?: boolean
  badge?: number
}

export interface TabsProps {
  tabs: Tab[]
  activeTab: string
  onChange: (tabId: string) => void
  variant?: 'default' | 'pills' | 'underline'
  size?: 'sm' | 'md' | 'lg'
  fullWidth?: boolean
  className?: string
}

// =============================================================================
// Tabs Component
// =============================================================================

export function Tabs({
  tabs,
  activeTab,
  onChange,
  variant = 'default',
  size = 'md',
  fullWidth = false,
  className = '',
}: TabsProps) {
  const sizeClasses = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  }

  const getTabClasses = (tab: Tab) => {
    const isActive = tab.id === activeTab
    const baseClasses = `inline-flex items-center gap-2 font-medium transition-all duration-200 ${
      tab.disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
    } ${sizeClasses[size]} ${fullWidth ? 'flex-1 justify-center' : ''}`

    if (variant === 'pills') {
      return `${baseClasses} rounded-lg ${
        isActive
          ? 'bg-[var(--accent-primary)] text-white'
          : 'text-[var(--text-secondary)] hover:bg-[var(--glass-bg)]'
      }`
    }

    if (variant === 'underline') {
      return `${baseClasses} border-b-2 ${
        isActive
          ? 'border-[var(--accent-primary)] text-[var(--accent-primary)]'
          : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-secondary)]'
      }`
    }

    // default variant
    return `${baseClasses} rounded-lg ${
      isActive
        ? 'bg-[var(--accent-primary)]/15 text-[var(--accent-primary)]'
        : 'text-[var(--text-secondary)] hover:bg-[var(--glass-bg)]'
    }`
  }

  const containerClasses = {
    default: 'inline-flex items-center gap-1 p-1 rounded-lg',
    pills: 'inline-flex items-center gap-1 p-1 rounded-lg',
    underline: 'inline-flex items-center gap-4 border-b border-[var(--border-secondary)]',
  }

  const containerStyles = {
    default: {
      background: 'var(--glass-bg)',
      border: '1px solid var(--glass-border)',
    },
    pills: {
      background: 'var(--glass-bg)',
      border: '1px solid var(--glass-border)',
    },
    underline: {},
  }

  return (
    <div
      className={`${containerClasses[variant]} ${fullWidth ? 'w-full' : ''} ${className}`}
      style={containerStyles[variant]}
      role="tablist"
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          role="tab"
          aria-selected={tab.id === activeTab}
          aria-disabled={tab.disabled}
          disabled={tab.disabled}
          onClick={() => !tab.disabled && onChange(tab.id)}
          className={getTabClasses(tab)}
        >
          {tab.icon && <span className="shrink-0">{tab.icon}</span>}
          <span>{tab.label}</span>
          {tab.badge !== undefined && tab.badge > 0 && (
            <span
              className="min-w-[1.25rem] h-5 px-1.5 flex items-center justify-center rounded-full text-xs font-bold"
              style={{
                background: tab.id === activeTab ? 'rgba(255,255,255,0.2)' : 'var(--accent-primary)',
                color: tab.id === activeTab ? 'white' : 'white',
              }}
            >
              {tab.badge > 99 ? '99+' : tab.badge}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}
