/**
 * LineChart Component
 *
 * Pure React SVG line chart.
 */

interface LineChartPoint {
  label: string
  value: number
}

interface LineChartProps {
  data: LineChartPoint[]
  height?: number
  showDots?: boolean
  showGrid?: boolean
  color?: string
}

export function LineChart({
  data,
  height = 200,
  showDots = true,
  showGrid = true,
  color = 'var(--accent-primary)',
}: LineChartProps) {
  if (data.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-[var(--text-muted)]"
        style={{ height }}
      >
        No data available
      </div>
    )
  }

  const padding = { top: 20, right: 20, bottom: 30, left: 10 }
  const _width = 100 // percentage-based
  const chartHeight = height - padding.top - padding.bottom

  const maxValue = Math.max(...data.map((d) => d.value), 1)
  const minValue = 0

  // Calculate points
  const points = data.map((point, index) => {
    const x = (index / (data.length - 1 || 1)) * 100
    const y =
      chartHeight -
      ((point.value - minValue) / (maxValue - minValue || 1)) * chartHeight
    return { x, y: y + padding.top, value: point.value, label: point.label }
  })

  // Create path
  const pathD = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
    .join(' ')

  // Create area path
  const areaD = `${pathD} L ${points[points.length - 1]?.x || 0} ${
    chartHeight + padding.top
  } L 0 ${chartHeight + padding.top} Z`

  // Grid lines
  const gridLines = [0, 0.25, 0.5, 0.75, 1].map((ratio) => ({
    y: padding.top + chartHeight * (1 - ratio),
    value: Math.round(minValue + (maxValue - minValue) * ratio),
  }))

  return (
    <div className="relative" style={{ height }}>
      <svg
        viewBox={`0 0 100 ${height}`}
        preserveAspectRatio="none"
        className="w-full h-full"
      >
        {/* Grid lines */}
        {showGrid &&
          gridLines.map((line, i) => (
            <g key={i}>
              <line
                x1="0"
                y1={line.y}
                x2="100"
                y2={line.y}
                stroke="var(--border-secondary)"
                strokeWidth="0.2"
                strokeDasharray="2,2"
              />
            </g>
          ))}

        {/* Area fill */}
        <path
          d={areaD}
          fill={`url(#gradient-${color.replace(/[^a-zA-Z]/g, '')})`}
          opacity="0.3"
        />

        {/* Line */}
        <path
          d={pathD}
          fill="none"
          stroke={color}
          strokeWidth="0.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
          style={{ strokeWidth: '2px' }}
        />

        {/* Dots */}
        {showDots &&
          points.map((point, i) => (
            <circle
              key={i}
              cx={point.x}
              cy={point.y}
              r="1"
              fill={color}
              className="hover:r-2 transition-all"
              vectorEffect="non-scaling-stroke"
              style={{ r: '3px' }}
            />
          ))}

        {/* Gradient definition */}
        <defs>
          <linearGradient
            id={`gradient-${color.replace(/[^a-zA-Z]/g, '')}`}
            x1="0"
            y1="0"
            x2="0"
            y2="1"
          >
            <stop offset="0%" stopColor={color} stopOpacity="0.4" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>

      {/* X-axis labels */}
      {data.length <= 14 && (
        <div className="absolute bottom-0 left-0 right-0 flex justify-between text-xs text-[var(--text-muted)]">
          {data
            .filter((_, i) => i % Math.ceil(data.length / 7) === 0)
            .map((point, i) => (
              <span key={i}>{point.label}</span>
            ))}
        </div>
      )}
    </div>
  )
}
