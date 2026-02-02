"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRightLeft, Settings, Activity, RefreshCw, Save,
  Users, Clock, TrendingUp, AlertTriangle,
  ChevronLeft, ChevronRight, Search, X, Shield, Server, Zap,
  Calendar
} from "lucide-react";

interface RedirectConfig {
  id?: string;
  staffGroups: string[];
  afkTimeSeconds: number;
  checkInterval: number;
  configUpdateInterval: number;
  maxRedirectAttempts: number;
  enableAFKRedirect: boolean;
  minPlayersForEmptyServer: number;
  maxPlayersForEmptyServer: number;
  preferredEmptyServers: string[];
  excludedServers: string[];
  enableWipeRedirect: boolean;
  wipeRedirectMinutesBefore: number;
  overrideRedirectServer: string | null;
}

interface ServerIdentifier {
  id: string;
  name: string;
  hashedId: string;
}

interface RedirectLog {
  id: string;
  logType: string;
  playerName: string | null;
  steamId: string | null;
  rank: string | null;
  afkTimeSeconds: number | null;
  redirectReason: string;
  sourceIdentifier: string;
  targetIdentifier: string | null;
  players: number | null;
  timestamp: string;
}

interface LogStats {
  total: number;
  playerRedirects: number;
  wipeRedirects: number;
  afkRedirects: number;
  avgAfkTime: number;
}

const defaultConfig: RedirectConfig = {
  staffGroups: [],
  afkTimeSeconds: 3600,
  checkInterval: 30,
  configUpdateInterval: 120,
  maxRedirectAttempts: 3,
  enableAFKRedirect: true,
  minPlayersForEmptyServer: 0,
  maxPlayersForEmptyServer: 2,
  preferredEmptyServers: [],
  excludedServers: [],
  enableWipeRedirect: true,
  wipeRedirectMinutesBefore: 2,
  overrideRedirectServer: null
};

type TabType = "settings" | "logs";

function Toast({ message, type, onClose }: { message: string; type: "success" | "error"; onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 50 }}
      className={`fixed bottom-4 right-4 px-4 py-3 rounded-lg shadow-lg z-50 flex items-center gap-2 ${
        type === "success" ? "bg-green-500/90" : "bg-red-500/90"
      } text-white`}
    >
      {message}
      <button onClick={onClose} className="ml-2 hover:opacity-75">
        <X className="h-4 w-4" />
      </button>
    </motion.div>
  );
}

