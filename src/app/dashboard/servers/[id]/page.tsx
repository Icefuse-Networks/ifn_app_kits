'use client'

import { useState, useEffect, use, useCallback } from 'react'
import { ArrowLeft, Users, Clock, Activity, Copy, Check, Globe, Terminal, Settings, BarChart2, ArrowRightLeft, X, CheckSquare, Square, Edit3, Trash2, Calendar, Plus, AlertTriangle, CheckCircle, XCircle, Timer } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Dropdown } from '@/components/ui/Dropdown'

interface IdentifierCategory {
  id: string
  name: string
  description: string | null
}

interface PlayerData {
  steamId: string
  playerName: string
  connectionTime: number
  idleTime: number
}

interface ServerIdentifier {
  id: string
  name: string
  hashedId: string
  description: string | null
  ip: string | null
  port: number | null
  connectEndpoint: string | null
  playerData: PlayerData[] | null
  playerCount: number
  lastPlayerUpdate: string | null
  categoryId: string | null
  category: { id: string; name: string } | null
  createdAt: string
  updatedAt: string
}

interface ServerOption {
  id: string
  name: string
  hashedId: string
  ip: string | null
  port: number | null
  playerCount: number
}

interface WipeSchedule {
  id: string
  serverIdentifierId: string
  dayOfWeek: number
  hour: number
  minute: number
  wipeType: string
  createdAt: string
}

interface QueueItem {
  id: string
  steamId: string
  playerName: string | null
  status: string
  failureReason: string | null
  createdAt: string
  processedAt: string | null
}

interface RedirectLogEntry {
  id: string
  logType: string
  playerName: string | null
  steamId: string | null
  redirectReason: string
  outcome: string | null
  failureReason: string | null
  sourceName: string | null
  targetName: string | null
  sourceIdentifier: string
  targetIdentifier: string | null
  timestamp: string
}

const DAYS_OF_WEEK = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
const WIPE_TYPES = [
  { value: "regular", label: "Regular" },
  { value: "force", label: "Force Wipe" },
  { value: "bp", label: "BP Wipe" }
]

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
  const hours = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
}

