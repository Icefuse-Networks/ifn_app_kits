"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import {
  Target, Users, Server, RefreshCw, Trash2, AlertTriangle,
  ChevronLeft, ChevronRight, ArrowUpDown, X, EyeOff, Eye, Save,
} from "lucide-react"
import { StatCard } from "@/components/analytics"
import { STAT_COLUMNS } from "@/lib/validations/stats"
import { Dropdown } from "@/components/global/Dropdown"
import { SearchInput } from "@/components/ui/SearchInput"

const TABLE_COLUMNS = STAT_COLUMNS.filter(c => c.format !== 'json' && c.sortable)
const EDITABLE_COLUMNS = STAT_COLUMNS.filter(c => c.aggregatable && c.column !== 'points')

interface PlayerRow {
  steamid: string
  name: string
  clan: string
  server_id?: string
  playtimeFormatted?: string
  member_count?: number
  [key: string]: unknown
}

interface StatsResponse {
  success: boolean
  data: PlayerRow[]
  meta: { total: number; filteredTotal: number; limit: number; offset: number; hasMore: boolean }
}

interface ServerInfo {
  server_id: string
  name: string
}

export default function StatsManagementPage() {
  const [servers, setServers] = useState<ServerInfo[]>([])
  const [selectedServer, setSelectedServer] = useState<string>("")
  const [timeframe, setTimeframe] = useState<string>("wipe")
  const [view, setView] = useState<string>("players")
  const [sort, setSort] = useState<string>("kills")
  const [order, setOrder] = useState<string>("desc")
  const [search, setSearch] = useState("")
  const [offset, setOffset] = useState(0)
  const [limit] = useState(50)

  const [data, setData] = useState<PlayerRow[]>([])
  const [meta, setMeta] = useState<StatsResponse["meta"] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [wipeLoading, setWipeLoading] = useState(false)

  // Player management
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerRow | null>(null)
  const [editStats, setEditStats] = useState<Record<string, number>>({})
  const [playerShadowBanned, setPlayerShadowBanned] = useState(false)
  const [saving, setSaving] = useState(false)

  const isAllServers = !selectedServer

  const serverMap = useMemo(() => {
    const map: Record<string, string> = {}
    for (const s of servers) map[s.server_id] = s.name
    return map
  }, [servers])

  const fetchServers = useCallback(async () => {
    try {
      const res = await fetch("/api/public/identifiers")
      if (!res.ok) return
      const json = await res.json()
      setServers((json.identifiers || []).map((i: { id: string; name: string }) => ({
        server_id: i.id,
        name: i.name,
      })))
    } catch { /* no servers */ }
  }, [])

  const fetchStats = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ timeframe, view, sort, order, limit: String(limit), offset: String(offset) })
      if (selectedServer) params.set("server_id", selectedServer)
      if (search) params.set("search", search)

      const res = await fetch(`/api/stats?${params}`)
      const json: StatsResponse = await res.json()
      if (!json.success) throw new Error("Failed to fetch stats")
      setData(json.data)
      setMeta(json.meta)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
      setData([])
      setMeta(null)
    } finally {
      setLoading(false)
    }
  }, [selectedServer, timeframe, view, sort, order, limit, offset, search])

  useEffect(() => { fetchServers() }, [fetchServers])
  useEffect(() => { fetchStats() }, [fetchStats])
  useEffect(() => { setOffset(0) }, [selectedServer, timeframe, view, sort, order, search])

  const handleWipe = async (scope: string) => {
    if (!selectedServer) return
    const serverName = serverMap[selectedServer] || selectedServer
    if (!confirm(`Are you sure you want to wipe ${scope} stats for ${serverName}?`)) return
    setWipeLoading(true)
    try {
      const res = await fetch("/api/stats", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ server_id: selectedServer, scope }),
      })
      const json = await res.json()
      if (!json.success) throw new Error("Wipe failed")
      fetchStats()
    } catch {
      alert("Failed to wipe stats")
    } finally {
      setWipeLoading(false)
    }
  }

  const handleSort = (col: string) => {
    if (sort === col) setOrder(order === "desc" ? "asc" : "desc")
    else { setSort(col); setOrder("desc") }
  }

  // Player management
  const openPlayerPanel = async (row: PlayerRow) => {
    setSelectedPlayer(row)
    const stats: Record<string, number> = {}
    for (const col of EDITABLE_COLUMNS) {
      stats[col.column] = Number(row[col.column]) || 0
    }
    setEditStats(stats)

    // Check shadow ban status
    try {
      const servId = row.server_id || selectedServer
      const res = await fetch(`/api/stats/player/${row.steamid}?server_id=${servId}&timeframe=${timeframe}`)
      const json = await res.json()
      setPlayerShadowBanned(json.shadowBanned || false)
    } catch {
      setPlayerShadowBanned(false)
    }
  }

  const closePlayerPanel = () => {
    setSelectedPlayer(null)
    setEditStats({})
  }

  const handleSaveStats = async () => {
    if (!selectedPlayer) return
    const servId = selectedPlayer.server_id || selectedServer
    if (!servId) { alert("Select a server first"); return }
    setSaving(true)
    try {
      const res = await fetch(`/api/stats/player/${selectedPlayer.steamid}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ server_id: servId, timeframe, stats: editStats }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error?.message || "Failed to save")
      closePlayerPanel()
      fetchStats()
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save stats")
    } finally {
      setSaving(false)
    }
  }

  const handleToggleShadowBan = async () => {
    if (!selectedPlayer) return
    setSaving(true)
    try {
      const method = playerShadowBanned ? "PUT" : "DELETE"
      const res = await fetch(`/api/stats/player/${selectedPlayer.steamid}`, { method })
      const json = await res.json()
      if (!json.success) throw new Error("Failed")
      setPlayerShadowBanned(!playerShadowBanned)
      fetchStats()
    } catch {
      alert("Failed to toggle shadow ban")
    } finally {
      setSaving(false)
    }
  }

  const totalPages = meta ? Math.ceil(meta.filteredTotal / limit) : 0
  const currentPage = Math.floor(offset / limit) + 1

  return (
    <div className="p-8">
      <div className="anim-fade-slide-up">
        {/* Header */}
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <div className="p-2 rounded-xl bg-[var(--accent-primary)]/20">
                <Target className="h-6 w-6 text-[var(--accent-primary)]" />
              </div>
              Player Stats
            </h1>
            <p className="text-[var(--text-muted)] mt-2">Manage player statistics and leaderboards</p>
          </div>
          <button
            onClick={() => fetchStats()}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--accent-primary)] text-white text-sm transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <StatCard label="Tracked Servers" value={servers.length} icon={Server} delay={0} />
          <StatCard label="Total Players" value={meta?.total || 0} icon={Users} iconColor="text-[var(--accent-primary)]" iconBgColor="bg-[var(--accent-primary)]/20" delay={0.1} />
          <StatCard label="Filtered Results" value={meta?.filteredTotal || 0} icon={Target} iconColor="text-[var(--status-success)]" iconBgColor="bg-[var(--status-success)]/20" delay={0.2} />
        </div>

        {/* Controls */}
        <div className="mb-6 p-5 rounded-xl bg-white/[0.02] border border-white/5">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-[var(--text-muted)] mb-2">Server</label>
              <Dropdown
                value={selectedServer}
                onChange={value => setSelectedServer(value ?? '')}
                options={[
                  { value: '', label: 'All Servers' },
                  ...servers.map(s => ({ value: s.server_id, label: s.name })),
                ]}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text-muted)] mb-2">Timeframe</label>
              <Dropdown
                value={timeframe}
                onChange={value => setTimeframe(value ?? 'wipe')}
                options={[
                  { value: 'wipe', label: 'Wipe' },
                  { value: 'monthly', label: 'Monthly' },
                  { value: 'overall', label: 'Overall' },
                ]}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text-muted)] mb-2">View</label>
              <Dropdown
                value={view}
                onChange={value => setView(value ?? 'players')}
                options={[
                  { value: 'players', label: 'Players' },
                  { value: 'clans', label: 'Clans' },
                ]}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text-muted)] mb-2">Search</label>
              <SearchInput
                placeholder="Name, SteamID, Clan"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text-muted)] mb-2">Wipe Actions</label>
              <div className="flex gap-2">
                <button
                  onClick={() => handleWipe("wipe")}
                  disabled={wipeLoading || !selectedServer}
                  className="flex items-center gap-1 px-3 py-2 rounded-lg bg-[var(--status-error)]/20 hover:bg-[var(--status-error)]/30 text-[var(--status-error)] text-xs font-medium transition-colors disabled:opacity-50"
                >
                  <Trash2 className="h-3 w-3" /> Wipe
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-[var(--status-error)]/10 border border-[var(--status-error)]/30 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-[var(--status-error)]" />
            <p className="text-[var(--status-error)] text-sm">{error}</p>
          </div>
        )}

        {/* Data Table */}
        <div className="rounded-xl bg-white/[0.02] border border-white/5 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="px-4 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase text-left">#</th>
                  {view === "players" && (
                    <th className="px-4 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase text-left">Player</th>
                  )}
                  {view === "clans" && (
                    <th className="px-4 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase text-left">Clan</th>
                  )}
                  {isAllServers && (
                    <th className="px-4 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase text-left">Server</th>
                  )}
                  {TABLE_COLUMNS.map(col => (
                    <th
                      key={col.column}
                      onClick={() => handleSort(col.column)}
                      className="px-4 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase text-right cursor-pointer hover:text-white transition-colors whitespace-nowrap"
                    >
                      <div className="flex items-center justify-end gap-1">
                        {col.label}
                        {sort === col.column && <ArrowUpDown className="h-3 w-3 text-[var(--accent-primary)]" />}
                      </div>
                    </th>
                  ))}
                  {view === "clans" && (
                    <th
                      onClick={() => handleSort("member_count")}
                      className="px-4 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase text-right cursor-pointer hover:text-white transition-colors"
                    >
                      <div className="flex items-center justify-end gap-1">
                        Members
                        {sort === "member_count" && <ArrowUpDown className="h-3 w-3 text-[var(--accent-primary)]" />}
                      </div>
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={99} className="text-center py-12 text-[var(--text-muted)]">
                      <RefreshCw className="h-6 w-6 mx-auto animate-spin text-[var(--accent-primary)] mb-2" />
                      Loading...
                    </td>
                  </tr>
                ) : data.length === 0 ? (
                  <tr>
                    <td colSpan={99} className="text-center py-12 text-[var(--text-muted)]">
                      No data available
                    </td>
                  </tr>
                ) : (
                  data.map((row, idx) => (
                    <tr
                      key={`${row.steamid || row.clan}-${row.server_id || idx}`}
                      onClick={() => view === "players" && row.steamid ? openPlayerPanel(row) : null}
                      className={`border-b border-white/5 hover:bg-white/[0.03] transition-colors ${view === "players" ? "cursor-pointer" : ""}`}
                    >
                      <td className="px-4 py-3 text-sm text-[var(--text-muted)]">{offset + idx + 1}</td>
                      {view === "players" && (
                        <td className="px-4 py-3 text-sm">
                          <div>
                            <span className="text-white font-medium">{row.name || "Unknown"}</span>
                            {row.clan && <span className="ml-2 text-xs text-[var(--accent-primary)]">[{row.clan}]</span>}
                          </div>
                          <div className="text-xs text-[var(--text-tertiary)]">{row.steamid}</div>
                        </td>
                      )}
                      {view === "clans" && (
                        <td className="px-4 py-3 text-sm text-white font-medium">{row.clan}</td>
                      )}
                      {isAllServers && (
                        <td className="px-4 py-3 text-sm text-[var(--text-secondary)]">
                          {serverMap[row.server_id as string] || row.server_id || "—"}
                        </td>
                      )}
                      {TABLE_COLUMNS.map(col => (
                        <td key={col.column} className="px-4 py-3 text-sm text-right text-[var(--text-secondary)]">
                          {col.format === "time"
                            ? String(row.playtimeFormatted || row[col.column] || "")
                            : col.format === "decimal"
                              ? Number(row[col.column] || 0).toFixed(2)
                              : Number(row[col.column] || 0).toLocaleString()
                          }
                        </td>
                      ))}
                      {view === "clans" && (
                        <td className="px-4 py-3 text-sm text-right text-[var(--text-secondary)]">
                          {Number(row.member_count || 0).toLocaleString()}
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-2 p-4 border-t border-white/5">
              <button
                onClick={() => setOffset(Math.max(0, offset - limit))}
                disabled={offset === 0}
                className="p-2 rounded-lg bg-white/5 hover:bg-[var(--accent-primary)]/20 disabled:opacity-50 transition-colors"
              >
                <ChevronLeft className="h-4 w-4 text-[var(--text-muted)]" />
              </button>
              <span className="text-sm text-[var(--text-muted)]">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setOffset(offset + limit)}
                disabled={!meta?.hasMore}
                className="p-2 rounded-lg bg-white/5 hover:bg-[var(--accent-primary)]/20 disabled:opacity-50 transition-colors"
              >
                <ChevronRight className="h-4 w-4 text-[var(--text-muted)]" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Player Management Panel */}
      {selectedPlayer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={closePlayerPanel}>
          <div
            className="w-full max-w-lg rounded-xl border border-white/10 p-6"
            style={{ background: 'var(--bg-secondary)' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Panel Header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-bold text-white">{selectedPlayer.name || "Unknown"}</h2>
                <p className="text-xs text-[var(--text-muted)]">{selectedPlayer.steamid}</p>
                {isAllServers && selectedPlayer.server_id && (
                  <p className="text-xs text-[var(--accent-primary)] mt-1">{serverMap[selectedPlayer.server_id] || selectedPlayer.server_id}</p>
                )}
              </div>
              <button onClick={closePlayerPanel} className="p-2 rounded-lg hover:bg-white/10 transition-colors">
                <X className="h-5 w-5 text-[var(--text-muted)]" />
              </button>
            </div>

            {/* Shadow Ban Toggle */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-white/[0.03] border border-white/5 mb-6">
              <div className="flex items-center gap-2">
                {playerShadowBanned ? <EyeOff className="h-4 w-4 text-[var(--status-error)]" /> : <Eye className="h-4 w-4 text-[var(--status-success)]" />}
                <span className="text-sm text-[var(--text-secondary)]">
                  {playerShadowBanned ? "Shadow banned — hidden from public leaderboards" : "Visible on public leaderboards"}
                </span>
              </div>
              <button
                onClick={handleToggleShadowBan}
                disabled={saving}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 ${
                  playerShadowBanned
                    ? "bg-[var(--status-success)]/20 text-[var(--status-success)] hover:bg-[var(--status-success)]/30"
                    : "bg-[var(--status-error)]/20 text-[var(--status-error)] hover:bg-[var(--status-error)]/30"
                }`}
              >
                {playerShadowBanned ? "Unban" : "Shadow Ban"}
              </button>
            </div>

            {/* Edit Stats */}
            <div className="space-y-3 mb-6">
              <h3 className="text-sm font-medium text-[var(--text-muted)]">Edit Stats ({timeframe})</h3>
              <div className="grid grid-cols-2 gap-3">
                {EDITABLE_COLUMNS.map(col => (
                  <div key={col.column}>
                    <label className="block text-xs text-[var(--text-muted)] mb-1">{col.label}</label>
                    <input
                      type="number"
                      min={0}
                      value={editStats[col.column] ?? 0}
                      onChange={e => setEditStats(prev => ({ ...prev, [col.column]: Number(e.target.value) || 0 }))}
                      className="w-full px-3 py-2 rounded-lg bg-white/[0.05] border border-white/10 text-white text-sm focus:outline-none focus:border-[var(--accent-primary)] transition-colors"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3">
              <button
                onClick={closePlayerPanel}
                className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-[var(--text-secondary)] text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveStats}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/80 text-white text-sm transition-colors disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
