/**
 * StatCard Component
 *
 * Summary metric card with glass morphism styling.
 */

import { LucideIcon } from 'lucide-react'

interface StatCardProps {
  label: string
  value: string | number
  icon?: LucideIcon
  trend?: {
    value: number
    isPositive: boolean
  }
  description?: string
}

export function StatCard({
  label,
  value,
  icon: Icon,
  trend,
  description,
}: StatCardProps) {
  return (
    <div
      className="p-6 rounded-[var(--radius-lg)] transition-all duration-200"
      style={{
        background: 'var(--glass-bg)',
        border: '1px solid var(--glass-border)',
      }}
    >
      <div className="flex items-start justify-between mb-2">
        <span className="text-sm text-[var(--text-secondary)]">{label}</span>
        {Icon && (
          <div
            className="w-8 h-8 rounded-[var(--radius-md)] flex items-center justify-center"
            style={{ background: 'var(--accent-primary)/10' }}
          >
            <Icon className="w-4 h-4 text-[var(--accent-primary)]" />
          </div>
        )}
      </div>

      <div className="flex items-end gap-2">
        <span className="text-2xl font-bold text-[var(--text-primary)]">
          {typeof value === 'number' ? value.toLocaleString() : value}
        </span>

        {trend && (
          <span
            className={`text-sm font-medium ${
              trend.isPositive
                ? 'text-[var(--status-success)]'
                : 'text-[var(--status-error)]'
            }`}
          >
            {trend.isPositive ? '+' : ''}
            {trend.value}%
          </span>
        )}
      </div>

      {description && (
        <p className="mt-1 text-xs text-[var(--text-muted)]">{description}</p>
      )}
    </div>
  )
}
