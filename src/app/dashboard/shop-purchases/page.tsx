"use client";

import React, { useState, useCallback, useEffect } from "react";
import {
  ShoppingCart, RefreshCw, Loader2, Search, ChevronLeft, ChevronRight, Filter, X, Download, Server, User, Package, DollarSign, Clock, Hash,
  TrendingUp, BarChart3, PieChart, Calendar, Award, Zap, Users, Activity, ArrowUpRight, ArrowDownRight
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface ShopPurchase {
  timestamp: string;
  server_name: string;
  player_name: string;
  steamid64: string;
  item_name: string;
  amount: number;
  currency: string;
  cost: number;
}

interface AnalyticsData {
  overview: {
    totalPurchases: number;
    totalRevenue: number;
    uniquePlayers: number;
    activeServers: number;
    uniqueItems: number;
    avgPurchaseValue: number;
    maxPurchaseValue: number;
  };
  timeSeries: { date: string; purchases: number; revenue: number; players: number }[];
  serverStats: { server: string; purchases: number; revenue: number; players: number; itemsSold: number; avgValue: number }[];
  topItems: { item: string; count: number; revenue: number; totalAmount: number; buyers: number }[];
  hourlyHeatmap: { hour: number; dayOfWeek: number; count: number }[];
  currencyBreakdown: { currency: string; count: number; total: number }[];
  topPlayers: { steamid64: string; playerName: string; purchases: number; totalSpent: number; uniqueItems: number }[];
  serverTrends: { date: string; server: string; purchases: number }[];
}

const COLORS = ['#a855f7', '#ec4899', '#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4', '#8b5cf6', '#f97316', '#14b8a6'];
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const StatCard = ({ icon: Icon, title, value, subtitle, trend, delay = 0 }: {
  icon: React.ElementType;
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: { value: number; positive: boolean };
  delay?: number;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay }}
    className="rounded-xl p-6 transition-all duration-300 hover:scale-[1.02] bg-white/[0.02] border border-white/5"
  >
    <div className="flex items-center justify-between">
      <div className="flex-1">
        <p className="text-zinc-500 text-sm font-medium mb-1">{title}</p>
        <p className="text-2xl font-bold text-white mb-1">{value}</p>
        <div className="flex items-center gap-2">
          {subtitle && <p className="text-xs text-purple-400">{subtitle}</p>}
          {trend && (
            <span className={`text-xs flex items-center gap-1 ${trend.positive ? 'text-green-400' : 'text-red-400'}`}>
              {trend.positive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
              {trend.value}%
            </span>
          )}
        </div>
      </div>
      <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-purple-500/20">
        <Icon className="h-6 w-6 text-purple-400" />
      </div>
    </div>
  </motion.div>
);

const ChartCard = ({ title, icon: Icon, children, className = "" }: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  className?: string;
}) => (
  <div className={`rounded-xl p-6 bg-white/[0.02] border border-white/5 ${className}`}>
    <div className="flex items-center gap-2 mb-4">
      <Icon className="h-5 w-5 text-purple-400" />
      <h3 className="text-lg font-semibold text-white">{title}</h3>
    </div>
    {children}
  </div>
);

