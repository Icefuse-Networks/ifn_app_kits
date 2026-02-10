"use client";

import { useMemo } from "react";
import type { EChartsOption } from "echarts";
import { EChartWrapper } from "./EChartWrapper";

type TimeSeriesData = Record<string, string | number>;

interface SeriesConfig {
  key: string;
  name: string;
  type: "bar" | "line";
  color: string;
  yAxisIndex?: number;
  smooth?: boolean;
  areaStyle?: boolean;
  barRadius?: [number, number, number, number];
}

interface TimeSeriesChartProps {
  data: TimeSeriesData[];
  series: SeriesConfig[];
  height?: string | number;
  xAxisKey?: string;
  xAxisRotate?: number;
  showDualYAxis?: boolean;
  yAxisNames?: [string, string];
}

export function TimeSeriesChart({
  data,
  series,
  height = "100%",
  xAxisKey = "date",
  xAxisRotate = 45,
  showDualYAxis = false,
  yAxisNames = ["Count", "Value"],
}: TimeSeriesChartProps) {
  const option = useMemo<EChartsOption | null>(() => {
    if (!data?.length) return null;

    const yAxis = showDualYAxis
      ? [
          {
            type: "value" as const,
            name: yAxisNames[0],
            axisLine: { lineStyle: { color: "rgba(255,255,255,0.1)" } },
            axisLabel: { color: "#888" },
            splitLine: { lineStyle: { color: "rgba(255,255,255,0.05)" } },
          },
          {
            type: "value" as const,
            name: yAxisNames[1],
            axisLine: { lineStyle: { color: "rgba(255,255,255,0.1)" } },
            axisLabel: { color: "#888" },
            splitLine: { show: false },
          },
        ]
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
        axisPointer: { type: "cross", crossStyle: { color: "#999" } },
        order: "valueDesc",
      },
      legend: {
        data: series.map((s) => s.name),
        textStyle: { color: "#888", fontSize: 10 },
        top: 0,
        type: series.length > 4 ? "scroll" : "plain",
        pageTextStyle: { color: "#888" },
        pageIconColor: "#a855f7",
        pageIconInactiveColor: "#444",
      },
      grid: { left: 60, right: showDualYAxis ? 60 : 20, top: 50, bottom: 60 },
      xAxis: {
        type: "category",
        data: data.map((d) => d[xAxisKey] as string),
        axisLine: { lineStyle: { color: "rgba(255,255,255,0.1)" } },
        axisLabel: { color: "#888", rotate: xAxisRotate, fontSize: 10 },
      },
      yAxis,
      series: series.map((s) => {
        const base: Record<string, unknown> = {
          name: s.name,
          type: s.type,
          data: data.map((d) => d[s.key]),
          yAxisIndex: s.yAxisIndex ?? 0,
        };

        if (s.type === "bar") {
          base.itemStyle = {
            color: {
              type: "linear",
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: s.color },
                { offset: 1, color: adjustColor(s.color, -30) },
              ],
            },
            borderRadius: s.barRadius ?? [4, 4, 0, 0],
          };
        } else {
          base.smooth = s.smooth ?? true;
          base.lineStyle = { color: s.color, width: 3 };
          base.itemStyle = { color: s.color };
          if (s.areaStyle) {
            base.areaStyle = {
              color: {
                type: "linear",
                x: 0,
                y: 0,
                x2: 0,
                y2: 1,
                colorStops: [
                  { offset: 0, color: `${s.color}4D` },
                  { offset: 1, color: `${s.color}00` },
                ],
              },
            };
          }
        }

        return base;
      }),
    };
  }, [data, series, xAxisKey, xAxisRotate, showDualYAxis, yAxisNames]);

  return <EChartWrapper option={option} height={height} />;
}

function adjustColor(hex: string, amount: number): string {
  const num = parseInt(hex.replace("#", ""), 16);
  const r = Math.min(255, Math.max(0, (num >> 16) + amount));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00ff) + amount));
  const b = Math.min(255, Math.max(0, (num & 0x0000ff) + amount));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}
