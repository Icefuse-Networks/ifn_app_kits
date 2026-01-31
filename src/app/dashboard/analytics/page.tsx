"use client";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BarChart3, Server, Users, TrendingUp, RefreshCw, Clock, Activity, Zap, ChevronDown, Check } from "lucide-react";
import ReactECharts from "echarts-for-react";

interface TimeSeriesPoint {
  time_bucket: string;
  server_ip: string;
  server_name: string;
  avg_players: number;
  max_players: number;
  min_players: number;
  capacity: number;
}

interface TotalsPoint {
  time_bucket: string;
  total_players: number;
  total_capacity: number;
  server_count: number;
}

interface AggregateData {
  server_ip: string;
  server_name: string;
  category: string;
  avg_players: number;
  peak_players: number;
  min_players: number;
  avg_capacity: number;
  data_points: number;
  avg_utilization: number;
}

interface HeatmapPoint {
  day_of_week: number;
  hour: number;
  avg_players: number;
}

interface ServerOption {
  server_ip: string;
  server_name: string;
}

type TimeRange = "1h" | "6h" | "24h" | "7d" | "30d" | "custom";
type GroupBy = "hour" | "day" | "week";

const TIME_PRESETS: Record<TimeRange, { label: string; hours?: number }> = {
  "1h": { label: "1 Hour", hours: 1 },
  "6h": { label: "6 Hours", hours: 6 },
  "24h": { label: "24 Hours", hours: 24 },
  "7d": { label: "7 Days", hours: 168 },
  "30d": { label: "30 Days", hours: 720 },
  "custom": { label: "Custom" },
};

const COLORS = [
  "#a855f7",
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#ec4899",
  "#8b5cf6",
  "#14b8a6",
];

const getServerKey = (o: ServerOption) => `${o.server_ip}::${o.server_name}`;
const parseServerKey = (key: string) => {
  const [ip] = key.split("::");
  return ip;
};

