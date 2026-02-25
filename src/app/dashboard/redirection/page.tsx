"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import {
  ArrowRightLeft, Settings, Activity, RefreshCw, Save,
  Users, Clock, AlertTriangle,
  Search, Shield, Server, Zap,
  Calendar, BarChart3, Download, CheckCircle, XCircle, Timer, Crosshair, RotateCcw, GitBranch
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, NumberInput } from "@/components/ui/Input";
import { Switch } from "@/components/ui/Switch";
import { Dropdown, DropdownOption } from "@/components/ui/Dropdown";
import { MultiSelect } from "@/components/ui/MultiSelect";
import { Tabs } from "@/components/ui/Tabs";
import { Badge } from "@/components/ui/Badge";
import { Alert } from "@/components/ui/Alert";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Loading";
import { SimplePagination } from "@/components/ui/Pagination";
import { PieChart } from "@/components/analytics/PieChart";
import { TimeSeriesChart } from "@/components/analytics/TimeSeriesChart";
import { BarChart } from "@/components/analytics/BarChart";
import { ChartCard } from "@/components/analytics/ChartCard";

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
  wipeRedirectMode: string;
  wipeTargetServer: string | null;
  wipeHoldingServer: string | null;
  wipeServerMapping: Record<string, string>;
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
  sourceName: string | null;
  targetName: string | null;
  outcome: string | null;
  failureReason: string | null;
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

interface AnalyticsData {
  summary: {
    total: number;
    success: number;
    failed: number;
    timeout: number;
    successRate: number;
    pendingQueue: number;
    period: string;
  };
  byReason: Array<{ reason: string; count: number }>;
  byServer: Array<{ serverId: string; serverName: string; count: number; successRate: number }>;
  trend: Array<{ date: string; total: number; success: number; failed: number }>;
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
  wipeRedirectMode: "current",
  wipeTargetServer: null,
  wipeHoldingServer: null,
  wipeServerMapping: {},
  overrideRedirectServer: null
};

type TabType = "settings" | "logs" | "analytics";
type AnalyticsPeriod = "7d" | "30d" | "90d";
type OutcomeFilter = "all" | "success" | "failed" | "timeout";

