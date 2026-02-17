"use client";

import React, { useState, useCallback, useEffect, useMemo } from "react";
import {
  BarChart3, RefreshCw, Castle, Trophy, Users, TrendingUp, Clock, Calendar,
  Target, Skull, Crown, Hammer, Shield, Box, CheckCircle2, MapPin, ChevronDown, ChevronUp,
  Activity, Zap, Server as ServerIcon, Swords, Award
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
import { Dropdown } from "@/components/ui/Dropdown";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Tabs } from "@/components/ui/Tabs";
import { SimplePagination } from "@/components/ui/Pagination";
import { EmptyState } from "@/components/ui/EmptyState";
import { Loading } from "@/components/ui/Loading";

// Types for Base Analytics
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

interface BasesAnalytics {
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

// Types for Event Analytics
interface EventCompletion {
  timestamp: string;
  server_id: string;
  event_type: "koth" | "maze";
  winner_steam_id: string;
  winner_name: string;
  winner_clan_tag: string | null;
  winner_kills: number;
  is_clan_mode: number;
  event_modes: string[];
  location: string | null;
  duration_seconds: number;
  participants: { steam_id: string; name: string; kills: number; deaths: number; position: number }[];
}

interface EventsAnalytics {
  overview: {
    totalEvents: number;
    uniqueWinners: number;
    avgParticipants: number;
    totalKills: number;
    avgDuration: number;
    kothCount: number;
    mazeCount: number;
  };
  timeSeries: { date: string; events: number; participants: number; kills: number }[];
  topWinners: { steam_id: string; name: string; wins: number; kills: number; events: number }[];
  eventModes: { mode: string; count: number }[];
  hourlyHeatmap: { hour: number; dayOfWeek: number; count: number }[];
  locationStats: { location: string; count: number }[];
}

// Types for Server Analytics
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

type TimeRange = "1h" | "6h" | "24h" | "7d" | "30d";
type GroupBy = "minute" | "hour" | "day" | "week";

const TIME_PRESETS: Record<TimeRange, { label: string; hours: number }> = {
  "1h": { label: "1 Hour", hours: 1 },
  "6h": { label: "6 Hours", hours: 6 },
  "24h": { label: "24 Hours", hours: 24 },
  "7d": { label: "7 Days", hours: 168 },
  "30d": { label: "30 Days", hours: 720 },
};

const COLORS = ['#f59e0b', '#ef4444', '#a855f7', '#3b82f6', '#22c55e', '#ec4899', '#06b6d4', '#8b5cf6', '#f97316', '#14b8a6'];

export default function CentralAnalyticsPage() {
  const [activeCategory, setActiveCategory] = useState<'overview' | 'bases' | 'events' | 'servers'>('overview');
  const [loading, setLoading] = useState(true);
  const [timeFilter, setTimeFilter] = useState<{ type: 'hours' | 'days'; value: number }>({ type: 'days', value: 30 });
  const [serverFilter, setServerFilter] = useState("");
  const [servers, setServers] = useState<string[]>([]);

  // Bases state
  const [basesAnalytics, setBasesAnalytics] = useState<BasesAnalytics | null>(null);
  const [raids, setRaids] = useState<RaidEvent[]>([]);
  const [raidsPage, setRaidsPage] = useState(1);
  const [raidsTotalRecords, setRaidsTotalRecords] = useState(0);
  const [expandedRaid, setExpandedRaid] = useState<string | null>(null);

  // Events state
  const [eventsAnalytics, setEventsAnalytics] = useState<EventsAnalytics | null>(null);
  const [events, setEvents] = useState<EventCompletion[]>([]);
  const [eventsPage, setEventsPage] = useState(1);
  const [eventsTotalRecords, setEventsTotalRecords] = useState(0);
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);

