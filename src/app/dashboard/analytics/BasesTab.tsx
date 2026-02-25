"use client";

import React, { useState, useCallback, useEffect, useMemo } from "react";
import {
  Castle, RefreshCw, Clock, TrendingUp, BarChart3, Calendar, Users, Target, Skull,
  ChevronDown, ChevronUp, Shield, Hammer, Box, CheckCircle2
} from "lucide-react";
import {
  StatCard, ChartCard, BarChart, PieChart, TimeSeriesChart, ActivityHeatmap, DataTable, RankBadge, Column,
} from "@/components/analytics";
import { Dropdown } from "@/components/global/Dropdown";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Tabs } from "@/components/ui/Tabs";
import { SimplePagination } from "@/components/ui/Pagination";
import { EmptyState } from "@/components/ui/EmptyState";
import { Loading } from "@/components/ui/Loading";

interface RaidEvent {
  timestamp_str: string; server_id: string; base_id: number; building_name: string;
  base_type: string; building_grade: string; raid_duration_seconds: number; was_completed: number;
  total_entities_destroyed: number; total_containers_destroyed: number; total_npcs_killed: number;
  raider_steam_ids: string[]; raider_names: string[];
  raider_entities_destroyed: number[]; raider_containers_destroyed: number[]; raider_npcs_killed: number[];
}

interface AnalyticsData {
  overview: {
    totalRaids: number; completedRaids: number; completionRate: number; avgDuration: number;
    uniqueRaiders: number; totalEntitiesDestroyed: number; totalContainersDestroyed: number;
    totalNpcsKilled: number; avgRaidersPerRaid: number;
  };
  timeSeries: { date: string; raids: number; completed: number; abandoned: number }[];
  topRaiders: { steam_id: string; name: string; raids: number; entities: number; completed: number }[];
  baseTypes: { name: string; value: number }[];
  gradeDistribution: { name: string; value: number }[];
  buildingNames: { name: string; value: number }[];
  serverDistribution: { name: string; value: number }[];
  hourlyHeatmap: { hour: number; dayOfWeek: number; count: number }[];
}

const COLORS = ['#f59e0b', '#ef4444', '#a855f7', '#3b82f6', '#22c55e', '#ec4899', '#06b6d4', '#8b5cf6', '#f97316', '#14b8a6'];

interface BasesTabProps {
  timeFilter: { type: 'hours' | 'days'; value: number };
  serverFilter: string;
  servers: string[];
  onServersFound: (servers: string[]) => void;
  serverNameMap: Record<string, string>;
}

