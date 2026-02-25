"use client";

import React, { useState, useCallback, useEffect } from "react";
import {
  BarChart3, Castle, Trophy, ShoppingCart, TrendingUp,
  Server as ServerIcon
} from "lucide-react";
import { Dropdown } from "@/components/ui/Dropdown";
import { Tabs } from "@/components/ui/Tabs";
import BasesTab from "./BasesTab";
import EventsTab from "./EventsTab";
import ServersTab from "./ServersTab";
import ShopTab from "./ShopTab";
import GlobalStatsTab from "./GlobalStatsTab";

type Category = 'overview' | 'bases' | 'events' | 'servers' | 'shop' | 'global';

interface ServerIdentifier {
  id: string;
  name: string;
  hashedId: string;
  ip: string | null;
  port: number | null;
}

export default function CentralAnalyticsPage() {
  const [activeCategory, setActiveCategory] = useState<Category>('overview');
  const [timeFilter, setTimeFilter] = useState<{ type: 'hours' | 'days'; value: number }>({ type: 'days', value: 30 });
  const [serverFilter, setServerFilter] = useState("");
  const [servers, setServers] = useState<string[]>([]);
  const [serverIdentifiers, setServerIdentifiers] = useState<ServerIdentifier[]>([]);

  // Fetch server identifiers for name resolution
  useEffect(() => {
    fetch("/api/identifiers", { credentials: "include" })
      .then(res => res.ok ? res.json() : [])
      .then(data => { if (Array.isArray(data)) setServerIdentifiers(data); })
      .catch(() => {});
  }, []);

  // Build a map from hashedId → name for display
  const serverNameMap = React.useMemo(() => {
    const map: Record<string, string> = {};
    serverIdentifiers.forEach(s => { map[s.hashedId] = s.name; });
    return map;
  }, [serverIdentifiers]);

  const handleServersFound = useCallback((newServers: string[]) => {
    setServers(prev => [...new Set([...prev, ...newServers])].sort() as string[]);
  }, []);

  const showSharedFilters = activeCategory === 'bases' || activeCategory === 'events' || activeCategory === 'shop';

  const overviewCards: { category: Category; icon: React.ElementType; iconColor: string; bgFrom: string; bgTo: string; borderColor: string; title: string; desc: string }[] = [
    { category: 'bases', icon: Castle, iconColor: 'text-red-400', bgFrom: 'from-red-500/10', bgTo: 'to-orange-500/10', borderColor: 'border-red-500/20 hover:border-red-500/40', title: 'Base Raid Analytics', desc: 'Raid statistics, raiders, completion rates, and leaderboards' },
    { category: 'events', icon: Trophy, iconColor: 'text-amber-400', bgFrom: 'from-amber-500/10', bgTo: 'to-red-500/10', borderColor: 'border-amber-500/20 hover:border-amber-500/40', title: 'Event Analytics', desc: 'KOTH and Maze event statistics, winners, and participation' },
    { category: 'servers', icon: ServerIcon, iconColor: 'text-purple-400', bgFrom: 'from-purple-500/10', bgTo: 'to-pink-500/10', borderColor: 'border-purple-500/20 hover:border-purple-500/40', title: 'Server Analytics', desc: 'Real-time population data, utilization, and activity trends' },
    { category: 'shop', icon: ShoppingCart, iconColor: 'text-green-400', bgFrom: 'from-green-500/10', bgTo: 'to-emerald-500/10', borderColor: 'border-green-500/20 hover:border-green-500/40', title: 'Shop Analytics', desc: 'Purchase analytics, revenue tracking, and top items' },
    { category: 'global', icon: TrendingUp, iconColor: 'text-cyan-400', bgFrom: 'from-cyan-500/10', bgTo: 'to-blue-500/10', borderColor: 'border-cyan-500/20 hover:border-cyan-500/40', title: 'Global Rust Stats', desc: 'Global server analytics from BattleMetrics (Top 1000)' },
  ];

  return (
    <div className="p-8">
      <div className="anim-fade-slide-up">
        <div className="space-y-6">
          {/* Header */}
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
            <div className="flex gap-3 flex-wrap items-center">
              {activeCategory !== 'overview' && (
                <Tabs
                  tabs={[
                    { id: 'overview', label: 'Overview', icon: <BarChart3 className="h-4 w-4" /> },
                    { id: 'bases', label: 'Base Raids', icon: <Castle className="h-4 w-4" /> },
                    { id: 'events', label: 'Events', icon: <Trophy className="h-4 w-4" /> },
                    { id: 'servers', label: 'Servers', icon: <ServerIcon className="h-4 w-4" /> },
                    { id: 'shop', label: 'Shop', icon: <ShoppingCart className="h-4 w-4" /> },
                    { id: 'global', label: 'Global Stats', icon: <TrendingUp className="h-4 w-4" /> },
                  ]}
                  activeTab={activeCategory}
                  onChange={(tab) => setActiveCategory(tab as Category)}
                  variant="pills"
                />
              )}
              {showSharedFilters && (
                <>
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
                      { value: 'days:90', label: 'Last 90 days' },
                    ]}
                    onChange={(val) => {
                      const [type, value] = (val || '').split(':');
                      setTimeFilter({ type: type as 'hours' | 'days', value: Number(value) });
                    }}
                  />
                  <Dropdown
                    value={serverFilter}
                    options={[
                      { value: '', label: 'All Servers' },
                      ...servers.map(s => ({ value: s, label: serverNameMap[s] || s }))
                    ]}
                    onChange={(val) => setServerFilter(val || '')}
                  />
                </>
              )}
            </div>
          </div>

          {/* Overview Grid */}
          {activeCategory === 'overview' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {overviewCards.map((card, idx) => (
                <div
                  key={card.category}
                  onClick={() => setActiveCategory(card.category)}
                  className={`anim-stagger-item group cursor-pointer rounded-xl bg-gradient-to-br ${card.bgFrom} ${card.bgTo} border ${card.borderColor} p-8 transition-all hover:scale-105`}
                  style={{ animationDelay: `${(idx + 1) * 100}ms` }}
                >
                  <div className="flex flex-col items-center text-center">
                    <div className="p-4 rounded-2xl bg-white/10 mb-4 group-hover:bg-white/15 transition-colors">
                      <card.icon className={`h-12 w-12 ${card.iconColor}`} />
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-2">{card.title}</h2>
                    <p className="text-zinc-400 text-sm">{card.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Tab Content */}
          {activeCategory === 'bases' && (
            <BasesTab timeFilter={timeFilter} serverFilter={serverFilter} servers={servers} onServersFound={handleServersFound} serverNameMap={serverNameMap} />
          )}
          {activeCategory === 'events' && (
            <EventsTab timeFilter={timeFilter} serverFilter={serverFilter} servers={servers} onServersFound={handleServersFound} serverNameMap={serverNameMap} />
          )}
          {activeCategory === 'servers' && <ServersTab />}
          {activeCategory === 'shop' && <ShopTab timeFilter={timeFilter} serverFilter={serverFilter} />}
          {activeCategory === 'global' && <GlobalStatsTab />}
        </div>
      </div>
    </div>
  );
}
