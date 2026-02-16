"use client";

import React, { useState, useCallback, useEffect, useMemo } from "react";
import {
  Castle, RefreshCw, Loader2, ChevronLeft, ChevronRight, Clock,
  TrendingUp, BarChart3, Calendar, Users, Target, Skull, ChevronDown, ChevronUp,
  Shield, Hammer, Box, CheckCircle2
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
  RankBadge,
  Column,
} from "@/components/analytics";

interface RaidEvent {
  timestamp_str: string;
  server_id: string;
  base_id: number;
  building_name: string;
  base_type: string;
  building_grade: string;
  raid_duration_seconds: number;
  was_completed: number;
  total_entities_destroyed: number;
  total_containers_destroyed: number;
  total_npcs_killed: number;
  raider_steam_ids: string[];
  raider_names: string[];
  raider_entities_destroyed: number[];
  raider_containers_destroyed: number[];
  raider_npcs_killed: number[];
}

interface AnalyticsData {
  overview: {
    totalRaids: number;
    completedRaids: number;
    completionRate: number;
    avgDuration: number;
    uniqueRaiders: number;
    totalEntitiesDestroyed: number;
    totalNpcsKilled: number;
  };
  timeSeries: { date: string; raids: number; completed: number; abandoned: number }[];
  topRaiders: { steam_id: string; name: string; raids: number; entities: number; completed: number }[];
  baseTypes: { name: string; value: number }[];
  gradeDistribution: { name: string; value: number }[];
  hourlyHeatmap: { hour: number; dayOfWeek: number; count: number }[];
}

const COLORS = ['#f59e0b', '#ef4444', '#a855f7', '#3b82f6', '#22c55e', '#ec4899', '#06b6d4', '#8b5cf6', '#f97316', '#14b8a6'];

