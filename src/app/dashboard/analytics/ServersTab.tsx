"use client";

import React, { useState, useCallback, useEffect, useMemo, useRef } from "react";
import {
  BarChart3, Server, Users, TrendingUp, RefreshCw, Clock, Activity, Zap, ChevronDown, Check
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  StatCard, ChartCard, BarChart, PieChart, TimeSeriesChart, ActivityHeatmap, DataTable, Column,
} from "@/components/analytics";
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
  const [groupBy, setGroupBy] = useState<GroupBy>("minute");
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
      const [serversRes, timeseriesRes, totalsRes, aggregateRes, heatmapRes, currentRes] = await Promise.all([
        fetch(`/api/analytics/server-stats?type=servers`),
        fetch(`/api/analytics/server-stats?type=timeseries&${baseParams}`),
        fetch(`/api/analytics/server-stats?type=totals&${baseParams}`),
        fetch(`/api/analytics/server-stats?type=aggregate&${baseParams}`),
        fetch(`/api/analytics/server-stats?type=heatmap&${baseParams}`),
        fetch(`/api/analytics/server-stats?type=current`),
      ]);
      const [serversData, timeseriesData, totalsData, aggregateData, heatmapData, currentData] = await Promise.all([
        serversRes.json(), timeseriesRes.json(), totalsRes.json(), aggregateRes.json(), heatmapRes.json(), currentRes.json(),
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
    return totals.map((t) => {
      const parts = t.time_bucket.split(/[\s:-]/);
      const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]), parseInt(parts[3] || '0'), parseInt(parts[4] || '0'), parseInt(parts[5] || '0'));
      const dateStr = groupBy === "minute" || groupBy === "hour"
        ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        : d.toLocaleDateString([], { month: "short", day: "numeric" });
      return { date: dateStr, total_players: Number(t.total_players) };
    });
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
    const data = allBuckets.map((bucket) => {
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
