"use client";

import { useMemo } from "react";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

interface ActivityHeatmapProps {
  data: number[][];
  colorStart?: string;
  colorEnd?: string;
  showLegend?: boolean;
  cellHeight?: number;
  tooltipPrefix?: string;
}

export function ActivityHeatmap({
  data,
  colorStart = "rgba(var(--accent-primary-rgb),",
  colorEnd = "rgba(var(--status-info-rgb),",
  showLegend = true,
  cellHeight = 32,
  tooltipPrefix = "purchases",
}: ActivityHeatmapProps) {
  const maxValue = useMemo(() => Math.max(1, ...data.flat()), [data]);

  if (data.length !== 7 || data.some((row) => row.length !== 24)) {
    return (
      <div className="flex items-center justify-center h-32 text-[var(--text-muted)]">
        Invalid heatmap data
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[700px]">
        <div className="flex mb-2">
          <div className="w-12" />
          {Array(24)
            .fill(null)
            .map((_, h) => (
              <div key={h} className="flex-1 text-center text-xs text-[var(--text-muted)]">
                {h}
              </div>
            ))}
        </div>
        {data.map((row, dayIdx) => (
          <div key={dayIdx} className="flex items-center gap-1 mb-1">
            <div className="w-12 text-sm text-[var(--text-muted)] font-medium">{DAYS[dayIdx]}</div>
            {row.map((count, hourIdx) => {
              const intensity = count / maxValue;
              return (
                <div
                  key={hourIdx}
                  className="flex-1 rounded transition-all cursor-pointer hover:ring-2 hover:ring-white/30 hover:scale-105"
                  style={{
                    height: cellHeight,
                    background: `linear-gradient(135deg, ${colorStart}${Math.max(intensity * 0.95, 0.08)}), ${colorEnd}${Math.max(intensity * 0.7, 0.05)}))`,
                  }}
                  title={`${DAYS[dayIdx]} ${hourIdx}:00 - ${count} ${tooltipPrefix}`}
                />
              );
            })}
          </div>
        ))}
        {showLegend && (
          <div className="flex items-center justify-end gap-3 mt-4">
            <span className="text-xs text-[var(--text-muted)]">Less</span>
            {[0.1, 0.3, 0.5, 0.7, 0.9].map((i) => (
              <div
                key={i}
                className="w-6 h-6 rounded"
                style={{
                  background: `linear-gradient(135deg, ${colorStart}${i}), ${colorEnd}${i * 0.7}))`,
                }}
              />
            ))}
            <span className="text-xs text-[var(--text-muted)]">More</span>
          </div>
        )}
      </div>
    </div>
  );
}
