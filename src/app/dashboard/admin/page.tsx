"use client";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Server, Users, Activity, TrendingUp, Clock, Zap } from "lucide-react";

interface ServerStats {
  totalServers: number;
  activeServers: number;
  totalPlayers: number;
  avgPlayers: number;
}

interface RecentActivity {
  id: number;
  type: string;
  message: string;
  timestamp: string;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<ServerStats>({ totalServers: 0, activeServers: 0, totalPlayers: 0, avgPlayers: 0 });
  const [activities, setActivities] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch("/api/analytics/overview");
        if (res.ok) {
          const data = await res.json();
          setStats(data.stats || { totalServers: 0, activeServers: 0, totalPlayers: 0, avgPlayers: 0 });
          setActivities(data.recentActivity || []);
        }
      } catch (err) {
        console.error("Failed to fetch dashboard data:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const statCards = [
    { label: "Total Servers", value: stats.totalServers, icon: Server, color: "from-purple-500 to-pink-500" },
    { label: "Active Servers", value: stats.activeServers, icon: Activity, color: "from-green-500 to-emerald-500" },
    { label: "Total Players", value: stats.totalPlayers, icon: Users, color: "from-blue-500 to-cyan-500" },
    { label: "Avg Players/Server", value: stats.avgPlayers.toFixed(1), icon: TrendingUp, color: "from-orange-500 to-yellow-500" },
  ];

  return (
    <div className="p-8">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20">
              <Zap className="h-6 w-6 text-purple-400" />
            </div>
            Dashboard
          </h1>
          <p className="text-zinc-500 mt-2">Overview of your server infrastructure</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {statCards.map((card, index) => (
            <motion.div
              key={card.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="rounded-xl p-6 bg-white/[0.02] border border-white/5 hover:border-white/10 transition-all group"
            >
              <div className="flex items-center justify-between mb-4">
                <div className={`p-3 rounded-xl bg-gradient-to-br ${card.color} bg-opacity-20`}>
                  <card.icon className="h-5 w-5 text-white" />
                </div>
                <span className="text-xs text-zinc-500 uppercase tracking-wider">{card.label}</span>
              </div>
              <div className="text-3xl font-bold text-white group-hover:text-purple-400 transition-colors">
                {loading ? (
                  <div className="h-9 w-20 bg-white/5 rounded animate-pulse" />
                ) : (
                  card.value
                )}
              </div>
            </motion.div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
            className="rounded-xl p-6 bg-white/[0.02] border border-white/5"
          >
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Clock className="h-5 w-5 text-purple-400" />
              Recent Activity
            </h2>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 bg-white/5 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : activities.length > 0 ? (
              <div className="space-y-3">
                {activities.map((activity) => (
                  <div key={activity.id} className="p-4 rounded-lg bg-white/[0.02] border border-white/5">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-white">{activity.message}</span>
                      <span className="text-xs text-zinc-500">{activity.timestamp}</span>
                    </div>
                    <span className="text-xs text-purple-400 mt-1 inline-block">{activity.type}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-zinc-500">
                <Activity className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>No recent activity</p>
              </div>
            )}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 }}
            className="rounded-xl p-6 bg-white/[0.02] border border-white/5"
          >
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-400" />
              Quick Stats
            </h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-lg bg-white/[0.02] border border-white/5">
                <span className="text-zinc-400">Server Uptime</span>
                <span className="text-green-400 font-semibold">99.9%</span>
              </div>
              <div className="flex items-center justify-between p-4 rounded-lg bg-white/[0.02] border border-white/5">
                <span className="text-zinc-400">Active Announcements</span>
                <span className="text-purple-400 font-semibold">--</span>
              </div>
              <div className="flex items-center justify-between p-4 rounded-lg bg-white/[0.02] border border-white/5">
                <span className="text-zinc-400">Loot Configs</span>
                <span className="text-blue-400 font-semibold">--</span>
              </div>
            </div>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}