export default function BasesTab({ timeFilter, serverFilter, servers, onServersFound, serverNameMap }: BasesTabProps) {
  const [raids, setRaids] = useState<RaidEvent[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [baseTypeFilter, setBaseTypeFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [activeSubTab, setActiveSubTab] = useState<'analytics' | 'raids'>('analytics');
  const [expandedRaid, setExpandedRaid] = useState<string | null>(null);
  const ITEMS_PER_PAGE = 25;

  const fetchRaids = useCallback(async () => {
    setLoading(true); setError(null);
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
      if (data.data?.length > 0) {
        const uniqueServers = [...new Set(data.data.map((e: RaidEvent) => e.server_id))] as string[];
        onServersFound(uniqueServers);
      }
    } catch (err) { setError(err instanceof Error ? err.message : "Unknown error"); }
    finally { setLoading(false); }
  }, [currentPage, serverFilter, baseTypeFilter, timeFilter, onServersFound]);

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

      const totalRaiderCount = raidList.reduce((sum, r) => sum + (r.raider_steam_ids?.length || 0), 0);
      const overview = {
        totalRaids: raidList.length, completedRaids,
        completionRate: raidList.length > 0 ? Math.round((completedRaids / raidList.length) * 100) : 0,
        avgDuration: raidList.length > 0 ? Math.round(raidList.reduce((sum, r) => sum + r.raid_duration_seconds, 0) / raidList.length) : 0,
        uniqueRaiders: uniqueRaiderSet.size,
        totalEntitiesDestroyed: raidList.reduce((sum, r) => sum + r.total_entities_destroyed, 0),
        totalContainersDestroyed: raidList.reduce((sum, r) => sum + r.total_containers_destroyed, 0),
        totalNpcsKilled: raidList.reduce((sum, r) => sum + r.total_npcs_killed, 0),
        avgRaidersPerRaid: raidList.length > 0 ? +(totalRaiderCount / raidList.length).toFixed(1) : 0,
      };

      const dateMap = new Map<string, { raids: number; completed: number; abandoned: number }>();
      raidList.forEach(r => {
        const date = r.timestamp_str.split(' ')[0];
        const existing = dateMap.get(date) || { raids: 0, completed: 0, abandoned: 0 };
        existing.raids++;
        if (r.was_completed) existing.completed++; else existing.abandoned++;
        dateMap.set(date, existing);
      });
      const timeSeries = Array.from(dateMap.entries()).map(([date, stats]) => ({ date, ...stats })).sort((a, b) => a.date.localeCompare(b.date));

      const raiderMap = new Map<string, { name: string; raids: number; entities: number; completed: number }>();
      raidList.forEach(r => {
        if (!r.raider_steam_ids) return;
        for (let i = 0; i < r.raider_steam_ids.length; i++) {
          const steamId = r.raider_steam_ids[i];
          const existing = raiderMap.get(steamId) || { name: r.raider_names[i] || "Unknown", raids: 0, entities: 0, completed: 0 };
          existing.raids++; existing.entities += r.raider_entities_destroyed?.[i] || 0;
          if (r.was_completed) existing.completed++;
          raiderMap.set(steamId, existing);
        }
      });
      const topRaiders = Array.from(raiderMap.entries()).map(([steam_id, stats]) => ({ steam_id, ...stats })).sort((a, b) => b.raids - a.raids).slice(0, 10);

      const typeMap = new Map<string, number>();
      raidList.forEach(r => typeMap.set(r.base_type, (typeMap.get(r.base_type) || 0) + 1));
      const baseTypes = Array.from(typeMap.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

      const gradeMap = new Map<string, number>();
      raidList.forEach(r => gradeMap.set(r.building_grade, (gradeMap.get(r.building_grade) || 0) + 1));
      const gradeDistribution = Array.from(gradeMap.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

      const buildingMap = new Map<string, number>();
      raidList.forEach(r => buildingMap.set(r.building_name, (buildingMap.get(r.building_name) || 0) + 1));
      const buildingNames = Array.from(buildingMap.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 15);

      const serverMap = new Map<string, number>();
      raidList.forEach(r => {
        const label = serverNameMap[r.server_id] || r.server_id;
        serverMap.set(label, (serverMap.get(label) || 0) + 1);
      });
      const serverDistribution = Array.from(serverMap.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

      const heatmapMap = new Map<string, number>();
      raidList.forEach(r => {
        const date = new Date(r.timestamp_str.replace(' ', 'T'));
        const dayOfWeek = date.getDay() || 7;
        const key = `${dayOfWeek}-${date.getHours()}`;
        heatmapMap.set(key, (heatmapMap.get(key) || 0) + 1);
      });
      const hourlyHeatmap = Array.from(heatmapMap.entries()).map(([key, count]) => {
        const [dow, hr] = key.split('-').map(Number);
        return { dayOfWeek: dow, hour: hr, count };
      });

      setAnalytics({ overview, timeSeries, topRaiders, baseTypes, gradeDistribution, buildingNames, serverDistribution, hourlyHeatmap });
    } catch (err) { console.error("Analytics fetch error:", err); }
    finally { setAnalyticsLoading(false); }
  }, [timeFilter, serverFilter, baseTypeFilter, serverNameMap]);

  useEffect(() => { fetchRaids(); }, [fetchRaids]);
  useEffect(() => { fetchAnalytics(); }, [fetchAnalytics]);

  const totalPages = Math.ceil(totalRecords / ITEMS_PER_PAGE);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

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
    { key: "name", header: "Player", render: (_, row) => (<div><div className="text-sm text-white font-medium">{row.name}</div><div className="text-xs text-[var(--text-tertiary)] font-mono">{row.steam_id}</div></div>) },
    { key: "raids", header: "Raids", align: "right" as const, render: (v) => <span className="text-[var(--status-warning)] font-semibold">{(v as number).toLocaleString()}</span> },
    { key: "entities", header: "Destroyed", align: "right" as const, render: (v) => <span className="text-[var(--status-error)]">{(v as number).toLocaleString()}</span> },
    { key: "completed", header: "Completed", align: "right" as const, render: (v) => <span className="text-[var(--status-success)]">{(v as number).toLocaleString()}</span> },
  ], []);

  return (
    <>
      <div className="flex gap-3 flex-wrap mb-4">
        <Tabs
          tabs={[
            { id: 'analytics', label: 'Analytics', icon: <BarChart3 className="h-4 w-4" /> },
            { id: 'raids', label: 'Raids', icon: <Hammer className="h-4 w-4" /> }
          ]}
          activeTab={activeSubTab}
          onChange={(tab) => setActiveSubTab(tab as 'analytics' | 'raids')}
          variant="pills" size="sm"
        />
        <Dropdown value={baseTypeFilter} options={[
          { value: '', label: 'All Types' }, { value: 'Small', label: 'Small' },
          { value: 'Medium', label: 'Medium' }, { value: 'Large', label: 'Large' }
        ]} onChange={(val) => { setBaseTypeFilter(val || ''); setCurrentPage(1); }} />
        <Button onClick={() => { fetchRaids(); fetchAnalytics(); }} disabled={loading || analyticsLoading} loading={loading || analyticsLoading} icon={<RefreshCw className="h-4 w-4" />} variant="primary">Refresh</Button>
      </div>

      {activeSubTab === 'analytics' && (
        <>
          {analyticsLoading ? <Loading size="lg" text="Loading analytics..." /> : analytics ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                <StatCard icon={Castle} label="Total Raids" value={analytics.overview.totalRaids} delay={0.05} />
                <StatCard icon={CheckCircle2} label="Completed" value={analytics.overview.completedRaids} delay={0.1} />
                <StatCard icon={Target} label="Completion %" value={`${analytics.overview.completionRate}%`} delay={0.15} />
                <StatCard icon={Clock} label="Avg Duration" value={formatDuration(analytics.overview.avgDuration)} delay={0.2} />
                <StatCard icon={Users} label="Unique Raiders" value={analytics.overview.uniqueRaiders} delay={0.25} />
                <StatCard icon={Hammer} label="Entities Destroyed" value={analytics.overview.totalEntitiesDestroyed.toLocaleString()} delay={0.3} />
                <StatCard icon={Box} label="Containers Looted" value={analytics.overview.totalContainersDestroyed.toLocaleString()} delay={0.35} />
                <StatCard icon={Skull} label="NPCs Killed" value={analytics.overview.totalNpcsKilled.toLocaleString()} delay={0.4} />
                <StatCard icon={Users} label="Avg Raiders/Raid" value={analytics.overview.avgRaidersPerRaid} delay={0.45} />
                <StatCard icon={Shield} label="Most Raided Grade" value={analytics.gradeDistribution[0]?.name || "N/A"} delay={0.5} />
              </div>

              <ChartCard title="Raids Over Time" icon={TrendingUp} className="lg:col-span-2" delay={0.4}>
                <div className="h-80">
                  <TimeSeriesChart data={analytics.timeSeries} series={[
                    { key: "raids", name: "Total Raids", type: "bar", color: "#f59e0b" },
                    { key: "completed", name: "Completed", type: "line", color: "#22c55e", smooth: true, areaStyle: true },
                    { key: "abandoned", name: "Abandoned", type: "line", color: "#ef4444", smooth: true },
                  ]} height="100%" />
                </div>
              </ChartCard>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ChartCard title="Top Raiders" icon={Users} delay={0.45}>
                  <div className="h-72"><BarChart data={analytics.topRaiders.slice(0, 8).map(r => ({ label: r.name, value: r.raids }))} height="100%" colors={COLORS} /></div>
                </ChartCard>
                <ChartCard title="Completion Rate" icon={CheckCircle2} delay={0.5}>
                  <div className="h-72"><PieChart data={[
                    { name: 'Completed', value: analytics.overview.completedRaids },
                    { name: 'Abandoned', value: analytics.overview.totalRaids - analytics.overview.completedRaids },
                  ].filter(d => d.value > 0)} height="100%" colors={['#22c55e', '#ef4444']} /></div>
                </ChartCard>
                <ChartCard title="Most Raided Buildings" icon={Castle} delay={0.52}>
                  <div className="h-72"><BarChart data={analytics.buildingNames.slice(0, 10).map(b => ({ label: b.name, value: b.value }))} height="100%" colors={COLORS} /></div>
                </ChartCard>
                {analytics.serverDistribution.length > 1 && (
                  <ChartCard title="Raids by Server" icon={Castle} delay={0.54}>
                    <div className="h-72"><PieChart data={analytics.serverDistribution} height="100%" colors={COLORS} /></div>
                  </ChartCard>
                )}
                <ChartCard title="Base Types" icon={Castle} delay={0.55}>
                  <div className="h-64"><PieChart data={analytics.baseTypes} height="100%" colors={COLORS} /></div>
                </ChartCard>
                <ChartCard title="Building Grade" icon={Shield} delay={0.6}>
                  <div className="h-64"><PieChart data={analytics.gradeDistribution} height="100%" colors={['#a855f7', '#3b82f6', '#f59e0b', '#22c55e']} /></div>
                </ChartCard>
              </div>

              <ChartCard title="Raid Activity Heatmap (by Day & Hour)" icon={Calendar} delay={0.65}>
                <ActivityHeatmap data={heatmapGrid} tooltipPrefix="raids" />
              </ChartCard>

              <ChartCard title="Raider Leaderboard" icon={Target} delay={0.7}>
                <DataTable data={analytics.topRaiders} columns={raiderColumns} keyExtractor={(row) => row.steam_id} />
              </ChartCard>
            </>
          ) : <EmptyState icon={<Castle className="h-12 w-12" />} title="No raid data available" />}
        </>
      )}

      {activeSubTab === 'raids' && (
        <>
          {error && (
            <div className="text-center py-10 bg-[var(--status-error)]/20 border border-[var(--status-error)]/50 p-6 rounded-xl">
              <p className="text-xl font-semibold text-[var(--status-error)]">{error}</p>
            </div>
          )}
          {loading ? <Loading size="lg" text="Loading raids..." /> : (
            <div className="anim-fade-slide-up space-y-4">
              {raids.map((raid, idx) => {
                const raidKey = `${raid.timestamp_str}-${raid.base_id}`;
                const isExpanded = expandedRaid === raidKey;
                return (
                  <div key={`${raidKey}-${idx}`}
                    className="anim-stagger-item rounded-xl overflow-hidden bg-white/[0.02] border border-white/5 hover:border-[var(--status-error)]/30 transition-colors"
                    style={{ animationDelay: `${idx * 20}ms` }}>
                    <div className="p-4 cursor-pointer flex items-center justify-between" onClick={() => setExpandedRaid(isExpanded ? null : raidKey)}>
                      <div className="flex items-center gap-4">
                        <div className={`p-2 rounded-lg ${raid.was_completed ? 'bg-[var(--status-success)]/20' : 'bg-[var(--status-error)]/20'}`}>
                          {raid.was_completed ? <CheckCircle2 className="h-5 w-5 text-[var(--status-success)]" /> : <Target className="h-5 w-5 text-[var(--status-error)]" />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <Badge variant={raid.was_completed ? 'success' : 'error'} size="sm">{raid.was_completed ? 'COMPLETED' : 'ABANDONED'}</Badge>
                            <Badge variant="secondary" size="sm">{raid.base_type}</Badge>
                            <Badge variant="secondary" size="sm">{raid.building_grade}</Badge>
                            <span className="text-xs text-[var(--text-muted)]">{raid.building_name}</span>
                          </div>
                          <div className="text-xs text-[var(--text-muted)] mt-1">
                            <Clock className="inline h-3 w-3 mr-1" />{raid.timestamp_str} &bull; {formatDuration(raid.raid_duration_seconds)}
                            {raid.server_id && <span className="ml-2 text-[var(--text-tertiary)]">&bull; {serverNameMap[raid.server_id] || raid.server_id}</span>}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="text-right">
                          <div className="flex items-center gap-3 text-sm">
                            <span className="text-[var(--text-muted)]"><Hammer className="inline h-3 w-3 mr-1 text-[var(--status-warning)]" />{raid.total_entities_destroyed}</span>
                            <span className="text-[var(--text-muted)]"><Box className="inline h-3 w-3 mr-1 text-[var(--status-warning)]" />{raid.total_containers_destroyed}</span>
                            <span className="text-[var(--text-muted)]"><Skull className="inline h-3 w-3 mr-1 text-[var(--status-error)]" />{raid.total_npcs_killed}</span>
                          </div>
                          <div className="text-xs text-[var(--text-muted)] mt-1"><Users className="inline h-3 w-3 mr-1" />{raid.raider_steam_ids?.length || 0} raiders</div>
                        </div>
                        {isExpanded ? <ChevronUp className="h-5 w-5 text-[var(--text-muted)]" /> : <ChevronDown className="h-5 w-5 text-[var(--text-muted)]" />}
                      </div>
                    </div>
                      {isExpanded && raid.raider_steam_ids?.length > 0 && (
                        <div className="border-t border-white/5 overflow-hidden">
                          <div className="p-4">
                            <h4 className="text-sm font-semibold text-[var(--text-muted)] mb-3">Raiders</h4>
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead><tr className="text-[var(--text-muted)] text-xs uppercase"><th className="text-left pb-2">#</th><th className="text-left pb-2">Player</th><th className="text-right pb-2">Entities</th><th className="text-right pb-2">Containers</th><th className="text-right pb-2">NPCs Killed</th></tr></thead>
                                <tbody>
                                  {raid.raider_steam_ids.map((steamId, pIdx) => (
                                    <tr key={steamId} className="border-t border-white/5">
                                      <td className="py-2"><RankBadge rank={pIdx + 1} /></td>
                                      <td className="py-2"><div className="text-white">{raid.raider_names[pIdx] || "Unknown"}</div><div className="text-xs text-[var(--text-tertiary)] font-mono">{steamId}</div></td>
                                      <td className="py-2 text-right text-[var(--status-warning)] font-semibold">{raid.raider_entities_destroyed?.[pIdx] || 0}</td>
                                      <td className="py-2 text-right text-[var(--status-warning)]">{raid.raider_containers_destroyed?.[pIdx] || 0}</td>
                                      <td className="py-2 text-right text-[var(--status-error)]">{raid.raider_npcs_killed?.[pIdx] || 0}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </div>
                      )}
                  </div>
                );
              })}
              {raids.length === 0 && <EmptyState icon={<Castle className="h-12 w-12" />} title="No raids found" />}
              {totalPages > 1 && (
                <div className="flex justify-center pt-4">
                  <SimplePagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
                </div>
              )}
            </div>
          )}
        </>
      )}
    </>
  );
}