function MultiSelectDropdown({
  options,
  selected,
  onChange,
  placeholder = "Select servers"
}: {
  options: ServerOption[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredOptions = options.filter(o =>
    o.server_name.toLowerCase().includes(search.toLowerCase()) ||
    o.server_ip.toLowerCase().includes(search.toLowerCase())
  );

  const toggleOption = (key: string) => {
    if (selected.includes(key)) {
      onChange(selected.filter(s => s !== key));
    } else {
      onChange([...selected, key]);
    }
  };

  const selectAll = () => onChange(options.map(getServerKey));
  const clearAll = () => onChange([]);

  const displayText = selected.length === 0
    ? placeholder
    : selected.length === options.length
      ? "All Servers"
      : `${selected.length} server${selected.length > 1 ? "s" : ""} selected`;

  return (
    <div ref={dropdownRef} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm min-w-[200px] justify-between hover:border-purple-500/50 transition-colors"
      >
        <span className={selected.length === 0 ? "text-zinc-400" : "text-white"}>{displayText}</span>
        <ChevronDown className={`h-4 w-4 text-zinc-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 mt-2 w-80 rounded-lg bg-zinc-900 border border-white/10 shadow-xl overflow-hidden"
          >
            <div className="p-2 border-b border-white/5">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search servers..."
                className="w-full px-3 py-2 rounded bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-purple-500"
              />
            </div>
            <div className="flex gap-2 p-2 border-b border-white/5">
              <button onClick={selectAll} className="flex-1 px-2 py-1 text-xs rounded bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 transition-colors">
                Select All
              </button>
              <button onClick={clearAll} className="flex-1 px-2 py-1 text-xs rounded bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors">
                Clear All
              </button>
            </div>
            <div className="max-h-64 overflow-y-auto">
              {filteredOptions.length === 0 ? (
                <div className="p-4 text-center text-zinc-500 text-sm">No servers found</div>
              ) : (
                filteredOptions.map((option) => {
                  const key = getServerKey(option);
                  return (
                    <button
                      key={key}
                      onClick={() => toggleOption(key)}
                      className="w-full flex items-center gap-3 px-3 py-2 hover:bg-white/5 transition-colors"
                    >
                      <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                        selected.includes(key)
                          ? "bg-purple-500 border-purple-500"
                          : "border-white/20"
                      }`}>
                        {selected.includes(key) && <Check className="h-3 w-3 text-white" />}
                      </div>
                      <div className="text-left flex-1 min-w-0">
                        <div className="text-white text-sm truncate">{option.server_name}</div>
                        <div className="text-zinc-500 text-xs truncate">{option.server_ip}</div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function AnalyticsPage() {
  const [timeRange, setTimeRange] = useState<TimeRange>("24h");
  const [groupBy, setGroupBy] = useState<GroupBy>("hour");
  const [selectedServers, setSelectedServers] = useState<string[]>([]);
  const [servers, setServers] = useState<ServerOption[]>([]);
  const [timeseries, setTimeseries] = useState<TimeSeriesPoint[]>([]);
  const [totals, setTotals] = useState<TotalsPoint[]>([]);
  const [aggregate, setAggregate] = useState<AggregateData[]>([]);
  const [heatmap, setHeatmap] = useState<HeatmapPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [customFrom, setCustomFrom] = useState(() => {
    const d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    return d.toISOString().slice(0, 16);
  });
  const [customTo, setCustomTo] = useState(() => new Date().toISOString().slice(0, 16));

  const getTimeParams = useCallback(() => {
    if (timeRange === "custom" && customFrom && customTo) {
      return { from: customFrom, to: customTo };
    }
    const hours = TIME_PRESETS[timeRange].hours || 24;
    const now = new Date();
    const from = new Date(now.getTime() - hours * 60 * 60 * 1000);
    return { from: from.toISOString(), to: now.toISOString() };
  }, [timeRange, customFrom, customTo]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { from, to } = getTimeParams();
    const serverIps = selectedServers.map(parseServerKey);
    const serverParam = selectedServers.length === 0 ? "all" : serverIps.join(",");
    const baseParams = `from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&server=${serverParam}&groupBy=${groupBy}`;

    try {
      const [serversRes, timeseriesRes, totalsRes, aggregateRes, heatmapRes] = await Promise.all([
        fetch(`/api/analytics/server-stats?type=servers`),
        fetch(`/api/analytics/server-stats?type=timeseries&${baseParams}`),
        fetch(`/api/analytics/server-stats?type=totals&${baseParams}`),
        fetch(`/api/analytics/server-stats?type=aggregate&${baseParams}`),
        fetch(`/api/analytics/server-stats?type=heatmap&${baseParams}`),
      ]);

      const [serversData, timeseriesData, totalsData, aggregateData, heatmapData] = await Promise.all([
        serversRes.json(),
        timeseriesRes.json(),
        totalsRes.json(),
        aggregateRes.json(),
        heatmapRes.json(),
      ]);

      setServers(serversData.servers || []);
      setTimeseries(timeseriesData.data || []);
      setTotals(totalsData.data || []);
      setAggregate(aggregateData.data || []);
      setHeatmap(heatmapData.data || []);
    } catch (err) {
      console.error("Failed to fetch analytics:", err);
    } finally {
      setLoading(false);
    }
  }, [getTimeParams, selectedServers, groupBy]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const totalPlayersOption = useMemo(() => {
    const labels = totals.map((t) => {
      const d = new Date(t.time_bucket);
      return groupBy === "hour" ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : d.toLocaleDateString([], { month: "short", day: "numeric" });
    });
    return {
      tooltip: { trigger: "axis", backgroundColor: "rgba(0,0,0,0.8)", borderColor: "rgba(168,85,247,0.5)", textStyle: { color: "#fff" } },
      grid: { left: 50, right: 20, top: 40, bottom: 40 },
      xAxis: { type: "category", data: labels, axisLine: { lineStyle: { color: "rgba(255,255,255,0.1)" } }, axisLabel: { color: "#888", rotate: 45 } },
      yAxis: { type: "value", axisLine: { lineStyle: { color: "rgba(255,255,255,0.1)" } }, axisLabel: { color: "#888" }, splitLine: { lineStyle: { color: "rgba(255,255,255,0.05)" } } },
      series: [{
        name: "Total Players",
        type: "line",
        data: totals.map((t) => Number(t.total_players)),
        smooth: true,
        lineStyle: { color: COLORS[0], width: 2 },
        areaStyle: { color: { type: "linear", x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: "rgba(168,85,247,0.3)" }, { offset: 1, color: "rgba(168,85,247,0)" }] } },
        itemStyle: { color: COLORS[0] }
      }]
    };
  }, [totals, groupBy]);

  const serverComparisonOption = useMemo(() => {
    const serverGroups = new Map<string, TimeSeriesPoint[]>();
    timeseries.forEach((t) => {
      if (!serverGroups.has(t.server_name)) serverGroups.set(t.server_name, []);
      serverGroups.get(t.server_name)!.push(t);
    });

    const labels = [...new Set(timeseries.map((t) => {
      const d = new Date(t.time_bucket);
      return groupBy === "hour" ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : d.toLocaleDateString([], { month: "short", day: "numeric" });
    }))];

    const series = Array.from(serverGroups.entries()).slice(0, 8).map(([name, data], i) => ({
      name: name.substring(0, 20),
      type: "line",
      smooth: true,
      data: labels.map((label) => {
        const point = data.find((d) => {
          const dDate = new Date(d.time_bucket);
          const formatted = groupBy === "hour" ? dDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : dDate.toLocaleDateString([], { month: "short", day: "numeric" });
          return formatted === label;
        });
        return point ? Number(point.avg_players) : 0;
      }),
      lineStyle: { color: COLORS[i % COLORS.length], width: 2 },
      itemStyle: { color: COLORS[i % COLORS.length] }
    }));

    return {
      tooltip: { trigger: "axis", backgroundColor: "rgba(0,0,0,0.8)", borderColor: "rgba(59,130,246,0.5)", textStyle: { color: "#fff" } },
      legend: { data: series.map(s => s.name), textStyle: { color: "#888" }, top: 0 },
      grid: { left: 50, right: 20, top: 40, bottom: 40 },
      xAxis: { type: "category", data: labels, axisLine: { lineStyle: { color: "rgba(255,255,255,0.1)" } }, axisLabel: { color: "#888", rotate: 45 } },
      yAxis: { type: "value", axisLine: { lineStyle: { color: "rgba(255,255,255,0.1)" } }, axisLabel: { color: "#888" }, splitLine: { lineStyle: { color: "rgba(255,255,255,0.05)" } } },
      series
    };
  }, [timeseries, groupBy]);

  const utilizationOption = useMemo(() => ({
    tooltip: { trigger: "axis", backgroundColor: "rgba(0,0,0,0.8)", textStyle: { color: "#fff" } },
    grid: { left: 80, right: 20, top: 20, bottom: 40 },
    xAxis: { type: "value", max: 100, axisLine: { lineStyle: { color: "rgba(255,255,255,0.1)" } }, axisLabel: { color: "#888" }, splitLine: { lineStyle: { color: "rgba(255,255,255,0.05)" } } },
    yAxis: { type: "category", data: aggregate.slice(0, 10).map((a) => a.server_name.substring(0, 15)), axisLine: { lineStyle: { color: "rgba(255,255,255,0.1)" } }, axisLabel: { color: "#888" } },
    series: [{
      type: "bar",
      data: aggregate.slice(0, 10).map((a, i) => ({ value: Number(a.avg_utilization).toFixed(1), itemStyle: { color: COLORS[i % COLORS.length] } })),
    }]
  }), [aggregate]);

  const peakPlayersOption = useMemo(() => ({
    tooltip: { trigger: "item", backgroundColor: "rgba(0,0,0,0.8)", textStyle: { color: "#fff" } },
    legend: { orient: "vertical", right: 10, top: "center", textStyle: { color: "#888" } },
    series: [{
      type: "pie",
      radius: ["40%", "70%"],
      center: ["35%", "50%"],
      data: aggregate.slice(0, 10).map((a, i) => ({
        value: Number(a.peak_players),
        name: a.server_name.substring(0, 15),
        itemStyle: { color: COLORS[i % COLORS.length] }
      })),
      label: { show: false },
      emphasis: { label: { show: true, color: "#fff" } }
    }]
  }), [aggregate]);

  const heatmapGrid = useMemo(() => {
    const grid: number[][] = Array(7).fill(null).map(() => Array(24).fill(0));
    heatmap.forEach((h) => {
      const day = Number(h.day_of_week) - 1;
      const hour = Number(h.hour);
      if (day >= 0 && day < 7 && hour >= 0 && hour < 24) {
        grid[day][hour] = Number(h.avg_players);
      }
    });
    return grid;
  }, [heatmap]);

  const maxHeatmapValue = useMemo(() => Math.max(1, ...heatmapGrid.flat()), [heatmapGrid]);

  const summaryStats = useMemo(() => {
    const totalAvg = aggregate.reduce((sum, a) => sum + Number(a.avg_players), 0);
    const totalPeak = Math.max(0, ...aggregate.map((a) => Number(a.peak_players)));
    const avgUtil = aggregate.length > 0 ? aggregate.reduce((sum, a) => sum + Number(a.avg_utilization), 0) / aggregate.length : 0;
    return { totalAvg: Math.round(totalAvg), totalPeak, avgUtil: avgUtil.toFixed(1), serverCount: aggregate.length };
  }, [aggregate]);

  const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <div className="p-8">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20">
                <BarChart3 className="h-6 w-6 text-purple-400" />
              </div>
              Server Analytics
            </h1>
            <p className="text-zinc-500 mt-2">Real-time population data from ClickHouse</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <MultiSelectDropdown
              options={servers}
              selected={selectedServers}
              onChange={setSelectedServers}
              placeholder="All Servers"
            />

            <div className="flex rounded-lg overflow-hidden border border-white/10">
              {(Object.keys(TIME_PRESETS) as TimeRange[]).map((range) => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={`px-3 py-2 text-sm transition-colors ${timeRange === range ? "bg-purple-500 text-white" : "bg-white/5 text-zinc-400 hover:text-white"}`}
                >
                  {TIME_PRESETS[range].label}
                </button>
              ))}
            </div>

            {timeRange === "custom" && (
              <div className="flex items-center gap-2">
                <input
                  type="datetime-local"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-purple-500"
                />
                <span className="text-zinc-500">to</span>
                <input
                  type="datetime-local"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-purple-500"
                />
              </div>
            )}

            <select
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value as GroupBy)}
              className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-purple-500"
            >
              <option value="hour">Group by Hour</option>
              <option value="day">Group by Day</option>
              <option value="week">Group by Week</option>
            </select>

            <button
              onClick={fetchData}
              className="p-2 rounded-lg bg-white/5 border border-white/10 text-zinc-400 hover:text-white transition-colors"
            >
              <RefreshCw className={`h-5 w-5 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          {[
            { label: "Total Servers", value: summaryStats.serverCount, icon: Server, color: "purple" },
            { label: "Avg Total Players", value: summaryStats.totalAvg, icon: Users, color: "blue" },
            { label: "Peak Players", value: summaryStats.totalPeak, icon: Zap, color: "yellow" },
            { label: "Avg Utilization", value: `${summaryStats.avgUtil}%`, icon: Activity, color: "green" },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="rounded-xl p-6 bg-white/[0.02] border border-white/5"
            >
              <div className="flex items-center justify-between mb-3">
                <stat.icon className={`h-5 w-5 text-${stat.color}-400`} />
                <span className="text-xs text-zinc-500 uppercase">{stat.label}</span>
              </div>
              <div className="text-2xl font-bold text-white">{loading ? "--" : stat.value}</div>
            </motion.div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }} className="rounded-xl p-6 bg-white/[0.02] border border-white/5">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-purple-400" />
              Total Players Over Time
            </h2>
            <div className="h-72">
              {totals.length > 0 ? <ReactECharts option={totalPlayersOption} style={{ height: "100%" }} /> : <div className="h-full flex items-center justify-center text-zinc-500">No data</div>}
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }} className="rounded-xl p-6 bg-white/[0.02] border border-white/5">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Server className="h-5 w-5 text-blue-400" />
              Server Comparison
            </h2>
            <div className="h-72">
              {serverComparisonOption.series.length > 0 ? <ReactECharts option={serverComparisonOption} style={{ height: "100%" }} /> : <div className="h-full flex items-center justify-center text-zinc-500 text-sm">No data for selected time range</div>}
            </div>
          </motion.div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="rounded-xl p-6 bg-white/[0.02] border border-white/5">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-green-400" />
              Server Utilization
            </h2>
            <div className="h-64">
              {aggregate.length > 0 ? <ReactECharts option={utilizationOption} style={{ height: "100%" }} /> : <div className="h-full flex items-center justify-center text-zinc-500">No data</div>}
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="rounded-xl p-6 bg-white/[0.02] border border-white/5">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Zap className="h-5 w-5 text-yellow-400" />
              Peak Players by Server
            </h2>
            <div className="h-64">
              {aggregate.length > 0 ? <ReactECharts option={peakPlayersOption} style={{ height: "100%" }} /> : <div className="h-full flex items-center justify-center text-zinc-500">No data</div>}
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }} className="rounded-xl p-6 bg-white/[0.02] border border-white/5">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Clock className="h-5 w-5 text-pink-400" />
              Activity Heatmap
            </h2>
            <div className="h-64 overflow-auto">
              <div className="min-w-[500px]">
                <div className="flex mb-1">
                  <div className="w-10" />
                  {Array.from({ length: 24 }, (_, h) => (
                    <div key={h} className="flex-1 text-center text-[10px] text-zinc-500">{h}</div>
                  ))}
                </div>
                {heatmapGrid.map((row, dayIdx) => (
                  <div key={dayIdx} className="flex items-center mb-1">
                    <div className="w-10 text-xs text-zinc-500">{DAYS[dayIdx]}</div>
                    {row.map((val, hourIdx) => {
                      const intensity = val / maxHeatmapValue;
                      return (
                        <div
                          key={hourIdx}
                          className="flex-1 h-5 rounded-sm mx-px"
                          style={{ backgroundColor: `rgba(168, 85, 247, ${intensity * 0.8 + 0.1})` }}
                          title={`${DAYS[dayIdx]} ${hourIdx}:00 - ${Math.round(val)} players`}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }} className="rounded-xl p-6 bg-white/[0.02] border border-white/5">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Server className="h-5 w-5 text-purple-400" />
            Server Statistics
          </h2>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <div key={i} className="h-12 bg-white/5 rounded-lg animate-pulse" />)}
            </div>
          ) : aggregate.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/5">
                    <th className="text-left py-3 px-4 text-xs text-zinc-500 uppercase">Server</th>
                    <th className="text-left py-3 px-4 text-xs text-zinc-500 uppercase">Category</th>
                    <th className="text-right py-3 px-4 text-xs text-zinc-500 uppercase">Avg Players</th>
                    <th className="text-right py-3 px-4 text-xs text-zinc-500 uppercase">Peak</th>
                    <th className="text-right py-3 px-4 text-xs text-zinc-500 uppercase">Capacity</th>
                    <th className="text-right py-3 px-4 text-xs text-zinc-500 uppercase">Utilization</th>
                    <th className="text-right py-3 px-4 text-xs text-zinc-500 uppercase">Data Points</th>
                  </tr>
                </thead>
                <tbody>
                  {aggregate.map((a, idx) => (
                    <tr key={`${a.server_ip}-${a.server_name}-${idx}`} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                      <td className="py-3 px-4">
                        <div className="text-white font-medium">{a.server_name}</div>
                        <div className="text-xs text-zinc-500">{a.server_ip}</div>
                      </td>
                      <td className="py-3 px-4 text-zinc-400">{a.category}</td>
                      <td className="py-3 px-4 text-right text-white font-semibold">{Math.round(Number(a.avg_players))}</td>
                      <td className="py-3 px-4 text-right text-yellow-400 font-semibold">{Number(a.peak_players)}</td>
                      <td className="py-3 px-4 text-right text-zinc-400">{Math.round(Number(a.avg_capacity))}</td>
                      <td className="py-3 px-4 text-right">
                        <span className={`font-semibold ${Number(a.avg_utilization) > 75 ? "text-green-400" : Number(a.avg_utilization) > 50 ? "text-yellow-400" : "text-red-400"}`}>
                          {Number(a.avg_utilization).toFixed(1)}%
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right text-zinc-500">{Number(a.data_points)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12 text-zinc-500">
              <Server className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>No analytics data available yet</p>
              <p className="text-sm mt-2">Data will populate as the servers API is called</p>
            </div>
          )}
        </motion.div>
      </motion.div>
    </div>
  );
}
