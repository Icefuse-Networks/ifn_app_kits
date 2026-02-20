"use client";

import React, { useState, useCallback, useEffect, useMemo, useRef } from "react";
import {
  BarChart3, Server, Users, TrendingUp, RefreshCw, Clock, Activity, Zap, ChevronDown, Check, Sparkles
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  StatCard, ChartCard, BarChart, PieChart, TimeSeriesChart, ActivityHeatmap, DataTable, Column,
} from "@/components/analytics";
import { EChartWrapper } from "@/components/analytics/EChartWrapper";
import { Dropdown } from "@/components/ui/Dropdown";
import { Button } from "@/components/ui/Button";
import { Tabs } from "@/components/ui/Tabs";
import { Loading } from "@/components/ui/Loading";

interface TimeSeriesPoint {
  time_bucket: string; server_ip: string; server_name: string;
  avg_players: number; max_players: number; min_players: number; capacity: number;
}
interface TotalsPoint { time_bucket: string; total_players: number; total_capacity: number; server_count: number; }
interface AggregateData {
  server_ip: string; server_name: string; category: string;
  avg_players: number; peak_players: number; min_players: number;
  avg_capacity: number; data_points: number; avg_utilization: number;
}
interface HeatmapPoint { day_of_week: number; hour: number; avg_players: number; }
interface ServerOption { server_ip: string; server_name: string; }

type TimeRange = "1h" | "6h" | "24h" | "7d" | "30d" | "custom";
type GroupBy = "minute" | "hour" | "day" | "week";

const TIME_PRESETS: Record<TimeRange, { label: string; hours?: number }> = {
  "1h": { label: "1 Hour", hours: 1 }, "6h": { label: "6 Hours", hours: 6 },
  "24h": { label: "24 Hours", hours: 24 }, "7d": { label: "7 Days", hours: 168 },
  "30d": { label: "30 Days", hours: 720 }, "custom": { label: "Custom" },
};
const COLORS = ["#a855f7", "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#ec4899", "#8b5cf6", "#14b8a6"];

/** Removes outlier spikes AND dips by replacing values that deviate too far from rolling median */
function removeSpikes<T>(data: T[], getValue: (item: T) => number, setValue: (item: T, v: number) => T, windowSize = 7): T[] {
  if (data.length < 3) return data;
  return data.map((item, i) => {
    const val = getValue(item);
    const start = Math.max(0, i - windowSize);
    const end = Math.min(data.length, i + windowSize + 1);
    const neighbors = data.slice(start, end).map(getValue).filter((_, j) => start + j !== i).sort((a, b) => a - b);
    // Use trimmed mean (drop top/bottom 20%) for more robust baseline
    const trimCount = Math.max(1, Math.floor(neighbors.length * 0.2));
    const trimmed = neighbors.slice(trimCount, -trimCount);
    const baseline = trimmed.length > 0 ? trimmed.reduce((a, b) => a + b, 0) / trimmed.length : (neighbors[Math.floor(neighbors.length / 2)] || val);
    if (baseline <= 0) return item;
    // Spike: value is more than 80% above baseline
    if (val > baseline * 1.8) return setValue(item, Math.round(baseline));
    // Dip: value drops below 40% of baseline
    if (val < baseline * 0.4) return setValue(item, Math.round(baseline));
    return item;
  });
}

const getServerKey = (o: ServerOption) => `${o.server_ip}::${o.server_name}`;

