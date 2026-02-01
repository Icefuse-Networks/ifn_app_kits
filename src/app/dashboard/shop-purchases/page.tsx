"use client";

import React, { useState, useCallback, useEffect, useMemo } from "react";
import {
  ShoppingCart, RefreshCw, Loader2, Search, ChevronLeft, ChevronRight, Filter, X, Download, Server, User, Package, DollarSign, Clock, Hash,
  TrendingUp, BarChart3, PieChart as PieChartIcon, Calendar, Award, Zap, Users, Activity, Trash2, AlertTriangle
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  StatCard,
  ChartCard,
  BarChart,
  PieChart,
  TimeSeriesChart,
  ActivityHeatmap,
  DataTable,
  ShareBar,
  RankBadge,
  Column,
} from "@/components/analytics";

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
}

const COLORS = ['#a855f7', '#ec4899', '#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4', '#8b5cf6', '#f97316', '#14b8a6'];

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
  const [timeFilter, setTimeFilter] = useState<{ type: 'hours' | 'days'; value: number }>({ type: 'days', value: 30 });
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
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

      const response = await fetch(`/api/shop-purchases?${params.toString()}`, { credentials: 'include' });
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
      if (timeFilter.type === 'hours') {
        params.append("hours", String(timeFilter.value));
      } else {
        params.append("days", String(timeFilter.value));
      }
      if (serverFilter) params.append("server", serverFilter);

      const response = await fetch(`/api/shop-purchases/analytics?${params.toString()}`, { credentials: 'include' });
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
  }, [timeFilter, serverFilter]);

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

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const response = await fetch('/api/shop-purchases/analytics', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(deleteTarget ? { server_name: deleteTarget } : {}),
      });
      if (!response.ok) throw new Error("Failed to delete");
      setShowDeleteModal(false);
      setDeleteTarget(null);
      fetchAnalytics();
      fetchPurchases();
    } catch (err) {
      console.error("Delete error:", err);
    } finally {
      setDeleting(false);
    }
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

  const timeSeriesData = useMemo(() => analytics?.timeSeries || [], [analytics?.timeSeries]);

  const serverRevenueData = useMemo(() => {
    if (!analytics?.serverStats?.length) return [];
    return [...analytics.serverStats]
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10)
      .map(s => ({ label: s.server, value: s.revenue }));
  }, [analytics?.serverStats]);

  const topItemsData = useMemo(() => {
    if (!analytics?.topItems?.length) return [];
    return [...analytics.topItems]
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
      .map(s => ({ label: s.item, value: s.count }));
  }, [analytics?.topItems]);

  const currencyData = useMemo(() => {
    if (!analytics?.currencyBreakdown?.length) return [];
    return analytics.currencyBreakdown.map(c => ({ name: c.currency, value: c.count }));
  }, [analytics?.currencyBreakdown]);

  const serverPurchasesData = useMemo(() => {
    if (!analytics?.serverStats?.length) return [];
    return [...analytics.serverStats]
      .sort((a, b) => b.purchases - a.purchases)
      .slice(0, 8)
      .map(s => ({ label: s.server, value: s.purchases }));
  }, [analytics?.serverStats]);

  const heatmapGrid = useMemo(() => {
    if (!analytics?.hourlyHeatmap) return Array(7).fill(null).map(() => Array(24).fill(0));
    const grid: number[][] = Array(7).fill(null).map(() => Array(24).fill(0));
    analytics.hourlyHeatmap.forEach(d => {
      const dayIdx = d.dayOfWeek - 1;
      if (dayIdx >= 0 && dayIdx < 7 && d.hour >= 0 && d.hour < 24) grid[dayIdx][d.hour] = d.count;
    });
    return grid;
  }, [analytics?.hourlyHeatmap]);

  type ServerStat = { server: string; purchases: number; revenue: number; players: number; itemsSold: number; avgValue: number };
  type PlayerStat = { steamid64: string; playerName: string; purchases: number; totalSpent: number; uniqueItems: number };

  const serverColumns: Column<ServerStat>[] = useMemo(() => [
    {
      key: "server",
      header: "Server",
      render: (_, row, idx) => (
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full shrink-0" style={{ background: COLORS[idx % COLORS.length] }} />
          <span className="text-white font-medium truncate max-w-[280px]" title={row.server}>{row.server}</span>
        </div>
      ),
    },
    { key: "purchases", header: "Purchases", align: "right" as const, render: (v) => <span className="text-white">{(v as number).toLocaleString()}</span> },
    { key: "revenue", header: "Revenue", align: "right" as const, render: (v) => <span className="text-green-400 font-semibold">{(v as number).toLocaleString()}</span> },
    { key: "players", header: "Players", align: "right" as const, render: (v) => <span className="text-zinc-400">{(v as number).toLocaleString()}</span> },
    {
      key: "share",
      header: "Share",
      render: (_, row, idx) => {
        const total = analytics?.serverStats.reduce((sum, s) => sum + s.purchases, 0) || 0;
        return <ShareBar value={row.purchases} total={total} colorIndex={idx} colors={COLORS} />;
      },
    },
  ], [analytics?.serverStats]);

  const playerColumns: Column<PlayerStat>[] = useMemo(() => [
    { key: "rank", header: "#", render: (_, __, idx) => <RankBadge rank={idx + 1} /> },
    {
      key: "playerName",
      header: "Player",
      render: (_, row) => (
        <div>
          <div className="text-sm text-white font-medium">{row.playerName}</div>
          <div className="text-xs text-zinc-600 font-mono">{row.steamid64}</div>
        </div>
      ),
    },
    { key: "purchases", header: "Purchases", align: "right" as const, render: (v) => <span className="text-white">{(v as number).toLocaleString()}</span> },
    { key: "totalSpent", header: "Total Spent", align: "right" as const, render: (v) => <span className="text-green-400 font-semibold">{(v as number).toLocaleString()}</span> },
  ], []);

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
                <button onClick={() => setActiveTab('analytics')} className={`px-4 py-2 text-sm transition-colors ${activeTab === 'analytics' ? 'bg-purple-500 text-white' : 'bg-white/5 text-zinc-400 hover:text-white'}`}>
                  <BarChart3 className="h-4 w-4 inline mr-2" />Analytics
                </button>
                <button onClick={() => setActiveTab('transactions')} className={`px-4 py-2 text-sm transition-colors ${activeTab === 'transactions' ? 'bg-purple-500 text-white' : 'bg-white/5 text-zinc-400 hover:text-white'}`}>
                  <Clock className="h-4 w-4 inline mr-2" />Transactions
                </button>
              </div>
              <select value={`${timeFilter.type}:${timeFilter.value}`} onChange={e => { const [type, val] = e.target.value.split(':'); setTimeFilter({ type: type as 'hours' | 'days', value: Number(val) }); }} className="px-4 py-2 rounded-lg text-sm text-white bg-white/5 border border-white/10">
                <option value="hours:1">Last hour</option>
                <option value="hours:6">Last 6 hours</option>
                <option value="hours:12">Last 12 hours</option>
                <option value="hours:24">Last 24 hours</option>
                <option value="days:2">Last 2 days</option>
                <option value="days:3">Last 3 days</option>
                <option value="days:7">Last 7 days</option>
                <option value="days:14">Last 14 days</option>
                <option value="days:30">Last 30 days</option>
                <option value="days:60">Last 60 days</option>
                <option value="days:90">Last 90 days</option>
                <option value="days:180">Last 6 months</option>
                <option value="days:365">Last year</option>
              </select>
              <select value={serverFilter} onChange={e => { setServerFilter(e.target.value); setCurrentPage(1); }} className="px-4 py-2 rounded-lg text-sm text-white bg-white/5 border border-white/10">
                <option value="">All Servers</option>
                {servers.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <motion.button onClick={() => { fetchPurchases(); fetchAnalytics(); }} disabled={loading || analyticsLoading} className="flex items-center space-x-2 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50 bg-gradient-to-r from-purple-500 to-pink-500" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                {(loading || analyticsLoading) ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                <span>Refresh</span>
              </motion.button>
              <motion.button onClick={() => { setDeleteTarget(serverFilter || null); setShowDeleteModal(true); }} className="flex items-center space-x-2 text-red-400 px-4 py-2 rounded-lg transition-colors hover:bg-red-500/10 bg-white/5 border border-white/10" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Trash2 className="h-4 w-4" />
                <span>Clear Data</span>
              </motion.button>
            </div>
          </div>

          <AnimatePresence>
            {showDeleteModal && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowDeleteModal(false)}>
                <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} onClick={e => e.stopPropagation()} className="bg-zinc-900 border border-white/10 rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-3 rounded-xl bg-red-500/20">
                      <AlertTriangle className="h-6 w-6 text-red-400" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-white">Clear Shop Data</h3>
                      <p className="text-sm text-zinc-400">This action cannot be undone</p>
                    </div>
                  </div>
                  <p className="text-zinc-300 mb-6">
                    {deleteTarget
                      ? <>Are you sure you want to delete all purchase data for <span className="font-semibold text-purple-400">{deleteTarget}</span>?</>
                      : <>Are you sure you want to delete <span className="font-semibold text-red-400">ALL</span> shop purchase data across all servers?</>
                    }
                  </p>
                  <div className="flex gap-3">
                    <button onClick={() => setShowDeleteModal(false)} className="flex-1 px-4 py-2 rounded-lg bg-white/5 text-white hover:bg-white/10 transition-colors">Cancel</button>
                    <button onClick={handleDelete} disabled={deleting} className="flex-1 px-4 py-2 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                      {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                      {deleting ? "Deleting..." : "Delete"}
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

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
                    <StatCard icon={Hash} label="Total Purchases" value={analytics.overview.totalPurchases} delay={0.05} />
                    <StatCard icon={DollarSign} label="Total Revenue" value={analytics.overview.totalRevenue} delay={0.1} />
                    <StatCard icon={Users} label="Unique Players" value={analytics.overview.uniquePlayers} delay={0.15} />
                    <StatCard icon={Server} label="Active Servers" value={analytics.overview.activeServers} delay={0.2} />
                    <StatCard icon={Package} label="Unique Items" value={analytics.overview.uniqueItems} delay={0.25} />
                    <StatCard icon={Activity} label="Avg Purchase" value={analytics.overview.avgPurchaseValue.toFixed(0)} delay={0.3} />
                    <StatCard icon={Zap} label="Max Purchase" value={analytics.overview.maxPurchaseValue} delay={0.35} />
                  </div>

                  <ChartCard title="Purchases & Revenue Over Time" icon={TrendingUp} className="lg:col-span-2" delay={0.4}>
                    <div className="h-80">
                      <TimeSeriesChart
                        data={timeSeriesData}
                        series={[
                          { key: "purchases", name: "Purchases", type: "bar", color: "#a855f7" },
                          { key: "revenue", name: "Revenue", type: "line", color: "#22c55e", yAxisIndex: 1, smooth: true, areaStyle: true },
                          { key: "players", name: "Players", type: "line", color: "#3b82f6", smooth: true },
                        ]}
                        showDualYAxis
                        yAxisNames={["Count", "Revenue"]}
                        height="100%"
                      />
                    </div>
                  </ChartCard>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <ChartCard title="Revenue by Server" icon={Server} delay={0.45}>
                      <div className="h-72">
                        <BarChart data={serverRevenueData} height="100%" colors={COLORS} />
                      </div>
                    </ChartCard>

                    <ChartCard title="Top Items (by count)" icon={Package} delay={0.5}>
                      <div className="h-72">
                        <BarChart data={topItemsData} height="100%" colors={COLORS} labelWidth={140} />
                      </div>
                    </ChartCard>

                    <ChartCard title="Currency Distribution" icon={PieChartIcon} delay={0.55}>
                      <div className="h-64">
                        <PieChart data={currencyData} height="100%" colors={COLORS} />
                      </div>
                    </ChartCard>

                    <ChartCard title="Purchases by Server" icon={BarChart3} delay={0.6}>
                      <div className="h-64">
                        <BarChart data={serverPurchasesData} height="100%" horizontal={false} colors={COLORS} showLabels={false} />
                      </div>
                    </ChartCard>
                  </div>

                  <ChartCard title="Activity Heatmap (Purchases by Day & Hour)" icon={Calendar} delay={0.65}>
                    <ActivityHeatmap data={heatmapGrid} tooltipPrefix="purchases" />
                  </ChartCard>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <ChartCard title="Server Comparison" icon={Server} delay={0.7}>
                      <DataTable
                        data={analytics.serverStats}
                        columns={serverColumns}
                        keyExtractor={(row) => row.server}
                        showRowColors
                        colors={COLORS}
                      />
                    </ChartCard>

                    <ChartCard title="Top Spenders" icon={Award} delay={0.75}>
                      <DataTable
                        data={analytics.topPlayers.slice(0, 10)}
                        columns={playerColumns}
                        keyExtractor={(row) => row.steamid64}
                      />
                    </ChartCard>
                  </div>

                  <ChartCard title="Top Items by Revenue" icon={DollarSign} delay={0.8}>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      {analytics.topItems.slice(0, 8).map((item, idx) => (
                        <motion.div key={item.item} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.8 + idx * 0.05 }} className="p-4 rounded-xl transition-all hover:scale-[1.03] bg-gradient-to-br from-white/[0.03] to-white/[0.01] border border-white/5 hover:border-purple-500/30">
                          <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold shrink-0" style={{ background: `linear-gradient(135deg, ${COLORS[idx % COLORS.length]}, ${COLORS[(idx + 1) % COLORS.length]})` }}>
                              {idx + 1}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-white truncate" title={item.item}>{item.item}</p>
                              <div className="flex items-center gap-3 mt-2 text-xs">
                                <span className="text-zinc-400">{item.count} sales</span>
                                <span className="text-green-400 font-semibold">{item.revenue.toLocaleString()}</span>
                              </div>
                              <div className="text-xs text-zinc-500 mt-1">{item.buyers} buyers</div>
                            </div>
                          </div>
                        </motion.div>
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
                <motion.button onClick={() => setShowFilters(p => !p)} className="flex items-center space-x-2 text-white px-4 py-2 rounded-lg transition-colors hover:bg-white/5 bg-white/[0.02] border border-white/10" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                  <Filter className="h-4 w-4" />
                  <span>Filters</span>
                </motion.button>
                <motion.button onClick={exportCSV} disabled={purchases.length === 0} className="flex items-center space-x-2 text-white px-4 py-2 rounded-lg transition-colors hover:bg-white/5 disabled:opacity-50 bg-white/[0.02] border border-white/10" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                  <Download className="h-4 w-4" />
                  <span>Export CSV</span>
                </motion.button>
              </div>

              <AnimatePresence>
                {showFilters && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="p-6 rounded-xl overflow-hidden bg-white/[0.02] border border-white/10">
                    <form onSubmit={handleSearch} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                      <div>
                        <label className="block text-sm font-medium text-zinc-400 mb-2">Search</label>
                        <div className="relative">
                          <input type="text" placeholder="Player, SteamID, or Item..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full bg-zinc-800/50 border border-zinc-700/50 rounded-lg px-4 py-2 pl-10 text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500" />
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-zinc-400 mb-2">Server</label>
                        <select value={serverFilter} onChange={e => { setServerFilter(e.target.value); setCurrentPage(1); }} className="w-full bg-zinc-800/50 border border-zinc-700/50 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-purple-500">
                          <option value="">All Servers</option>
                          {servers.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                      <div className="flex gap-2">
                        <button type="submit" className="flex-1 bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded-lg transition-colors">Search</button>
                        <button type="button" onClick={resetFilters} className="text-sm text-purple-400 hover:text-purple-300 flex items-center gap-1 transition-colors px-3"><X className="h-4 w-4" /> Reset</button>
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
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl overflow-hidden bg-white/[0.02] border border-white/5">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-white/10 bg-white/[0.02]">
                          <th className="px-6 py-4 text-left text-xs font-semibold text-zinc-400 uppercase"><Clock className="inline h-4 w-4 mr-1" />Timestamp</th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-zinc-400 uppercase"><Server className="inline h-4 w-4 mr-1" />Server</th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-zinc-400 uppercase"><User className="inline h-4 w-4 mr-1" />Player</th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-zinc-400 uppercase">SteamID64</th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-zinc-400 uppercase"><Package className="inline h-4 w-4 mr-1" />Item</th>
                          <th className="px-6 py-4 text-center text-xs font-semibold text-zinc-400 uppercase">Amt</th>
                          <th className="px-6 py-4 text-center text-xs font-semibold text-zinc-400 uppercase">Currency</th>
                          <th className="px-6 py-4 text-right text-xs font-semibold text-zinc-400 uppercase"><DollarSign className="inline h-4 w-4 mr-1" />Cost</th>
                        </tr>
                      </thead>
                      <tbody>
                        {purchases.map((purchase, idx) => (
                          <motion.tr key={`${purchase.steamid64}-${purchase.timestamp}-${idx}`} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.02 }} className="border-b border-white/5 hover:bg-white/[0.03] transition-colors">
                            <td className="px-6 py-4 text-sm text-zinc-400">{purchase.timestamp}</td>
                            <td className="px-6 py-4 text-sm text-white">{purchase.server_name}</td>
                            <td className="px-6 py-4 text-sm text-white font-medium">{purchase.player_name}</td>
                            <td className="px-6 py-4 text-sm text-zinc-500 font-mono">{purchase.steamid64}</td>
                            <td className="px-6 py-4 text-sm text-purple-400 font-medium">{purchase.item_name}</td>
                            <td className="px-6 py-4 text-sm text-center text-white">{purchase.amount}</td>
                            <td className="px-6 py-4 text-sm text-center"><span className="px-2 py-1 rounded-full text-xs bg-purple-500/20 text-purple-400">{purchase.currency}</span></td>
                            <td className="px-6 py-4 text-sm text-right text-green-400 font-semibold">{purchase.cost.toLocaleString()}</td>
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
                      <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-2 rounded-lg bg-white/5 hover:bg-purple-500 disabled:opacity-50 transition-colors"><ChevronLeft className="h-5 w-5" /></button>
                      <span className="px-4 py-2 text-sm text-zinc-400">Page {currentPage} of {totalPages} ({totalRecords.toLocaleString()} records)</span>
                      <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-2 rounded-lg bg-white/5 hover:bg-purple-500 disabled:opacity-50 transition-colors"><ChevronRight className="h-5 w-5" /></button>
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
