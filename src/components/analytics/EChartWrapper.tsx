"use client";

import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";

interface EChartWrapperProps {
  option: EChartsOption | null;
  height?: string | number;
  emptyMessage?: string;
  className?: string;
}

export function EChartWrapper({
  option,
  height = "100%",
  emptyMessage = "No data",
  className = "",
}: EChartWrapperProps) {
  if (!option) {
    return (
      <div
        className={`flex items-center justify-center text-zinc-500 ${className}`}
        style={{ height }}
      >
        {emptyMessage}
      </div>
    );
  }

  return (
    <ReactECharts
      option={option}
      style={{ height }}
      className={className}
    />
  );
}