function MultiSelectDropdown({ options, selected, onChange, placeholder = "Select servers" }: {
  options: ServerOption[]; selected: string[]; onChange: (selected: string[]) => void; placeholder?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredOptions = options.filter(o =>
    o.server_name.toLowerCase().includes(search.toLowerCase()) || o.server_ip.toLowerCase().includes(search.toLowerCase())
  );
  const toggleOption = (key: string) => onChange(selected.includes(key) ? selected.filter(s => s !== key) : [...selected, key]);
  const displayText = selected.length === 0 ? placeholder : selected.length === options.length ? "All Servers" : `${selected.length} server${selected.length > 1 ? "s" : ""} selected`;

  return (
    <div ref={dropdownRef} className="relative">
      <button onClick={() => setIsOpen(!isOpen)} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm min-w-[200px] justify-between hover:border-purple-500/50 transition-colors">
        <span className={selected.length === 0 ? "text-zinc-400" : "text-white"}>{displayText}</span>
        <ChevronDown className={`h-4 w-4 text-zinc-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.15 }}
            className="absolute z-50 mt-2 w-80 rounded-lg bg-zinc-900 border border-white/10 shadow-xl overflow-hidden">
            <div className="p-2 border-b border-white/5">
              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search servers..."
                className="w-full px-3 py-2 rounded bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-purple-500" />
            </div>
            <div className="flex gap-2 p-2 border-b border-white/5">
              <button onClick={() => onChange(options.map(getServerKey))} className="flex-1 px-2 py-1 text-xs rounded bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 transition-colors">Select All</button>
              <button onClick={() => onChange([])} className="flex-1 px-2 py-1 text-xs rounded bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors">Clear All</button>
            </div>
            <div className="max-h-64 overflow-y-auto">
              {filteredOptions.length === 0 ? <div className="p-4 text-center text-zinc-500 text-sm">No servers found</div> :
                filteredOptions.map((option) => {
                  const key = getServerKey(option);
                  return (
                    <button key={key} onClick={() => toggleOption(key)} className="w-full flex items-center gap-3 px-3 py-2 hover:bg-white/5 transition-colors">
                      <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${selected.includes(key) ? "bg-purple-500 border-purple-500" : "border-white/20"}`}>
                        {selected.includes(key) && <Check className="h-3 w-3 text-white" />}
                      </div>
                      <div className="text-left flex-1 min-w-0">
                        <div className="text-white text-sm truncate">{option.server_name}</div>
                        <div className="text-zinc-500 text-xs truncate">{option.server_ip}</div>
                      </div>
                    </button>
                  );
                })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function ServersTab() {
  const [timeRange, setTimeRange] = useState<TimeRange>("24h");
  const [groupBy, setGroupBy] = useState<GroupBy>("hour");
  const [selectedServers, setSelectedServers] = useState<string[]>([]);
  const [servers, setServers] = useState<ServerOption[]>([]);
  const [timeseries, setTimeseries] = useState<TimeSeriesPoint[]>([]);
  const [totals, setTotals] = useState<TotalsPoint[]>([]);
  const [aggregate, setAggregate] = useState<AggregateData[]>([]);
  const [heatmap, setHeatmap] = useState<HeatmapPoint[]>([]);
  const [currentPlayers, setCurrentPlayers] = useState<{ total: number; capacity: number; count: number }>({ total: 0, capacity: 0, count: 0 });
  const [loading, setLoading] = useState(true);
  const [customFrom, setCustomFrom] = useState(() => { const d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); return d.toISOString().slice(0, 16); });
  const [customTo, setCustomTo] = useState(() => new Date().toISOString().slice(0, 16));

  const getTimeParams = useCallback(() => {
    if (timeRange === "custom" && customFrom && customTo) return { from: customFrom, to: customTo };
    const hours = TIME_PRESETS[timeRange].hours || 24;
    const now = new Date();
    return { from: new Date(now.getTime() - hours * 60 * 60 * 1000).toISOString(), to: now.toISOString() };
  }, [timeRange, customFrom, customTo]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { from, to } = getTimeParams();
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const baseParams = `from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&server=all&groupBy=${groupBy}&timezone=${encodeURIComponent(timezone)}`;
    try {
      const opts = { credentials: 'include' as const };
      const [serversRes, timeseriesRes, totalsRes, aggregateRes, heatmapRes, currentRes] = await Promise.all([
        fetch(`/api/analytics/server-stats?type=servers`, opts),
        fetch(`/api/analytics/server-stats?type=timeseries&${baseParams}`, opts),
        fetch(`/api/analytics/server-stats?type=totals&${baseParams}`, opts),
        fetch(`/api/analytics/server-stats?type=aggregate&${baseParams}`, opts),
        fetch(`/api/analytics/server-stats?type=heatmap&${baseParams}`, opts),
        fetch(`/api/analytics/server-stats?type=current`, opts),
      ]);
      const [serversData, timeseriesData, totalsData, aggregateData, heatmapData, currentData] = await Promise.all([
        serversRes.ok ? serversRes.json() : { servers: [] },
        timeseriesRes.ok ? timeseriesRes.json() : { data: [] },
        totalsRes.ok ? totalsRes.json() : { data: [] },
        aggregateRes.ok ? aggregateRes.json() : { data: [] },
        heatmapRes.ok ? heatmapRes.json() : { data: [] },
        currentRes.ok ? currentRes.json() : { totalPlayers: 0, totalCapacity: 0, serverCount: 0 },
      ]);
      setServers(serversData.servers || []); setTimeseries(timeseriesData.data || []);
      setTotals(totalsData.data || []); setAggregate(aggregateData.data || []);
      setHeatmap(heatmapData.data || []);
      setCurrentPlayers({ total: currentData.totalPlayers || 0, capacity: currentData.totalCapacity || 0, count: currentData.serverCount || 0 });
    } catch (err) { console.error("Failed to fetch analytics:", err); }
    finally { setLoading(false); }
  }, [getTimeParams, groupBy]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const totalPlayersData = useMemo(() => {
    const raw = totals.map((t) => {
      const parts = t.time_bucket.split(/[\s:-]/);
      const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]), parseInt(parts[3] || '0'), parseInt(parts[4] || '0'), parseInt(parts[5] || '0'));
      const dateStr = groupBy === "minute" || groupBy === "hour"
        ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        : d.toLocaleDateString([], { month: "short", day: "numeric" });
      return { date: dateStr, total_players: Number(t.total_players) };
    });
    return removeSpikes(raw, d => d.total_players, (d, v) => ({ ...d, total_players: v }));
  }, [totals, groupBy]);

  const heatmapGrid = useMemo(() => {
    const grid: number[][] = Array(7).fill(null).map(() => Array(24).fill(0));
    heatmap.forEach((h) => {
      const day = Number(h.day_of_week) - 1; const hour = Number(h.hour);
      if (day >= 0 && day < 7 && hour >= 0 && hour < 24) grid[day][hour] = Number(h.avg_players);
    });
    return grid;
  }, [heatmap]);

  const summaryStats = useMemo(() => {
    const totalAvg = aggregate.reduce((sum, a) => sum + Number(a.avg_players), 0);
    const totalPeak = Math.max(0, ...aggregate.map((a) => Number(a.peak_players)));
    const avgUtil = aggregate.length > 0 ? aggregate.reduce((sum, a) => sum + Number(a.avg_utilization), 0) / aggregate.length : 0;
    return { totalAvg: Math.round(totalAvg), totalPeak, avgUtil: avgUtil.toFixed(1), serverCount: aggregate.length };
  }, [aggregate]);

  const serverComparisonData = useMemo(() => {
    if (!timeseries.length) return { data: [], series: [] };
    const selectedServerKeys = new Set(selectedServers);
    const filteredTimeseries = selectedServers.length > 0
      ? timeseries.filter(t => selectedServerKeys.has(`${t.server_ip}::${t.server_name}`))
      : timeseries;
    if (!filteredTimeseries.length) return { data: [], series: [] };
    const serverGroups = new Map<string, TimeSeriesPoint[]>();
    filteredTimeseries.forEach((t) => {
      if (!serverGroups.has(t.server_name)) serverGroups.set(t.server_name, []);
      serverGroups.get(t.server_name)!.push(t);
    });
    const serverNames = Array.from(serverGroups.keys()).slice(0, 8);
    const allBuckets = [...new Set(filteredTimeseries.map(t => t.time_bucket))].sort();
    let data = allBuckets.map((bucket) => {
      const parts = bucket.split(/[\s:-]/);
      const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]), parseInt(parts[3] || '0'), parseInt(parts[4] || '0'), parseInt(parts[5] || '0'));
      const dateStr = groupBy === "minute" || groupBy === "hour"
        ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        : d.toLocaleDateString([], { month: "short", day: "numeric" });
      const row: Record<string, string | number> = { date: dateStr };
      serverNames.forEach((name) => {
        const point = serverGroups.get(name)?.find(p => p.time_bucket === bucket);
        row[name] = point ? Number(point.avg_players) : 0;
      });
      return row;
    });
    // Remove spikes per server series
    serverNames.forEach((name) => {
      data = removeSpikes(data, d => Number(d[name] || 0), (d, v) => ({ ...d, [name]: v }));
    });
    const series = serverNames.map((name, i) => ({
      key: name, name: name.length > 20 ? name.substring(0, 18) + "…" : name,
      type: "line" as const, color: COLORS[i % COLORS.length], smooth: true,
    }));
    return { data, series };
  }, [timeseries, groupBy, selectedServers]);

  const aggregateColumns: Column<AggregateData>[] = useMemo(() => [
    { key: "server_name", header: "Server", render: (_, row) => (<div><div className="text-white font-medium">{row.server_name}</div><div className="text-xs text-zinc-500">{row.server_ip}</div></div>) },
    { key: "category", header: "Category", className: "text-zinc-400" },
    { key: "avg_players", header: "Avg Players", align: "right" as const, render: (v) => <span className="text-white font-semibold">{Math.round(Number(v))}</span> },
    { key: "peak_players", header: "Peak", align: "right" as const, render: (v) => <span className="text-yellow-400 font-semibold">{Number(v)}</span> },
    { key: "avg_capacity", header: "Capacity", align: "right" as const, render: (v) => <span className="text-zinc-400">{Math.round(Number(v))}</span> },
    { key: "avg_utilization", header: "Utilization", align: "right" as const, render: (v) => {
      const util = Number(v);
      const color = util > 75 ? "text-green-400" : util > 50 ? "text-yellow-400" : "text-red-400";
      return <span className={`font-semibold ${color}`}>{util.toFixed(1)}%</span>;
    }},
    { key: "data_points", header: "Data Points", align: "right" as const, className: "text-zinc-500" },
  ], []);

  // --- Population Forecast ---
  const [forecastData, setForecastData] = useState<{ date: string; predicted: number; low: number; high: number; event: string }[]>([]);
  const [forecastLoading, setForecastLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setForecastLoading(true);
      try {
        const now = new Date();
        const from90 = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const opts = { credentials: 'include' as const };

        // Fetch 90-day hourly totals for pattern building
        const [heatmapRes, totalsRes] = await Promise.all([
          fetch(`/api/analytics/server-stats?type=heatmap&from=${encodeURIComponent(from90)}&to=${encodeURIComponent(now.toISOString())}&server=all&groupBy=hour&timezone=${encodeURIComponent(tz)}`, opts),
          fetch(`/api/analytics/server-stats?type=totals&from=${encodeURIComponent(from90)}&to=${encodeURIComponent(now.toISOString())}&server=all&groupBy=hour&timezone=${encodeURIComponent(tz)}`, opts),
        ]);
        const heatmapData = heatmapRes.ok ? await heatmapRes.json() : { data: [] };
        const totalsData = totalsRes.ok ? await totalsRes.json() : { data: [] };

        // Build day-of-week + hour pattern from heatmap (avg players per dow+hour)
        const pattern: Record<string, number> = {};
        (heatmapData.data || []).forEach((h: HeatmapPoint) => {
          pattern[`${Number(h.day_of_week)}-${Number(h.hour)}`] = Number(h.avg_players);
        });

        // Calculate stddev from hourly totals to build confidence bands
        const hourlyByDow: Record<string, number[]> = {};
        (totalsData.data || []).forEach((t: TotalsPoint) => {
          const parts = t.time_bucket.split(/[\s:-]/);
          const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]), parseInt(parts[3] || '0'));
          const dow = d.getDay() === 0 ? 7 : d.getDay(); // 1=Mon .. 7=Sun (ClickHouse convention)
          const hour = d.getHours();
          const key = `${dow}-${hour}`;
          if (!hourlyByDow[key]) hourlyByDow[key] = [];
          hourlyByDow[key].push(Number(t.total_players));
        });

        const stddevMap: Record<string, number> = {};
        Object.entries(hourlyByDow).forEach(([key, values]) => {
          const mean = values.reduce((a, b) => a + b, 0) / values.length;
          const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
          stddevMap[key] = Math.sqrt(variance);
        });

        // US holidays and school events for Eastern time (2025-2026 school year)
        const getEvents = (date: Date): { modifier: number; label: string }[] => {
          const m = date.getMonth() + 1;
          const d = date.getDate();
          const dow = date.getDay();
          const events: { modifier: number; label: string }[] = [];

          // Federal holidays (higher player count - kids off school)
          if (m === 1 && d === 1) events.push({ modifier: 1.35, label: "New Year's Day" });
          if (m === 1 && d >= 15 && d <= 21 && dow === 1) events.push({ modifier: 1.2, label: "MLK Day" });
          if (m === 2 && d >= 15 && d <= 21 && dow === 1) events.push({ modifier: 1.2, label: "Presidents' Day" });
          if (m === 5 && d >= 25 && d <= 31 && dow === 1) events.push({ modifier: 1.25, label: "Memorial Day" });
          if (m === 6 && d === 19) events.push({ modifier: 1.15, label: "Juneteenth" });
          if (m === 7 && d === 4) events.push({ modifier: 1.3, label: "Independence Day" });
          if (m === 9 && d >= 1 && d <= 7 && dow === 1) events.push({ modifier: 1.2, label: "Labor Day" });
          if (m === 10 && d >= 8 && d <= 14 && dow === 1) events.push({ modifier: 1.1, label: "Columbus Day" });
          if (m === 11 && d === 11) events.push({ modifier: 1.15, label: "Veterans Day" });
          if (m === 11 && d >= 22 && d <= 28 && dow === 4) events.push({ modifier: 1.3, label: "Thanksgiving" });
          if (m === 11 && d >= 23 && d <= 29 && dow === 5) events.push({ modifier: 1.25, label: "Black Friday" });
          if (m === 12 && d >= 24 && d <= 26) events.push({ modifier: 1.4, label: "Christmas" });
          if (m === 12 && d >= 27 && d <= 31) events.push({ modifier: 1.3, label: "Holiday Break" });

          // School calendar (Eastern US typical)
          // Summer break: ~Jun 15 - Aug 25 → more players
          if ((m === 6 && d >= 15) || m === 7 || (m === 8 && d <= 25))
            events.push({ modifier: 1.25, label: "Summer Break" });
          // Winter break: ~Dec 20 - Jan 3
          if ((m === 12 && d >= 20) || (m === 1 && d <= 3))
            events.push({ modifier: 1.3, label: "Winter Break" });
          // Spring break: ~Mar 10-21 or Apr 7-18 (varies by district, use mid-March)
          if (m === 3 && d >= 10 && d <= 21)
            events.push({ modifier: 1.2, label: "Spring Break" });
          // School start: ~Aug 26 - Sep 5 → dip in players
          if ((m === 8 && d >= 26) || (m === 9 && d <= 5))
            events.push({ modifier: 0.85, label: "School Start" });
          // School end: ~Jun 10-14 → slight bump (excitement)
          if (m === 6 && d >= 10 && d <= 14)
            events.push({ modifier: 1.1, label: "School Ending" });

          // Weekend boost
          if (dow === 0 || dow === 6) events.push({ modifier: 1.15, label: "Weekend" });
          // Friday evening boost handled by hourly pattern already

          return events;
        };

        // Generate 7-day hourly forecast
        const forecast: typeof forecastData = [];
        for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
          for (let hour = 0; hour < 24; hour += 3) { // every 3 hours for readability
            const futureDate = new Date(now.getTime() + (dayOffset * 24 + hour) * 60 * 60 * 1000);
            const dow = futureDate.getDay() === 0 ? 7 : futureDate.getDay();
            const key = `${dow}-${hour}`;
            let baseline = pattern[key] || 0;

            // Apply event modifiers (multiply them together)
            const events = getEvents(futureDate);
            let combinedModifier = 1;
            events.forEach(e => { combinedModifier *= e.modifier; });
            // Cap combined modifier
            combinedModifier = Math.min(combinedModifier, 1.6);

            const predicted = Math.round(baseline * combinedModifier);
            const sd = stddevMap[key] || predicted * 0.15;
            const low = Math.max(0, Math.round(predicted - sd));
            const high = Math.round(predicted + sd);

            const eventLabels = events.filter(e => e.label !== "Weekend").map(e => e.label);
            const dateLabel = futureDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
              + ' ' + futureDate.toLocaleTimeString('en-US', { hour: '2-digit', hour12: true });

            forecast.push({
              date: dateLabel,
              predicted,
              low,
              high,
              event: eventLabels.join(', '),
            });
          }
        }

        if (!cancelled) setForecastData(forecast);
      } catch (err) { console.error("Failed to build forecast:", err); }
      finally { if (!cancelled) setForecastLoading(false); }
    })();
    return () => { cancelled = true; };
  }, []);

  const forecastOption = useMemo(() => {
    if (!forecastData.length) return null;
    const dates = forecastData.map(f => f.date);
    const predicted = forecastData.map(f => f.predicted);
    const lowVals = forecastData.map(f => f.low);
    const bandWidth = forecastData.map(f => f.high - f.low);

    return {
      tooltip: {
        trigger: "axis",
        backgroundColor: "rgba(0,0,0,0.85)",
        borderColor: "rgba(16,185,129,0.5)",
        textStyle: { color: "#fff" },
        formatter: (params: { dataIndex: number; seriesName: string; value: number; marker: string }[]) => {
          const idx = params[0]?.dataIndex ?? 0;
          const f = forecastData[idx];
          if (!f) return '';
          let html = `<div style="font-weight:600;margin-bottom:4px">${f.date}</div>`;
          html += `<div>Predicted: <b style="color:#10b981">${f.predicted}</b> players</div>`;
          html += `<div style="color:#888">Range: ${f.low} - ${f.high}</div>`;
          if (f.event) html += `<div style="color:#f59e0b;margin-top:4px">${f.event}</div>`;
          return html;
        },
      },
      legend: {
        data: ["Predicted", "Confidence Range"],
        textStyle: { color: "#888", fontSize: 10 },
        top: 0,
      },
      grid: { left: 60, right: 20, top: 50, bottom: 80 },
      xAxis: {
        type: "category",
        data: dates,
        axisLine: { lineStyle: { color: "rgba(255,255,255,0.1)" } },
        axisLabel: { color: "#888", rotate: 45, fontSize: 9 },
      },
      yAxis: {
        type: "value",
        axisLine: { lineStyle: { color: "rgba(255,255,255,0.1)" } },
        axisLabel: { color: "#888" },
        splitLine: { lineStyle: { color: "rgba(255,255,255,0.05)" } },
      },
      series: [
        // Invisible low boundary (base for the band)
        {
          name: "Low",
          type: "line",
          data: lowVals,
          lineStyle: { opacity: 0 },
          areaStyle: { opacity: 0 },
          stack: "band",
          symbol: "none",
          tooltip: { show: false },
        },
        // Band between low and high
        {
          name: "Confidence Range",
          type: "line",
          data: bandWidth,
          lineStyle: { opacity: 0 },
          areaStyle: { color: "rgba(16,185,129,0.15)" },
          stack: "band",
          symbol: "none",
          tooltip: { show: false },
        },
        // Main prediction line
        {
          name: "Predicted",
          type: "line",
          data: predicted,
          smooth: true,
          lineStyle: { color: "#10b981", width: 3 },
          itemStyle: { color: "#10b981" },
          symbol: "circle",
          symbolSize: 4,
          z: 2,
        },
      ],
    };
  }, [forecastData]);

  return (
    <>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <MultiSelectDropdown options={servers} selected={selectedServers} onChange={setSelectedServers} placeholder="All Servers" />
        <Tabs
          tabs={(Object.keys(TIME_PRESETS) as TimeRange[]).map((range) => ({ id: range, label: TIME_PRESETS[range].label }))}
          activeTab={timeRange} onChange={(tab) => setTimeRange(tab as TimeRange)} variant="pills" size="sm"
        />
        {timeRange === "custom" && (
          <div className="flex items-center gap-2">
            <input type="datetime-local" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)}
              className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-purple-500" />
            <span className="text-zinc-500">to</span>
            <input type="datetime-local" value={customTo} onChange={(e) => setCustomTo(e.target.value)}
              className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-purple-500" />
          </div>
        )}
        <Dropdown value={groupBy} options={[
          { value: 'minute', label: 'By Minute' }, { value: 'hour', label: 'By Hour' },
          { value: 'day', label: 'By Day' }, { value: 'week', label: 'By Week' }
        ]} onChange={(val) => setGroupBy(val as GroupBy)} />
        <Button onClick={fetchData} disabled={loading} variant="ghost">
          <RefreshCw className={`h-5 w-5 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <StatCard label="Current Players" value={loading ? "--" : currentPlayers.total} subtitle={`${currentPlayers.count} servers online`} icon={Users} delay={0} />
        <StatCard label="Avg Total Players" value={loading ? "--" : summaryStats.totalAvg} icon={TrendingUp} iconColor="text-blue-400" iconBgColor="bg-blue-500/20" delay={0.1} />
        <StatCard label="Peak Players" value={loading ? "--" : summaryStats.totalPeak} icon={Zap} iconColor="text-yellow-400" iconBgColor="bg-yellow-500/20" delay={0.2} />
        <StatCard label="Avg Utilization" value={loading ? "--" : `${summaryStats.avgUtil}%`} icon={Activity} iconColor="text-green-400" iconBgColor="bg-green-500/20" delay={0.3} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <ChartCard title="Total Players Over Time" icon={TrendingUp} iconColor="text-purple-400" delay={0.2}>
          <div className="h-72"><TimeSeriesChart data={totalPlayersData} series={[{ key: "total_players", name: "Total Players", type: "line", color: COLORS[0], smooth: true, areaStyle: true }]} height="100%" /></div>
        </ChartCard>
        <ChartCard title="Server Comparison" icon={Server} iconColor="text-blue-400" delay={0.3}>
          <div className="h-72">
            {serverComparisonData.data.length > 0
              ? <TimeSeriesChart data={serverComparisonData.data} series={serverComparisonData.series} height="100%" />
              : <div className="h-full flex items-center justify-center text-zinc-500 text-sm">No data for selected time range</div>}
          </div>
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <ChartCard title="Server Utilization" icon={BarChart3} iconColor="text-green-400" delay={0.4}>
          <div className="h-64"><BarChart data={aggregate.slice(0, 10).map((a) => ({ label: a.server_name.substring(0, 15), value: Number(a.avg_utilization) }))} height="100%" colors={COLORS} labelWidth={80} valueFormatter={(v) => `${v.toFixed(1)}%`} /></div>
        </ChartCard>
        <ChartCard title="Peak Players by Server" icon={Zap} iconColor="text-yellow-400" delay={0.5}>
          <div className="h-64"><PieChart data={aggregate.slice(0, 10).map((a) => ({ name: a.server_name.substring(0, 15), value: Number(a.peak_players) }))} height="100%" colors={COLORS} /></div>
        </ChartCard>
        <ChartCard title="Activity Heatmap" icon={Clock} iconColor="text-pink-400" delay={0.6}>
          <div className="h-64 overflow-auto"><ActivityHeatmap data={heatmapGrid} tooltipPrefix="players" cellHeight={20} /></div>
        </ChartCard>
      </div>

      {/* 7-Day Population Forecast */}
      <div className="mb-6">
        <ChartCard title="7-Day Population Forecast" icon={Sparkles} iconColor="text-emerald-400" delay={0.65}>
          {forecastLoading ? (
            <div className="h-80 flex items-center justify-center"><Loading /></div>
          ) : forecastData.length > 0 ? (
            <>
              <div className="flex flex-wrap gap-2 mb-3">
                {forecastData.filter(f => f.event).reduce<string[]>((acc, f) => {
                  f.event.split(', ').forEach(e => { if (e && !acc.includes(e)) acc.push(e); });
                  return acc;
                }, []).map(e => (
                  <span key={e} className="px-2 py-1 rounded-full bg-amber-500/15 text-amber-400 text-xs font-medium">{e}</span>
                ))}
              </div>
              <div className="h-80"><EChartWrapper option={forecastOption} height="100%" /></div>
              <p className="text-xs text-zinc-600 mt-2">Based on 90-day historical patterns. Adjusted for US holidays, school calendar (Eastern), and weekend patterns. Shaded area shows confidence range.</p>
            </>
          ) : (
            <div className="h-40 flex items-center justify-center text-zinc-500 text-sm">Not enough historical data to generate forecast</div>
          )}
        </ChartCard>
      </div>

      <ChartCard title="Server Statistics" icon={Server} iconColor="text-purple-400" delay={0.7}>
        {loading ? (
          <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-12 bg-white/5 rounded-lg animate-pulse" />)}</div>
        ) : (
          <DataTable data={aggregate} columns={aggregateColumns} keyExtractor={(row, idx) => `${row.server_ip}-${row.server_name}-${idx}`}
            emptyMessage="No analytics data available yet" emptyIcon={<Server className="h-12 w-12 mx-auto mb-3 opacity-30" />} />
        )}
      </ChartCard>
    </>
  );
}