const SimpleBarChart = ({ data, dataKey, labelKey, horizontal = false, showValue = true }: {
  data: Record<string, unknown>[];
  dataKey: string;
  labelKey: string;
  horizontal?: boolean;
  showValue?: boolean;
}) => {
  const maxValue = Math.max(...data.map(d => Number(d[dataKey]) || 0));
  if (horizontal) {
    return (
      <div className="space-y-3">
        {data.slice(0, 10).map((item, idx) => (
          <div key={idx} className="flex items-center gap-3">
            <div className="w-32 text-sm text-zinc-500 truncate" title={String(item[labelKey])}>{String(item[labelKey])}</div>
            <div className="flex-1 h-6 rounded-full overflow-hidden bg-white/5">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${(Number(item[dataKey]) / maxValue) * 100}%`, background: COLORS[idx % COLORS.length] }}
              />
            </div>
            {showValue && <div className="w-16 text-right text-sm font-medium text-white">{Number(item[dataKey]).toLocaleString()}</div>}
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="flex items-end justify-around h-48 gap-2">
      {data.map((item, idx) => (
        <div key={idx} className="flex flex-col items-center gap-2 flex-1">
          <div className="relative w-full flex justify-center">
            <div
              className="w-8 rounded-t-md transition-all duration-500"
              style={{ height: `${Math.max((Number(item[dataKey]) / maxValue) * 140, 4)}px`, background: COLORS[idx % COLORS.length] }}
            />
          </div>
          <span className="text-xs text-zinc-500 truncate max-w-full" title={String(item[labelKey])}>
            {String(item[labelKey]).slice(0, 8)}
          </span>
        </div>
      ))}
    </div>
  );
};

const AreaChart = ({ data, lines, xKey }: {
  data: { [key: string]: string | number }[];
  lines: { key: string; color: string; label: string }[];
  xKey: string;
}) => {
  if (!data.length) return <div className="h-48 flex items-center justify-center text-zinc-500">No data</div>;
  const maxValues = lines.map(line => Math.max(...data.map(d => Number(d[line.key]) || 0)));
  const overallMax = Math.max(...maxValues, 1);
  const width = 100;
  const height = 48;
  const padding = 2;

  return (
    <div className="relative">
      <div className="flex gap-4 mb-4 flex-wrap">
        {lines.map(line => (
          <div key={line.key} className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ background: line.color }} />
            <span className="text-xs text-zinc-500">{line.label}</span>
          </div>
        ))}
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-48" preserveAspectRatio="none">
        {lines.map((line, lineIdx) => {
          const points = data.map((d, i) => {
            const x = padding + (i / Math.max(data.length - 1, 1)) * (width - padding * 2);
            const y = height - padding - ((Number(d[line.key]) || 0) / overallMax) * (height - padding * 2);
            return `${x},${y}`;
          });
          const areaPoints = `${padding},${height - padding} ${points.join(' ')} ${width - padding},${height - padding}`;
          return (
            <g key={line.key}>
              <polygon points={areaPoints} fill={line.color} fillOpacity={0.1 + lineIdx * 0.05} />
              <polyline points={points.join(' ')} fill="none" stroke={line.color} strokeWidth="0.5" />
            </g>
          );
        })}
      </svg>
      <div className="flex justify-between text-xs text-zinc-600 mt-2">
        <span>{data[0]?.[xKey]}</span>
        <span>{data[data.length - 1]?.[xKey]}</span>
      </div>
    </div>
  );
};

const PieChartSimple = ({ data, valueKey, labelKey }: {
  data: Record<string, unknown>[];
  valueKey: string;
  labelKey: string;
}) => {
  const total = data.reduce((sum, d) => sum + (Number(d[valueKey]) || 0), 0);
  if (!total) return <div className="h-48 flex items-center justify-center text-zinc-500">No data</div>;
  let cumulative = 0;
  const segments = data.map((item, idx) => {
    const value = Number(item[valueKey]) || 0;
    const percentage = (value / total) * 100;
    const startAngle = cumulative * 3.6;
    cumulative += percentage;
    const endAngle = cumulative * 3.6;
    const label = String(item[labelKey] ?? "");
    return { label, percentage, startAngle, endAngle, color: COLORS[idx % COLORS.length] };
  });

  const polarToCartesian = (angle: number, radius: number) => {
    const rad = (angle - 90) * Math.PI / 180;
    return { x: 50 + radius * Math.cos(rad), y: 50 + radius * Math.sin(rad) };
  };

  return (
    <div className="flex items-center gap-6">
      <svg viewBox="0 0 100 100" className="w-40 h-40">
        {segments.map((seg, idx) => {
          const start = polarToCartesian(seg.startAngle, 40);
          const end = polarToCartesian(seg.endAngle, 40);
          const largeArc = seg.endAngle - seg.startAngle > 180 ? 1 : 0;
          const d = `M 50 50 L ${start.x} ${start.y} A 40 40 0 ${largeArc} 1 ${end.x} ${end.y} Z`;
          return <path key={idx} d={d} fill={seg.color} className="hover:opacity-80 transition-opacity" />;
        })}
        <circle cx="50" cy="50" r="20" fill="#0a0a0f" />
      </svg>
      <div className="flex-1 space-y-2">
        {segments.slice(0, 6).map((seg, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ background: seg.color }} />
            <span className="text-sm text-zinc-500 flex-1 truncate">{seg.label}</span>
            <span className="text-sm font-medium text-white">{seg.percentage.toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const HeatmapChart = ({ data }: { data: { hour: number; dayOfWeek: number; count: number }[] }) => {
  const maxCount = Math.max(...data.map(d => d.count), 1);
  const grid: number[][] = Array(7).fill(null).map(() => Array(24).fill(0));
  data.forEach(d => {
    const dayIdx = d.dayOfWeek - 1;
    if (dayIdx >= 0 && dayIdx < 7 && d.hour >= 0 && d.hour < 24) {
      grid[dayIdx][d.hour] = d.count;
    }
  });

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[600px]">
        <div className="flex mb-2">
          <div className="w-10" />
          {Array(24).fill(null).map((_, h) => (
            <div key={h} className="flex-1 text-center text-[10px] text-zinc-600">{h}</div>
          ))}
        </div>
        {grid.map((row, dayIdx) => (
          <div key={dayIdx} className="flex items-center gap-1 mb-1">
            <div className="w-10 text-xs text-zinc-500">{DAYS[dayIdx]}</div>
            {row.map((count, hourIdx) => {
              const intensity = count / maxCount;
              return (
                <div
                  key={hourIdx}
                  className="flex-1 h-6 rounded-sm transition-colors cursor-pointer hover:ring-1 hover:ring-white/30"
                  style={{ background: `rgba(168, 85, 247, ${Math.max(intensity * 0.9, 0.05)})` }}
                  title={`${DAYS[dayIdx]} ${hourIdx}:00 - ${count} purchases`}
                />
              );
            })}
          </div>
        ))}
        <div className="flex items-center justify-end gap-2 mt-4">
          <span className="text-xs text-zinc-600">Less</span>
          {[0.1, 0.3, 0.5, 0.7, 0.9].map(i => (
            <div key={i} className="w-4 h-4 rounded-sm" style={{ background: `rgba(168, 85, 247, ${i})` }} />
          ))}
          <span className="text-xs text-zinc-600">More</span>
        </div>
      </div>
    </div>
  );
};

const ServerComparisonTable = ({ data }: { data: AnalyticsData['serverStats'] }) => (
  <div className="overflow-x-auto">
    <table className="w-full">
      <thead>
        <tr className="border-b border-white/5">
          <th className="px-4 py-3 text-left text-sm font-semibold text-zinc-500">Server</th>
          <th className="px-4 py-3 text-right text-sm font-semibold text-zinc-500">Purchases</th>
          <th className="px-4 py-3 text-right text-sm font-semibold text-zinc-500">Revenue</th>
          <th className="px-4 py-3 text-right text-sm font-semibold text-zinc-500">Players</th>
          <th className="px-4 py-3 text-right text-sm font-semibold text-zinc-500">Items</th>
          <th className="px-4 py-3 text-right text-sm font-semibold text-zinc-500">Avg Value</th>
          <th className="px-4 py-3 text-left text-sm font-semibold text-zinc-500">Share</th>
        </tr>
      </thead>
      <tbody>
        {data.map((server, idx) => {
          const totalPurchases = data.reduce((sum, s) => sum + s.purchases, 0);
          const share = totalPurchases ? (server.purchases / totalPurchases) * 100 : 0;
          return (
            <tr key={server.server} className="border-b border-white/5 hover:bg-white/[0.02]">
              <td className="px-4 py-3 text-sm text-white font-medium flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ background: COLORS[idx % COLORS.length] }} />
                {server.server}
              </td>
              <td className="px-4 py-3 text-sm text-right text-white">{server.purchases.toLocaleString()}</td>
              <td className="px-4 py-3 text-sm text-right text-green-400 font-medium">{server.revenue.toLocaleString()}</td>
              <td className="px-4 py-3 text-sm text-right text-zinc-500">{server.players.toLocaleString()}</td>
              <td className="px-4 py-3 text-sm text-right text-zinc-500">{server.itemsSold}</td>
              <td className="px-4 py-3 text-sm text-right text-purple-400">{server.avgValue.toFixed(0)}</td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="w-20 h-2 rounded-full overflow-hidden bg-white/10">
                    <div className="h-full rounded-full" style={{ width: `${share}%`, background: COLORS[idx % COLORS.length] }} />
                  </div>
                  <span className="text-xs text-zinc-500">{share.toFixed(1)}%</span>
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  </div>
);

const TopPlayersTable = ({ data }: { data: AnalyticsData['topPlayers'] }) => (
  <div className="overflow-x-auto">
    <table className="w-full">
      <thead>
        <tr className="border-b border-white/5">
          <th className="px-4 py-3 text-left text-sm font-semibold text-zinc-500">#</th>
          <th className="px-4 py-3 text-left text-sm font-semibold text-zinc-500">Player</th>
          <th className="px-4 py-3 text-right text-sm font-semibold text-zinc-500">Purchases</th>
          <th className="px-4 py-3 text-right text-sm font-semibold text-zinc-500">Total Spent</th>
          <th className="px-4 py-3 text-right text-sm font-semibold text-zinc-500">Unique Items</th>
        </tr>
      </thead>
      <tbody>
        {data.map((player, idx) => (
          <tr key={player.steamid64} className="border-b border-white/5 hover:bg-white/[0.02]">
            <td className="px-4 py-3 text-sm">
              {idx < 3 ? (
                <span className={`text-lg ${idx === 0 ? 'text-yellow-400' : idx === 1 ? 'text-gray-300' : 'text-orange-400'}`}>
                  {idx === 0 ? '1' : idx === 1 ? '2' : '3'}
                </span>
              ) : (
                <span className="text-zinc-600">{idx + 1}</span>
              )}
            </td>
            <td className="px-4 py-3">
              <div className="text-sm text-white font-medium">{player.playerName}</div>
              <div className="text-xs text-zinc-600 font-mono">{player.steamid64}</div>
            </td>
            <td className="px-4 py-3 text-sm text-right text-white">{player.purchases.toLocaleString()}</td>
            <td className="px-4 py-3 text-sm text-right text-green-400 font-medium">{player.totalSpent.toLocaleString()}</td>
            <td className="px-4 py-3 text-sm text-right text-purple-400">{player.uniqueItems}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export default function ShopPurchasesPage() {
  const [purchases, setPurchases] = useState<ShopPurchase[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [serverFilter, setServerFilter] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [servers, setServers] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'analytics' | 'transactions'>('analytics');
  const [dateRange, setDateRange] = useState(30);
  const ITEMS_PER_PAGE = 25;

  const fetchPurchases = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.append("start", String((currentPage - 1) * ITEMS_PER_PAGE));
      params.append("length", String(ITEMS_PER_PAGE));
      params.append("order[0][column]", "0");
      params.append("order[0][dir]", "desc");
      params.append("columns[0][name]", "timestamp");
      if (searchTerm) params.append("search[value]", searchTerm);
      if (serverFilter) params.append("server", serverFilter);

      const response = await fetch(`/api/shop-purchases?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch purchases");

      const data = await response.json();
      setPurchases(data.data || []);
      setTotalRecords(data.recordsFiltered || 0);

      if (data.data && data.data.length > 0) {
        const uniqueServers = [...new Set(data.data.map((p: ShopPurchase) => p.server_name))] as string[];
        setServers(prev => [...new Set([...prev, ...uniqueServers])].sort() as string[]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [currentPage, searchTerm, serverFilter]);

  const fetchAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);
    try {
      const params = new URLSearchParams();
      params.append("days", String(dateRange));
      if (serverFilter) params.append("server", serverFilter);

      const response = await fetch(`/api/shop-purchases/analytics?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch analytics");

      const data = await response.json();
      setAnalytics(data);

      if (data.serverStats) {
        const uniqueServers = data.serverStats.map((s: { server: string }) => s.server) as string[];
        setServers(prev => [...new Set([...prev, ...uniqueServers])].sort() as string[]);
      }
    } catch (err) {
      console.error("Analytics fetch error:", err);
    } finally {
      setAnalyticsLoading(false);
    }
  }, [dateRange, serverFilter]);

  useEffect(() => { fetchPurchases(); }, [fetchPurchases]);
  useEffect(() => { fetchAnalytics(); }, [fetchAnalytics]);

  const totalPages = Math.ceil(totalRecords / ITEMS_PER_PAGE);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchPurchases();
  };

  const resetFilters = () => {
    setSearchTerm("");
    setServerFilter("");
    setCurrentPage(1);
  };

  const exportCSV = () => {
    const headers = ["Timestamp", "Server", "Player", "SteamID64", "Item", "Amount", "Currency", "Cost"];
    const rows = purchases.map(p => [p.timestamp, p.server_name, p.player_name, p.steamid64, p.item_name, p.amount, p.currency, p.cost]);
    const csv = [headers, ...rows].map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `shop_purchases_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-8">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <div className="space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20">
                  <ShoppingCart className="h-6 w-6 text-purple-400" />
                </div>
                Shop Analytics
              </h1>
              <p className="text-zinc-500 mt-2">Comprehensive shop purchase analytics and insights</p>
            </div>
            <div className="flex gap-3 flex-wrap">
              <div className="flex rounded-lg overflow-hidden border border-white/10">
                <button
                  onClick={() => setActiveTab('analytics')}
                  className={`px-4 py-2 text-sm transition-colors ${activeTab === 'analytics' ? 'bg-purple-500 text-white' : 'bg-white/5 text-zinc-400 hover:text-white'}`}
                >
                  <BarChart3 className="h-4 w-4 inline mr-2" />Analytics
                </button>
                <button
                  onClick={() => setActiveTab('transactions')}
                  className={`px-4 py-2 text-sm transition-colors ${activeTab === 'transactions' ? 'bg-purple-500 text-white' : 'bg-white/5 text-zinc-400 hover:text-white'}`}
                >
                  <Clock className="h-4 w-4 inline mr-2" />Transactions
                </button>
              </div>
              <select
                value={dateRange}
                onChange={e => setDateRange(Number(e.target.value))}
                className="px-4 py-2 rounded-lg text-sm text-white bg-white/5 border border-white/10"
              >
                <option value={7}>Last 7 days</option>
                <option value={14}>Last 14 days</option>
                <option value={30}>Last 30 days</option>
                <option value={60}>Last 60 days</option>
                <option value={90}>Last 90 days</option>
                <option value={180}>Last 180 days</option>
                <option value={365}>Last year</option>
              </select>
              <select
                value={serverFilter}
                onChange={e => { setServerFilter(e.target.value); setCurrentPage(1); }}
                className="px-4 py-2 rounded-lg text-sm text-white bg-white/5 border border-white/10"
              >
                <option value="">All Servers</option>
                {servers.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <motion.button
                onClick={() => { fetchPurchases(); fetchAnalytics(); }}
                disabled={loading || analyticsLoading}
                className="flex items-center space-x-2 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50 bg-gradient-to-r from-purple-500 to-pink-500"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                {(loading || analyticsLoading) ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                <span>Refresh</span>
              </motion.button>
            </div>
          </div>

          {activeTab === 'analytics' && (
            <>
              {analyticsLoading ? (
                <div className="text-center py-20">
                  <Loader2 className="h-12 w-12 mx-auto animate-spin text-purple-400 mb-4" />
                  <p className="text-lg text-zinc-400">Loading analytics...</p>
                </div>
              ) : analytics ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4">
                    <StatCard icon={Hash} title="Total Purchases" value={analytics.overview.totalPurchases.toLocaleString()} delay={0.1} />
                    <StatCard icon={DollarSign} title="Total Revenue" value={analytics.overview.totalRevenue.toLocaleString()} delay={0.15} />
                    <StatCard icon={Users} title="Unique Players" value={analytics.overview.uniquePlayers.toLocaleString()} delay={0.2} />
                    <StatCard icon={Server} title="Active Servers" value={analytics.overview.activeServers} delay={0.25} />
                    <StatCard icon={Package} title="Unique Items" value={analytics.overview.uniqueItems} delay={0.3} />
                    <StatCard icon={Activity} title="Avg Purchase" value={analytics.overview.avgPurchaseValue.toFixed(0)} delay={0.35} />
                    <StatCard icon={Zap} title="Max Purchase" value={analytics.overview.maxPurchaseValue.toLocaleString()} delay={0.4} />
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <ChartCard title="Purchases & Revenue Over Time" icon={TrendingUp} className="lg:col-span-2">
                      <AreaChart
                        data={analytics.timeSeries}
                        xKey="date"
                        lines={[
                          { key: 'purchases', color: '#a855f7', label: 'Purchases' },
                          { key: 'revenue', color: '#22c55e', label: 'Revenue' },
                          { key: 'players', color: '#3b82f6', label: 'Active Players' },
                        ]}
                      />
                    </ChartCard>

                    <ChartCard title="Revenue by Server" icon={Server}>
                      <SimpleBarChart data={analytics.serverStats} dataKey="revenue" labelKey="server" horizontal />
                    </ChartCard>

                    <ChartCard title="Top Items (by count)" icon={Package}>
                      <SimpleBarChart data={analytics.topItems} dataKey="count" labelKey="item" horizontal />
                    </ChartCard>

                    <ChartCard title="Currency Distribution" icon={PieChart}>
                      <PieChartSimple data={analytics.currencyBreakdown} valueKey="count" labelKey="currency" />
                    </ChartCard>

                    <ChartCard title="Purchases by Server" icon={BarChart3}>
                      <SimpleBarChart data={analytics.serverStats} dataKey="purchases" labelKey="server" />
                    </ChartCard>
                  </div>

                  <ChartCard title="Activity Heatmap (Purchases by Day & Hour)" icon={Calendar}>
                    <HeatmapChart data={analytics.hourlyHeatmap} />
                  </ChartCard>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <ChartCard title="Server Comparison" icon={Server}>
                      <ServerComparisonTable data={analytics.serverStats} />
                    </ChartCard>

                    <ChartCard title="Top Spenders" icon={Award}>
                      <TopPlayersTable data={analytics.topPlayers} />
                    </ChartCard>
                  </div>

                  <ChartCard title="Top Items by Revenue" icon={DollarSign}>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      {analytics.topItems.slice(0, 8).map((item, idx) => (
                        <div
                          key={item.item}
                          className="p-4 rounded-lg transition-all hover:scale-[1.02] bg-white/[0.02] border border-white/5"
                        >
                          <div className="flex items-start gap-3">
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold" style={{ background: COLORS[idx % COLORS.length] }}>
                              {idx + 1}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-white truncate" title={item.item}>{item.item}</p>
                              <div className="flex items-center gap-4 mt-1 text-xs text-zinc-500">
                                <span>{item.count} sales</span>
                                <span className="text-green-400">{item.revenue.toLocaleString()} revenue</span>
                              </div>
                              <div className="text-xs text-zinc-600 mt-1">{item.buyers} unique buyers</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ChartCard>
                </>
              ) : (
                <div className="text-center py-20 text-zinc-600">
                  <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No analytics data available</p>
                </div>
              )}
            </>
          )}

          {activeTab === 'transactions' && (
            <>
              <div className="flex gap-3 flex-wrap">
                <motion.button
                  onClick={() => setShowFilters(p => !p)}
                  className="flex items-center space-x-2 text-white px-4 py-2 rounded-lg transition-colors hover:bg-white/5 bg-white/[0.02] border border-white/10"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Filter className="h-4 w-4" />
                  <span>Filters</span>
                </motion.button>
                <motion.button
                  onClick={exportCSV}
                  disabled={purchases.length === 0}
                  className="flex items-center space-x-2 text-white px-4 py-2 rounded-lg transition-colors hover:bg-white/5 disabled:opacity-50 bg-white/[0.02] border border-white/10"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Download className="h-4 w-4" />
                  <span>Export CSV</span>
                </motion.button>
              </div>

              <AnimatePresence>
                {showFilters && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="p-6 rounded-xl overflow-hidden bg-white/[0.02] border border-white/10"
                  >
                    <form onSubmit={handleSearch} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                      <div>
                        <label className="block text-sm font-medium text-zinc-400 mb-2">Search</label>
                        <div className="relative">
                          <input
                            type="text"
                            placeholder="Player, SteamID, or Item..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full bg-zinc-800/50 border border-zinc-700/50 rounded-lg px-4 py-2 pl-10 text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500"
                          />
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-zinc-400 mb-2">Server</label>
                        <select
                          value={serverFilter}
                          onChange={e => { setServerFilter(e.target.value); setCurrentPage(1); }}
                          className="w-full bg-zinc-800/50 border border-zinc-700/50 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-purple-500"
                        >
                          <option value="">All Servers</option>
                          {servers.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                      <div className="flex gap-2">
                        <button type="submit" className="flex-1 bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded-lg transition-colors">
                          Search
                        </button>
                        <button type="button" onClick={resetFilters} className="text-sm text-purple-400 hover:text-purple-300 flex items-center gap-1 transition-colors px-3">
                          <X className="h-4 w-4" /> Reset
                        </button>
                      </div>
                    </form>
                  </motion.div>
                )}
              </AnimatePresence>

              {error && (
                <div className="text-center py-10 bg-red-900/20 border border-red-700/50 p-6 rounded-xl">
                  <p className="text-xl font-semibold text-red-300">{error}</p>
                </div>
              )}

              {loading ? (
                <div className="text-center py-20">
                  <Loader2 className="h-12 w-12 mx-auto animate-spin text-purple-400 mb-4" />
                  <p className="text-lg text-zinc-400">Loading transactions...</p>
                </div>
              ) : (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-xl overflow-hidden bg-white/[0.02] border border-white/5"
                >
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-white/5">
                          <th className="px-6 py-4 text-left text-sm font-semibold text-zinc-500"><Clock className="inline h-4 w-4 mr-1" />Timestamp</th>
                          <th className="px-6 py-4 text-left text-sm font-semibold text-zinc-500"><Server className="inline h-4 w-4 mr-1" />Server</th>
                          <th className="px-6 py-4 text-left text-sm font-semibold text-zinc-500"><User className="inline h-4 w-4 mr-1" />Player</th>
                          <th className="px-6 py-4 text-left text-sm font-semibold text-zinc-500">SteamID64</th>
                          <th className="px-6 py-4 text-left text-sm font-semibold text-zinc-500"><Package className="inline h-4 w-4 mr-1" />Item</th>
                          <th className="px-6 py-4 text-center text-sm font-semibold text-zinc-500">Amount</th>
                          <th className="px-6 py-4 text-center text-sm font-semibold text-zinc-500">Currency</th>
                          <th className="px-6 py-4 text-right text-sm font-semibold text-zinc-500"><DollarSign className="inline h-4 w-4 mr-1" />Cost</th>
                        </tr>
                      </thead>
                      <tbody>
                        {purchases.map((purchase, idx) => (
                          <motion.tr
                            key={`${purchase.steamid64}-${purchase.timestamp}-${idx}`}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.02 }}
                            className="border-b border-white/5 hover:bg-white/[0.02] transition-colors"
                          >
                            <td className="px-6 py-4 text-sm text-zinc-500">{purchase.timestamp}</td>
                            <td className="px-6 py-4 text-sm text-white">{purchase.server_name}</td>
                            <td className="px-6 py-4 text-sm text-white font-medium">{purchase.player_name}</td>
                            <td className="px-6 py-4 text-sm text-zinc-500 font-mono">{purchase.steamid64}</td>
                            <td className="px-6 py-4 text-sm text-purple-400 font-medium">{purchase.item_name}</td>
                            <td className="px-6 py-4 text-sm text-center text-white">{purchase.amount}</td>
                            <td className="px-6 py-4 text-sm text-center">
                              <span className="px-2 py-1 rounded-full text-xs bg-purple-500/20 text-purple-400">{purchase.currency}</span>
                            </td>
                            <td className="px-6 py-4 text-sm text-right text-green-400 font-medium">{purchase.cost.toLocaleString()}</td>
                          </motion.tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {purchases.length === 0 && (
                    <div className="text-center py-16 text-zinc-600">
                      <ShoppingCart className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No transactions found</p>
                    </div>
                  )}

                  {totalPages > 1 && (
                    <div className="flex justify-center items-center gap-2 p-6 border-t border-white/5">
                      <button
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="p-2 rounded-md bg-zinc-800 hover:bg-purple-500 disabled:opacity-50 transition-colors"
                      >
                        <ChevronLeft className="h-5 w-5" />
                      </button>
                      <span className="px-4 py-2 text-sm text-zinc-500">
                        Page {currentPage} of {totalPages} ({totalRecords.toLocaleString()} records)
                      </span>
                      <button
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="p-2 rounded-md bg-zinc-800 hover:bg-purple-500 disabled:opacity-50 transition-colors"
                      >
                        <ChevronRight className="h-5 w-5" />
                      </button>
                    </div>
                  )}
                </motion.div>
              )}
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
