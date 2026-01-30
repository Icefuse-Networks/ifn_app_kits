/**
 * BarChart Component
 *
 * Pure React horizontal bar chart using CSS flexbox.
 */

interface BarChartItem {
  label: string
  value: number
  color?: string
}

interface BarChartProps {
  data: BarChartItem[]
  maxItems?: number
  showValues?: boolean
  valueFormatter?: (value: number) => string
}

export function BarChart({
  data,
  maxItems = 10,
  showValues = true,
  valueFormatter = (v) => v.toLocaleString(),
}: BarChartProps) {
  const displayData = data.slice(0, maxItems)
  const maxValue = Math.max(...displayData.map((d) => d.value), 1)

  if (displayData.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-[var(--text-muted)]">
        No data available
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {displayData.map((item, index) => {
        const percentage = (item.value / maxValue) * 100

        return (
          <div key={item.label} className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="text-[var(--text-primary)] truncate max-w-[60%]">
                {item.label}
              </span>
              {showValues && (
                <span className="text-[var(--text-secondary)] font-medium">
                  {valueFormatter(item.value)}
                </span>
              )}
            </div>

            <div
              className="h-6 rounded-[var(--radius-sm)] overflow-hidden"
              style={{ background: 'var(--bg-input)' }}
            >
              <div
                className="h-full rounded-[var(--radius-sm)] transition-all duration-500 ease-out flex items-center justify-end pr-2"
                style={{
                  width: `${Math.max(percentage, 2)}%`,
                  background: item.color || 'var(--accent-primary)',
                  transitionDelay: `${index * 50}ms`,
                }}
              >
                {percentage > 15 && (
                  <span className="text-xs font-medium text-white opacity-90">
                    {percentage.toFixed(0)}%
                  </span>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