export default function BasesAnalyticsPage() {
  const [raids, setRaids] = useState<RaidEvent[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [serverFilter, setServerFilter] = useState("");
  const [baseTypeFilter, setBaseTypeFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [servers, setServers] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'analytics' | 'raids'>('analytics');
  const [timeFilter, setTimeFilter] = useState<{ type: 'hours' | 'days'; value: number }>({ type: 'days', value: 30 });
  const [expandedRaid, setExpandedRaid] = useState<string | null>(null);
  const ITEMS_PER_PAGE = 25;

  const fetchRaids = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.append("start", String((currentPage - 1) * ITEMS_PER_PAGE));
      params.append("length", String(ITEMS_PER_PAGE));
      if (serverFilter) params.append("server_id", serverFilter);
      if (baseTypeFilter) params.append("base_type", baseTypeFilter);
      if (timeFilter.type === 'hours') params.append("hours", String(timeFilter.value));
      else params.append("days", String(timeFilter.value));

      const response = await fetch(`/api/bases/stats?${params.toString()}`, { credentials: 'include' });
      if (!response.ok) throw new Error("Failed to fetch raids");

      const data = await response.json();
      setRaids(data.data || []);
      setTotalRecords(data.recordsFiltered || 0);

      if (data.data && data.data.length > 0) {
        const uniqueServers = [...new Set(data.data.map((e: RaidEvent) => e.server_id))] as string[];
        setServers(prev => [...new Set([...prev, ...uniqueServers])].sort() as string[]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [currentPage, serverFilter, baseTypeFilter, timeFilter]);

  const fetchAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);
    try {
      const params = new URLSearchParams();
      if (timeFilter.type === 'hours') params.append("hours", String(timeFilter.value));
      else params.append("days", String(timeFilter.value));
      if (serverFilter) params.append("server_id", serverFilter);
      if (baseTypeFilter) params.append("base_type", baseTypeFilter);

      const response = await fetch(`/api/bases/stats?${params.toString()}&length=1000`, { credentials: 'include' });
      if (!response.ok) throw new Error("Failed to fetch analytics");

      const data = await response.json();
      const raidList: RaidEvent[] = data.data || [];

      const completedRaids = raidList.filter(r => r.was_completed).length;
      const uniqueRaiderSet = new Set<string>();
      raidList.forEach(r => r.raider_steam_ids?.forEach(id => uniqueRaiderSet.add(id)));

      const overview = {
        totalRaids: raidList.length,
        completedRaids,
        completionRate: raidList.length > 0 ? Math.round((completedRaids / raidList.length) * 100) : 0,
        avgDuration: raidList.length > 0 ? Math.round(raidList.reduce((sum, r) => sum + r.raid_duration_seconds, 0) / raidList.length) : 0,
        uniqueRaiders: uniqueRaiderSet.size,
        totalEntitiesDestroyed: raidList.reduce((sum, r) => sum + r.total_entities_destroyed, 0),
        totalNpcsKilled: raidList.reduce((sum, r) => sum + r.total_npcs_killed, 0),
      };

      // Time series by date
      const dateMap = new Map<string, { raids: number; completed: number; abandoned: number }>();
      raidList.forEach(r => {
        const date = r.timestamp_str.split(' ')[0];
        const existing = dateMap.get(date) || { raids: 0, completed: 0, abandoned: 0 };
        existing.raids++;
        if (r.was_completed) existing.completed++;
        else existing.abandoned++;
        dateMap.set(date, existing);
      });
      const timeSeries = Array.from(dateMap.entries())
        .map(([date, stats]) => ({ date, ...stats }))
        .sort((a, b) => a.date.localeCompare(b.date));

      // Top raiders
      const raiderMap = new Map<string, { name: string; raids: number; entities: number; completed: number }>();
      raidList.forEach(r => {
        if (!r.raider_steam_ids) return;
        const wasCompleted = r.was_completed;
        for (let i = 0; i < r.raider_steam_ids.length; i++) {
          const steamId = r.raider_steam_ids[i];
          const existing = raiderMap.get(steamId) || { name: r.raider_names[i] || "Unknown", raids: 0, entities: 0, completed: 0 };
          existing.raids++;
          existing.entities += r.raider_entities_destroyed?.[i] || 0;
          if (wasCompleted) existing.completed++;
          raiderMap.set(steamId, existing);
        }
      });
      const topRaiders = Array.from(raiderMap.entries())
        .map(([steam_id, stats]) => ({ steam_id, ...stats }))
        .sort((a, b) => b.raids - a.raids)
        .slice(0, 10);

      // Base types
      const typeMap = new Map<string, number>();
      raidList.forEach(r => {
        typeMap.set(r.base_type, (typeMap.get(r.base_type) || 0) + 1);
      });
      const baseTypes = Array.from(typeMap.entries())
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);

      // Grade distribution
      const gradeMap = new Map<string, number>();
      raidList.forEach(r => {
        gradeMap.set(r.building_grade, (gradeMap.get(r.building_grade) || 0) + 1);
      });
      const gradeDistribution = Array.from(gradeMap.entries())
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);

      // Hourly heatmap
      const heatmapMap = new Map<string, number>();
      raidList.forEach(r => {
        const date = new Date(r.timestamp_str.replace(' ', 'T'));
        const dayOfWeek = date.getDay() || 7;
        const hour = date.getHours();
        const key = `${dayOfWeek}-${hour}`;
        heatmapMap.set(key, (heatmapMap.get(key) || 0) + 1);
      });
      const hourlyHeatmap = Array.from(heatmapMap.entries()).map(([key, count]) => {
        const [dow, hr] = key.split('-').map(Number);
        return { dayOfWeek: dow, hour: hr, count };
      });

      setAnalytics({ overview, timeSeries, topRaiders, baseTypes, gradeDistribution, hourlyHeatmap });
    } catch (err) {
      console.error("Analytics fetch error:", err);
    } finally {
      setAnalyticsLoading(false);
    }
  }, [timeFilter, serverFilter, baseTypeFilter]);

  useEffect(() => { fetchRaids(); }, [fetchRaids]);
  useEffect(() => { fetchAnalytics(); }, [fetchAnalytics]);

  const totalPages = Math.ceil(totalRecords / ITEMS_PER_PAGE);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const timeSeriesData = useMemo(() => analytics?.timeSeries || [], [analytics?.timeSeries]);

  const topRaidersData = useMemo(() => {
    if (!analytics?.topRaiders?.length) return [];
    return analytics.topRaiders.slice(0, 8).map(r => ({ label: r.name, value: r.raids }));
  }, [analytics?.topRaiders]);

  const baseTypeData = useMemo(() => analytics?.baseTypes || [], [analytics?.baseTypes]);
  const gradeData = useMemo(() => analytics?.gradeDistribution || [], [analytics?.gradeDistribution]);

  const completionData = useMemo(() => {
    if (!analytics?.overview) return [];
    return [
      { name: 'Completed', value: analytics.overview.completedRaids },
      { name: 'Abandoned', value: analytics.overview.totalRaids - analytics.overview.completedRaids },
    ].filter(d => d.value > 0);
  }, [analytics?.overview]);

  const heatmapGrid = useMemo(() => {
    if (!analytics?.hourlyHeatmap) return Array(7).fill(null).map(() => Array(24).fill(0));
    const grid: number[][] = Array(7).fill(null).map(() => Array(24).fill(0));
    analytics.hourlyHeatmap.forEach(d => {
      const dayIdx = d.dayOfWeek - 1;
      if (dayIdx >= 0 && dayIdx < 7 && d.hour >= 0 && d.hour < 24) grid[dayIdx][d.hour] = d.count;
    });
    return grid;
  }, [analytics?.hourlyHeatmap]);

  type RaiderStat = { steam_id: string; name: string; raids: number; entities: number; completed: number };

  const raiderColumns: Column<RaiderStat>[] = useMemo(() => [
    { key: "rank", header: "#", render: (_, __, idx) => <RankBadge rank={idx + 1} /> },
    {
      key: "name",
      header: "Player",
      render: (_, row) => (
        <div>
          <div className="text-sm text-white font-medium">{row.name}</div>
          <div className="text-xs text-zinc-600 font-mono">{row.steam_id}</div>
        </div>
      ),
    },
    { key: "raids", header: "Raids", align: "right" as const, render: (v) => <span className="text-amber-400 font-semibold">{(v as number).toLocaleString()}</span> },
    { key: "entities", header: "Destroyed", align: "right" as const, render: (v) => <span className="text-red-400">{(v as number).toLocaleString()}</span> },
    { key: "completed", header: "Completed", align: "right" as const, render: (v) => <span className="text-green-400">{(v as number).toLocaleString()}</span> },
  ], []);

  return (
    <div className="p-8">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <div className="space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                <div className="p-2 rounded-xl bg-gradient-to-br from-red-500/20 to-orange-500/20">
                  <Castle className="h-6 w-6 text-red-400" />
                </div>
                Base Raid Analytics
              </h1>
              <p className="text-zinc-500 mt-2">IcefuseBases raid statistics and leaderboards</p>
            </div>
            <div className="flex gap-3 flex-wrap">
              <div className="flex rounded-lg overflow-hidden border border-white/10">
                <button onClick={() => setActiveTab('analytics')} className={`px-4 py-2 text-sm transition-colors ${activeTab === 'analytics' ? 'bg-red-500 text-white' : 'bg-white/5 text-zinc-400 hover:text-white'}`}>
                  <BarChart3 className="h-4 w-4 inline mr-2" />Analytics
                </button>
                <button onClick={() => setActiveTab('raids')} className={`px-4 py-2 text-sm transition-colors ${activeTab === 'raids' ? 'bg-red-500 text-white' : 'bg-white/5 text-zinc-400 hover:text-white'}`}>
                  <Hammer className="h-4 w-4 inline mr-2" />Raids
                </button>
              </div>
              <select value={`${timeFilter.type}:${timeFilter.value}`} onChange={e => { const [type, val] = e.target.value.split(':'); setTimeFilter({ type: type as 'hours' | 'days', value: Number(val) }); setCurrentPage(1); }} className="px-4 py-2 rounded-lg text-sm text-white bg-white/5 border border-white/10">
                <option value="hours:1">Last hour</option>
                <option value="hours:6">Last 6 hours</option>
                <option value="hours:24">Last 24 hours</option>
                <option value="days:7">Last 7 days</option>
                <option value="days:14">Last 14 days</option>
                <option value="days:30">Last 30 days</option>
                <option value="days:60">Last 60 days</option>
                <option value="days:90">Last 90 days</option>
              </select>
              <select value={baseTypeFilter} onChange={e => { setBaseTypeFilter(e.target.value); setCurrentPage(1); }} className="px-4 py-2 rounded-lg text-sm text-white bg-white/5 border border-white/10">
                <option value="">All Types</option>
                <option value="Small">Small</option>
                <option value="Medium">Medium</option>
                <option value="Large">Large</option>
              </select>
              <select value={serverFilter} onChange={e => { setServerFilter(e.target.value); setCurrentPage(1); }} className="px-4 py-2 rounded-lg text-sm text-white bg-white/5 border border-white/10">
                <option value="">All Servers</option>
                {servers.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <motion.button onClick={() => { fetchRaids(); fetchAnalytics(); }} disabled={loading || analyticsLoading} className="flex items-center space-x-2 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50 bg-gradient-to-r from-red-500 to-orange-500" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                {(loading || analyticsLoading) ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                <span>Refresh</span>
              </motion.button>
            </div>
          </div>

          {activeTab === 'analytics' && (
            <>
              {analyticsLoading ? (
                <div className="text-center py-20">
                  <Loader2 className="h-12 w-12 mx-auto animate-spin text-red-400 mb-4" />
                  <p className="text-lg text-zinc-400">Loading analytics...</p>
                </div>
              ) : analytics ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4">
                    <StatCard icon={Castle} label="Total Raids" value={analytics.overview.totalRaids} delay={0.05} />
                    <StatCard icon={CheckCircle2} label="Completed" value={analytics.overview.completedRaids} delay={0.1} />
                    <StatCard icon={Target} label="Completion %" value={`${analytics.overview.completionRate}%`} delay={0.15} />
                    <StatCard icon={Clock} label="Avg Duration" value={formatDuration(analytics.overview.avgDuration)} delay={0.2} />
                    <StatCard icon={Users} label="Unique Raiders" value={analytics.overview.uniqueRaiders} delay={0.25} />
                    <StatCard icon={Hammer} label="Entities Destroyed" value={analytics.overview.totalEntitiesDestroyed} delay={0.3} />
                    <StatCard icon={Skull} label="NPCs Killed" value={analytics.overview.totalNpcsKilled} delay={0.35} />
                  </div>

                  <ChartCard title="Raids Over Time" icon={TrendingUp} className="lg:col-span-2" delay={0.4}>
                    <div className="h-80">
                      <TimeSeriesChart
                        data={timeSeriesData}
                        series={[
                          { key: "raids", name: "Total Raids", type: "bar", color: "#f59e0b" },
                          { key: "completed", name: "Completed", type: "line", color: "#22c55e", smooth: true, areaStyle: true },
                          { key: "abandoned", name: "Abandoned", type: "line", color: "#ef4444", smooth: true },
                        ]}
                        height="100%"
                      />
                    </div>
                  </ChartCard>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <ChartCard title="Top Raiders" icon={Users} delay={0.45}>
                      <div className="h-72">
                        <BarChart data={topRaidersData} height="100%" colors={COLORS} />
                      </div>
                    </ChartCard>

                    <ChartCard title="Completion Rate" icon={CheckCircle2} delay={0.5}>
                      <div className="h-72">
                        <PieChart data={completionData} height="100%" colors={['#22c55e', '#ef4444']} />
                      </div>
                    </ChartCard>

                    <ChartCard title="Base Types" icon={Castle} delay={0.55}>
                      <div className="h-64">
                        <PieChart data={baseTypeData} height="100%" colors={COLORS} />
                      </div>
                    </ChartCard>

                    <ChartCard title="Building Grade" icon={Shield} delay={0.6}>
                      <div className="h-64">
                        <PieChart data={gradeData} height="100%" colors={['#a855f7', '#3b82f6', '#f59e0b', '#22c55e']} />
                      </div>
                    </ChartCard>
                  </div>

                  <ChartCard title="Raid Activity Heatmap (by Day & Hour)" icon={Calendar} delay={0.65}>
                    <ActivityHeatmap data={heatmapGrid} tooltipPrefix="raids" />
                  </ChartCard>

                  <ChartCard title="Raider Leaderboard" icon={Target} delay={0.7}>
                    <DataTable
                      data={analytics.topRaiders}
                      columns={raiderColumns}
                      keyExtractor={(row) => row.steam_id}
                    />
                  </ChartCard>
                </>
              ) : (
                <div className="text-center py-20 text-zinc-600">
                  <Castle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No raid data available</p>
                </div>
              )}
            </>
          )}

          {activeTab === 'raids' && (
            <>
              {error && (
                <div className="text-center py-10 bg-red-900/20 border border-red-700/50 p-6 rounded-xl">
                  <p className="text-xl font-semibold text-red-300">{error}</p>
                </div>
              )}

              {loading ? (
                <div className="text-center py-20">
                  <Loader2 className="h-12 w-12 mx-auto animate-spin text-red-400 mb-4" />
                  <p className="text-lg text-zinc-400">Loading raids...</p>
                </div>
              ) : (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                  {raids.map((raid, idx) => {
                    const raidKey = `${raid.timestamp_str}-${raid.base_id}`;
                    const isExpanded = expandedRaid === raidKey;
                    return (
                      <motion.div
                        key={`${raidKey}-${idx}`}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.02 }}
                        className="rounded-xl overflow-hidden bg-white/[0.02] border border-white/5 hover:border-red-500/30 transition-colors"
                      >
                        <div
                          className="p-4 cursor-pointer flex items-center justify-between"
                          onClick={() => setExpandedRaid(isExpanded ? null : raidKey)}
                        >
                          <div className="flex items-center gap-4">
                            <div className={`p-2 rounded-lg ${raid.was_completed ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
                              {raid.was_completed ? <CheckCircle2 className="h-5 w-5 text-green-400" /> : <Target className="h-5 w-5 text-red-400" />}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className={`text-sm font-bold ${raid.was_completed ? 'text-green-400' : 'text-red-400'}`}>
                                  {raid.was_completed ? 'COMPLETED' : 'ABANDONED'}
                                </span>
                                <span className="px-1.5 py-0.5 text-xs rounded bg-white/10 text-zinc-400">{raid.base_type}</span>
                                <span className="px-1.5 py-0.5 text-xs rounded bg-white/10 text-zinc-400">{raid.building_grade}</span>
                                <span className="text-xs text-zinc-500">{raid.building_name}</span>
                              </div>
                              <div className="text-xs text-zinc-500 mt-1">
                                <Clock className="inline h-3 w-3 mr-1" />
                                {raid.timestamp_str} &bull; {formatDuration(raid.raid_duration_seconds)}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-6">
                            <div className="text-right">
                              <div className="flex items-center gap-3 text-sm">
                                <span className="text-zinc-400"><Hammer className="inline h-3 w-3 mr-1 text-orange-400" />{raid.total_entities_destroyed}</span>
                                <span className="text-zinc-400"><Box className="inline h-3 w-3 mr-1 text-yellow-400" />{raid.total_containers_destroyed}</span>
                                <span className="text-zinc-400"><Skull className="inline h-3 w-3 mr-1 text-red-400" />{raid.total_npcs_killed}</span>
                              </div>
                              <div className="text-xs text-zinc-500 mt-1">
                                <Users className="inline h-3 w-3 mr-1" />
                                {raid.raider_steam_ids?.length || 0} raiders
                              </div>
                            </div>
                            {isExpanded ? <ChevronUp className="h-5 w-5 text-zinc-500" /> : <ChevronDown className="h-5 w-5 text-zinc-500" />}
                          </div>
                        </div>

                        <AnimatePresence>
                          {isExpanded && raid.raider_steam_ids?.length > 0 && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="border-t border-white/5 overflow-hidden"
                            >
                              <div className="p-4">
                                <h4 className="text-sm font-semibold text-zinc-400 mb-3">Raiders</h4>
                                <div className="overflow-x-auto">
                                  <table className="w-full text-sm">
                                    <thead>
                                      <tr className="text-zinc-500 text-xs uppercase">
                                        <th className="text-left pb-2">#</th>
                                        <th className="text-left pb-2">Player</th>
                                        <th className="text-right pb-2">Entities</th>
                                        <th className="text-right pb-2">Containers</th>
                                        <th className="text-right pb-2">NPCs Killed</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {raid.raider_steam_ids.map((steamId, pIdx) => (
                                        <tr key={steamId} className="border-t border-white/5">
                                          <td className="py-2">
                                            <RankBadge rank={pIdx + 1} />
                                          </td>
                                          <td className="py-2">
                                            <div className="text-white">{raid.raider_names[pIdx] || "Unknown"}</div>
                                            <div className="text-xs text-zinc-600 font-mono">{steamId}</div>
                                          </td>
                                          <td className="py-2 text-right text-orange-400 font-semibold">{raid.raider_entities_destroyed?.[pIdx] || 0}</td>
                                          <td className="py-2 text-right text-yellow-400">{raid.raider_containers_destroyed?.[pIdx] || 0}</td>
                                          <td className="py-2 text-right text-red-400">{raid.raider_npcs_killed?.[pIdx] || 0}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    );
                  })}

                  {raids.length === 0 && (
                    <div className="text-center py-16 text-zinc-600">
                      <Castle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No raids found</p>
                    </div>
                  )}

                  {totalPages > 1 && (
                    <div className="flex justify-center items-center gap-2 pt-4">
                      <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-2 rounded-lg bg-white/5 hover:bg-red-500 disabled:opacity-50 transition-colors"><ChevronLeft className="h-5 w-5" /></button>
                      <span className="px-4 py-2 text-sm text-zinc-400">Page {currentPage} of {totalPages} ({totalRecords.toLocaleString()} raids)</span>
                      <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-2 rounded-lg bg-white/5 hover:bg-red-500 disabled:opacity-50 transition-colors"><ChevronRight className="h-5 w-5" /></button>
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
