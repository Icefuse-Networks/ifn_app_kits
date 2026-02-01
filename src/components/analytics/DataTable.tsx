"use client";

import { ReactNode } from "react";

const DEFAULT_COLORS = ['#a855f7', '#ec4899', '#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4', '#8b5cf6', '#f97316', '#14b8a6'];

export interface Column<T> {
  key: keyof T | string;
  header: string;
  align?: "left" | "center" | "right";
  render?: (value: unknown, row: T, index: number) => ReactNode;
  className?: string;
  headerClassName?: string;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  keyExtractor: (row: T, index: number) => string;
  emptyMessage?: string;
  emptyIcon?: ReactNode;
  showRowColors?: boolean;
  colors?: string[];
}

export function DataTable<T>({
  data,
  columns,
  keyExtractor,
  emptyMessage = "No data available",
  emptyIcon,
  showRowColors = false,
  colors = DEFAULT_COLORS,
}: DataTableProps<T>) {
  if (data.length === 0) {
    return (
      <div className="text-center py-12 text-zinc-500">
        {emptyIcon && <div className="mb-3">{emptyIcon}</div>}
        <p>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-white/10">
            {columns.map((col) => (
              <th
                key={String(col.key)}
                className={`px-4 py-3 text-xs font-semibold text-zinc-400 uppercase ${
                  col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left"
                } ${col.headerClassName || ""}`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, idx) => (
            <tr
              key={keyExtractor(row, idx)}
              className="border-b border-white/5 hover:bg-white/[0.03] transition-colors"
            >
              {columns.map((col) => {
                const value = typeof col.key === "string" && col.key.includes(".")
                  ? col.key.split(".").reduce((o: unknown, k) => (o as Record<string, unknown>)?.[k], row)
                  : (row as Record<string, unknown>)[col.key as string];

                return (
                  <td
                    key={String(col.key)}
                    className={`px-4 py-3 text-sm ${
                      col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left"
                    } ${col.className || ""}`}
                  >
                    {col.render ? (
                      col.render(value, row, idx)
                    ) : showRowColors && col.key === columns[0].key ? (
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ background: colors[idx % colors.length] }}
                        />
                        <span className="text-white font-medium truncate">{String(value)}</span>
                      </div>
                    ) : (
                      String(value ?? "")
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface ShareBarProps {
  value: number;
  total: number;
  colorIndex?: number;
  colors?: string[];
}

export function ShareBar({ value, total, colorIndex = 0, colors = DEFAULT_COLORS }: ShareBarProps) {
  const share = total ? (value / total) * 100 : 0;
  const color1 = colors[colorIndex % colors.length];
  const color2 = colors[(colorIndex + 1) % colors.length];

  return (
    <div className="flex items-center gap-2">
      <div className="w-24 h-2 rounded-full overflow-hidden bg-white/10">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${share}%`, background: `linear-gradient(90deg, ${color1}, ${color2})` }}
        />
      </div>
      <span className="text-xs text-zinc-400 w-12">{share.toFixed(1)}%</span>
    </div>
  );
}

interface RankBadgeProps {
  rank: number;
}

export function RankBadge({ rank }: RankBadgeProps) {
  if (rank > 3) {
    return <span className="text-zinc-500 pl-2">{rank}</span>;
  }

  const colors = {
    1: "bg-yellow-500/20 text-yellow-400",
    2: "bg-gray-400/20 text-gray-300",
    3: "bg-orange-500/20 text-orange-400",
  };

  return (
    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold ${colors[rank as 1 | 2 | 3]}`}>
      {rank}
    </div>
  );
}
