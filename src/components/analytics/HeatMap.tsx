/**
 * HeatMap Component
 *
 * Pure React 24x7 grid for time-of-day patterns.
 */

interface HeatMapProps {
  data: number[][]  // 7 days x 24 hours
  maxValue?: number
  showLabels?: boolean
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const HOUR_LABELS = ['12a', '3a', '6a', '9a', '12p', '3p', '6p', '9p']

export function HeatMap({ data, maxValue, showLabels = true }: HeatMapProps) {
  // Calculate max value if not provided
  const calculatedMax = maxValue ?? Math.max(...data.flat(), 1)

  // Get color intensity based on value
  const getIntensity = (value: number): string => {
    if (value === 0) return 'var(--bg-input)'

    const intensity = Math.min(value / calculatedMax, 1)

    // Use cyan accent with varying opacity
    if (intensity < 0.25) return 'rgba(0, 213, 255, 0.2)'
    if (intensity < 0.5) return 'rgba(0, 213, 255, 0.4)'
    if (intensity < 0.75) return 'rgba(0, 213, 255, 0.6)'
    return 'rgba(0, 213, 255, 0.9)'
  }

  if (!data || data.length !== 7) {
    return (
      <div className="flex items-center justify-center h-32 text-[var(--text-muted)]">
        Invalid heat map data
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {/* Hour labels */}
      {showLabels && (
        <div className="flex pl-10">
          {HOUR_LABELS.map((label, i) => (
            <div
              key={label}
              className="text-xs text-[var(--text-muted)]"
              style={{ width: `${100 / 8}%` }}
            >
              {label}
            </div>
          ))}
        </div>
      )}

      {/* Grid */}
      <div className="space-y-1">
        {data.map((dayData, dayIndex) => (
          <div key={dayIndex} className="flex items-center gap-2">
            {/* Day label */}
            {showLabels && (
              <div className="w-8 text-xs text-[var(--text-muted)] text-right">
                {DAY_LABELS[dayIndex]}
              </div>
            )}

            {/* Hour cells */}
            <div className="flex-1 flex gap-[2px]">
              {dayData.map((value, hourIndex) => (
                <div
                  key={hourIndex}
                  className="flex-1 aspect-square rounded-[2px] transition-colors duration-200 cursor-pointer hover:ring-1 hover:ring-[var(--accent-primary)]"
                  style={{ background: getIntensity(value) }}
                  title={`${DAY_LABELS[dayIndex]} ${hourIndex}:00 - ${value} redemptions`}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-end gap-2 text-xs text-[var(--text-muted)]">
        <span>Less</span>
        <div className="flex gap-[2px]">
          <div
            className="w-3 h-3 rounded-[2px]"
            style={{ background: 'var(--bg-input)' }}
          />
          <div
            className="w-3 h-3 rounded-[2px]"
            style={{ background: 'rgba(0, 213, 255, 0.2)' }}
          />
          <div
            className="w-3 h-3 rounded-[2px]"
            style={{ background: 'rgba(0, 213, 255, 0.4)' }}
          />
          <div
            className="w-3 h-3 rounded-[2px]"
            style={{ background: 'rgba(0, 213, 255, 0.6)' }}
          />
          <div
            className="w-3 h-3 rounded-[2px]"
            style={{ background: 'rgba(0, 213, 255, 0.9)' }}
          />
        </div>
        <span>More</span>
      </div>
    </div>
  )
}
