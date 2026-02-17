"use client";

import React, { useState, useCallback, useEffect, useMemo } from "react";
import {
  Trophy, RefreshCw, Clock,
  TrendingUp, BarChart3, Calendar, Award, Users, Swords, MapPin, Crown, Target, Skull, ChevronDown, ChevronUp
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
import { Dropdown, DropdownOption } from "@/components/ui/Dropdown";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Tabs, Tab } from "@/components/ui/Tabs";
import { SimplePagination } from "@/components/ui/Pagination";
import { EmptyState } from "@/components/ui/EmptyState";
import { Loading } from "@/components/ui/Loading";

interface Participant {
  steam_id: string;
  name: string;
  kills: number;
  deaths: number;
  position: number;
}

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
  participants: Participant[];
}

interface AnalyticsData {
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

const COLORS = ['#f59e0b', '#ef4444', '#a855f7', '#3b82f6', '#22c55e', '#ec4899', '#06b6d4', '#8b5cf6', '#f97316', '#14b8a6'];

export default function EventAnalyticsPage() {
  const [events, setEvents] = useState<EventCompletion[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [serverFilter, setServerFilter] = useState("");
  const [eventTypeFilter, setEventTypeFilter] = useState<"" | "koth" | "maze">("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [servers, setServers] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'analytics' | 'events'>('analytics');
  const [timeFilter, setTimeFilter] = useState<{ type: 'hours' | 'days'; value: number }>({ type: 'days', value: 30 });
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);
  const ITEMS_PER_PAGE = 25;

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.append("start", String((currentPage - 1) * ITEMS_PER_PAGE));
      params.append("length", String(ITEMS_PER_PAGE));
      if (serverFilter) params.append("server_id", serverFilter);
      if (eventTypeFilter) params.append("event_type", eventTypeFilter);
      if (timeFilter.type === 'hours') params.append("hours", String(timeFilter.value));
      else params.append("days", String(timeFilter.value));

      const response = await fetch(`/api/events/completions?${params.toString()}`, { credentials: 'include' });
      if (!response.ok) throw new Error("Failed to fetch events");

      const data = await response.json();
      setEvents(data.data || []);
      setTotalRecords(data.recordsFiltered || 0);

      if (data.data && data.data.length > 0) {
        const uniqueServers = [...new Set(data.data.map((e: EventCompletion) => e.server_id))] as string[];
        setServers(prev => [...new Set([...prev, ...uniqueServers])].sort() as string[]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [currentPage, serverFilter, eventTypeFilter, timeFilter]);

  const fetchAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);
    try {
      const params = new URLSearchParams();
      if (timeFilter.type === 'hours') params.append("hours", String(timeFilter.value));
      else params.append("days", String(timeFilter.value));
      if (serverFilter) params.append("server_id", serverFilter);
      if (eventTypeFilter) params.append("event_type", eventTypeFilter);

      const response = await fetch(`/api/events/completions?${params.toString()}&length=1000`, { credentials: 'include' });
      if (!response.ok) throw new Error("Failed to fetch analytics");

      const data = await response.json();
      const eventsList: EventCompletion[] = data.data || [];

      // Compute analytics from raw data
      const overview = {
        totalEvents: eventsList.length,
        uniqueWinners: new Set(eventsList.map(e => e.winner_steam_id)).size,
        avgParticipants: eventsList.length > 0 ? Math.round(eventsList.reduce((sum, e) => sum + (e.participants?.length || 0), 0) / eventsList.length) : 0,
        totalKills: eventsList.reduce((sum, e) => sum + (e.participants?.reduce((s, p) => s + p.kills, 0) || 0), 0),
        avgDuration: eventsList.length > 0 ? Math.round(eventsList.reduce((sum, e) => sum + e.duration_seconds, 0) / eventsList.length) : 0,
        kothCount: eventsList.filter(e => e.event_type === 'koth').length,
        mazeCount: eventsList.filter(e => e.event_type === 'maze').length,
      };

      // Time series by date
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

      // Top winners
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

      // Event modes
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

      // Hourly heatmap
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

      // Location stats (KOTH only)
      const locationMap = new Map<string, number>();
      eventsList.filter(e => e.event_type === 'koth' && e.location).forEach(e => {
        locationMap.set(e.location!, (locationMap.get(e.location!) || 0) + 1);
      });
      const locationStats = Array.from(locationMap.entries())
        .map(([location, count]) => ({ location, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      setAnalytics({ overview, timeSeries, topWinners, eventModes, hourlyHeatmap, locationStats });
    } catch (err) {
      console.error("Analytics fetch error:", err);
    } finally {
      setAnalyticsLoading(false);
    }
  }, [timeFilter, serverFilter, eventTypeFilter]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);
  useEffect(() => { fetchAnalytics(); }, [fetchAnalytics]);

  const totalPages = Math.ceil(totalRecords / ITEMS_PER_PAGE);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const timeSeriesData = useMemo(() => analytics?.timeSeries || [], [analytics?.timeSeries]);

  const topWinnersData = useMemo(() => {
    if (!analytics?.topWinners?.length) return [];
    return analytics.topWinners.slice(0, 8).map(w => ({ label: w.name, value: w.wins }));
  }, [analytics?.topWinners]);

  const eventModesData = useMemo(() => {
    if (!analytics?.eventModes?.length) return [];
    return analytics.eventModes.map(m => ({ name: m.mode, value: m.count }));
  }, [analytics?.eventModes]);

  const locationData = useMemo(() => {
    if (!analytics?.locationStats?.length) return [];
    return analytics.locationStats.map(l => ({ label: l.location, value: l.count }));
  }, [analytics?.locationStats]);

  const eventTypeData = useMemo(() => {
    if (!analytics?.overview) return [];
    return [
      { name: 'KOTH', value: analytics.overview.kothCount },
      { name: 'Maze', value: analytics.overview.mazeCount },
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

  type WinnerStat = { steam_id: string; name: string; wins: number; kills: number; events: number };

  const winnerColumns: Column<WinnerStat>[] = useMemo(() => [
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
    { key: "wins", header: "Wins", align: "right" as const, render: (v) => <span className="text-amber-400 font-semibold">{(v as number).toLocaleString()}</span> },
    { key: "kills", header: "Kills", align: "right" as const, render: (v) => <span className="text-red-400">{(v as number).toLocaleString()}</span> },
  ], []);

  return (
    <div className="p-8">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <div className="space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                <div className="p-2 rounded-xl bg-gradient-to-br from-amber-500/20 to-red-500/20">
                  <Trophy className="h-6 w-6 text-amber-400" />
                </div>
                Event Analytics
              </h1>
              <p className="text-zinc-500 mt-2">KOTH and Maze event statistics and leaderboards</p>
            </div>
            <div className="flex gap-3 flex-wrap">
              <Tabs
                tabs={[
                  { id: 'analytics', label: 'Analytics', icon: <BarChart3 className="h-4 w-4" /> },
                  { id: 'events', label: 'Events', icon: <Swords className="h-4 w-4" /> }
                ]}
                activeTab={activeTab}
                onChange={(tab) => setActiveTab(tab as 'analytics' | 'events')}
                variant="pills"
              />
              <Dropdown
                value={`${timeFilter.type}:${timeFilter.value}`}
                options={[
                  { value: 'hours:1', label: 'Last hour' },
                  { value: 'hours:6', label: 'Last 6 hours' },
                  { value: 'hours:24', label: 'Last 24 hours' },
                  { value: 'days:7', label: 'Last 7 days' },
                  { value: 'days:14', label: 'Last 14 days' },
                  { value: 'days:30', label: 'Last 30 days' },
                  { value: 'days:60', label: 'Last 60 days' },
                  { value: 'days:90', label: 'Last 90 days' }
                ]}
                onChange={(val) => { const [type, value] = (val || '').split(':'); setTimeFilter({ type: type as 'hours' | 'days', value: Number(value) }); setCurrentPage(1); }}
              />
              <Dropdown
                value={eventTypeFilter}
                options={[
                  { value: '', label: 'All Events' },
                  { value: 'koth', label: 'KOTH' },
                  { value: 'maze', label: 'Maze' }
                ]}
                onChange={(val) => { setEventTypeFilter(val as "" | "koth" | "maze"); setCurrentPage(1); }}
              />
              <Dropdown
                value={serverFilter}
                options={[
                  { value: '', label: 'All Servers' },
                  ...servers.map(s => ({ value: s, label: s }))
                ]}
                onChange={(val) => { setServerFilter(val || ''); setCurrentPage(1); }}
              />
              <Button
                onClick={() => { fetchEvents(); fetchAnalytics(); }}
                disabled={loading || analyticsLoading}
                loading={loading || analyticsLoading}
                leftIcon={<RefreshCw className="h-4 w-4" />}
                variant="primary"
              >
                Refresh
              </Button>
            </div>
          </div>

          {activeTab === 'analytics' && (
            <>
              {analyticsLoading ? (
                <Loading size="lg" text="Loading analytics..." />
              ) : analytics ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4">
                    <StatCard icon={Trophy} label="Total Events" value={analytics.overview.totalEvents} delay={0.05} />
                    <StatCard icon={Crown} label="Unique Winners" value={analytics.overview.uniqueWinners} delay={0.1} />
                    <StatCard icon={Users} label="Avg Participants" value={analytics.overview.avgParticipants} delay={0.15} />
                    <StatCard icon={Skull} label="Total Kills" value={analytics.overview.totalKills} delay={0.2} />
                    <StatCard icon={Clock} label="Avg Duration" value={formatDuration(analytics.overview.avgDuration)} delay={0.25} />
                    <StatCard icon={Target} label="KOTH Events" value={analytics.overview.kothCount} delay={0.3} />
                    <StatCard icon={MapPin} label="Maze Events" value={analytics.overview.mazeCount} delay={0.35} />
                  </div>

                  <ChartCard title="Events & Activity Over Time" icon={TrendingUp} className="lg:col-span-2" delay={0.4}>
                    <div className="h-80">
                      <TimeSeriesChart
                        data={timeSeriesData}
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
                        <BarChart data={topWinnersData} height="100%" colors={COLORS} />
                      </div>
                    </ChartCard>

                    <ChartCard title="Event Types" icon={Trophy} delay={0.5}>
                      <div className="h-72">
                        <PieChart data={eventTypeData} height="100%" colors={['#f59e0b', '#a855f7']} />
                      </div>
                    </ChartCard>

                    <ChartCard title="Event Modes" icon={Target} delay={0.55}>
                      <div className="h-64">
                        <PieChart data={eventModesData} height="100%" colors={COLORS} />
                      </div>
                    </ChartCard>

                    <ChartCard title="KOTH Locations" icon={MapPin} delay={0.6}>
                      <div className="h-64">
                        <BarChart data={locationData} height="100%" horizontal={false} colors={COLORS} showLabels={false} />
                      </div>
                    </ChartCard>
                  </div>

                  <ChartCard title="Activity Heatmap (Events by Day & Hour)" icon={Calendar} delay={0.65}>
                    <ActivityHeatmap data={heatmapGrid} tooltipPrefix="events" />
                  </ChartCard>

                  <ChartCard title="Winner Leaderboard" icon={Award} delay={0.7}>
                    <DataTable
                      data={analytics.topWinners}
                      columns={winnerColumns}
                      keyExtractor={(row) => row.steam_id}
                    />
                  </ChartCard>
                </>
              ) : (
                <EmptyState
                  leftIcon={<Trophy className="h-12 w-12" />}
                  title="No event data available"
                />
              )}
            </>
          )}

          {activeTab === 'events' && (
            <>
              {error && (
                <div className="text-center py-10 bg-red-900/20 border border-red-700/50 p-6 rounded-xl">
                  <p className="text-xl font-semibold text-red-300">{error}</p>
                </div>
              )}

              {loading ? (
                <Loading size="lg" text="Loading events..." />
              ) : (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                  {events.map((event, idx) => {
                    const isExpanded = expandedEvent === `${event.timestamp}-${event.winner_steam_id}`;
                    return (
                      <motion.div
                        key={`${event.timestamp}-${event.winner_steam_id}-${idx}`}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.02 }}
                        className="rounded-xl overflow-hidden bg-white/[0.02] border border-white/5 hover:border-amber-500/30 transition-colors"
                      >
                        <div
                          className="p-4 cursor-pointer flex items-center justify-between"
                          onClick={() => setExpandedEvent(isExpanded ? null : `${event.timestamp}-${event.winner_steam_id}`)}
                        >
                          <div className="flex items-center gap-4">
                            <div className={`p-2 rounded-lg ${event.event_type === 'koth' ? 'bg-amber-500/20' : 'bg-purple-500/20'}`}>
                              {event.event_type === 'koth' ? <Target className="h-5 w-5 text-amber-400" /> : <MapPin className="h-5 w-5 text-purple-400" />}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <Badge variant={event.event_type === 'koth' ? 'warning' : 'primary'} size="sm">
                                  {event.event_type.toUpperCase()}
                                </Badge>
                                {event.location && (
                                  <span className="text-xs text-zinc-500">@ {event.location}</span>
                                )}
                                {event.event_modes?.length > 0 && (
                                  <div className="flex gap-1">
                                    {event.event_modes.map(mode => (
                                      <Badge key={mode} variant="secondary" size="sm">{mode}</Badge>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <div className="text-xs text-zinc-500 mt-1">
                                <Clock className="inline h-3 w-3 mr-1" />
                                {event.timestamp} • {formatDuration(event.duration_seconds)}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-6">
                            <div className="text-right">
                              <div className="flex items-center gap-2">
                                <Crown className="h-4 w-4 text-amber-400" />
                                <span className="text-white font-semibold">{event.winner_name}</span>
                                {event.winner_clan_tag && (
                                  <span className="text-xs text-zinc-500">[{event.winner_clan_tag}]</span>
                                )}
                              </div>
                              <div className="text-xs text-zinc-500">
                                <Skull className="inline h-3 w-3 mr-1 text-red-400" />
                                {event.winner_kills} kills
                                <Users className="inline h-3 w-3 ml-2 mr-1" />
                                {event.participants?.length || 0} players
                              </div>
                            </div>
                            {isExpanded ? <ChevronUp className="h-5 w-5 text-zinc-500" /> : <ChevronDown className="h-5 w-5 text-zinc-500" />}
                          </div>
                        </div>

                        <AnimatePresence>
                          {isExpanded && event.participants?.length > 0 && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="border-t border-white/5 overflow-hidden"
                            >
                              <div className="p-4">
                                <h4 className="text-sm font-semibold text-zinc-400 mb-3">Participants</h4>
                                <div className="overflow-x-auto">
                                  <table className="w-full text-sm">
                                    <thead>
                                      <tr className="text-zinc-500 text-xs uppercase">
                                        <th className="text-left pb-2">#</th>
                                        <th className="text-left pb-2">Player</th>
                                        <th className="text-right pb-2">Kills</th>
                                        <th className="text-right pb-2">Deaths</th>
                                        <th className="text-right pb-2">K/D</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {[...event.participants]
                                        .sort((a, b) => a.position - b.position)
                                        .map((p, pIdx) => (
                                          <tr key={p.steam_id} className="border-t border-white/5">
                                            <td className="py-2">
                                              <RankBadge rank={p.position || pIdx + 1} />
                                            </td>
                                            <td className="py-2">
                                              <div className="text-white">{p.name}</div>
                                              <div className="text-xs text-zinc-600 font-mono">{p.steam_id}</div>
                                            </td>
                                            <td className="py-2 text-right text-red-400 font-semibold">{p.kills}</td>
                                            <td className="py-2 text-right text-zinc-400">{p.deaths}</td>
                                            <td className="py-2 text-right text-zinc-300">
                                              {p.deaths > 0 ? (p.kills / p.deaths).toFixed(2) : p.kills.toFixed(2)}
                                            </td>
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

                  {events.length === 0 && (
                    <EmptyState
                      leftIcon={<Trophy className="h-12 w-12" />}
                      title="No events found"
                    />
                  )}

                  {totalPages > 1 && (
                    <div className="flex justify-center pt-4">
                      <SimplePagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        onPageChange={setCurrentPage}
                      />
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