  // Servers state
  const [timeRange, setTimeRange] = useState<TimeRange>("24h");
  const [groupBy, setGroupBy] = useState<GroupBy>("minute");
  const [serverOptions, setServerOptions] = useState<ServerOption[]>([]);
  const [timeseries, setTimeseries] = useState<TimeSeriesPoint[]>([]);
  const [totals, setTotals] = useState<TotalsPoint[]>([]);
  const [aggregate, setAggregate] = useState<AggregateData[]>([]);
  const [heatmap, setHeatmap] = useState<HeatmapPoint[]>([]);
  const [currentPlayers, setCurrentPlayers] = useState<{ total: number; capacity: number; count: number }>({ total: 0, capacity: 0, count: 0 });

  const ITEMS_PER_PAGE = 25;

  const fetchBasesData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (timeFilter.type === 'hours') params.append("hours", String(timeFilter.value));
      else params.append("days", String(timeFilter.value));
      if (serverFilter) params.append("server_id", serverFilter);
      params.append("length", "1000");

      const response = await fetch(`/api/bases/stats?${params.toString()}`, { credentials: 'include' });
      if (!response.ok) throw new Error("Failed to fetch bases analytics");

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

      const typeMap = new Map<string, number>();
      raidList.forEach(r => {
        typeMap.set(r.base_type, (typeMap.get(r.base_type) || 0) + 1);
      });
      const baseTypes = Array.from(typeMap.entries())
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);

      const gradeMap = new Map<string, number>();
      raidList.forEach(r => {
        gradeMap.set(r.building_grade, (gradeMap.get(r.building_grade) || 0) + 1);
      });
      const gradeDistribution = Array.from(gradeMap.entries())
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);

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

      setBasesAnalytics({ overview, timeSeries, topRaiders, baseTypes, gradeDistribution, hourlyHeatmap });

      if (data.data && data.data.length > 0) {
        const uniqueServers = [...new Set(data.data.map((e: RaidEvent) => e.server_id))] as string[];
        setServers(prev => [...new Set([...prev, ...uniqueServers])].sort() as string[]);
      }
    } catch (err) {
      console.error("Bases analytics fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [timeFilter, serverFilter]);

  const fetchEventsData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (timeFilter.type === 'hours') params.append("hours", String(timeFilter.value));
      else params.append("days", String(timeFilter.value));
      if (serverFilter) params.append("server_id", serverFilter);
      params.append("length", "1000");

      const response = await fetch(`/api/events/completions?${params.toString()}`, { credentials: 'include' });
      if (!response.ok) throw new Error("Failed to fetch events analytics");

      const data = await response.json();
      const eventsList: EventCompletion[] = data.data || [];

      const overview = {
        totalEvents: eventsList.length,
        uniqueWinners: new Set(eventsList.map(e => e.winner_steam_id)).size,
        avgParticipants: eventsList.length > 0 ? Math.round(eventsList.reduce((sum, e) => sum + (e.participants?.length || 0), 0) / eventsList.length) : 0,
        totalKills: eventsList.reduce((sum, e) => sum + (e.participants?.reduce((s, p) => s + p.kills, 0) || 0), 0),
        avgDuration: eventsList.length > 0 ? Math.round(eventsList.reduce((sum, e) => sum + e.duration_seconds, 0) / eventsList.length) : 0,
        kothCount: eventsList.filter(e => e.event_type === 'koth').length,
        mazeCount: eventsList.filter(e => e.event_type === 'maze').length,
      };

      const dateMap = new Map<string, { events: number; participants: number; kills: number }>();
      eventsList.forEach(e => {
        const date = e.timestamp.split(' ')[0];
        const existing = dateMap.get(date) || { events: 0, participants: 0, kills: 0 };
        existing.events++;
        existing.participants += e.participants?.length || 0;
        existing.kills += e.participants?.reduce((s, p) => s + p.kills, 0) || 0;
        dateMap.set(date, existing);
      });
      const timeSeries = Array.from(dateMap.entries())
        .map(([date, stats]) => ({ date, ...stats }))
        .sort((a, b) => a.date.localeCompare(b.date));

      const winnerMap = new Map<string, { name: string; wins: number; kills: number; events: number }>();
      eventsList.forEach(e => {
        const existing = winnerMap.get(e.winner_steam_id) || { name: e.winner_name, wins: 0, kills: 0, events: 0 };
        existing.wins++;
        existing.kills += e.winner_kills;
        existing.events++;
        winnerMap.set(e.winner_steam_id, existing);
      });
      const topWinners = Array.from(winnerMap.entries())
        .map(([steam_id, stats]) => ({ steam_id, ...stats }))
        .sort((a, b) => b.wins - a.wins)
        .slice(0, 10);

      const modeMap = new Map<string, number>();
      eventsList.forEach(e => {
        e.event_modes?.forEach(mode => {
          modeMap.set(mode, (modeMap.get(mode) || 0) + 1);
        });
        if (!e.event_modes?.length) {
          modeMap.set('Standard', (modeMap.get('Standard') || 0) + 1);
        }
      });
      const eventModes = Array.from(modeMap.entries())
        .map(([mode, count]) => ({ mode, count }))
        .sort((a, b) => b.count - a.count);

      const heatmapMap = new Map<string, number>();
      eventsList.forEach(e => {
        const date = new Date(e.timestamp.replace(' ', 'T'));
        const dayOfWeek = date.getDay() || 7;
        const hour = date.getHours();
        const key = `${dayOfWeek}-${hour}`;
        heatmapMap.set(key, (heatmapMap.get(key) || 0) + 1);
      });
      const hourlyHeatmap = Array.from(heatmapMap.entries()).map(([key, count]) => {
        const [dow, hr] = key.split('-').map(Number);
        return { dayOfWeek: dow, hour: hr, count };
      });

      const locationMap = new Map<string, number>();
      eventsList.filter(e => e.event_type === 'koth' && e.location).forEach(e => {
        locationMap.set(e.location!, (locationMap.get(e.location!) || 0) + 1);
      });
      const locationStats = Array.from(locationMap.entries())
        .map(([location, count]) => ({ location, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      setEventsAnalytics({ overview, timeSeries, topWinners, eventModes, hourlyHeatmap, locationStats });

      if (data.data && data.data.length > 0) {
        const uniqueServers = [...new Set(data.data.map((e: EventCompletion) => e.server_id))] as string[];
        setServers(prev => [...new Set([...prev, ...uniqueServers])].sort() as string[]);
      }
    } catch (err) {
      console.error("Events analytics fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [timeFilter, serverFilter]);

  const getTimeParams = useCallback(() => {
    const hours = TIME_PRESETS[timeRange].hours || 24;
    const now = new Date();
    const from = new Date(now.getTime() - hours * 60 * 60 * 1000);
    return { from: from.toISOString(), to: now.toISOString() };
  }, [timeRange]);

  const fetchServersData = useCallback(async () => {
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
        serversRes.json(),
        timeseriesRes.json(),
        totalsRes.json(),
        aggregateRes.json(),
        heatmapRes.json(),
        currentRes.json(),
      ]);

      setServerOptions(serversData.servers || []);
      setTimeseries(timeseriesData.data || []);
      setTotals(totalsData.data || []);
      setAggregate(aggregateData.data || []);
      setHeatmap(heatmapData.data || []);
      setCurrentPlayers({ total: currentData.totalPlayers || 0, capacity: currentData.totalCapacity || 0, count: currentData.serverCount || 0 });
    } catch (err) {
      console.error("Failed to fetch server analytics:", err);
    } finally {
      setLoading(false);
    }
  }, [getTimeParams, groupBy]);

  useEffect(() => {
    if (activeCategory === 'bases') fetchBasesData();
    else if (activeCategory === 'events') fetchEventsData();
    else if (activeCategory === 'servers') fetchServersData();
  }, [activeCategory, fetchBasesData, fetchEventsData, fetchServersData]);

  const handleCategoryClick = (category: 'bases' | 'events' | 'servers') => {
    setActiveCategory(category);
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const basesHeatmapGrid = useMemo(() => {
    if (!basesAnalytics?.hourlyHeatmap) return Array(7).fill(null).map(() => Array(24).fill(0));
    const grid: number[][] = Array(7).fill(null).map(() => Array(24).fill(0));
    basesAnalytics.hourlyHeatmap.forEach(d => {
      const dayIdx = d.dayOfWeek - 1;
      if (dayIdx >= 0 && dayIdx < 7 && d.hour >= 0 && d.hour < 24) grid[dayIdx][d.hour] = d.count;
    });
    return grid;
  }, [basesAnalytics?.hourlyHeatmap]);

  const eventsHeatmapGrid = useMemo(() => {
    if (!eventsAnalytics?.hourlyHeatmap) return Array(7).fill(null).map(() => Array(24).fill(0));
    const grid: number[][] = Array(7).fill(null).map(() => Array(24).fill(0));
    eventsAnalytics.hourlyHeatmap.forEach(d => {
      const dayIdx = d.dayOfWeek - 1;
      if (dayIdx >= 0 && dayIdx < 7 && d.hour >= 0 && d.hour < 24) grid[dayIdx][d.hour] = d.count;
    });
    return grid;
  }, [eventsAnalytics?.hourlyHeatmap]);

  const serverHeatmapGrid = useMemo(() => {
    if (!heatmap) return Array(7).fill(null).map(() => Array(24).fill(0));
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

  const totalPlayersData = useMemo(() => {
    return totals.map((t) => {
      const parts = t.time_bucket.split(/[\s:-]/);
      const d = new Date(
        parseInt(parts[0]),
        parseInt(parts[1]) - 1,
        parseInt(parts[2]),
        parseInt(parts[3] || '0'),
        parseInt(parts[4] || '0'),
        parseInt(parts[5] || '0')
      );
      let dateStr: string;
      if (groupBy === "minute") {
        dateStr = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      } else if (groupBy === "hour") {
        dateStr = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      } else {
        dateStr = d.toLocaleDateString([], { month: "short", day: "numeric" });
      }
      return {
        date: dateStr,
        total_players: Number(t.total_players),
      };
    });
  }, [totals, groupBy]);

  const summaryStats = useMemo(() => {
    const totalAvg = aggregate.reduce((sum, a) => sum + Number(a.avg_players), 0);
    const totalPeak = Math.max(0, ...aggregate.map((a) => Number(a.peak_players)));
    const avgUtil = aggregate.length > 0 ? aggregate.reduce((sum, a) => sum + Number(a.avg_utilization), 0) / aggregate.length : 0;
    return { totalAvg: Math.round(totalAvg), totalPeak, avgUtil: avgUtil.toFixed(1), serverCount: aggregate.length };
  }, [aggregate]);

  return (
    <div className="p-8">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <div className="space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20">
                  <BarChart3 className="h-6 w-6 text-purple-400" />
                </div>
                Central Analytics
              </h1>
              <p className="text-zinc-500 mt-2">Consolidated analytics across all systems</p>
            </div>
            <div className="flex gap-3 flex-wrap">
              {activeCategory !== 'overview' && (
                <>
                  <Button
                    onClick={() => setActiveCategory('overview')}
                    variant="ghost"
                    icon={<BarChart3 className="h-4 w-4" />}
                  >
                    Back to Overview
                  </Button>
                  <Tabs
                    tabs={[
                      { id: 'bases', label: 'Base Raids', icon: <Castle className="h-4 w-4" /> },
                      { id: 'events', label: 'Events', icon: <Trophy className="h-4 w-4" /> },
                      { id: 'servers', label: 'Servers', icon: <ServerIcon className="h-4 w-4" /> }
                    ]}
                    activeTab={activeCategory as 'bases' | 'events' | 'servers'}
                    onChange={(tab) => setActiveCategory(tab as 'bases' | 'events' | 'servers')}
                    variant="pills"
                  />
                </>
              )}
              {activeCategory !== 'servers' && activeCategory !== 'overview' && (
                <>
                  <Dropdown
                    value={`${timeFilter.type}:${timeFilter.value}`}
                    options={[
                      { value: 'hours:1', label: 'Last hour' },
                      { value: 'hours:6', label: 'Last 6 hours' },
                      { value: 'hours:24', label: 'Last 24 hours' },
                      { value: 'days:7', label: 'Last 7 days' },
                      { value: 'days:30', label: 'Last 30 days' },
                      { value: 'days:60', label: 'Last 60 days' },
                      { value: 'days:90', label: 'Last 90 days' }
                    ]}
                    onChange={(val) => { const [type, value] = (val || '').split(':'); setTimeFilter({ type: type as 'hours' | 'days', value: Number(value) }); }}
                  />
                  <Dropdown
                    value={serverFilter}
                    options={[
                      { value: '', label: 'All Servers' },
                      ...servers.map(s => ({ value: s, label: s }))
                    ]}
                    onChange={(val) => setServerFilter(val || '')}
                  />
                </>
              )}
              {activeCategory === 'servers' && (
                <>
                  <Tabs
                    tabs={(Object.keys(TIME_PRESETS) as TimeRange[]).map((range) => ({
                      id: range,
                      label: TIME_PRESETS[range].label
                    }))}
                    activeTab={timeRange}
                    onChange={(tab) => setTimeRange(tab as TimeRange)}
                    variant="pills"
                    size="sm"
                  />
                  <Dropdown
                    value={groupBy}
                    options={[
                      { value: 'minute', label: 'By Minute' },
                      { value: 'hour', label: 'By Hour' },
                      { value: 'day', label: 'By Day' },
                      { value: 'week', label: 'By Week' }
                    ]}
                    onChange={(val) => setGroupBy(val as GroupBy)}
                  />
                </>
              )}
              {activeCategory !== 'overview' && (
                <Button
                  onClick={() => {
                    if (activeCategory === 'bases') fetchBasesData();
                    else if (activeCategory === 'events') fetchEventsData();
                    else fetchServersData();
                  }}
                  disabled={loading}
                  loading={loading}
                  icon={<RefreshCw className="h-4 w-4" />}
                  variant="primary"
                >
                  Refresh
                </Button>
              )}
            </div>
          </div>

          {activeCategory === 'overview' ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                onClick={() => handleCategoryClick('bases')}
                className="group cursor-pointer rounded-xl bg-gradient-to-br from-red-500/10 to-orange-500/10 border border-red-500/20 hover:border-red-500/40 p-8 transition-all hover:scale-105"
              >
                <div className="flex flex-col items-center text-center">
                  <div className="p-4 rounded-2xl bg-red-500/20 mb-4 group-hover:bg-red-500/30 transition-colors">
                    <Castle className="h-12 w-12 text-red-400" />
                  </div>
                  <h2 className="text-2xl font-bold text-white mb-2">Base Raid Analytics</h2>
                  <p className="text-zinc-400 text-sm">
                    View comprehensive statistics about base raids, raiders, completion rates, and more
                  </p>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                onClick={() => handleCategoryClick('events')}
                className="group cursor-pointer rounded-xl bg-gradient-to-br from-amber-500/10 to-red-500/10 border border-amber-500/20 hover:border-amber-500/40 p-8 transition-all hover:scale-105"
              >
                <div className="flex flex-col items-center text-center">
                  <div className="p-4 rounded-2xl bg-amber-500/20 mb-4 group-hover:bg-amber-500/30 transition-colors">
                    <Trophy className="h-12 w-12 text-amber-400" />
                  </div>
                  <h2 className="text-2xl font-bold text-white mb-2">Event Analytics</h2>
                  <p className="text-zinc-400 text-sm">
                    Track KOTH and Maze event statistics, winners, participation, and event modes
                  </p>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                onClick={() => handleCategoryClick('servers')}
                className="group cursor-pointer rounded-xl bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/20 hover:border-purple-500/40 p-8 transition-all hover:scale-105"
              >
                <div className="flex flex-col items-center text-center">
                  <div className="p-4 rounded-2xl bg-purple-500/20 mb-4 group-hover:bg-purple-500/30 transition-colors">
                    <ServerIcon className="h-12 w-12 text-purple-400" />
                  </div>
                  <h2 className="text-2xl font-bold text-white mb-2">Server Analytics</h2>
                  <p className="text-zinc-400 text-sm">
                    Real-time population data, server utilization, and player activity trends
                  </p>
                </div>
              </motion.div>
            </div>
          ) : loading ? (
            <Loading size="lg" text="Loading analytics..." />
          ) : (
            <>
              {activeCategory === 'bases' && basesAnalytics && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4">
                    <StatCard icon={Castle} label="Total Raids" value={basesAnalytics.overview.totalRaids} delay={0.05} />
                    <StatCard icon={CheckCircle2} label="Completed" value={basesAnalytics.overview.completedRaids} delay={0.1} />
                    <StatCard icon={Target} label="Completion %" value={`${basesAnalytics.overview.completionRate}%`} delay={0.15} />
                    <StatCard icon={Clock} label="Avg Duration" value={formatDuration(basesAnalytics.overview.avgDuration)} delay={0.2} />
                    <StatCard icon={Users} label="Unique Raiders" value={basesAnalytics.overview.uniqueRaiders} delay={0.25} />
                    <StatCard icon={Hammer} label="Entities Destroyed" value={basesAnalytics.overview.totalEntitiesDestroyed} delay={0.3} />
                    <StatCard icon={Skull} label="NPCs Killed" value={basesAnalytics.overview.totalNpcsKilled} delay={0.35} />
                  </div>

                  <ChartCard title="Raids Over Time" icon={TrendingUp} className="lg:col-span-2" delay={0.4}>
                    <div className="h-80">
                      <TimeSeriesChart
                        data={basesAnalytics.timeSeries}
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
                        <BarChart data={basesAnalytics.topRaiders.slice(0, 8).map(r => ({ label: r.name, value: r.raids }))} height="100%" colors={COLORS} />
                      </div>
                    </ChartCard>

                    <ChartCard title="Completion Rate" icon={CheckCircle2} delay={0.5}>
                      <div className="h-72">
                        <PieChart data={[
                          { name: 'Completed', value: basesAnalytics.overview.completedRaids },
                          { name: 'Abandoned', value: basesAnalytics.overview.totalRaids - basesAnalytics.overview.completedRaids },
                        ].filter(d => d.value > 0)} height="100%" colors={['#22c55e', '#ef4444']} />
                      </div>
                    </ChartCard>

                    <ChartCard title="Base Types" icon={Castle} delay={0.55}>
                      <div className="h-64">
                        <PieChart data={basesAnalytics.baseTypes} height="100%" colors={COLORS} />
                      </div>
                    </ChartCard>

                    <ChartCard title="Building Grade" icon={Shield} delay={0.6}>
                      <div className="h-64">
                        <PieChart data={basesAnalytics.gradeDistribution} height="100%" colors={['#a855f7', '#3b82f6', '#f59e0b', '#22c55e']} />
                      </div>
                    </ChartCard>
                  </div>

                  <ChartCard title="Raid Activity Heatmap (by Day & Hour)" icon={Calendar} delay={0.65}>
                    <ActivityHeatmap data={basesHeatmapGrid} tooltipPrefix="raids" />
                  </ChartCard>

                  <ChartCard title="Raider Leaderboard" icon={Target} delay={0.7}>
                    <DataTable
                      data={basesAnalytics.topRaiders}
                      columns={[
                        { key: "rank", header: "#", render: (_, __, idx) => <RankBadge rank={(idx || 0) + 1} /> },
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
                      ]}
                      keyExtractor={(row) => row.steam_id}
                    />
                  </ChartCard>
                </>
              )}

              {activeCategory === 'events' && eventsAnalytics && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4">
                    <StatCard icon={Trophy} label="Total Events" value={eventsAnalytics.overview.totalEvents} delay={0.05} />
                    <StatCard icon={Crown} label="Unique Winners" value={eventsAnalytics.overview.uniqueWinners} delay={0.1} />
                    <StatCard icon={Users} label="Avg Participants" value={eventsAnalytics.overview.avgParticipants} delay={0.15} />
                    <StatCard icon={Skull} label="Total Kills" value={eventsAnalytics.overview.totalKills} delay={0.2} />
                    <StatCard icon={Clock} label="Avg Duration" value={formatDuration(eventsAnalytics.overview.avgDuration)} delay={0.25} />
                    <StatCard icon={Target} label="KOTH Events" value={eventsAnalytics.overview.kothCount} delay={0.3} />
                    <StatCard icon={MapPin} label="Maze Events" value={eventsAnalytics.overview.mazeCount} delay={0.35} />
                  </div>

                  <ChartCard title="Events & Activity Over Time" icon={TrendingUp} className="lg:col-span-2" delay={0.4}>
                    <div className="h-80">
                      <TimeSeriesChart
                        data={eventsAnalytics.timeSeries}
                        series={[
                          { key: "events", name: "Events", type: "bar", color: "#f59e0b" },
                          { key: "kills", name: "Kills", type: "line", color: "#ef4444", yAxisIndex: 1, smooth: true, areaStyle: true },
                          { key: "participants", name: "Participants", type: "line", color: "#3b82f6", smooth: true },
                        ]}
                        showDualYAxis
                        yAxisNames={["Count", "Kills"]}
                        height="100%"
                      />
                    </div>
                  </ChartCard>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <ChartCard title="Top Winners" icon={Crown} delay={0.45}>
                      <div className="h-72">
                        <BarChart data={eventsAnalytics.topWinners.slice(0, 8).map(w => ({ label: w.name, value: w.wins }))} height="100%" colors={COLORS} />
                      </div>
                    </ChartCard>

                    <ChartCard title="Event Types" icon={Trophy} delay={0.5}>
                      <div className="h-72">
                        <PieChart data={[
                          { name: 'KOTH', value: eventsAnalytics.overview.kothCount },
                          { name: 'Maze', value: eventsAnalytics.overview.mazeCount },
                        ].filter(d => d.value > 0)} height="100%" colors={['#f59e0b', '#a855f7']} />
                      </div>
                    </ChartCard>

                    <ChartCard title="Event Modes" icon={Target} delay={0.55}>
                      <div className="h-64">
                        <PieChart data={eventsAnalytics.eventModes.map(m => ({ name: m.mode, value: m.count }))} height="100%" colors={COLORS} />
                      </div>
                    </ChartCard>

                    <ChartCard title="KOTH Locations" icon={MapPin} delay={0.6}>
                      <div className="h-64">
                        <BarChart data={eventsAnalytics.locationStats.map(l => ({ label: l.location, value: l.count }))} height="100%" horizontal={false} colors={COLORS} showLabels={false} />
                      </div>
                    </ChartCard>
                  </div>

                  <ChartCard title="Activity Heatmap (Events by Day & Hour)" icon={Calendar} delay={0.65}>
                    <ActivityHeatmap data={eventsHeatmapGrid} tooltipPrefix="events" />
                  </ChartCard>

                  <ChartCard title="Winner Leaderboard" icon={Award} delay={0.7}>
                    <DataTable
                      data={eventsAnalytics.topWinners}
                      columns={[
                        { key: "rank", header: "#", render: (_, __, idx) => <RankBadge rank={(idx || 0) + 1} /> },
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
                        { key: "wins", header: "Wins", align: "right" as const, render: (v) => <span className="text-amber-400 font-semibold">{(v as number).toLocaleString()}</span> },
                        { key: "kills", header: "Kills", align: "right" as const, render: (v) => <span className="text-red-400">{(v as number).toLocaleString()}</span> },
                      ]}
                      keyExtractor={(row) => row.steam_id}
                    />
                  </ChartCard>
                </>
              )}

              {activeCategory === 'servers' && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <StatCard label="Current Players" value={currentPlayers.total} subtitle={`${currentPlayers.count} servers online`} icon={Users} delay={0} />
                    <StatCard label="Avg Total Players" value={summaryStats.totalAvg} icon={TrendingUp} iconColor="text-blue-400" iconBgColor="bg-blue-500/20" delay={0.1} />
                    <StatCard label="Peak Players" value={summaryStats.totalPeak} icon={Zap} iconColor="text-yellow-400" iconBgColor="bg-yellow-500/20" delay={0.2} />
                    <StatCard label="Avg Utilization" value={`${summaryStats.avgUtil}%`} icon={Activity} iconColor="text-green-400" iconBgColor="bg-green-500/20" delay={0.3} />
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <ChartCard title="Total Players Over Time" icon={TrendingUp} iconColor="text-purple-400" delay={0.4}>
                      <div className="h-72">
                        <TimeSeriesChart
                          data={totalPlayersData}
                          series={[{ key: "total_players", name: "Total Players", type: "line", color: COLORS[0], smooth: true, areaStyle: true }]}
                          height="100%"
                        />
                      </div>
                    </ChartCard>

                    <ChartCard title="Server Utilization" icon={BarChart3} iconColor="text-green-400" delay={0.45}>
                      <div className="h-72">
                        <BarChart data={aggregate.slice(0, 10).map((a) => ({
                          label: a.server_name.substring(0, 15),
                          value: Number(a.avg_utilization),
                        }))} height="100%" colors={COLORS} labelWidth={80} valueFormatter={(v) => `${v.toFixed(1)}%`} />
                      </div>
                    </ChartCard>

                    <ChartCard title="Peak Players by Server" icon={Zap} iconColor="text-yellow-400" delay={0.5}>
                      <div className="h-64">
                        <PieChart data={aggregate.slice(0, 10).map((a) => ({
                          name: a.server_name.substring(0, 15),
                          value: Number(a.peak_players),
                        }))} height="100%" colors={COLORS} />
                      </div>
                    </ChartCard>

                    <ChartCard title="Activity Heatmap" icon={Clock} iconColor="text-pink-400" delay={0.55}>
                      <div className="h-64 overflow-auto">
                        <ActivityHeatmap data={serverHeatmapGrid} tooltipPrefix="players" cellHeight={20} />
                      </div>
                    </ChartCard>
                  </div>

                  <ChartCard title="Server Statistics" icon={ServerIcon} iconColor="text-purple-400" delay={0.6}>
                    <DataTable
                      data={aggregate}
                      columns={[
                        {
                          key: "server_name",
                          header: "Server",
                          render: (_, row) => (
                            <div>
                              <div className="text-white font-medium">{row.server_name}</div>
                              <div className="text-xs text-zinc-500">{row.server_ip}</div>
                            </div>
                          ),
                        },
                        { key: "category", header: "Category", className: "text-zinc-400" },
                        { key: "avg_players", header: "Avg Players", align: "right" as const, render: (v) => <span className="text-white font-semibold">{Math.round(Number(v))}</span> },
                        { key: "peak_players", header: "Peak", align: "right" as const, render: (v) => <span className="text-yellow-400 font-semibold">{Number(v)}</span> },
                        { key: "avg_capacity", header: "Capacity", align: "right" as const, render: (v) => <span className="text-zinc-400">{Math.round(Number(v))}</span> },
                        {
                          key: "avg_utilization",
                          header: "Utilization",
                          align: "right" as const,
                          render: (v) => {
                            const util = Number(v);
                            const color = util > 75 ? "text-green-400" : util > 50 ? "text-yellow-400" : "text-red-400";
                            return <span className={`font-semibold ${color}`}>{util.toFixed(1)}%</span>;
                          },
                        },
                        { key: "data_points", header: "Data Points", align: "right" as const, className: "text-zinc-500" },
                      ]}
                      keyExtractor={(row, idx) => `${row.server_ip}-${row.server_name}-${idx}`}
                    />
                  </ChartCard>
                </>
              )}
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
