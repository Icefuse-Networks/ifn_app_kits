"use client";

import React, { useState, useCallback, useEffect, useMemo } from "react";
import {
  ShoppingCart, RefreshCw, Search, ChevronLeft, ChevronRight, Filter, Download, Server, User, Package, DollarSign, Clock, Hash,
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
import {
  Modal,
  ConfirmModal,
  Input,
  Button,
  SearchInput,
  Tabs,
  Loading,
  EmptyState,
  Alert,
  Dropdown
} from "@/components/ui";

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
              <Tabs
                tabs={[
                  { id: 'analytics', label: 'Analytics', icon: <BarChart3 className="h-4 w-4" /> },
                  { id: 'transactions', label: 'Transactions', icon: <Clock className="h-4 w-4" /> }
                ]}
                activeTab={activeTab}
                onChange={(id) => setActiveTab(id as 'analytics' | 'transactions')}
                variant="pills"
              />
              <Dropdown
                value={`${timeFilter.type}:${timeFilter.value}`}
                onChange={val => { if (val) { const [type, valStr] = val.split(':'); setTimeFilter({ type: type as 'hours' | 'days', value: Number(valStr) }); } }}
                options={[
                  { value: "hours:1", label: "Last hour" },
                  { value: "hours:6", label: "Last 6 hours" },
                  { value: "hours:12", label: "Last 12 hours" },
                  { value: "hours:24", label: "Last 24 hours" },
                  { value: "days:2", label: "Last 2 days" },
                  { value: "days:3", label: "Last 3 days" },
                  { value: "days:7", label: "Last 7 days" },
                  { value: "days:14", label: "Last 14 days" },
                  { value: "days:30", label: "Last 30 days" },
                  { value: "days:60", label: "Last 60 days" },
                  { value: "days:90", label: "Last 90 days" },
                  { value: "days:180", label: "Last 6 months" },
                  { value: "days:365", label: "Last year" }
                ]}
              />
              <Dropdown
                value={serverFilter}
                onChange={val => { setServerFilter(val || ''); setCurrentPage(1); }}
                options={servers.map(s => ({ value: s, label: s }))}
                placeholder="All Servers"
                emptyOption="All Servers"
              />
              <Button
                onClick={() => { fetchPurchases(); fetchAnalytics(); }}
                disabled={loading || analyticsLoading}
                loading={loading || analyticsLoading}
                icon={<RefreshCw className="h-4 w-4" />}
                className="bg-gradient-to-r from-purple-500 to-pink-500"
              >
                Refresh
              </Button>
              <Button
                variant="error"
                onClick={() => { setDeleteTarget(serverFilter || null); setShowDeleteModal(true); }}
                icon={<Trash2 className="h-4 w-4" />}
              >
                Clear Data
              </Button>
            </div>
          </div>

          <ConfirmModal
            isOpen={showDeleteModal}
            onClose={() => setShowDeleteModal(false)}
            onConfirm={handleDelete}
            title="Clear Shop Data"
            description={
              deleteTarget
                ? `Are you sure you want to delete all purchase data for ${deleteTarget}? This action cannot be undone.`
                : "Are you sure you want to delete ALL shop purchase data across all servers? This action cannot be undone."
            }
            confirmText="Delete"
            cancelText="Cancel"
            variant="error"
            loading={deleting}
          />

          {activeTab === 'analytics' && (
            <>
              {analyticsLoading ? (
                <Loading text="Loading analytics..." size="lg" />
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
                <EmptyState
                  icon={<BarChart3 className="h-12 w-12" />}
                  title="No analytics data"
                  description="No analytics data available"
                />
              )}
            </>
          )}

          {activeTab === 'transactions' && (
            <>
              <div className="flex gap-3 flex-wrap">
                <Button
                  variant="secondary"
                  onClick={() => setShowFilters(p => !p)}
                  icon={<Filter className="h-4 w-4" />}
                >
                  Filters
                </Button>
                <Button
                  variant="secondary"
                  onClick={exportCSV}
                  disabled={purchases.length === 0}
                   icon={<Download className="h-4 w-4" />}
                >
                  Export CSV
                </Button>
              </div>

              <AnimatePresence>
                {showFilters && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="p-6 rounded-xl overflow-hidden bg-white/[0.02] border border-white/10">
                    <form onSubmit={handleSearch} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                      <SearchInput
                        label="Search"
                        placeholder="Player, SteamID, or Item..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                      />
                      <Dropdown
                        value={serverFilter}
                        onChange={val => { setServerFilter(val || ''); setCurrentPage(1); }}
                        options={servers.map(s => ({ value: s, label: s }))}
                        placeholder="All Servers"
                        emptyOption="All Servers"
                      />
                      <div className="flex gap-2">
                        <Button type="submit" variant="primary" className="flex-1">
                          Search
                        </Button>
                        <Button type="button" variant="ghost" onClick={resetFilters}>
                          Reset
                        </Button>
                      </div>
                    </form>
                  </motion.div>
                )}
              </AnimatePresence>

              {error && (
                <Alert variant="error">{error}</Alert>
              )}

              {loading ? (
                <Loading text="Loading transactions..." size="lg" />
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
                    <EmptyState
                      icon={<ShoppingCart className="h-12 w-12" />}
                      title="No transactions found"
                    />
                  )}

                  {totalPages > 1 && (
                    <div className="flex justify-center items-center gap-2 p-6 border-t border-white/5">
                      <Button
                        variant="secondary"
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        size="sm"
                      >
                        <ChevronLeft className="h-5 w-5" />
                      </Button>
                      <span className="px-4 py-2 text-sm text-zinc-400">Page {currentPage} of {totalPages} ({totalRecords.toLocaleString()} records)</span>
                      <Button
                        variant="secondary"
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        size="sm"
                      >
                        <ChevronRight className="h-5 w-5" />
                      </Button>
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
