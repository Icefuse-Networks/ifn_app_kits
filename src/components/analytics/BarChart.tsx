"use client";

import { useMemo } from "react";
import type { EChartsOption } from "echarts";
import { EChartWrapper } from "./EChartWrapper";

const DEFAULT_COLORS = ['#a855f7', '#ec4899', '#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4', '#8b5cf6', '#f97316', '#14b8a6'];

interface BarChartData {
  label: string;
  value: number;
}

interface BarChartProps {
  data: BarChartData[];
  height?: string | number;
  colors?: string[];
  horizontal?: boolean;
  showLabels?: boolean;
  maxItems?: number;
  labelWidth?: number;
  gradient?: boolean;
  barRadius?: number;
  valueFormatter?: (value: number) => string;
}

export function BarChart({
  data,
  height = "100%",
  colors = DEFAULT_COLORS,
  horizontal = true,
  showLabels = true,
  maxItems = 10,
  labelWidth = 120,
  gradient = true,
  barRadius = 4,
  valueFormatter = (v) => v.toLocaleString(),
}: BarChartProps) {
  const option = useMemo<EChartsOption | null>(() => {
    if (!data?.length) return null;

    const displayData = data.slice(0, maxItems);
    const labels = displayData.map((d) =>
      d.label.length > 30 ? d.label.slice(0, 28) + "…" : d.label
    );

    const seriesData = displayData.map((d, i) => {
      const color1 = colors[i % colors.length];
      const color2 = colors[(i + 1) % colors.length];
      return {
        value: d.value,
        itemStyle: gradient
          ? {
              color: {
                type: "linear" as const,
                x: horizontal ? 0 : 0,
                y: horizontal ? 0 : 0,
                x2: horizontal ? 1 : 0,
                y2: horizontal ? 0 : 1,
                colorStops: [
                  { offset: 0, color: color1 },
                  { offset: 1, color: color2 },
                ],
              },
              borderRadius: horizontal ? [0, barRadius, barRadius, 0] : [barRadius, barRadius, 0, 0],
            }
          : {
              color: color1,
              borderRadius: horizontal ? [0, barRadius, barRadius, 0] : [barRadius, barRadius, 0, 0],
            },
      };
    });

    const xAxis = horizontal
      ? {
          type: "value" as const,
          axisLine: { lineStyle: { color: "rgba(255,255,255,0.1)" } },
          axisLabel: { color: "#888" },
          splitLine: { lineStyle: { color: "rgba(255,255,255,0.05)" } },
        }
      : {
          type: "category" as const,
          data: labels,
          axisLine: { lineStyle: { color: "rgba(255,255,255,0.1)" } },
          axisLabel: { color: "#888", rotate: 45, fontSize: 10 },
        };

    const yAxis = horizontal
      ? {
          type: "category" as const,
          data: labels,
          axisLine: { lineStyle: { color: "rgba(255,255,255,0.1)" } },
          axisLabel: { color: "#fff", fontSize: 11 },
        }
      : {
          type: "value" as const,
          axisLine: { lineStyle: { color: "rgba(255,255,255,0.1)" } },
          axisLabel: { color: "#888" },
          splitLine: { lineStyle: { color: "rgba(255,255,255,0.05)" } },
        };

    return {
      tooltip: {
        trigger: "axis",
        backgroundColor: "rgba(0,0,0,0.85)",
        borderColor: "rgba(168,85,247,0.5)",
        textStyle: { color: "#fff" },
        axisPointer: { type: "shadow" },
      },
      grid: {
        left: horizontal ? labelWidth : 40,
        right: showLabels ? 60 : 20,
        top: 20,
        bottom: horizontal ? 20 : 80,
      },
      xAxis,
      yAxis,
      series: [
        {
          type: "bar",
          data: seriesData,
          label: showLabels
            ? {
                show: true,
                position: horizontal ? ("right" as const) : ("top" as const),
                color: "#fff",
                fontSize: 11,
                formatter: (p: unknown) => valueFormatter((p as { value: number }).value),
              }
            : undefined,
        },
      ],
    };
  }, [data, colors, horizontal, showLabels, maxItems, labelWidth, gradient, barRadius, valueFormatter]);

  return <EChartWrapper option={option} height={height} />;
}
