"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Target, Users, Server, RefreshCw, Trash2, AlertTriangle, Search,
  ChevronLeft, ChevronRight, ArrowUpDown,
} from "lucide-react"
import { StatCard } from "@/components/analytics"
import { STAT_COLUMNS } from "@/lib/validations/stats"
import { Dropdown } from "@/components/ui/Dropdown"
import { SearchInput } from "@/components/ui/SearchInput"
import { Loading, Skeleton } from "@/components/ui/Loading"
import { EmptyState } from "@/components/ui/EmptyState"
import { Alert } from "@/components/ui/Alert"
import { Button } from "@/components/ui/Button"
import { SimplePagination } from "@/components/ui/Pagination"

// Derive display columns from config (exclude json/computed fields not useful in table)
const TABLE_COLUMNS = STAT_COLUMNS.filter(c => c.format !== 'json' && c.sortable)

interface PlayerRow {
  steamid: string
  name: string
  clan: string
  playtimeFormatted?: string
  [key: string]: unknown
}

interface StatsResponse {
  success: boolean
  data: PlayerRow[]
  meta: { total: number; filteredTotal: number; limit: number; offset: number; hasMore: boolean }
}

interface ServerSummary {
  server_id: string
  player_count: number
}

export default function StatsManagementPage() {
  const [servers, setServers] = useState<ServerSummary[]>([])
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

  // Fetch server list from identifiers
  const fetchServers = useCallback(async () => {
    try {
      const res = await fetch("/api/public/identifiers")
      if (!res.ok) return
      const json = await res.json()
      const ids = (json.identifiers || []).map((i: { id: string; name: string }) => ({
        server_id: i.id,
        player_count: 0,
      }))
      setServers(ids)
      if (ids.length > 0 && !selectedServer) {
        setSelectedServer(ids[0].server_id)
      }
    } catch {
      // fallback: no servers
    }
  }, [selectedServer])

  const fetchStats = useCallback(async () => {
    if (!selectedServer) return
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        server_id: selectedServer,
        timeframe,
        view,
        sort,
        order,
        limit: String(limit),
        offset: String(offset),
      })
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
    if (!confirm(`Are you sure you want to wipe ${scope} stats for ${selectedServer}?`)) return
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
    if (sort === col) {
      setOrder(order === "desc" ? "asc" : "desc")
    } else {
      setSort(col)
      setOrder("desc")
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
              <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20">
                <Target className="h-6 w-6 text-purple-400" />
              </div>
              Player Stats
            </h1>
            <p className="text-zinc-500 mt-2">Manage player statistics and leaderboards</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => fetchStats()}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-sm transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <StatCard label="Tracked Servers" value={servers.length} icon={Server} delay={0} />
          <StatCard label="Total Players" value={meta?.total || 0} icon={Users} iconColor="text-blue-400" iconBgColor="bg-blue-500/20" delay={0.1} />
          <StatCard label="Filtered Results" value={meta?.filteredTotal || 0} icon={Target} iconColor="text-green-400" iconBgColor="bg-green-500/20" delay={0.2} />
        </div>

        {/* Controls */}
        <div className="mb-6 p-5 rounded-xl bg-white/[0.02] border border-white/5">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-2">Server</label>
              <Dropdown
                value={selectedServer}
                onChange={value => setSelectedServer(value ?? '')}
                options={servers.map(s => ({ value: s.server_id, label: s.server_id }))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-2">Timeframe</label>
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
              <label className="block text-sm font-medium text-zinc-400 mb-2">View</label>
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
              <label className="block text-sm font-medium text-zinc-400 mb-2">Search</label>
              <SearchInput
                placeholder="Name, SteamID, Clan"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-2">Wipe Actions</label>
              <div className="flex gap-2">
                <button
                  onClick={() => handleWipe("wipe")}
                  disabled={wipeLoading || !selectedServer}
                  className="flex items-center gap-1 px-3 py-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 text-xs font-medium transition-colors disabled:opacity-50"
                >
                  <Trash2 className="h-3 w-3" /> Wipe
                </button>
                <button
                  onClick={() => handleWipe("monthly")}
                  disabled={wipeLoading || !selectedServer}
                  className="flex items-center gap-1 px-3 py-2 rounded-lg bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 text-xs font-medium transition-colors disabled:opacity-50"
                >
                  <Trash2 className="h-3 w-3" /> Monthly
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-red-400" />
            <p className="text-red-300 text-sm">{error}</p>
          </div>
        )}

        {/* Data Table — columns from config */}
        <div className="rounded-xl bg-white/[0.02] border border-white/5 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="px-4 py-3 text-xs font-semibold text-zinc-400 uppercase text-left">#</th>
                  {view === "players" && (
                    <th className="px-4 py-3 text-xs font-semibold text-zinc-400 uppercase text-left">Player</th>
                  )}
                  {view === "clans" && (
                    <th className="px-4 py-3 text-xs font-semibold text-zinc-400 uppercase text-left">Clan</th>
                  )}
                  {TABLE_COLUMNS.map(col => (
                    <th
                      key={col.column}
                      onClick={() => handleSort(col.column)}
                      className="px-4 py-3 text-xs font-semibold text-zinc-400 uppercase text-right cursor-pointer hover:text-white transition-colors whitespace-nowrap"
                    >
                      <div className="flex items-center justify-end gap-1">
                        {col.label}
                        {sort === col.column && (
                          <ArrowUpDown className="h-3 w-3 text-purple-400" />
                        )}
                      </div>
                    </th>
                  ))}
                  {view === "clans" && (
                    <th
                      onClick={() => handleSort("member_count")}
                      className="px-4 py-3 text-xs font-semibold text-zinc-400 uppercase text-right cursor-pointer hover:text-white transition-colors"
                    >
                      <div className="flex items-center justify-end gap-1">
                        Members
                        {sort === "member_count" && <ArrowUpDown className="h-3 w-3 text-purple-400" />}
                      </div>
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={TABLE_COLUMNS.length + 3} className="text-center py-12 text-zinc-500">
                      <RefreshCw className="h-6 w-6 mx-auto animate-spin text-purple-500 mb-2" />
                      Loading...
                    </td>
                  </tr>
                ) : data.length === 0 ? (
                  <tr>
                    <td colSpan={TABLE_COLUMNS.length + 3} className="text-center py-12 text-zinc-500">
                      No data available
                    </td>
                  </tr>
                ) : (
                  data.map((row, idx) => (
                    <tr key={row.steamid || (row.clan as string) || idx} className="border-b border-white/5 hover:bg-white/[0.03] transition-colors">
                      <td className="px-4 py-3 text-sm text-zinc-500">{offset + idx + 1}</td>
                      {view === "players" && (
                        <td className="px-4 py-3 text-sm">
                          <div>
                            <span className="text-white font-medium">{row.name || "Unknown"}</span>
                            {row.clan && <span className="ml-2 text-xs text-purple-400">[{row.clan}]</span>}
                          </div>
                          <div className="text-xs text-zinc-600">{row.steamid}</div>
                        </td>
                      )}
                      {view === "clans" && (
                        <td className="px-4 py-3 text-sm text-white font-medium">{row.clan}</td>
                      )}
                      {TABLE_COLUMNS.map(col => (
                        <td key={col.column} className="px-4 py-3 text-sm text-right text-zinc-300">
                          {col.format === "time"
                            ? String(row.playtimeFormatted || row[col.column] || "")
                            : col.format === "decimal"
                              ? Number(row[col.column] || 0).toFixed(2)
                              : Number(row[col.column] || 0).toLocaleString()
                          }
                        </td>
                      ))}
                      {view === "clans" && (
                        <td className="px-4 py-3 text-sm text-right text-zinc-300">
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
                className="p-2 rounded-lg bg-white/5 hover:bg-purple-500/20 disabled:opacity-50 transition-colors"
              >
                <ChevronLeft className="h-4 w-4 text-zinc-400" />
              </button>
              <span className="text-sm text-zinc-400">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setOffset(offset + limit)}
                disabled={!meta?.hasMore}
                className="p-2 rounded-lg bg-white/5 hover:bg-purple-500/20 disabled:opacity-50 transition-colors"
              >
                <ChevronRight className="h-4 w-4 text-zinc-400" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
