"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { motion } from "framer-motion"
import {
  ArrowLeft, Gift, Users, Search, Plus, Clock, Server, Eye,
  Trash2, User, RefreshCw, BarChart3, Activity,
  Power, PowerOff, Globe, Filter, Trophy, X, Check, ChevronDown
} from "lucide-react"
import Link from "next/link"

interface GiveawayPlayer {
  id: string
  playerName: string
  playerSteamId64: string
  playTime: number
  server: string
  isWinner: boolean
  createdAt: string
  giveaway?: { id: string; name: string } | null
}

interface GiveawayServer {
  id: string
  serverIdentifier: string
}

interface ServerIdentifier {
  id: string
  name: string
  hashedId: string
  ip: string | null
  port: number | null
}

interface Giveaway {
  id: string
  name: string
  description: string | null
  isActive: boolean
  isGlobal: boolean
  minPlaytimeHours: number
  maxWinners: number
  startAt: string | null
  endAt: string | null
  winnerId: string | null
  winnerName: string | null
  winnerSteamId64: string | null
  endedAt: string | null
  createdAt: string
  servers: GiveawayServer[]
  _count?: { players: number }
}

function formatTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`
  return `${(seconds / 3600).toFixed(1)}h`
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "No limit"
  return new Date(dateStr).toLocaleDateString()
}

export default function GiveawaysPage() {
  const [giveaways, setGiveaways] = useState<Giveaway[]>([])
  const [players, setPlayers] = useState<GiveawayPlayer[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [selectedGiveaway, setSelectedGiveaway] = useState<string | null>(null)
  const [playerAvatars, setPlayerAvatars] = useState<Record<string, string>>({})
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<"giveaways" | "players">("giveaways")

  // Available servers for selection
  const [availableServers, setAvailableServers] = useState<ServerIdentifier[]>([])

  // Create form state
  const [newName, setNewName] = useState("")
  const [newDescription, setNewDescription] = useState("")
  const [newIsGlobal, setNewIsGlobal] = useState(true)
  const [newMinPlaytime, setNewMinPlaytime] = useState(2)
  const [newMaxWinners, setNewMaxWinners] = useState(1)
  const [newSelectedServers, setNewSelectedServers] = useState<Set<string>>(new Set())
  const [newStartAt, setNewStartAt] = useState("")
  const [newEndAt, setNewEndAt] = useState("")
  const [scopeDropdownOpen, setScopeDropdownOpen] = useState(false)

  // Winner picker
  const [winners, setWinners] = useState<GiveawayPlayer[]>([])
  const [isPickingWinner, setIsPickingWinner] = useState(false)
  const [unboxingReel, setUnboxingReel] = useState<GiveawayPlayer[]>([])
  const scrollRef = useRef<HTMLDivElement>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [giveawaysRes, playersRes, serversRes] = await Promise.all([
        fetch("/api/admin/giveaways?includeInactive=true&limit=100", { credentials: "include" }),
        fetch(`/api/admin/giveaways/players?limit=100${selectedGiveaway ? `&giveawayId=${selectedGiveaway}` : ""}`, { credentials: "include" }),
        fetch("/api/identifiers", { credentials: "include" }),
      ])
      if (giveawaysRes.ok) {
        const result = await giveawaysRes.json()
        if (result.success) setGiveaways(result.data)
      }
      if (playersRes.ok) {
        const result = await playersRes.json()
        if (result.success) {
          setPlayers(result.data)
          fetchAvatars(result.data)
        }
      }
      if (serversRes.ok) {
        const serversData = await serversRes.json()
        setAvailableServers(Array.isArray(serversData) ? serversData : [])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data")
    } finally {
      setLoading(false)
    }
  }, [selectedGiveaway])

  const fetchAvatars = async (playersData: GiveawayPlayer[]) => {
    try {
      const steamIds = playersData.map(p => p.playerSteamId64).join(",")
      if (!steamIds) return
      const res = await fetch(`https://icefuse.com/api/steam/avatars?steamids=${steamIds}`)
      if (res.ok) setPlayerAvatars(await res.json())
    } catch { /* ignore avatar failures */ }
  }

  useEffect(() => { fetchData() }, [fetchData])

  const filteredPlayers = useMemo(() => {
    if (!search) return players
    const q = search.toLowerCase()
    return players.filter(p =>
      p.playerName.toLowerCase().includes(q) ||
      p.playerSteamId64.includes(q) ||
      p.server.toLowerCase().includes(q)
    )
  }, [players, search])

  const stats = useMemo(() => {
    const active = giveaways.filter(g => g.isActive).length
    const totalPlayers = players.length
    const totalPlaytime = players.reduce((sum, p) => sum + p.playTime, 0)
    const uniqueServers = new Set(players.map(p => p.server)).size
    return { active, totalPlayers, totalPlaytime, uniqueServers }
  }, [giveaways, players])

  const playersByServer = useMemo(() => {
    return players.reduce((acc, p) => {
      acc[p.server] = (acc[p.server] || 0) + 1
      return acc
    }, {} as Record<string, number>)
  }, [players])

  async function createGiveaway() {
    if (!newName.trim()) return
    setCreating(true)
    setError(null)
    try {
      const body: Record<string, unknown> = {
        name: newName.trim(),
        description: newDescription.trim() || undefined,
        isGlobal: newIsGlobal,
        isActive: false,
        minPlaytimeHours: newMinPlaytime,
        maxWinners: newMaxWinners,
      }
      if (newStartAt) body.startAt = new Date(newStartAt).toISOString()
      if (newEndAt) body.endAt = new Date(newEndAt).toISOString()
      if (!newIsGlobal && newSelectedServers.size > 0) {
        body.serverIdentifiers = Array.from(newSelectedServers)
      }

      const res = await fetch("/api/admin/giveaways", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error((await res.json()).error || "Failed to create giveaway")
      resetCreateForm()
      fetchData()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create giveaway")
    } finally {
      setCreating(false)
    }
  }

  async function toggleGiveaway(giveaway: Giveaway) {
    try {
      const res = await fetch(`/api/admin/giveaways?id=${giveaway.id}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !giveaway.isActive }),
      })
      if (!res.ok) throw new Error("Failed to update giveaway")
      fetchData()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to toggle giveaway")
    }
  }

  async function deleteGiveaway(giveawayId: string) {
    try {
      const res = await fetch(`/api/admin/giveaways?id=${giveawayId}`, {
        method: "DELETE",
        credentials: "include",
      })
      if (!res.ok) throw new Error("Failed to delete giveaway")
      if (selectedGiveaway === giveawayId) setSelectedGiveaway(null)
      fetchData()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete giveaway")
    }
  }

  async function deletePlayer(playerId: string) {
    try {
      const res = await fetch(`/api/admin/giveaways/players?id=${playerId}`, {
        method: "DELETE",
        credentials: "include",
      })
      if (!res.ok) throw new Error("Failed to remove player")
      fetchData()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove player")
    }
  }

  function resetCreateForm() {
    setNewName("")
    setNewDescription("")
    setNewIsGlobal(true)
    setNewMinPlaytime(2)
    setNewMaxWinners(1)
    setNewSelectedServers(new Set())
    setNewStartAt("")
    setNewEndAt("")
    setScopeDropdownOpen(false)
    setShowCreateForm(false)
  }

  function toggleServerSelection(hashedId: string) {
    setNewSelectedServers(prev => {
      const next = new Set(prev)
      if (next.has(hashedId)) next.delete(hashedId)
      else next.add(hashedId)
      return next
    })
  }

  async function saveWinners(giveawayId: string, winnerPlayers: GiveawayPlayer[]) {
    if (winnerPlayers.length === 0) return
    try {
      const primary = winnerPlayers[0]
      await fetch(`/api/admin/giveaways?id=${giveawayId}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          winnerId: primary.id,
          winnerName: primary.playerName,
          winnerSteamId64: primary.playerSteamId64,
          isActive: false,
          endedAt: new Date().toISOString(),
        }),
      })
      // Mark all winners on player records
      await Promise.all(winnerPlayers.map(w =>
        fetch(`/api/admin/giveaways/players?id=${w.id}`, {
          method: "PUT",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isWinner: true }),
        })
      ))
      fetchData()
    } catch { /* best effort */ }
  }

  function pickRandomWinner() {
    if (filteredPlayers.length === 0) return
    setIsPickingWinner(true)
    setWinners([])

    // Determine how many winners to pick
    const activeGiveaway = selectedGiveaway
      ? giveaways.find(g => g.id === selectedGiveaway)
      : giveaways.find(g => g.isActive)
    const numWinners = Math.min(activeGiveaway?.maxWinners ?? 1, filteredPlayers.length)

    // Shuffle and pick winners
    const shuffled = [...filteredPlayers].sort(() => Math.random() - 0.5)
    const pickedWinners = shuffled.slice(0, numWinners)
    const finalWinner = pickedWinners[0]

    const reel: GiveawayPlayer[] = []
    for (let i = 0; i < 49; i++) {
      const rp = filteredPlayers[Math.floor(Math.random() * filteredPlayers.length)]
      reel.push({ ...rp, id: `${rp.id}_${i}` })
    }
    reel.push({ ...finalWinner, id: `${finalWinner.id}_winner` })
    setUnboxingReel(reel)

    const audio = new Audio("/unbox.mp3")
    audio.volume = 0.5
    audio.play().catch(() => {})

    setTimeout(() => {
      if (scrollRef.current) {
        const containerWidth = scrollRef.current.offsetWidth
        const itemWidth = 120
        const centerOffset = containerWidth / 2 - itemWidth / 2
        const finalPosition = (reel.length - 1) * itemWidth - centerOffset
        scrollRef.current.style.transform = `translateX(-${finalPosition}px)`
        scrollRef.current.style.transition = "transform 4s cubic-bezier(0.25, 0.46, 0.45, 0.94)"
      }
    }, 100)

    setTimeout(() => {
      setWinners(pickedWinners)
      setIsPickingWinner(false)
      const giveawayId = selectedGiveaway || finalWinner.giveaway?.id
      if (giveawayId) {
        saveWinners(giveawayId, pickedWinners)
      }
    }, 4500)
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link href="/dashboard" className="p-2.5 rounded-xl transition-all hover:scale-105 bg-[var(--glass-bg)] border border-[var(--glass-border)] hover:border-[var(--glass-border-prominent)]">
            <ArrowLeft className="w-5 h-5 text-[var(--text-secondary)]" />
          </Link>
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-1">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-pink-500/20 to-purple-500/20 border border-pink-500/20">
                <Gift className="h-6 w-6 text-pink-400" />
              </div>
              <h1 className="text-2xl font-bold text-[var(--text-primary)]">Giveaways</h1>
            </div>
            <p className="text-[var(--text-muted)] text-sm ml-[52px]">Manage giveaways, entries, and pick winners</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => fetchData()} disabled={loading} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-[var(--glass-bg)] border border-[var(--glass-border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              <span>Refresh</span>
            </button>
            <button onClick={() => setShowCreateForm(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-sm bg-[var(--accent-primary)] text-white">
              <Plus className="w-4 h-4" />
              <span>New Giveaway</span>
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-6 mb-8">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[var(--glass-bg)] border border-[var(--glass-border)]">
            <div className="p-2 rounded-lg bg-emerald-500/10"><Power className="w-4 h-4 text-emerald-400" /></div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-bold text-emerald-400">{stats.active}</span>
              <span className="text-sm text-[var(--text-muted)]">active</span>
            </div>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[var(--glass-bg)] border border-[var(--glass-border)]">
            <div className="p-2 rounded-lg bg-purple-500/10"><Users className="w-4 h-4 text-purple-400" /></div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-bold text-[var(--text-primary)]">{stats.totalPlayers}</span>
              <span className="text-sm text-[var(--text-muted)]">entries</span>
            </div>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[var(--glass-bg)] border border-[var(--glass-border)]">
            <div className="p-2 rounded-lg bg-blue-500/10"><Clock className="w-4 h-4 text-blue-400" /></div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-bold text-[var(--text-primary)]">{formatTime(stats.totalPlaytime)}</span>
              <span className="text-sm text-[var(--text-muted)]">playtime</span>
            </div>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[var(--glass-bg)] border border-[var(--glass-border)]">
            <div className="p-2 rounded-lg bg-pink-500/10"><Server className="w-4 h-4 text-pink-400" /></div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-bold text-[var(--text-primary)]">{stats.uniqueServers}</span>
              <span className="text-sm text-[var(--text-muted)]">servers</span>
            </div>
          </motion.div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 mb-6 p-1 rounded-xl bg-[var(--glass-bg)] border border-[var(--glass-border)] w-fit">
          <button onClick={() => setTab("giveaways")} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === "giveaways" ? "bg-[var(--accent-primary)] text-white" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`}>
            <span className="flex items-center gap-2"><Gift className="w-4 h-4" />Giveaways</span>
          </button>
          <button onClick={() => setTab("players")} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === "players" ? "bg-[var(--accent-primary)] text-white" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`}>
            <span className="flex items-center gap-2"><Users className="w-4 h-4" />Players ({players.length})</span>
          </button>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl flex items-start gap-3 bg-red-500/10 border border-red-500/30">
            <span className="text-red-400 flex-1">{error}</span>
            <button onClick={() => setError(null)} className="text-red-400 hover:opacity-70 text-sm">Dismiss</button>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-[var(--accent-primary)] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : tab === "giveaways" ? (
          /* Giveaways Tab */
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            {giveaways.length === 0 ? (
              <div className="rounded-2xl p-12 text-center bg-[var(--glass-bg)] border border-[var(--glass-border)]">
                <Gift className="w-12 h-12 mx-auto mb-4 text-[var(--text-muted)] opacity-50" />
                <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">No Giveaways</h3>
                <p className="text-[var(--text-secondary)]">Create your first giveaway to get started.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {giveaways.map((giveaway, idx) => (
                  <motion.div key={giveaway.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 + idx * 0.05 }}>
                    <div className={`group rounded-2xl p-5 transition-all duration-200 bg-[var(--glass-bg)] border hover:shadow-xl hover:shadow-black/10 ${giveaway.isActive ? "border-emerald-500/30 hover:border-emerald-500/50" : "border-[var(--glass-border)] hover:border-[var(--glass-border-prominent)]"}`}>
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className={`relative w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${giveaway.isActive ? "bg-gradient-to-br from-emerald-500/20 to-green-500/20 border border-emerald-500/30" : "bg-[var(--bg-input)] border border-[var(--glass-border)]"}`}>
                            <Gift className={`w-5 h-5 ${giveaway.isActive ? "text-emerald-400" : "text-[var(--text-muted)]"}`} />
                            <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[var(--glass-bg)] ${giveaway.isActive ? "bg-emerald-500" : "bg-gray-500"}`} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <h3 className="font-semibold text-[var(--text-primary)] truncate">{giveaway.name}</h3>
                            {giveaway.description && <p className="text-xs text-[var(--text-muted)] truncate mt-0.5">{giveaway.description}</p>}
                          </div>
                        </div>
                      </div>

                      {/* Giveaway details */}
                      <div className="space-y-2 mb-4">
                        <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                          {giveaway.isGlobal ? (
                            <><Globe className="w-3.5 h-3.5 text-blue-400" /><span className="text-blue-400">All Servers</span></>
                          ) : (
                            <><Server className="w-3.5 h-3.5" /><span>{giveaway.servers.length} server{giveaway.servers.length !== 1 ? "s" : ""}</span></>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-xs text-[var(--text-muted)]">
                          <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" />Min {giveaway.minPlaytimeHours}h</span>
                          {giveaway.maxWinners > 1 && <span className="flex items-center gap-1.5"><Trophy className="w-3.5 h-3.5" />{giveaway.maxWinners} winners</span>}
                        </div>
                        {(giveaway.startAt || giveaway.endAt) && (
                          <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                            <Activity className="w-3.5 h-3.5" />
                            <span>{formatDate(giveaway.startAt)} — {formatDate(giveaway.endAt)}</span>
                          </div>
                        )}
                        {giveaway.winnerName && (
                          <div className="flex items-center gap-2 text-xs">
                            <Trophy className="w-3.5 h-3.5 text-yellow-400" />
                            <span className="text-yellow-400 font-medium">{giveaway.winnerName}</span>
                            {giveaway.winnerSteamId64 && <span className="text-[var(--text-muted)] font-mono text-[10px]">{giveaway.winnerSteamId64}</span>}
                          </div>
                        )}
                        {giveaway.endedAt && !giveaway.winnerName && (
                          <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                            <Trophy className="w-3.5 h-3.5 opacity-50" />
                            <span>Ended — no winner</span>
                          </div>
                        )}
                      </div>

                      {/* Footer */}
                      <div className="flex items-center justify-between pt-3 border-t border-[var(--glass-border)]">
                        <div className="flex items-center gap-3">
                          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg ${(giveaway._count?.players ?? 0) > 0 ? "bg-purple-500/10 text-purple-400" : "bg-[var(--bg-input)] text-[var(--text-muted)]"}`}>
                            <Users className="w-3.5 h-3.5" />
                            <span className="text-sm font-semibold">{giveaway._count?.players ?? 0}</span>
                          </div>
                          <span className={`flex items-center gap-1 text-xs ${giveaway.isActive ? "text-emerald-400" : "text-[var(--text-muted)]"}`}>
                            {giveaway.isActive ? <Power className="w-3 h-3" /> : <PowerOff className="w-3 h-3" />}
                            {giveaway.isActive ? "Active" : "Inactive"}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button onClick={() => { setSelectedGiveaway(giveaway.id); setTab("players") }} className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--accent-primary)] hover:bg-[var(--glass-bg)] transition-colors" title="View players">
                            <Eye className="w-4 h-4" />
                          </button>
                          <button onClick={() => toggleGiveaway(giveaway)} className={`p-1.5 rounded-lg transition-colors ${giveaway.isActive ? "text-emerald-400 hover:text-red-400 hover:bg-red-500/10" : "text-[var(--text-muted)] hover:text-emerald-400 hover:bg-emerald-500/10"}`} title={giveaway.isActive ? "Deactivate" : "Activate"}>
                            {giveaway.isActive ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
                          </button>
                          <button onClick={() => deleteGiveaway(giveaway.id)} className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-red-400 hover:bg-red-500/10 transition-colors" title="Delete">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        ) : (
          /* Players Tab */
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            {/* Players toolbar */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                  <input type="text" placeholder="Search players..." value={search} onChange={e => setSearch(e.target.value)} className="pl-11 pr-4 py-2.5 rounded-xl bg-[var(--glass-bg)] border border-[var(--glass-border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)] transition-colors w-72" />
                </div>
                {selectedGiveaway && (
                  <button onClick={() => { setSelectedGiveaway(null); fetchData() }} className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm bg-purple-500/10 border border-purple-500/20 text-purple-400 hover:bg-purple-500/20 transition-colors">
                    <Filter className="w-3.5 h-3.5" />
                    <span>Filtered</span>
                    <span className="text-purple-300">×</span>
                  </button>
                )}
              </div>
              <button onClick={pickRandomWinner} disabled={filteredPlayers.length === 0 || isPickingWinner} className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm text-white disabled:opacity-50 transition-all bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700">
                <Trophy className={`w-4 h-4 ${isPickingWinner ? "animate-spin" : ""}`} />
                <span>{isPickingWinner ? "Picking..." : "Pick Winner"}</span>
              </button>
            </div>

            {/* Charts row */}
            {Object.keys(playersByServer).length > 0 && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
                <div className="rounded-xl p-5 bg-[var(--glass-bg)] border border-[var(--glass-border)]">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="p-1.5 rounded-lg bg-purple-500/10"><Server className="w-4 h-4 text-purple-400" /></div>
                    <h3 className="text-sm font-semibold text-[var(--text-primary)]">Players by Server</h3>
                  </div>
                  <div className="space-y-3">
                    {Object.entries(playersByServer).sort(([,a], [,b]) => b - a).slice(0, 6).map(([server, count]) => {
                      const total = players.length
                      const pct = total > 0 ? (count / total) * 100 : 0
                      return (
                        <div key={server}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-[var(--text-muted)] truncate max-w-[200px]" title={server}>{server}</span>
                            <span className="text-xs font-semibold text-[var(--text-primary)]">{count}</span>
                          </div>
                          <div className="w-full rounded-full h-1.5 bg-[var(--bg-input)]">
                            <motion.div className="h-1.5 rounded-full bg-gradient-to-r from-purple-500 to-pink-500" initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8, delay: 0.3 }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
                <div className="rounded-xl p-5 bg-[var(--glass-bg)] border border-[var(--glass-border)]">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="p-1.5 rounded-lg bg-blue-500/10"><BarChart3 className="w-4 h-4 text-blue-400" /></div>
                    <h3 className="text-sm font-semibold text-[var(--text-primary)]">Playtime Distribution</h3>
                  </div>
                  <div className="space-y-3">
                    {(() => {
                      const ranges: Record<string, number> = { "0-1h": 0, "1-5h": 0, "5-10h": 0, "10-50h": 0, "50h+": 0 }
                      players.forEach(p => {
                        const h = p.playTime / 3600
                        if (h < 1) ranges["0-1h"]++
                        else if (h < 5) ranges["1-5h"]++
                        else if (h < 10) ranges["5-10h"]++
                        else if (h < 50) ranges["10-50h"]++
                        else ranges["50h+"]++
                      })
                      const total = players.length
                      return Object.entries(ranges).map(([range, count]) => {
                        const pct = total > 0 ? (count / total) * 100 : 0
                        return (
                          <div key={range}>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-[var(--text-muted)]">{range}</span>
                              <span className="text-xs font-semibold text-[var(--text-primary)]">{count}</span>
                            </div>
                            <div className="w-full rounded-full h-1.5 bg-[var(--bg-input)]">
                              <motion.div className="h-1.5 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500" initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8, delay: 0.3 }} />
                            </div>
                          </div>
                        )
                      })
                    })()}
                  </div>
                </div>
              </div>
            )}

            {/* Players table */}
            <div className="rounded-2xl overflow-hidden bg-[var(--glass-bg)] border border-[var(--glass-border)]">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[var(--glass-border)]">
                    <th className="text-left py-3.5 px-5 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Player</th>
                    <th className="text-left py-3.5 px-5 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Steam ID</th>
                    <th className="text-left py-3.5 px-5 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Playtime</th>
                    <th className="text-left py-3.5 px-5 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Server</th>
                    <th className="text-left py-3.5 px-5 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Entered</th>
                    <th className="text-right py-3.5 px-5 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPlayers.map((player, idx) => (
                    <motion.tr key={player.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.02 * idx }} className="border-b border-[var(--glass-border)] last:border-b-0 hover:bg-[var(--glass-bg-prominent)] transition-colors">
                      <td className="py-3 px-5">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0 border-2 border-[var(--glass-border)]">
                            {playerAvatars[player.playerSteamId64] ? (
                              <img src={playerAvatars[player.playerSteamId64]} alt={player.playerName} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-500/30 to-pink-500/30">
                                <User className="w-4 h-4 text-[var(--text-muted)]" />
                              </div>
                            )}
                          </div>
                          <span className="text-sm font-medium text-[var(--text-primary)] truncate max-w-[140px]">{player.playerName}</span>
                        </div>
                      </td>
                      <td className="py-3 px-5"><span className="text-xs font-mono text-[var(--text-muted)]">{player.playerSteamId64}</span></td>
                      <td className="py-3 px-5">
                        <span className="flex items-center gap-1.5 text-sm text-[var(--text-primary)]">
                          <Clock className="w-3.5 h-3.5 text-purple-400" />
                          {formatTime(player.playTime)}
                        </span>
                      </td>
                      <td className="py-3 px-5"><span className="text-xs text-[var(--text-muted)] truncate max-w-[140px] block" title={player.server}>{player.server}</span></td>
                      <td className="py-3 px-5">
                        <div className="text-xs text-[var(--text-muted)]">
                          {new Date(player.createdAt).toLocaleDateString()}
                          <div className="text-[10px] opacity-60">{new Date(player.createdAt).toLocaleTimeString()}</div>
                        </div>
                      </td>
                      <td className="py-3 px-5 text-right">
                        <button onClick={() => deletePlayer(player.id)} className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-red-400 hover:bg-red-500/10 transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
              {filteredPlayers.length === 0 && (
                <div className="text-center py-12">
                  <Users className="w-10 h-10 mx-auto mb-3 text-[var(--text-muted)] opacity-50" />
                  <p className="text-[var(--text-secondary)]">{search ? "No players found matching your search" : "No entries yet"}</p>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* Winner display */}
        {winners.length > 0 && !isPickingWinner && (
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50" onClick={() => setWinners([])}>
            <div className="rounded-2xl p-8 max-w-md w-full bg-[var(--bg-secondary)] border-2 border-purple-500/30" onClick={e => e.stopPropagation()}>
              <div className="text-center">
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", delay: 0.2 }}>
                  <Trophy className="w-12 h-12 mx-auto mb-4 text-yellow-400" />
                </motion.div>
                <h3 className="text-2xl font-bold text-[var(--text-primary)] mb-6">{winners.length > 1 ? "Winners!" : "Winner!"}</h3>
                <div className="space-y-3 mb-6">
                  {winners.map((w, i) => (
                    <motion.div key={w.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + i * 0.15 }} className="rounded-xl p-4 bg-[var(--glass-bg)] border border-purple-500/20">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full overflow-hidden border-3 border-purple-500/50 shrink-0">
                          {playerAvatars[w.playerSteamId64] ? (
                            <img src={playerAvatars[w.playerSteamId64]} alt={w.playerName} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-500/30 to-pink-500/30">
                              <User className="w-5 h-5 text-[var(--text-muted)]" />
                            </div>
                          )}
                        </div>
                        <div className="text-left flex-1 min-w-0">
                          <p className="text-lg font-bold text-[var(--text-primary)] truncate">{w.playerName}</p>
                          <p className="text-xs font-mono text-[var(--text-muted)]">{w.playerSteamId64}</p>
                        </div>
                        <div className="text-sm text-purple-400 flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {formatTime(w.playTime)}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
                <button onClick={() => setWinners([])} className="px-6 py-2.5 rounded-xl font-medium text-sm bg-[var(--glass-bg)] border border-[var(--glass-border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
                  Close
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Picking animation overlay */}
        {isPickingWinner && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center">
            <div className="rounded-2xl p-8 max-w-4xl w-full mx-4 bg-[var(--bg-secondary)] border-2 border-purple-500/30">
              <div className="text-center mb-6">
                <h3 className="text-2xl font-bold text-[var(--text-primary)] mb-1">Selecting Winner...</h3>
                <p className="text-sm text-[var(--text-muted)]">The reel is spinning!</p>
              </div>
              <div className="relative rounded-xl p-6 overflow-hidden bg-[var(--glass-bg)]" style={{ height: "180px" }}>
                <div className="absolute top-0 bottom-0 left-1/2 w-0.5 transform -translate-x-1/2 z-10 bg-purple-500" />
                <div className="absolute top-0 bottom-0 left-0 w-24 z-10 bg-gradient-to-r from-[var(--bg-secondary)] to-transparent" />
                <div className="absolute top-0 bottom-0 right-0 w-24 z-10 bg-gradient-to-l from-[var(--bg-secondary)] to-transparent" />
                <div ref={scrollRef} className="flex items-center gap-4 h-full" style={{ transform: "translateX(0px)", transition: "none" }}>
                  {unboxingReel.map((player, index) => (
                    <div key={`${player.id}-${index}`} className="flex-shrink-0 rounded-xl p-4 text-center bg-[var(--glass-bg)] border border-[var(--glass-border)]" style={{ width: "100px" }}>
                      <div className="w-12 h-12 rounded-full overflow-hidden mx-auto mb-2 border-2 border-purple-500/30">
                        {playerAvatars[player.playerSteamId64] ? (
                          <img src={playerAvatars[player.playerSteamId64]} alt={player.playerName} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-500/30 to-pink-500/30">
                            <User className="w-6 h-6 text-[var(--text-muted)]" />
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-[var(--text-primary)] font-medium truncate">{player.playerName}</p>
                      <p className="text-[10px] text-[var(--text-muted)] flex items-center justify-center gap-0.5 mt-1">
                        <Clock className="w-2.5 h-2.5" />{formatTime(player.playTime)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex justify-center mt-4">
                <span className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
                  <Gift className="w-4 h-4 animate-spin text-purple-400" />Rolling...
                </span>
              </div>
            </div>
          </motion.div>
        )}

        {/* Create giveaway modal */}
        {showCreateForm && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50" onClick={() => resetCreateForm()}>
            <div className="w-full max-w-lg rounded-2xl p-8 bg-[var(--bg-secondary)] border border-[var(--glass-border)]" onClick={e => e.stopPropagation()}>
              <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-6">Create Giveaway</h2>
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Name</label>
                  <input type="text" value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g., February Giveaway" className="w-full px-4 py-3 rounded-xl bg-[var(--bg-input)] border border-[var(--glass-border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)]" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Description (optional)</label>
                  <input type="text" value={newDescription} onChange={e => setNewDescription(e.target.value)} placeholder="Win a VIP package!" className="w-full px-4 py-3 rounded-xl bg-[var(--bg-input)] border border-[var(--glass-border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)]" />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Min Playtime (hours)</label>
                    <input type="number" value={newMinPlaytime} onChange={e => setNewMinPlaytime(Number(e.target.value))} min={0} max={1000} step={0.5} className="w-full px-4 py-3 rounded-xl bg-[var(--bg-input)] border border-[var(--glass-border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Winners</label>
                    <input type="number" value={newMaxWinners} onChange={e => setNewMaxWinners(Number(e.target.value))} min={1} max={100} step={1} className="w-full px-4 py-3 rounded-xl bg-[var(--bg-input)] border border-[var(--glass-border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]" />
                  </div>
                  <div className="relative">
                    <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Scope</label>
                    <button type="button" onClick={() => setScopeDropdownOpen(!scopeDropdownOpen)} className="w-full px-4 py-3 rounded-xl bg-[var(--bg-input)] border border-[var(--glass-border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)] flex items-center justify-between transition-colors">
                      <span className="flex items-center gap-2">
                        {newIsGlobal ? <><Globe className="w-4 h-4 text-blue-400" />All Servers</> : <><Server className="w-4 h-4 text-purple-400" />Specific Servers</>}
                      </span>
                      <ChevronDown className={`w-4 h-4 text-[var(--text-muted)] transition-transform ${scopeDropdownOpen ? "rotate-180" : ""}`} />
                    </button>
                    {scopeDropdownOpen && (
                      <div className="absolute top-full left-0 right-0 mt-1 rounded-xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] shadow-xl shadow-black/20 z-10 overflow-hidden">
                        <button type="button" onClick={() => { setNewIsGlobal(true); setScopeDropdownOpen(false) }} className={`w-full px-4 py-3 flex items-center gap-3 text-left transition-colors ${newIsGlobal ? "bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]" : "text-[var(--text-primary)] hover:bg-[var(--glass-bg)]"}`}>
                          <Globe className="w-4 h-4 text-blue-400" />
                          <div className="flex-1">
                            <div className="text-sm font-medium">All Servers</div>
                            <div className="text-xs text-[var(--text-muted)]">Available on every server</div>
                          </div>
                          {newIsGlobal && <Check className="w-4 h-4 text-[var(--accent-primary)]" />}
                        </button>
                        <div className="border-t border-[var(--glass-border)]" />
                        <button type="button" onClick={() => { setNewIsGlobal(false); setScopeDropdownOpen(false) }} className={`w-full px-4 py-3 flex items-center gap-3 text-left transition-colors ${!newIsGlobal ? "bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]" : "text-[var(--text-primary)] hover:bg-[var(--glass-bg)]"}`}>
                          <Server className="w-4 h-4 text-purple-400" />
                          <div className="flex-1">
                            <div className="text-sm font-medium">Specific Servers</div>
                            <div className="text-xs text-[var(--text-muted)]">Choose which servers</div>
                          </div>
                          {!newIsGlobal && <Check className="w-4 h-4 text-[var(--accent-primary)]" />}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                {!newIsGlobal && (
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                      Servers {newSelectedServers.size > 0 && <span className="text-[var(--accent-primary)]">({newSelectedServers.size} selected)</span>}
                    </label>
                    {availableServers.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {availableServers.filter(s => s.ip && s.port).map(server => {
                          const selected = newSelectedServers.has(server.hashedId)
                          return (
                            <button
                              key={server.id}
                              type="button"
                              onClick={() => toggleServerSelection(server.hashedId)}
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                                selected
                                  ? "bg-[var(--accent-primary)]/15 border-[var(--accent-primary)]/40 text-[var(--accent-primary)]"
                                  : "bg-[var(--bg-input)] border-[var(--glass-border)] text-[var(--text-muted)] hover:border-[var(--glass-border-prominent)] hover:text-[var(--text-primary)]"
                              }`}
                            >
                              {selected ? <Check className="w-3 h-3" /> : <Server className="w-3 h-3" />}
                              <span className="truncate max-w-[160px]">{server.name}</span>
                              {selected && (
                                <X className="w-3 h-3 opacity-60 hover:opacity-100" />
                              )}
                            </button>
                          )
                        })}
                      </div>
                    ) : (
                      <p className="text-xs text-[var(--text-muted)] py-3">No servers found. Make sure ServerID plugin is running on your servers.</p>
                    )}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Start Date (optional)</label>
                    <input type="datetime-local" value={newStartAt} onChange={e => setNewStartAt(e.target.value)} className="w-full px-4 py-3 rounded-xl bg-[var(--bg-input)] border border-[var(--glass-border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">End Date (optional)</label>
                    <input type="datetime-local" value={newEndAt} onChange={e => setNewEndAt(e.target.value)} className="w-full px-4 py-3 rounded-xl bg-[var(--bg-input)] border border-[var(--glass-border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]" />
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-[var(--glass-border)]">
                <button onClick={resetCreateForm} className="px-5 py-2.5 rounded-xl font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]">Cancel</button>
                <button onClick={createGiveaway} disabled={!newName.trim() || creating} className="px-5 py-2.5 rounded-xl font-medium bg-[var(--accent-primary)] text-white disabled:opacity-50">{creating ? "Creating..." : "Create"}</button>
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  )
}
