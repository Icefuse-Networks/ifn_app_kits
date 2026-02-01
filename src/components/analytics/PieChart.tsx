"use client";

import { useMemo } from "react";
import type { EChartsOption } from "echarts";
import { EChartWrapper } from "./EChartWrapper";

const DEFAULT_COLORS = ['#a855f7', '#ec4899', '#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4', '#8b5cf6', '#f97316', '#14b8a6'];

interface PieChartData {
  name: string;
  value: number;
}

interface PieChartProps {
  data: PieChartData[];
  height?: string | number;
  colors?: string[];
  innerRadius?: string;
  outerRadius?: string;
  showLegend?: boolean;
  legendPosition?: "right" | "bottom";
  centerX?: string;
  borderColor?: string;
}

export function PieChart({
  data,
  height = "100%",
  colors = DEFAULT_COLORS,
  innerRadius = "45%",
  outerRadius = "75%",
  showLegend = true,
  legendPosition = "right",
  centerX = "35%",
  borderColor = "#0a0a0f",
}: PieChartProps) {
  const option = useMemo<EChartsOption | null>(() => {
    if (!data?.length) return null;

    return {
      tooltip: {
        trigger: "item",
        backgroundColor: "rgba(0,0,0,0.85)",
        borderColor: "rgba(168,85,247,0.5)",
        textStyle: { color: "#fff" },
      },
      legend: showLegend
        ? {
            orient: legendPosition === "right" ? "vertical" : "horizontal",
            [legendPosition === "right" ? "right" : "bottom"]: legendPosition === "right" ? 20 : 10,
            [legendPosition === "right" ? "top" : "left"]: legendPosition === "right" ? "center" : "center",
            textStyle: { color: "#888" },
          }
        : undefined,
      series: [
        {
          type: "pie",
          radius: [innerRadius, outerRadius],
          center: [legendPosition === "right" ? centerX : "50%", "50%"],
          avoidLabelOverlap: true,
          itemStyle: {
            borderRadius: 8,
            borderColor,
            borderWidth: 2,
          },
          label: { show: false },
          emphasis: {
            label: {
              show: true,
              fontSize: 14,
              fontWeight: "bold",
              color: "#fff",
            },
          },
          data: data.map((d, i) => ({
            value: d.value,
            name: d.name,
            itemStyle: { color: colors[i % colors.length] },
          })),
        },
      ],
    };
  }, [data, colors, innerRadius, outerRadius, showLegend, legendPosition, centerX, borderColor]);

  return <EChartWrapper option={option} height={height} />;
}