function formatLastUpdate(dateStr: string | null): string {
  if (!dateStr) return 'Never'
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  if (diffSec < 60) return 'Just now'
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`
  return date.toLocaleDateString()
}

export default function ServerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: serverId } = use(params)
  const router = useRouter()
  const [server, setServer] = useState<ServerIdentifier | null>(null)
  const [categories, setCategories] = useState<IdentifierCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState<string | null>(null)
  const [selectedPlayers, setSelectedPlayers] = useState<Set<string>>(new Set())
  const [redirectModalOpen, setRedirectModalOpen] = useState(false)
  const [redirectTarget, setRedirectTarget] = useState<string | null>(null)
  const [availableServers, setAvailableServers] = useState<ServerOption[]>([])
  const [redirecting, setRedirecting] = useState(false)
  const [redirectMode, setRedirectMode] = useState<'single' | 'multi' | 'all'>('single')
  const [redirectReason, setRedirectReason] = useState<string>('Admin Redirect')
  const [singlePlayerTarget, setSinglePlayerTarget] = useState<PlayerData | null>(null)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editCategoryId, setEditCategoryId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [wipeSchedules, setWipeSchedules] = useState<WipeSchedule[]>([])
  const [newSchedule, setNewSchedule] = useState({ dayOfWeek: 4, hour: 14, minute: 0, wipeType: "regular" })
  const [addingSchedule, setAddingSchedule] = useState(false)

  // Redirect-all confirmation
  const [redirectAllConfirmText, setRedirectAllConfirmText] = useState('')

  // Pending redirects & history
  const [pendingQueue, setPendingQueue] = useState<QueueItem[]>([])
  const [recentHistory, setRecentHistory] = useState<RedirectLogEntry[]>([])

  const fetchServer = useCallback(async () => {
    try {
      const res = await fetch(`/api/identifiers/${serverId}`, { credentials: 'include' })
      if (!res.ok) throw new Error('Failed to fetch')
      const data = await res.json()
      setServer(data)
    } catch (err) {
      console.error('Failed to fetch server:', err)
    } finally {
      setLoading(false)
    }
  }, [serverId])

  const fetchWipeSchedules = useCallback(async () => {
    try {
      const res = await fetch(`/api/redirect/wipe-schedules?serverId=${serverId}`, { credentials: 'include' })
      const data = await res.json()
      if (data.success) setWipeSchedules(data.data)
    } catch (err) {
      console.error('Failed to fetch wipe schedules:', err)
    }
  }, [serverId])

  const fetchPendingQueue = useCallback(async () => {
    if (!server?.hashedId) return
    try {
      const res = await fetch(`/api/identifiers/redirect-queue?serverId=${server.hashedId}`, { credentials: 'include' })
      const data = await res.json()
      if (data.success && data.data?.redirects) {
        setPendingQueue(data.data.redirects.map((r: { id: string; steamId: string; playerName: string | null }) => ({
          id: r.id,
          steamId: r.steamId,
          playerName: r.playerName,
          status: 'pending',
          failureReason: null,
          createdAt: new Date().toISOString(),
          processedAt: null,
        })))
      } else {
        setPendingQueue([])
      }
    } catch (err) {
      console.error('Failed to fetch pending queue:', err)
    }
  }, [server?.hashedId])

  const fetchRecentHistory = useCallback(async () => {
    if (!server?.hashedId) return
    try {
      const res = await fetch(`/api/redirect/logs?sourceIdentifier=${server.hashedId}&limit=10&page=1`, { credentials: 'include' })
      const data = await res.json()
      if (data.success) setRecentHistory(data.data || [])
    } catch (err) {
      console.error('Failed to fetch history:', err)
    }
  }, [server?.hashedId])

  useEffect(() => {
    fetchServer()
    fetchWipeSchedules()
    fetch('/api/identifier-categories', { credentials: 'include' })
      .then(res => res.ok ? res.json() : [])
      .then(setCategories)
      .catch(() => setCategories([]))
    const interval = setInterval(fetchServer, 30000)
    return () => clearInterval(interval)
  }, [fetchServer, fetchWipeSchedules])

  useEffect(() => {
    if (server?.hashedId) {
      fetchPendingQueue()
      fetchRecentHistory()
      const queueInterval = setInterval(() => {
        fetchPendingQueue()
        fetchRecentHistory()
      }, 5000)
      return () => clearInterval(queueInterval)
    }
  }, [server?.hashedId, fetchPendingQueue, fetchRecentHistory])

  useEffect(() => {
    if (redirectModalOpen) {
      fetch('/api/identifiers', { credentials: 'include' })
        .then(res => res.json())
        .then((data: ServerOption[]) => {
          setAvailableServers(data.filter(s => s.hashedId !== server?.hashedId))
        })
        .catch(() => setAvailableServers([]))
    }
  }, [redirectModalOpen, server?.hashedId])

  async function cancelRedirect(queueId: string) {
    try {
      const res = await fetch('/api/identifiers/redirect-queue', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ids: [queueId] }),
      })
      if (res.ok) {
        setPendingQueue(prev => prev.filter(q => q.id !== queueId))
      }
    } catch (err) {
      console.error('Failed to cancel redirect:', err)
    }
  }

  function copyToClipboard(text: string, key: string) {
    navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  function togglePlayerSelection(steamId: string) {
    setSelectedPlayers(prev => {
      const next = new Set(prev)
      if (next.has(steamId)) next.delete(steamId)
      else next.add(steamId)
      return next
    })
  }

  function selectAllPlayers() {
    if (!server?.playerData) return
    setSelectedPlayers(new Set(server.playerData.map(p => p.steamId)))
  }

  function deselectAllPlayers() {
    setSelectedPlayers(new Set())
  }

  function openRedirectModal(mode: 'single' | 'multi' | 'all', player?: PlayerData) {
    setRedirectMode(mode)
    setSinglePlayerTarget(player || null)
    setRedirectTarget(null)
    setRedirectAllConfirmText('')
    setRedirectModalOpen(true)
  }

  function openEditModal() {
    if (!server) return
    setEditName(server.name)
    setEditDescription(server.description || '')
    setEditCategoryId(server.categoryId)
    setEditModalOpen(true)
  }

  async function saveServer() {
    if (!server) return
    setSaving(true)
    try {
      const res = await fetch(`/api/identifiers/${server.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName.trim() || undefined,
          description: editDescription.trim() || null,
          categoryId: editCategoryId,
        }),
      })
      if (res.ok) {
        const updated = await res.json()
        setServer(prev => prev ? { ...prev, ...updated } : null)
        setEditModalOpen(false)
      }
    } catch (err) {
      console.error('Failed to save:', err)
    } finally {
      setSaving(false)
    }
  }

  async function deleteServer() {
    if (!server) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/identifiers/${server.id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (res.ok) {
        router.push('/dashboard/servers')
      }
    } catch (err) {
      console.error('Failed to delete:', err)
    } finally {
      setDeleting(false)
    }
  }

  async function addWipeSchedule() {
    if (!server) return
    setAddingSchedule(true)
    try {
      const res = await fetch('/api/redirect/wipe-schedules', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serverIdentifierId: server.id,
          ...newSchedule
        })
      })
      const data = await res.json()
      if (data.success) {
        setWipeSchedules(prev => [...prev, data.data])
      }
    } catch (err) {
      console.error('Failed to add schedule:', err)
    } finally {
      setAddingSchedule(false)
    }
  }

  async function deleteWipeSchedule(scheduleId: string) {
    try {
      const res = await fetch('/api/redirect/wipe-schedules', {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: scheduleId })
      })
      if (res.ok) {
        setWipeSchedules(prev => prev.filter(s => s.id !== scheduleId))
      }
    } catch (err) {
      console.error('Failed to delete schedule:', err)
    }
  }

  async function executeRedirect() {
    if (!server || !redirectTarget) return

    // Block redirect-all unless confirmation typed
    if (redirectMode === 'all' && redirectAllConfirmText !== 'REDIRECT') return

    let players: { steamId: string; playerName?: string }[] = []
    if (redirectMode === 'single' && singlePlayerTarget) {
      players = [{ steamId: singlePlayerTarget.steamId, playerName: singlePlayerTarget.playerName }]
    } else if (redirectMode === 'multi') {
      players = Array.from(selectedPlayers).map(steamId => {
        const p = server.playerData?.find(pl => pl.steamId === steamId)
        return { steamId, playerName: p?.playerName }
      })
    } else if (redirectMode === 'all' && server.playerData) {
      players = server.playerData.map(p => ({ steamId: p.steamId, playerName: p.playerName }))
    }

    if (players.length === 0) return

    setRedirecting(true)
    try {
      const res = await fetch('/api/identifiers/redirect-queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          sourceServerId: server.hashedId,
          targetServerId: redirectTarget,
          reason: redirectReason,
          players,
        }),
      })

      if (res.ok) {
        setRedirectModalOpen(false)
        setSelectedPlayers(new Set())
        setRedirectAllConfirmText('')
        setRedirectReason('Admin Redirect')
        // Refresh queue
        fetchPendingQueue()
      }
    } catch (err) {
      console.error('Redirect failed:', err)
    } finally {
      setRedirecting(false)
    }
  }

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-[var(--accent-primary)] border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  if (!server) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="flex items-center gap-4 mb-8">
          <Link
            href="/dashboard/servers"
            className="p-2 rounded-lg transition-colors hover:bg-[var(--bg-card-hover)]"
            style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}
          >
            <ArrowLeft className="w-5 h-5 text-[var(--text-secondary)]" />
          </Link>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Server Not Found</h1>
        </div>
      </div>
    )
  }

  const isOnline = server.lastPlayerUpdate && (Date.now() - new Date(server.lastPlayerUpdate).getTime()) < 300000

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      <div className="flex items-center gap-4 mb-8">
        <Link
          href="/dashboard/servers"
          className="p-2 rounded-lg transition-colors hover:bg-[var(--bg-card-hover)]"
          style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}
        >
          <ArrowLeft className="w-5 h-5 text-[var(--text-secondary)]" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">{server.name}</h1>
            <span
              className="px-2 py-1 rounded-full text-xs font-medium"
              style={{
                background: isOnline ? 'rgba(34, 197, 94, 0.2)' : 'rgba(107, 114, 128, 0.2)',
                color: isOnline ? 'rgb(34, 197, 94)' : 'var(--text-muted)',
              }}
            >
              {isOnline ? 'Online' : 'Offline'}
            </span>
          </div>
          <p className="text-[var(--text-secondary)]">
            {server.category?.name || 'Uncategorized'} • Last update: {formatLastUpdate(server.lastPlayerUpdate)}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={openEditModal}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}
          >
            <Edit3 className="w-4 h-4 text-[var(--text-muted)]" />
            <span className="text-[var(--text-secondary)]">Edit</span>
          </button>
          {deleteConfirm ? (
            <div className="flex items-center gap-2">
              <button
                onClick={deleteServer}
                disabled={deleting}
                className="px-3 py-2 rounded-lg text-sm font-medium bg-red-500 text-white"
              >
                {deleting ? 'Deleting...' : 'Confirm'}
              </button>
              <button
                onClick={() => setDeleteConfirm(false)}
                className="px-3 py-2 rounded-lg text-sm font-medium text-[var(--text-muted)]"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setDeleteConfirm(true)}
              className="p-2 rounded-lg transition-colors hover:bg-red-500/10"
              title="Delete server"
            >
              <Trash2 className="w-4 h-4 text-[var(--text-muted)] hover:text-red-400" />
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div
          className="rounded-xl p-6"
          style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-blue-500/20">
              <Users className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-[var(--text-muted)]">Players Online</p>
              <p className="text-2xl font-bold text-[var(--text-primary)]">{server.playerCount}</p>
            </div>
          </div>
        </div>

        <div
          className="rounded-xl p-6"
          style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-emerald-500/20">
              <Globe className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-sm text-[var(--text-muted)]">Server Address</p>
              <p className="text-lg font-semibold text-[var(--text-primary)]">
                {server.ip}:{server.port}
              </p>
            </div>
          </div>
          <button
            onClick={() => copyToClipboard(`${server.ip}:${server.port}`, 'ip')}
            className="flex items-center gap-2 text-sm text-[var(--accent-primary)] hover:underline"
          >
            {copied === 'ip' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied === 'ip' ? 'Copied!' : 'Copy IP'}
          </button>
        </div>

        <div
          className="rounded-xl p-6"
          style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-purple-500/20">
              <Terminal className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <p className="text-sm text-[var(--text-muted)]">Connect Command</p>
              <p className="text-sm font-mono text-[var(--text-primary)] truncate">
                client.connect {server.connectEndpoint || `${server.ip}:${server.port}`}
              </p>
            </div>
          </div>
          <button
            onClick={() => copyToClipboard(`client.connect ${server.connectEndpoint || `${server.ip}:${server.port}`}`, 'connect')}
            className="flex items-center gap-2 text-sm text-[var(--accent-primary)] hover:underline"
          >
            {copied === 'connect' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied === 'connect' ? 'Copied!' : 'Copy Command'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div
          className="rounded-xl p-6"
          style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}
        >
          <div className="flex items-center gap-3 mb-2">
            <Settings className="w-5 h-5 text-[var(--text-muted)]" />
            <p className="text-sm font-medium text-[var(--text-primary)]">Server ID</p>
          </div>
          <p className="text-xs font-mono text-[var(--text-secondary)] break-all">{server.hashedId}</p>
        </div>

        <div
          className="rounded-xl p-6"
          style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}
        >
          <div className="flex items-center gap-3 mb-2">
            <Clock className="w-5 h-5 text-[var(--text-muted)]" />
            <p className="text-sm font-medium text-[var(--text-primary)]">Created</p>
          </div>
          <p className="text-sm text-[var(--text-secondary)]">{new Date(server.createdAt).toLocaleString()}</p>
        </div>

        <div
          className="rounded-xl p-6"
          style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}
        >
          <div className="flex items-center gap-3 mb-2">
            <BarChart2 className="w-5 h-5 text-[var(--text-muted)]" />
            <p className="text-sm font-medium text-[var(--text-primary)]">Category</p>
          </div>
          <p className="text-sm text-[var(--text-secondary)]">{server.category?.name || 'Uncategorized'}</p>
        </div>
      </div>

      {/* Pending Redirects */}
      {pendingQueue.length > 0 && (
        <div
          className="rounded-xl overflow-hidden mb-8"
          style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}
        >
          <div className="px-6 py-4 border-b border-[var(--glass-border)]">
            <div className="flex items-center gap-2">
              <Timer className="w-5 h-5 text-yellow-400" />
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">Pending Redirects</h2>
              <span
                className="px-2 py-0.5 rounded-full text-xs font-medium"
                style={{ background: 'rgba(234, 179, 8, 0.2)', color: 'rgb(234, 179, 8)' }}
              >
                {pendingQueue.length}
              </span>
            </div>
            <p className="text-sm text-[var(--text-muted)]">Queued redirects waiting to be processed by the plugin</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--glass-border)]">
                  <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-muted)] uppercase">Player</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-muted)] uppercase">Steam ID</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-muted)] uppercase">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-[var(--text-muted)] uppercase">Queued</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-[var(--text-muted)] uppercase"></th>
                </tr>
              </thead>
              <tbody>
                {pendingQueue.map((item) => (
                  <tr key={item.id} className="border-b border-[var(--glass-border)] last:border-0">
                    <td className="px-4 py-3 font-medium text-[var(--text-primary)]">{item.playerName || 'Unknown'}</td>
                    <td className="px-4 py-3 text-sm font-mono text-[var(--text-secondary)]">{item.steamId}</td>
                    <td className="px-4 py-3">
                      <span
                        className="px-2 py-0.5 rounded text-xs font-medium"
                        style={{
                          background: item.status === 'pending' ? 'rgba(234, 179, 8, 0.2)' :
                            item.status === 'completed' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                          color: item.status === 'pending' ? 'rgb(234, 179, 8)' :
                            item.status === 'completed' ? 'rgb(34, 197, 94)' : 'rgb(248, 113, 113)',
                        }}
                      >
                        {item.status}
                      </span>
                      {item.failureReason && (
                        <div className="text-xs text-red-400 mt-1">{item.failureReason}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-[var(--text-muted)]">
                      {formatLastUpdate(item.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {item.status === 'pending' && (
                        <button
                          onClick={() => cancelRedirect(item.id)}
                          className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors"
                          title="Cancel redirect"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Online Players */}
      <div
        className="rounded-xl overflow-hidden mb-8"
        style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}
      >
        <div className="px-6 py-4 border-b border-[var(--glass-border)] flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">Online Players</h2>
            <p className="text-sm text-[var(--text-muted)]">{server.playerCount} players currently connected</p>
          </div>
          {server.playerData && server.playerData.length > 0 && (
            <div className="flex items-center gap-2">
              {selectedPlayers.size > 0 && (
                <button
                  onClick={() => openRedirectModal('multi')}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                  style={{ background: 'rgba(59, 130, 246, 0.2)', color: 'rgb(96, 165, 250)' }}
                >
                  <ArrowRightLeft className="w-4 h-4" />
                  Redirect Selected ({selectedPlayers.size})
                </button>
              )}
              <button
                onClick={() => openRedirectModal('all')}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                style={{ background: 'rgba(239, 68, 68, 0.2)', color: 'rgb(248, 113, 113)' }}
              >
                <ArrowRightLeft className="w-4 h-4" />
                Redirect All
              </button>
            </div>
          )}
        </div>

        {!server.playerData || server.playerData.length === 0 ? (
          <div className="text-center py-12 text-[var(--text-muted)]">
            <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No players online</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--glass-border)]">
                  <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-muted)] uppercase w-10">
                    <button
                      onClick={selectedPlayers.size === server.playerData.length ? deselectAllPlayers : selectAllPlayers}
                      className="p-1 hover:bg-[var(--bg-card-hover)] rounded"
                    >
                      {selectedPlayers.size === server.playerData.length ? (
                        <CheckSquare className="w-4 h-4 text-[var(--accent-primary)]" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-muted)] uppercase">Player</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-muted)] uppercase">Steam ID</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-[var(--text-muted)] uppercase">Connected</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-[var(--text-muted)] uppercase">Idle</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-[var(--text-muted)] uppercase w-20">Actions</th>
                </tr>
              </thead>
              <tbody>
                {server.playerData.map((player, idx) => (
                  <tr
                    key={player.steamId}
                    className="border-b border-[var(--glass-border)] last:border-0"
                    style={{ background: idx % 2 === 0 ? 'var(--bg-input)' : 'transparent' }}
                  >
                    <td className="px-4 py-4">
                      <button
                        onClick={() => togglePlayerSelection(player.steamId)}
                        className="p-1 hover:bg-[var(--bg-card-hover)] rounded"
                      >
                        {selectedPlayers.has(player.steamId) ? (
                          <CheckSquare className="w-4 h-4 text-[var(--accent-primary)]" />
                        ) : (
                          <Square className="w-4 h-4 text-[var(--text-muted)]" />
                        )}
                      </button>
                    </td>
                    <td className="px-4 py-4 font-medium text-[var(--text-primary)]">{player.playerName}</td>
                    <td className="px-4 py-4 text-sm text-[var(--text-secondary)] font-mono">{player.steamId}</td>
                    <td className="px-4 py-4 text-right text-sm text-[var(--text-secondary)]">
                      <div className="flex items-center justify-end gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDuration(player.connectionTime)}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <span
                        className="px-2 py-1 rounded text-xs font-medium"
                        style={{
                          background: player.idleTime > 300 ? 'rgba(239, 68, 68, 0.2)' : player.idleTime > 60 ? 'rgba(234, 179, 8, 0.2)' : 'rgba(34, 197, 94, 0.2)',
                          color: player.idleTime > 300 ? 'rgb(239, 68, 68)' : player.idleTime > 60 ? 'rgb(234, 179, 8)' : 'rgb(34, 197, 94)',
                        }}
                      >
                        {formatDuration(player.idleTime)}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <button
                        onClick={() => openRedirectModal('single', player)}
                        className="p-2 rounded-lg transition-colors hover:bg-[var(--bg-card-hover)]"
                        title="Redirect player"
                      >
                        <ArrowRightLeft className="w-4 h-4 text-[var(--text-muted)]" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recent Redirect History */}
      {recentHistory.length > 0 && (
        <div
          className="rounded-xl overflow-hidden mb-8"
          style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}
        >
          <div className="px-6 py-4 border-b border-[var(--glass-border)]">
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-purple-400" />
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">Recent Redirect History</h2>
            </div>
            <p className="text-sm text-[var(--text-muted)]">Last 10 redirects from this server</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--glass-border)]">
                  <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-muted)] uppercase">Player</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-muted)] uppercase">Reason</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-muted)] uppercase">Outcome</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-muted)] uppercase">Target</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-[var(--text-muted)] uppercase">Time</th>
                </tr>
              </thead>
              <tbody>
                {recentHistory.map((log) => (
                  <tr key={log.id} className="border-b border-[var(--glass-border)] last:border-0 hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3">
                      {log.playerName ? (
                        <div>
                          <div className="font-medium text-[var(--text-primary)]">{log.playerName}</div>
                          <div className="text-xs text-[var(--text-muted)]">{log.steamId}</div>
                        </div>
                      ) : (
                        <span className="text-[var(--text-muted)]">{log.logType === 'wipe' ? 'All players' : 'Unknown'}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="px-2 py-0.5 rounded text-xs font-medium"
                        style={{
                          background: log.redirectReason === 'AFK_TIMEOUT' ? 'rgba(234, 179, 8, 0.2)' :
                            log.redirectReason.includes('WIPE') ? 'rgba(239, 68, 68, 0.2)' : 'rgba(59, 130, 246, 0.2)',
                          color: log.redirectReason === 'AFK_TIMEOUT' ? 'rgb(234, 179, 8)' :
                            log.redirectReason.includes('WIPE') ? 'rgb(248, 113, 113)' : 'rgb(96, 165, 250)',
                        }}
                      >
                        {log.redirectReason}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {log.outcome ? (
                        <div className="flex items-center gap-1">
                          {log.outcome === 'success' ? (
                            <CheckCircle className="w-4 h-4 text-green-400" />
                          ) : log.outcome === 'failed' ? (
                            <XCircle className="w-4 h-4 text-red-400" />
                          ) : (
                            <AlertTriangle className="w-4 h-4 text-yellow-400" />
                          )}
                          <span
                            className="text-xs font-medium"
                            style={{
                              color: log.outcome === 'success' ? 'rgb(34, 197, 94)' :
                                log.outcome === 'failed' ? 'rgb(248, 113, 113)' : 'rgb(234, 179, 8)',
                            }}
                          >
                            {log.outcome}
                          </span>
                          {log.failureReason && (
                            <span className="text-xs text-red-400 ml-1" title={log.failureReason}>
                              ({log.failureReason.length > 20 ? log.failureReason.slice(0, 18) + '...' : log.failureReason})
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-[var(--text-muted)]">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-[var(--text-secondary)]">
                      {log.targetName || log.targetIdentifier || '-'}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-[var(--text-muted)]">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Redirect Modal */}
      {redirectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
          <div
            className="w-full max-w-md rounded-xl p-6"
            style={{ background: '#1a1a2e', border: '1px solid var(--glass-border)' }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-[var(--text-primary)]">
                {redirectMode === 'single' && singlePlayerTarget
                  ? `Redirect ${singlePlayerTarget.playerName}`
                  : redirectMode === 'multi'
                    ? `Redirect ${selectedPlayers.size} Players`
                    : `Redirect All ${server?.playerCount || 0} Players`}
              </h3>
              <button
                onClick={() => setRedirectModalOpen(false)}
                className="p-1 rounded hover:bg-[var(--bg-card-hover)]"
              >
                <X className="w-5 h-5 text-[var(--text-muted)]" />
              </button>
            </div>

            {redirectMode === 'all' && (
              <div className="mb-4 p-3 rounded-lg" style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                  <span className="text-sm font-medium text-red-400">This will redirect ALL players</span>
                </div>
                <p className="text-xs text-[var(--text-muted)] mb-2">
                  Type <span className="font-mono font-bold text-red-400">REDIRECT</span> to confirm
                </p>
                <input
                  type="text"
                  value={redirectAllConfirmText}
                  onChange={(e) => setRedirectAllConfirmText(e.target.value)}
                  placeholder="Type REDIRECT to confirm"
                  className="w-full px-3 py-2 rounded-lg text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none"
                  style={{ background: 'var(--bg-input)', border: '1px solid var(--glass-border)' }}
                />
              </div>
            )}

            <div className="mb-4">
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                Select Target Server
              </label>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {availableServers.length === 0 ? (
                  <p className="text-sm text-[var(--text-muted)] py-4 text-center">No other servers available</p>
                ) : (
                  availableServers.map(s => (
                    <button
                      key={s.hashedId}
                      onClick={() => setRedirectTarget(s.hashedId)}
                      className="w-full p-3 rounded-lg text-left transition-colors"
                      style={{
                        background: redirectTarget === s.hashedId ? 'rgba(59, 130, 246, 0.2)' : 'var(--bg-input)',
                        border: redirectTarget === s.hashedId ? '1px solid rgb(59, 130, 246)' : '1px solid transparent',
                      }}
                    >
                      <div className="font-medium text-[var(--text-primary)]">{s.name}</div>
                      <div className="text-xs text-[var(--text-muted)]">
                        {s.ip}:{s.port} • {s.playerCount} players
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                Reason
              </label>
              <select
                value={redirectReason}
                onChange={(e) => setRedirectReason(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm text-[var(--text-primary)] focus:outline-none appearance-none"
                style={{ background: 'var(--bg-input)', border: '1px solid var(--glass-border)' }}
              >
                <option value="Admin Redirect">Admin Redirect</option>
                <option value="Server Maintenance">Server Maintenance</option>
                <option value="Server Wipe">Server Wipe</option>
                <option value="Population Balance">Population Balance</option>
                <option value="Event">Event</option>
                <option value="Testing">Testing</option>
              </select>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setRedirectModalOpen(false)}
                className="flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                style={{ background: 'var(--bg-input)', color: 'var(--text-secondary)' }}
              >
                Cancel
              </button>
              <button
                onClick={executeRedirect}
                disabled={!redirectTarget || redirecting || (redirectMode === 'all' && redirectAllConfirmText !== 'REDIRECT')}
                className="flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                style={{ background: 'var(--accent-primary)', color: 'white' }}
              >
                {redirecting ? 'Redirecting...' : 'Confirm Redirect'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={() => setEditModalOpen(false)}>
          <div
            className="w-full max-w-xl rounded-xl p-6 max-h-[90vh] overflow-y-auto"
            style={{ background: '#1a1a2e', border: '1px solid var(--glass-border)' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-[var(--text-primary)]">Edit Server</h3>
              <button onClick={() => setEditModalOpen(false)} className="p-1 rounded hover:bg-[var(--bg-card-hover)]">
                <X className="w-5 h-5 text-[var(--text-muted)]" />
              </button>
            </div>
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)]"
                  style={{ background: 'var(--bg-input)', border: '1px solid var(--glass-border)' }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Description</label>
                <input
                  type="text"
                  value={editDescription}
                  onChange={e => setEditDescription(e.target.value)}
                  placeholder="Optional"
                  className="w-full px-4 py-3 rounded-xl text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)]"
                  style={{ background: 'var(--bg-input)', border: '1px solid var(--glass-border)' }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Category</label>
                <Dropdown
                  value={editCategoryId}
                  onChange={value => setEditCategoryId(value)}
                  options={categories.map(cat => ({ value: cat.id, label: cat.name }))}
                  emptyOption="No category"
                  clearable
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Server ID</label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 px-3 py-2 rounded-lg text-xs font-mono truncate" style={{ background: 'var(--bg-input)', color: 'var(--accent-primary)' }}>
                    {server?.hashedId}
                  </code>
                  <button
                    onClick={() => server && copyToClipboard(server.hashedId, 'hashedId')}
                    className="p-2 rounded-lg hover:bg-[var(--bg-card-hover)]"
                  >
                    {copied === 'hashedId' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-[var(--text-muted)]" />}
                  </button>
                </div>
              </div>
              <div className="pt-4 border-t border-[var(--glass-border)]">
                <div className="flex items-center gap-2 mb-3">
                  <Calendar className="w-4 h-4 text-orange-400" />
                  <label className="text-sm font-medium text-[var(--text-secondary)]">Wipe Schedule (EST/EDT)</label>
                </div>
                {wipeSchedules.length === 0 ? (
                  <p className="text-xs text-[var(--text-muted)] mb-3">No wipe schedules configured</p>
                ) : (
                  <div className="space-y-2 mb-3">
                    {wipeSchedules.map((schedule) => (
                      <div key={schedule.id} className="flex items-center justify-between p-2 rounded-lg" style={{ background: 'var(--bg-input)' }}>
                        <div className="flex items-center gap-2">
                          <span
                            className="px-2 py-0.5 rounded text-xs font-medium"
                            style={{
                              background: schedule.wipeType === "force" ? 'rgba(239, 68, 68, 0.2)' : schedule.wipeType === "bp" ? 'rgba(168, 85, 247, 0.2)' : 'rgba(59, 130, 246, 0.2)',
                              color: schedule.wipeType === "force" ? 'rgb(248, 113, 113)' : schedule.wipeType === "bp" ? 'rgb(192, 132, 252)' : 'rgb(96, 165, 250)',
                            }}
                          >
                            {WIPE_TYPES.find(t => t.value === schedule.wipeType)?.label || schedule.wipeType}
                          </span>
                          <span className="text-xs text-[var(--text-primary)]">
                            {DAYS_OF_WEEK[schedule.dayOfWeek]} {String(schedule.hour).padStart(2, "0")}:{String(schedule.minute).padStart(2, "0")}
                          </span>
                        </div>
                        <button
                          onClick={() => deleteWipeSchedule(schedule.id)}
                          className="p-1 rounded hover:bg-red-500/10"
                        >
                          <Trash2 className="w-3 h-3 text-[var(--text-muted)] hover:text-red-400" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  <Dropdown
                    value={String(newSchedule.dayOfWeek)}
                    onChange={(value) => setNewSchedule({ ...newSchedule, dayOfWeek: parseInt(value ?? '0') })}
                    options={DAYS_OF_WEEK.map((day, i) => ({ value: String(i), label: day }))}
                  />
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min={0}
                      max={23}
                      value={newSchedule.hour}
                      onChange={(e) => setNewSchedule({ ...newSchedule, hour: parseInt(e.target.value) || 0 })}
                      className="w-12 px-2 py-1.5 rounded-lg text-xs text-center text-[var(--text-primary)]"
                      style={{ background: 'var(--bg-input)', border: '1px solid var(--glass-border)' }}
                    />
                    <span className="text-[var(--text-muted)]">:</span>
                    <input
                      type="number"
                      min={0}
                      max={59}
                      value={newSchedule.minute}
                      onChange={(e) => setNewSchedule({ ...newSchedule, minute: parseInt(e.target.value) || 0 })}
                      className="w-12 px-2 py-1.5 rounded-lg text-xs text-center text-[var(--text-primary)]"
                      style={{ background: 'var(--bg-input)', border: '1px solid var(--glass-border)' }}
                    />
                  </div>
                  <Dropdown
                    value={newSchedule.wipeType}
                    onChange={(value) => setNewSchedule({ ...newSchedule, wipeType: value ?? '' })}
                    options={WIPE_TYPES.map((t) => ({ value: t.value, label: t.label }))}
                  />
                  <button
                    onClick={addWipeSchedule}
                    disabled={addingSchedule}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                    style={{ background: 'var(--accent-primary)', color: 'white' }}
                  >
                    <Plus className="w-3 h-3" />
                    {addingSchedule ? 'Adding...' : 'Add'}
                  </button>
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setEditModalOpen(false)}
                className="flex-1 px-4 py-2 rounded-lg text-sm font-medium"
                style={{ background: 'var(--bg-input)', color: 'var(--text-secondary)' }}
              >
                Cancel
              </button>
              <button
                onClick={saveServer}
                disabled={saving}
                className="flex-1 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
                style={{ background: 'var(--accent-primary)', color: 'white' }}
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