function Toast({ message, type, onClose }: { message: string; type: "success" | "error"; onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="anim-fade-slide-up fixed bottom-4 right-4 z-[10000]">
      <Alert
        variant={type === "success" ? "success" : "error"}
        dismissible
        onDismiss={onClose}
      >
        {message}
      </Alert>
    </div>
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
    red: { icon: "text-red-400", bg: "bg-red-500/20" },
    cyan: { icon: "text-cyan-400", bg: "bg-cyan-500/20" },
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
        <Input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), addItem())}
          placeholder={placeholder}
          className="flex-1"
        />
        <Button onClick={addItem} variant="primary" size="md">
          Add
        </Button>
      </div>
      {items.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {items.map((item, idx) => (
            <Badge key={idx} variant="secondary" size="sm">
              {item}
              <button onClick={() => removeItem(item)} className="ml-1 hover:text-red-400">
                ×
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

function SettingInput({ label, description, value, onChange, step }: {
  label: string;
  description?: string;
  value: number;
  onChange: (val: number) => void;
  step?: string;
}) {
  return (
    <NumberInput
      label={label}
      helperText={description}
      value={value}
      onChange={onChange}
      step={step ? parseFloat(step) : 1}
      showControls={false}
    />
  );
}

function OutcomeBadge({ outcome }: { outcome: string | null }) {
  if (!outcome) return null;
  const variant = outcome === "success" ? "success" : outcome === "failed" ? "error" : "warning";
  return <Badge variant={variant} size="sm">{outcome}</Badge>;
}

function WipeMappingAdder({ servers, existingMappings, onAdd }: {
  servers: ServerIdentifier[];
  existingMappings: Record<string, string>;
  onAdd: (sourceId: string, targetId: string) => void;
}) {
  const [source, setSource] = useState<string | null>(null);
  const [target, setTarget] = useState<string | null>(null);

  const availableSources = servers.filter(s => !(s.hashedId in existingMappings));

  const handleAdd = () => {
    if (source && target) {
      onAdd(source, target);
      setSource(null);
      setTarget(null);
    }
  };

  return (
    <div className="flex items-end gap-3">
      <div className="flex-1">
        <label className="text-xs text-zinc-400 block mb-1">Source (wiping server)</label>
        <Dropdown
          value={source}
          options={availableSources.map((s): DropdownOption => ({
            value: s.hashedId,
            label: s.name,
            icon: <Server className="h-4 w-4" />,
          }))}
          onChange={(val) => setSource(val)}
          placeholder="Select source..."
          searchable
        />
      </div>
      <div className="flex-1">
        <label className="text-xs text-zinc-400 block mb-1">Destination</label>
        <Dropdown
          value={target}
          options={servers.map((s): DropdownOption => ({
            value: s.hashedId,
            label: s.name,
            icon: <Server className="h-4 w-4" />,
          }))}
          onChange={(val) => setTarget(val)}
          placeholder="Select destination..."
          searchable
        />
      </div>
      <Button onClick={handleAdd} variant="primary" size="md" disabled={!source || !target}>
        Add
      </Button>
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

  // Log state
  const [logPage, setLogPage] = useState(1);
  const [logTotal, setLogTotal] = useState(0);
  const [logFilter, setLogFilter] = useState<"all" | "player" | "wipe">("all");
  const [outcomeFilter, setOutcomeFilter] = useState<OutcomeFilter>("all");
  const [searchSteamId, setSearchSteamId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const logLimit = 25;

  // Analytics state
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [analyticsPeriod, setAnalyticsPeriod] = useState<AnalyticsPeriod>("30d");
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsServerId, setAnalyticsServerId] = useState("");

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
      const res = await fetch("/api/identifiers", { credentials: "include" });
      const data = await res.json();
      if (Array.isArray(data)) {
        setServers(data);
      } else if (data.success && Array.isArray(data.data)) {
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
      if (outcomeFilter !== "all") params.set("outcome", outcomeFilter);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);

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
  }, [logPage, logFilter, searchSteamId, outcomeFilter, dateFrom, dateTo]);

  const fetchAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);
    try {
      const params = new URLSearchParams({ period: analyticsPeriod });
      if (analyticsServerId) params.set("serverId", analyticsServerId);

      const res = await fetch(`/api/redirect/analytics?${params}`);
      const data = await res.json();
      if (data.success) {
        setAnalyticsData(data.data);
      }
    } catch (err) {
      console.error("Failed to fetch analytics:", err);
    } finally {
      setAnalyticsLoading(false);
    }
  }, [analyticsPeriod, analyticsServerId]);

  useEffect(() => {
    fetchConfig();
    fetchServers();
  }, [fetchConfig, fetchServers]);

  useEffect(() => {
    if (activeTab === "logs") {
      fetchLogs();
    }
  }, [activeTab, fetchLogs]);

  useEffect(() => {
    if (activeTab === "analytics") {
      fetchAnalytics();
    }
  }, [activeTab, fetchAnalytics]);

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

  const exportCsv = async () => {
    try {
      const params = new URLSearchParams({
        page: "1",
        limit: "10000",
        logType: logFilter
      });
      if (searchSteamId) params.set("steamId", searchSteamId);
      if (outcomeFilter !== "all") params.set("outcome", outcomeFilter);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);

      const res = await fetch(`/api/redirect/logs?${params}`);
      const data = await res.json();
      if (!data.success) return;

      const rows: string[] = [
        "Timestamp,Type,Player,SteamID,Rank,Reason,Outcome,FailureReason,Source,Target,AFKTime"
      ];
      for (const log of data.data as RedirectLog[]) {
        rows.push([
          log.timestamp,
          log.logType,
          `"${(log.playerName || "").replace(/"/g, '""')}"`,
          log.steamId || "",
          log.rank || "",
          log.redirectReason,
          log.outcome || "",
          `"${(log.failureReason || "").replace(/"/g, '""')}"`,
          log.sourceName || log.sourceIdentifier,
          log.targetName || log.targetIdentifier || "",
          log.afkTimeSeconds?.toString() || "",
        ].join(","));
      }

      const blob = new Blob([rows.join("\n")], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `redirect-logs-${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      setToast({ message: `Exported ${data.data.length} logs`, type: "success" });
    } catch {
      setToast({ message: "Failed to export logs", type: "error" });
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

  const handleRefresh = () => {
    if (activeTab === "settings") fetchConfig();
    else if (activeTab === "logs") fetchLogs();
    else fetchAnalytics();
  };

  // Analytics chart data
  const outcomeChartData = useMemo(() => {
    if (!analyticsData) return [];
    return [
      { name: "Success", value: analyticsData.summary.success },
      { name: "Failed", value: analyticsData.summary.failed },
      { name: "Timeout", value: analyticsData.summary.timeout },
    ].filter(d => d.value > 0);
  }, [analyticsData]);

  const reasonChartData = useMemo(() => {
    if (!analyticsData) return [];
    return analyticsData.byReason.map(r => ({
      label: r.reason,
      value: r.count,
    }));
  }, [analyticsData]);

  const trendSeries = useMemo(() => [
    { key: "success", name: "Success", type: "bar" as const, color: "#22c55e", barRadius: [4, 4, 0, 0] as [number, number, number, number] },
    { key: "failed", name: "Failed", type: "bar" as const, color: "#ef4444", barRadius: [4, 4, 0, 0] as [number, number, number, number] },
  ], []);

  return (
    <div className="p-8">
      <div className="anim-fade-slide-up">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20">
                <ArrowRightLeft className="h-6 w-6 text-purple-400" />
              </div>
              Redirection
            </h1>
            <p className="text-zinc-500 mt-2">Configure AFK redirects, wipe redirects, and player management</p>
          </div>

          <Button
            onClick={handleRefresh}
            variant="secondary"
            size="md"
          >
            <RefreshCw className={`h-5 w-5 ${loading || analyticsLoading ? "animate-spin" : ""}`} />
          </Button>
        </div>

        <Tabs
          tabs={[
            { id: "settings", label: "Settings", icon: <Settings className="h-4 w-4" /> },
            { id: "logs", label: "Logs", icon: <Activity className="h-4 w-4" /> },
            { id: "analytics", label: "Analytics", icon: <BarChart3 className="h-4 w-4" /> },
          ]}
          activeTab={activeTab}
          onChange={(tab) => setActiveTab(tab as TabType)}
          variant="pills"
          className="mb-6"
        />

          {activeTab === "settings" && (
            <div
              key="settings"
              className="anim-fade-slide-up space-y-6"
            >
              <div className="bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-xl p-6">
                <h2 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
                  <Shield className="h-5 w-5 text-orange-400" />
                  AFK Redirect
                </h2>
                <p className="text-sm text-zinc-500 mb-4">Monitors players in configured groups and redirects them to empty servers when AFK</p>

                <div className="space-y-6">
                  <div className="p-3 rounded-lg bg-white/5">
                    <Switch
                      checked={config.enableAFKRedirect}
                      onChange={(checked) => setConfig({ ...config, enableAFKRedirect: checked })}
                      label="Enable AFK Redirect"
                      description="When enabled, monitors players in the configured groups for AFK and redirects them"
                    />
                  </div>

                  <div className="bg-white/5 rounded-lg p-4">
                    <ListManager
                      label="Groups to Monitor"
                      description="Permission groups that will be monitored for AFK (e.g., developer, admin, default)"
                      items={config.staffGroups}
                      onChange={(items) => setConfig({ ...config, staffGroups: items })}
                      placeholder="e.g., developer, admin, default"
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
                <p className="text-sm text-zinc-500 mb-4">AFK redirects only target servers with population within these limits</p>

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
                  <div className="p-3 rounded-lg bg-white/5">
                    <Switch
                      checked={config.enableWipeRedirect}
                      onChange={(checked) => setConfig({ ...config, enableWipeRedirect: checked })}
                      label="Enable Wipe Redirect"
                      description="Redirects all players before scheduled wipes"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <SettingInput
                      label="Minutes Before Wipe"
                      description="Start redirecting players this many minutes before wipe (EST/EDT)"
                      value={config.wipeRedirectMinutesBefore}
                      onChange={(v) => setConfig({ ...config, wipeRedirectMinutesBefore: v })}
                    />
                  </div>

                  {/* Wipe Redirect Mode */}
                  <div>
                    <label className="text-sm font-medium text-[var(--text-primary)] block mb-2">Wipe Redirect Mode</label>
                    <p className="text-xs text-[var(--text-muted)] mb-3">How players are distributed when a server wipes</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                      {([
                        { value: "current", label: "Spread", icon: Users, desc: "Spread players across servers evenly using min/max population thresholds", color: "purple" },
                        { value: "targeted", label: "Targeted", icon: Crosshair, desc: "All players redirect to a single specific server", color: "blue" },
                        { value: "holding", label: "Holding", icon: RotateCcw, desc: "Redirect to a holding server, then return players when original comes back online", color: "green" },
                        { value: "mapping", label: "Mapping", icon: GitBranch, desc: "Each wiping server sends players to a specific mapped destination", color: "yellow" },
                      ] as const).map((mode) => (
                        <button
                          key={mode.value}
                          onClick={() => setConfig({ ...config, wipeRedirectMode: mode.value })}
                          className={`p-4 rounded-xl border text-left transition-all ${
                            config.wipeRedirectMode === mode.value
                              ? `border-${mode.color}-500/50 bg-${mode.color}-500/10 ring-1 ring-${mode.color}-500/30`
                              : "border-white/10 bg-white/5 hover:border-white/20"
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <mode.icon className={`h-4 w-4 ${config.wipeRedirectMode === mode.value ? `text-${mode.color}-400` : "text-zinc-400"}`} />
                            <span className={`text-sm font-medium ${config.wipeRedirectMode === mode.value ? "text-white" : "text-zinc-300"}`}>
                              {mode.label}
                            </span>
                          </div>
                          <p className="text-xs text-zinc-500">{mode.desc}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Targeted mode: select target server */}
                  {config.wipeRedirectMode === "targeted" && (
                    <div className="bg-white/5 rounded-lg p-4">
                      <label className="text-sm font-medium text-[var(--text-primary)] block mb-2">
                        <Crosshair className="h-4 w-4 inline mr-1 text-blue-400" />
                        Wipe Target Server
                      </label>
                      <p className="text-xs text-[var(--text-muted)] mb-2">All players from wiping servers will be sent here</p>
                      <Dropdown
                        value={config.wipeTargetServer}
                        options={servers.map((s): DropdownOption => ({
                          value: s.hashedId,
                          label: s.name,
                          icon: <Server className="h-4 w-4" />,
                        }))}
                        onChange={(val) => setConfig({ ...config, wipeTargetServer: val })}
                        placeholder="Select target server..."
                        clearable
                        searchable
                      />
                    </div>
                  )}

                  {/* Holding mode: select holding server */}
                  {config.wipeRedirectMode === "holding" && (
                    <div className="bg-white/5 rounded-lg p-4">
                      <label className="text-sm font-medium text-[var(--text-primary)] block mb-2">
                        <RotateCcw className="h-4 w-4 inline mr-1 text-green-400" />
                        Holding Server
                      </label>
                      <p className="text-xs text-[var(--text-muted)] mb-2">Players go here temporarily and are redirected back when the wiped server comes back online</p>
                      <Dropdown
                        value={config.wipeHoldingServer}
                        options={servers.map((s): DropdownOption => ({
                          value: s.hashedId,
                          label: s.name,
                          icon: <Server className="h-4 w-4" />,
                        }))}
                        onChange={(val) => setConfig({ ...config, wipeHoldingServer: val })}
                        placeholder="Select holding server..."
                        clearable
                        searchable
                      />
                    </div>
                  )}

                  {/* Mapping mode: server-to-server mapping */}
                  {config.wipeRedirectMode === "mapping" && (
                    <div className="bg-white/5 rounded-lg p-4 space-y-4">
                      <div>
                        <label className="text-sm font-medium text-[var(--text-primary)] block mb-1">
                          <GitBranch className="h-4 w-4 inline mr-1 text-yellow-400" />
                          Server Wipe Mapping
                        </label>
                        <p className="text-xs text-[var(--text-muted)]">When a source server wipes, its players are sent to the mapped destination</p>
                      </div>

                      {Object.entries(config.wipeServerMapping).map(([sourceId, targetId]) => {
                        const sourceName = servers.find(s => s.hashedId === sourceId)?.name || sourceId;
                        const targetName = servers.find(s => s.hashedId === targetId)?.name || targetId;
                        return (
                          <div key={sourceId} className="flex items-center gap-3 bg-white/5 rounded-lg p-3">
                            <div className="flex-1">
                              <span className="text-sm text-zinc-300">{sourceName}</span>
                            </div>
                            <span className="text-purple-400 text-sm">→</span>
                            <div className="flex-1">
                              <span className="text-sm text-white">{targetName}</span>
                            </div>
                            <button
                              onClick={() => {
                                const updated = { ...config.wipeServerMapping };
                                delete updated[sourceId];
                                setConfig({ ...config, wipeServerMapping: updated });
                              }}
                              className="text-red-400 hover:text-red-300 p-1"
                            >
                              ×
                            </button>
                          </div>
                        );
                      })}

                      <WipeMappingAdder
                        servers={servers}
                        existingMappings={config.wipeServerMapping}
                        onAdd={(sourceId, targetId) => {
                          setConfig({
                            ...config,
                            wipeServerMapping: { ...config.wipeServerMapping, [sourceId]: targetId }
                          });
                        }}
                      />
                    </div>
                  )}
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
                    <label className="text-sm font-medium text-[var(--text-primary)] block mb-2">Override Redirect Server</label>
                    <p className="text-xs text-[var(--text-muted)] mb-2">Forces all redirects (AFK and wipe) to this server, bypassing population checks</p>
                    <Dropdown
                      value={config.overrideRedirectServer}
                      options={servers.map((s): DropdownOption => ({
                        value: s.hashedId,
                        label: s.name,
                        icon: <Server className="h-4 w-4" />,
                      }))}
                      onChange={(val) => setConfig({ ...config, overrideRedirectServer: val })}
                      placeholder="None (use population-based selection)"
                      emptyOption="None (use population-based selection)"
                      clearable
                      searchable
                    />
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-white/5 rounded-lg p-4">
                      <label className="text-sm font-medium text-[var(--text-primary)] block mb-1">Preferred Empty Servers</label>
                      <p className="text-xs text-[var(--text-muted)] mb-2">Servers to prioritize as redirect targets when no override is set</p>
                      <MultiSelect
                        value={config.preferredEmptyServers}
                        options={servers.map(s => ({
                          value: s.hashedId,
                          label: s.name,
                          icon: <Server className="h-4 w-4" />,
                        }))}
                        onChange={(vals) => setConfig({ ...config, preferredEmptyServers: vals })}
                        placeholder="Select preferred servers..."
                        searchable
                        showSelectAll={false}
                      />
                    </div>
                    <div className="bg-white/5 rounded-lg p-4">
                      <label className="text-sm font-medium text-[var(--text-primary)] block mb-1">Excluded Servers</label>
                      <p className="text-xs text-[var(--text-muted)] mb-2">Servers to never redirect players to</p>
                      <MultiSelect
                        value={config.excludedServers}
                        options={servers.map(s => ({
                          value: s.hashedId,
                          label: s.name,
                          icon: <Server className="h-4 w-4" />,
                        }))}
                        onChange={(vals) => setConfig({ ...config, excludedServers: vals })}
                        placeholder="Select excluded servers..."
                        searchable
                        showSelectAll={false}
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
                <Button
                  onClick={saveConfig}
                  disabled={saving}
                  variant="primary"
                  size="lg"
                  loading={saving}
                  loadingText="Saving..."
                   icon={<Save className="h-4 w-4" />}
                >
                  Save Configuration
                </Button>
              </div>
            </div>
          )}

          {activeTab === "logs" && (
            <div
              key="logs"
              className="anim-fade-slide-up space-y-6"
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
                    <Input
                      type="text"
                      value={searchSteamId}
                      onChange={(e) => { setSearchSteamId(e.target.value); setLogPage(1); }}
                      placeholder="Search Steam ID..."
                      icon={<Search className="h-4 w-4" />}
                      size="sm"
                      className="w-48"
                    />
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
                    <div className="flex rounded-lg overflow-hidden border border-white/10">
                      {(["all", "success", "failed", "timeout"] as const).map((o) => (
                        <button
                          key={o}
                          onClick={() => { setOutcomeFilter(o); setLogPage(1); }}
                          className={`px-3 py-2 text-sm transition-colors capitalize ${
                            outcomeFilter === o ? "bg-purple-500 text-white" : "bg-white/5 text-zinc-400 hover:text-white"
                          }`}
                        >
                          {o}
                        </button>
                      ))}
                    </div>
                    <Button onClick={exportCsv} variant="secondary" size="sm" icon={<Download className="h-4 w-4" />}>
                      CSV
                    </Button>
                  </div>
                </div>

                {/* Date range filters */}
                <div className="flex flex-wrap items-center gap-3 mb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-zinc-400">From:</span>
                    <input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => { setDateFrom(e.target.value); setLogPage(1); }}
                      className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-purple-500"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-zinc-400">To:</span>
                    <input
                      type="date"
                      value={dateTo}
                      onChange={(e) => { setDateTo(e.target.value); setLogPage(1); }}
                      className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-purple-500"
                    />
                  </div>
                  {(dateFrom || dateTo) && (
                    <button
                      onClick={() => { setDateFrom(""); setDateTo(""); setLogPage(1); }}
                      className="text-sm text-purple-400 hover:text-purple-300"
                    >
                      Clear dates
                    </button>
                  )}
                </div>

                {loading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => <Skeleton key={i} height="4rem" variant="rectangular" />)}
                  </div>
                ) : logs.length === 0 ? (
                  <EmptyState
                    icon={<ArrowRightLeft className="h-12 w-12" />}
                    title="No redirect logs found"
                  />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-white/10">
                          <th className="text-left py-3 px-4 text-sm font-medium text-zinc-400">Type</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-zinc-400">Player</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-zinc-400">Reason</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-zinc-400">Outcome</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-zinc-400">Source → Target</th>
                          <th className="text-right py-3 px-4 text-sm font-medium text-zinc-400">Time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {logs.map((log) => (
                          <tr key={log.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                            <td className="py-3 px-4">
                              <Badge variant={log.logType === "player" ? "info" : "warning"} size="sm">
                                {log.logType}
                              </Badge>
                            </td>
                            <td className="py-3 px-4">
                              {log.playerName ? (
                                <div>
                                  <div className="text-white font-medium">{log.playerName}</div>
                                  <div className="text-xs text-zinc-500">{log.steamId}</div>
                                  {log.rank && <Badge variant="primary" size="sm">{log.rank}</Badge>}
                                </div>
                              ) : (
                                <span className="text-zinc-500">{log.players} players</span>
                              )}
                            </td>
                            <td className="py-3 px-4">
                              <Badge
                                variant={
                                  log.redirectReason === "AFK_TIMEOUT" ? "warning" :
                                  log.redirectReason === "WIPE" || log.redirectReason === "WIPE_REDIRECT" ? "error" :
                                  log.redirectReason === "PLAYER_RETURN" ? "info" :
                                  "success"
                                }
                                size="sm"
                              >
                                {log.redirectReason}
                              </Badge>
                              {log.afkTimeSeconds && (
                                <div className="text-xs text-zinc-500 mt-1">{formatTime(log.afkTimeSeconds)}</div>
                              )}
                            </td>
                            <td className="py-3 px-4">
                              <OutcomeBadge outcome={log.outcome} />
                              {log.failureReason && (
                                <div className="text-xs text-red-400 mt-1" title={log.failureReason}>
                                  {log.failureReason.length > 30 ? log.failureReason.slice(0, 28) + "..." : log.failureReason}
                                </div>
                              )}
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2 text-sm">
                                <span className="text-zinc-400 truncate max-w-[120px]" title={log.sourceIdentifier}>
                                  {log.sourceName || log.sourceIdentifier}
                                </span>
                                {(log.targetIdentifier || log.targetName) && (
                                  <>
                                    <span className="text-purple-400">→</span>
                                    <span className="text-white truncate max-w-[120px]" title={log.targetIdentifier || ""}>
                                      {log.targetName || log.targetIdentifier}
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
                  <div className="mt-4 pt-4 border-t border-white/10">
                    <SimplePagination
                      currentPage={logPage}
                      totalPages={totalPages}
                      onPageChange={setLogPage}
                      showPageInfo
                    />
                    <div className="text-center mt-2">
                      <span className="text-sm text-zinc-500">
                        {logTotal} total
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "analytics" && (
            <div
              key="analytics"
              className="anim-fade-slide-up space-y-6"
            >
              {/* Controls */}
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex rounded-lg overflow-hidden border border-white/10">
                  {(["7d", "30d", "90d"] as const).map((p) => (
                    <button
                      key={p}
                      onClick={() => setAnalyticsPeriod(p)}
                      className={`px-4 py-2 text-sm transition-colors ${
                        analyticsPeriod === p ? "bg-purple-500 text-white" : "bg-white/5 text-zinc-400 hover:text-white"
                      }`}
                    >
                      {p === "7d" ? "7 Days" : p === "30d" ? "30 Days" : "90 Days"}
                    </button>
                  ))}
                </div>
                <Dropdown
                  value={analyticsServerId || null}
                  options={servers.map((s): DropdownOption => ({
                    value: s.hashedId,
                    label: s.name,
                    icon: <Server className="h-4 w-4" />,
                  }))}
                  onChange={(val) => setAnalyticsServerId(val || "")}
                  placeholder="All servers"
                  emptyOption="All servers"
                  clearable
                  searchable
                />
              </div>

              {analyticsLoading ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} height="5rem" variant="rectangular" />)}
                  </div>
                  <Skeleton height="20rem" variant="rectangular" />
                </div>
              ) : !analyticsData ? (
                <EmptyState
                  icon={<BarChart3 className="h-12 w-12" />}
                  title="No analytics data"
                  description="Analytics data will appear once redirects are processed"
                />
              ) : (
                <>
                  {/* Summary cards */}
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    <StatCard
                      label="Total Redirects"
                      value={analyticsData.summary.total.toLocaleString()}
                      icon={ArrowRightLeft}
                      color="purple"
                    />
                    <StatCard
                      label="Success Rate"
                      value={`${analyticsData.summary.successRate}%`}
                      icon={CheckCircle}
                      color="green"
                      subtitle={`${analyticsData.summary.success.toLocaleString()} successful`}
                    />
                    <StatCard
                      label="Failed"
                      value={analyticsData.summary.failed.toLocaleString()}
                      icon={XCircle}
                      color="red"
                    />
                    <StatCard
                      label="Timeouts"
                      value={analyticsData.summary.timeout.toLocaleString()}
                      icon={Timer}
                      color="yellow"
                    />
                    <StatCard
                      label="Pending Queue"
                      value={analyticsData.summary.pendingQueue}
                      icon={Clock}
                      color="cyan"
                    />
                  </div>

                  {/* Charts row */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <ChartCard title="Outcome Breakdown" icon={BarChart3} iconColor="text-green-400" className="lg:col-span-1">
                      <div style={{ height: 250 }}>
                        {outcomeChartData.length > 0 ? (
                          <PieChart
                            data={outcomeChartData}
                            height={250}
                            colors={["#22c55e", "#ef4444", "#f59e0b"]}
                            innerRadius="50%"
                            outerRadius="80%"
                            showLegend
                            legendPosition="bottom"
                          />
                        ) : (
                          <div className="flex items-center justify-center h-full text-zinc-500 text-sm">No outcome data</div>
                        )}
                      </div>
                    </ChartCard>

                    <ChartCard title="Daily Trend" icon={Activity} iconColor="text-purple-400" className="lg:col-span-2">
                      <div style={{ height: 250 }}>
                        {analyticsData.trend.length > 0 ? (
                          <TimeSeriesChart
                            data={analyticsData.trend}
                            series={trendSeries}
                            height={250}
                            xAxisKey="date"
                            xAxisRotate={45}
                          />
                        ) : (
                          <div className="flex items-center justify-center h-full text-zinc-500 text-sm">No trend data</div>
                        )}
                      </div>
                    </ChartCard>
                  </div>

                  {/* Reason breakdown */}
                  {reasonChartData.length > 0 && (
                    <ChartCard title="Redirects by Reason" icon={AlertTriangle} iconColor="text-yellow-400">
                      <div style={{ height: Math.max(200, reasonChartData.length * 40) }}>
                        <BarChart
                          data={reasonChartData}
                          height="100%"
                          horizontal
                          labelWidth={160}
                          maxItems={15}
                        />
                      </div>
                    </ChartCard>
                  )}

                  {/* Per-server table */}
                  {analyticsData.byServer.length > 0 && (
                    <div className="bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-xl p-6">
                      <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
                        <Server className="h-5 w-5 text-blue-400" />
                        Per-Server Breakdown
                      </h3>
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b border-white/10">
                              <th className="text-left py-3 px-4 text-sm font-medium text-zinc-400">Server</th>
                              <th className="text-right py-3 px-4 text-sm font-medium text-zinc-400">Total Redirects</th>
                              <th className="text-right py-3 px-4 text-sm font-medium text-zinc-400">Success Rate</th>
                              <th className="text-left py-3 px-4 text-sm font-medium text-zinc-400 w-1/3">Rate</th>
                            </tr>
                          </thead>
                          <tbody>
                            {analyticsData.byServer.map((srv) => (
                              <tr key={srv.serverId} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                <td className="py-3 px-4">
                                  <div className="text-white font-medium">{srv.serverName}</div>
                                  <div className="text-xs text-zinc-500">{srv.serverId}</div>
                                </td>
                                <td className="py-3 px-4 text-right text-white">{srv.count.toLocaleString()}</td>
                                <td className="py-3 px-4 text-right">
                                  <span className={srv.successRate >= 90 ? "text-green-400" : srv.successRate >= 70 ? "text-yellow-400" : "text-red-400"}>
                                    {srv.successRate}%
                                  </span>
                                </td>
                                <td className="py-3 px-4">
                                  <div className="w-full bg-white/10 rounded-full h-2">
                                    <div
                                      className={`h-2 rounded-full ${
                                        srv.successRate >= 90 ? "bg-green-500" : srv.successRate >= 70 ? "bg-yellow-500" : "bg-red-500"
                                      }`}
                                      style={{ width: `${srv.successRate}%` }}
                                    />
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
      </div>

        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