function StatCard({ label, value, icon: Icon, subtitle, color = "purple" }: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  subtitle?: string;
  color?: string;
}) {
  const colorClasses: Record<string, { icon: string; bg: string }> = {
    purple: { icon: "text-purple-400", bg: "bg-purple-500/20" },
    blue: { icon: "text-blue-400", bg: "bg-blue-500/20" },
    green: { icon: "text-green-400", bg: "bg-green-500/20" },
    yellow: { icon: "text-yellow-400", bg: "bg-yellow-500/20" },
  };
  const colors = colorClasses[color] || colorClasses.purple;

  return (
    <div className="bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-xl p-4">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${colors.bg}`}>
          <Icon className={`h-5 w-5 ${colors.icon}`} />
        </div>
        <div>
          <p className="text-sm text-[var(--text-muted)]">{label}</p>
          <p className="text-xl font-bold text-[var(--text-primary)]">{value}</p>
          {subtitle && <p className="text-xs text-[var(--text-muted)]">{subtitle}</p>}
        </div>
      </div>
    </div>
  );
}

function ListManager({ label, description, items, onChange, placeholder }: {
  label: string;
  description?: string;
  items: string[];
  onChange: (items: string[]) => void;
  placeholder: string;
}) {
  const [input, setInput] = useState("");

  const addItem = () => {
    const trimmed = input.trim();
    if (trimmed && !items.includes(trimmed)) {
      onChange([...items, trimmed]);
      setInput("");
    }
  };

  const removeItem = (item: string) => {
    onChange(items.filter(i => i !== item));
  };

  return (
    <div className="space-y-2">
      <div>
        <label className="text-sm font-medium text-[var(--text-primary)]">{label}</label>
        {description && <p className="text-xs text-[var(--text-muted)] mt-0.5">{description}</p>}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), addItem())}
          placeholder={placeholder}
          className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-purple-500"
        />
        <button onClick={addItem} className="px-4 py-2 rounded-lg bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 transition-colors text-sm">
          Add
        </button>
      </div>
      {items.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {items.map((item, idx) => (
            <span key={idx} className="inline-flex items-center gap-1 px-2 py-1 rounded bg-white/10 text-sm text-white">
              {item}
              <button onClick={() => removeItem(item)} className="hover:text-red-400">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function SettingInput({ label, description, value, onChange, type = "number", step }: {
  label: string;
  description?: string;
  value: number;
  onChange: (val: number) => void;
  type?: string;
  step?: string;
}) {
  return (
    <div>
      <label className="text-sm font-medium text-[var(--text-primary)]">{label}</label>
      {description && <p className="text-xs text-[var(--text-muted)] mt-0.5">{description}</p>}
      <input
        type={type}
        step={step}
        value={value}
        onChange={(e) => onChange(type === "number" ? (parseFloat(e.target.value) || 0) : parseInt(e.target.value) || 0)}
        className="w-full mt-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-purple-500"
      />
    </div>
  );
}

export default function RedirectionPage() {
  const [activeTab, setActiveTab] = useState<TabType>("settings");
  const [config, setConfig] = useState<RedirectConfig>(defaultConfig);
  const [logs, setLogs] = useState<RedirectLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const [logPage, setLogPage] = useState(1);
  const [logTotal, setLogTotal] = useState(0);
  const [logFilter, setLogFilter] = useState<"all" | "player" | "wipe">("all");
  const [searchSteamId, setSearchSteamId] = useState("");
  const logLimit = 25;

  const [servers, setServers] = useState<ServerIdentifier[]>([]);

  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch("/api/redirect/config");
      const data = await res.json();
      if (data.success) {
        setConfig(data.data);
      }
    } catch (err) {
      console.error("Failed to fetch config:", err);
    }
  }, []);

  const fetchServers = useCallback(async () => {
    try {
      const res = await fetch("/api/identifiers");
      const data = await res.json();
      if (data.success) {
        setServers(data.data);
      }
    } catch (err) {
      console.error("Failed to fetch servers:", err);
    }
  }, []);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: logPage.toString(),
        limit: logLimit.toString(),
        logType: logFilter
      });
      if (searchSteamId) params.set("steamId", searchSteamId);

      const res = await fetch(`/api/redirect/logs?${params}`);
      const data = await res.json();
      if (data.success) {
        setLogs(data.data);
        setLogTotal(data.pagination.total);
      }
    } catch (err) {
      console.error("Failed to fetch logs:", err);
    } finally {
      setLoading(false);
    }
  }, [logPage, logFilter, searchSteamId]);

  useEffect(() => {
    fetchConfig();
    fetchServers();
  }, [fetchConfig, fetchServers]);

  useEffect(() => {
    if (activeTab === "logs") {
      fetchLogs();
    }
  }, [activeTab, fetchLogs]);

  const saveConfig = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/redirect/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config)
      });
      const data = await res.json();
      if (data.success) {
        setConfig(data.data);
        setToast({ message: "Configuration saved successfully", type: "success" });
      } else {
        setToast({ message: data.error?.message || "Failed to save", type: "error" });
      }
    } catch {
      setToast({ message: "Failed to save configuration", type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const stats = useMemo<LogStats>(() => {
    const playerLogs = logs.filter(l => l.logType === "player");
    const wipeLogs = logs.filter(l => l.logType === "wipe");
    const afkLogs = playerLogs.filter(l => l.redirectReason === "AFK_TIMEOUT");
    const avgAfk = afkLogs.length > 0
      ? afkLogs.reduce((sum, l) => sum + (l.afkTimeSeconds || 0), 0) / afkLogs.length
      : 0;

    return {
      total: logTotal,
      playerRedirects: playerLogs.length,
      wipeRedirects: wipeLogs.length,
      afkRedirects: afkLogs.length,
      avgAfkTime: Math.round(avgAfk)
    };
  }, [logs, logTotal]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  const formatDate = (iso: string) => new Date(iso).toLocaleString();

  const totalPages = Math.ceil(logTotal / logLimit);

  return (
    <div className="p-8">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20">
                <ArrowRightLeft className="h-6 w-6 text-purple-400" />
              </div>
              Redirection
            </h1>
            <p className="text-zinc-500 mt-2">Configure staff AFK redirects and wipe redirects</p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => activeTab === "settings" ? fetchConfig() : fetchLogs()}
              className="p-2 rounded-lg bg-white/5 border border-white/10 text-zinc-400 hover:text-white transition-colors"
            >
              <RefreshCw className={`h-5 w-5 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab("settings")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              activeTab === "settings"
                ? "bg-purple-500 text-white"
                : "bg-white/5 text-zinc-400 hover:text-white"
            }`}
          >
            <Settings className="h-4 w-4" />
            Settings
          </button>
          <button
            onClick={() => setActiveTab("logs")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              activeTab === "logs"
                ? "bg-purple-500 text-white"
                : "bg-white/5 text-zinc-400 hover:text-white"
            }`}
          >
            <Activity className="h-4 w-4" />
            Logs
          </button>
        </div>

        <AnimatePresence mode="wait">
          {activeTab === "settings" ? (
            <motion.div
              key="settings"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              <div className="bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-xl p-6">
                <h2 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
                  <Shield className="h-5 w-5 text-orange-400" />
                  Staff AFK Redirect
                </h2>
                <p className="text-sm text-zinc-500 mb-4">Monitors staff members and redirects them to empty servers when AFK</p>

                <div className="space-y-6">
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-white/5">
                    <button
                      onClick={() => setConfig({ ...config, enableAFKRedirect: !config.enableAFKRedirect })}
                      className={`relative w-12 h-6 rounded-full transition-colors ${config.enableAFKRedirect ? "bg-purple-500" : "bg-zinc-600"}`}
                    >
                      <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${config.enableAFKRedirect ? "translate-x-6" : ""}`} />
                    </button>
                    <div>
                      <span className="text-sm font-medium text-white">Enable Staff AFK Redirect</span>
                      <p className="text-xs text-zinc-500">When enabled, monitors staff for AFK and redirects them</p>
                    </div>
                  </div>

                  <div className="bg-white/5 rounded-lg p-4">
                    <ListManager
                      label="Staff Groups to Monitor"
                      description="Permission groups that will be monitored for AFK (e.g., admin, moderator)"
                      items={config.staffGroups}
                      onChange={(items) => setConfig({ ...config, staffGroups: items })}
                      placeholder="e.g., admin, moderator"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <SettingInput
                      label="AFK Timeout"
                      description="Seconds of inactivity before redirect"
                      value={config.afkTimeSeconds}
                      onChange={(v) => setConfig({ ...config, afkTimeSeconds: v })}
                    />
                    <SettingInput
                      label="Check Interval"
                      description="How often to check AFK status (seconds)"
                      value={config.checkInterval}
                      onChange={(v) => setConfig({ ...config, checkInterval: v })}
                      step="0.1"
                    />
                    <SettingInput
                      label="Max Redirect Attempts"
                      description="Retry attempts before giving up"
                      value={config.maxRedirectAttempts}
                      onChange={(v) => setConfig({ ...config, maxRedirectAttempts: v })}
                    />
                  </div>
                </div>
              </div>

              <div className="bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-xl p-6">
                <h2 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
                  <Users className="h-5 w-5 text-blue-400" />
                  Population Thresholds
                </h2>
                <p className="text-sm text-zinc-500 mb-4">AFK redirects only trigger when server population is within these limits</p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <SettingInput
                    label="Min Players for Empty Server"
                    description="Target server must have at least this many players"
                    value={config.minPlayersForEmptyServer}
                    onChange={(v) => setConfig({ ...config, minPlayersForEmptyServer: v })}
                  />
                  <SettingInput
                    label="Max Players for Empty Server"
                    description="Target server must have at most this many players"
                    value={config.maxPlayersForEmptyServer}
                    onChange={(v) => setConfig({ ...config, maxPlayersForEmptyServer: v })}
                  />
                </div>
              </div>

              <div className="bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-xl p-6">
                <h2 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-red-400" />
                  Wipe Redirect
                </h2>
                <p className="text-sm text-zinc-500 mb-4">Redirect players before server wipes. Configure schedules on each server.</p>

                <div className="space-y-6">
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-white/5">
                    <button
                      onClick={() => setConfig({ ...config, enableWipeRedirect: !config.enableWipeRedirect })}
                      className={`relative w-12 h-6 rounded-full transition-colors ${config.enableWipeRedirect ? "bg-purple-500" : "bg-zinc-600"}`}
                    >
                      <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${config.enableWipeRedirect ? "translate-x-6" : ""}`} />
                    </button>
                    <div>
                      <span className="text-sm font-medium text-white">Enable Wipe Redirect</span>
                      <p className="text-xs text-zinc-500">Redirects all players before scheduled wipes</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <SettingInput
                      label="Minutes Before Wipe"
                      description="Start redirecting players this many minutes before wipe (EST/EDT)"
                      value={config.wipeRedirectMinutesBefore}
                      onChange={(v) => setConfig({ ...config, wipeRedirectMinutesBefore: v })}
                    />
                  </div>
                </div>
              </div>

              <div className="bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-xl p-6">
                <h2 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
                  <Server className="h-5 w-5 text-green-400" />
                  Target Server Selection
                </h2>
                <p className="text-sm text-zinc-500 mb-4">Control which servers are used as redirect targets</p>

                <div className="space-y-6">
                  <div className="bg-white/5 rounded-lg p-4">
                    <label className="text-sm font-medium text-[var(--text-primary)]">Override Redirect Server</label>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5 mb-2">Forces all redirects (AFK and wipe) to this server, bypassing population checks</p>
                    <select
                      value={config.overrideRedirectServer || ""}
                      onChange={(e) => setConfig({ ...config, overrideRedirectServer: e.target.value || null })}
                      className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-purple-500"
                    >
                      <option value="">None (use population-based selection)</option>
                      {servers.map((s) => (
                        <option key={s.id} value={s.hashedId}>{s.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-white/5 rounded-lg p-4">
                      <ListManager
                        label="Preferred Empty Servers"
                        description="Server identifiers to prioritize when no override set"
                        items={config.preferredEmptyServers}
                        onChange={(items) => setConfig({ ...config, preferredEmptyServers: items })}
                        placeholder="Server identifier"
                      />
                    </div>
                    <div className="bg-white/5 rounded-lg p-4">
                      <ListManager
                        label="Excluded Servers"
                        description="Server identifiers to never redirect to"
                        items={config.excludedServers}
                        onChange={(items) => setConfig({ ...config, excludedServers: items })}
                        placeholder="Server identifier to exclude"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-xl p-6">
                <h2 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
                  <Zap className="h-5 w-5 text-yellow-400" />
                  Global Settings
                </h2>
                <p className="text-sm text-zinc-500 mb-4">General configuration that applies to all redirect systems</p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <SettingInput
                    label="Config Update Interval"
                    description="How often servers fetch this config (seconds)"
                    value={config.configUpdateInterval}
                    onChange={(v) => setConfig({ ...config, configUpdateInterval: v })}
                    step="0.1"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={saveConfig}
                  disabled={saving}
                  className="flex items-center gap-2 px-6 py-3 rounded-lg bg-purple-500 hover:bg-purple-600 text-white font-medium transition-colors disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  {saving ? "Saving..." : "Save Configuration"}
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="logs"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <StatCard label="Total Redirects" value={stats.total} icon={ArrowRightLeft} color="purple" />
                <StatCard label="Player Redirects" value={stats.playerRedirects} icon={Users} color="blue" subtitle="This page" />
                <StatCard label="Wipe Redirects" value={stats.wipeRedirects} icon={AlertTriangle} color="yellow" subtitle="This page" />
                <StatCard label="Avg AFK Time" value={formatTime(stats.avgAfkTime)} icon={Clock} color="green" />
              </div>

              <div className="bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-xl p-6">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-4">
                  <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                    <Activity className="h-5 w-5 text-purple-400" />
                    Redirect Logs
                  </h2>
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10">
                      <Search className="h-4 w-4 text-zinc-400" />
                      <input
                        type="text"
                        value={searchSteamId}
                        onChange={(e) => { setSearchSteamId(e.target.value); setLogPage(1); }}
                        placeholder="Search Steam ID..."
                        className="bg-transparent text-white text-sm focus:outline-none w-40"
                      />
                    </div>
                    <div className="flex rounded-lg overflow-hidden border border-white/10">
                      {(["all", "player", "wipe"] as const).map((type) => (
                        <button
                          key={type}
                          onClick={() => { setLogFilter(type); setLogPage(1); }}
                          className={`px-3 py-2 text-sm transition-colors capitalize ${
                            logFilter === type ? "bg-purple-500 text-white" : "bg-white/5 text-zinc-400 hover:text-white"
                          }`}
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {loading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => <div key={i} className="h-16 bg-white/5 rounded-lg animate-pulse" />)}
                  </div>
                ) : logs.length === 0 ? (
                  <div className="text-center py-12 text-zinc-500">
                    <ArrowRightLeft className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p>No redirect logs found</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-white/10">
                          <th className="text-left py-3 px-4 text-sm font-medium text-zinc-400">Type</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-zinc-400">Player</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-zinc-400">Reason</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-zinc-400">Source → Target</th>
                          <th className="text-right py-3 px-4 text-sm font-medium text-zinc-400">Time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {logs.map((log) => (
                          <tr key={log.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                            <td className="py-3 px-4">
                              <span className={`px-2 py-1 rounded text-xs font-medium ${
                                log.logType === "player" ? "bg-blue-500/20 text-blue-400" : "bg-yellow-500/20 text-yellow-400"
                              }`}>
                                {log.logType}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              {log.playerName ? (
                                <div>
                                  <div className="text-white font-medium">{log.playerName}</div>
                                  <div className="text-xs text-zinc-500">{log.steamId}</div>
                                  {log.rank && <div className="text-xs text-purple-400">{log.rank}</div>}
                                </div>
                              ) : (
                                <span className="text-zinc-500">{log.players} players</span>
                              )}
                            </td>
                            <td className="py-3 px-4">
                              <span className={`px-2 py-1 rounded text-xs font-medium ${
                                log.redirectReason === "AFK_TIMEOUT" ? "bg-orange-500/20 text-orange-400" :
                                log.redirectReason === "WIPE" || log.redirectReason === "WIPE_REDIRECT" ? "bg-red-500/20 text-red-400" :
                                log.redirectReason === "PLAYER_RETURN" ? "bg-cyan-500/20 text-cyan-400" :
                                "bg-green-500/20 text-green-400"
                              }`}>
                                {log.redirectReason}
                              </span>
                              {log.afkTimeSeconds && (
                                <div className="text-xs text-zinc-500 mt-1">{formatTime(log.afkTimeSeconds)}</div>
                              )}
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2 text-sm">
                                <span className="text-zinc-400 truncate max-w-[120px]" title={log.sourceIdentifier}>
                                  {log.sourceIdentifier}
                                </span>
                                {log.targetIdentifier && (
                                  <>
                                    <span className="text-purple-400">→</span>
                                    <span className="text-white truncate max-w-[120px]" title={log.targetIdentifier}>
                                      {log.targetIdentifier}
                                    </span>
                                  </>
                                )}
                              </div>
                            </td>
                            <td className="py-3 px-4 text-right text-sm text-zinc-400">
                              {formatDate(log.timestamp)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/10">
                    <span className="text-sm text-zinc-500">
                      Page {logPage} of {totalPages} ({logTotal} total)
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setLogPage(p => Math.max(1, p - 1))}
                        disabled={logPage === 1}
                        className="p-2 rounded-lg bg-white/5 border border-white/10 text-zinc-400 hover:text-white disabled:opacity-50 transition-colors"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setLogPage(p => Math.min(totalPages, p + 1))}
                        disabled={logPage === totalPages}
                        className="p-2 rounded-lg bg-white/5 border border-white/10 text-zinc-400 hover:text-white disabled:opacity-50 transition-colors"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <AnimatePresence>
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      </AnimatePresence>
    </div>
  );
}
