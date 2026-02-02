'use client'

import { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  ArrowLeft, Server, Users, ChevronRight, Wifi, WifiOff, Search, Plus, Copy, Trash2,
  Check, AlertCircle, Edit3, FolderPlus, Folder, ChevronDown, Settings, Activity
} from 'lucide-react'
import Link from 'next/link'

interface IdentifierCategory {
  id: string
  name: string
  description: string | null
  _count?: { identifiers: number }
}

interface ServerIdentifier {
  id: string
  name: string
  hashedId: string
  description: string | null
  ip: string | null
  port: number | null
  connectEndpoint: string | null
  playerCount: number
  lastPlayerUpdate: string | null
  categoryId: string | null
  createdAt: string
  updatedAt: string
  category: IdentifierCategory | null
  _count?: { usageEvents: number }
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

function isOnline(dateStr: string | null): boolean {
  if (!dateStr) return false
  return Date.now() - new Date(dateStr).getTime() < 300000
}

type TabType = 'monitor' | 'manage'

export default function ServersPage() {
  const [tab, setTab] = useState<TabType>('monitor')
  const [servers, setServers] = useState<ServerIdentifier[]>([])
  const [categories, setCategories] = useState<IdentifierCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const [showCreateForm, setShowCreateForm] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [newCategoryId, setNewCategoryId] = useState<string | null>(null)

  const [showCreateCategoryForm, setShowCreateCategoryForm] = useState(false)
  const [creatingCategory, setCreatingCategory] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [newCategoryDescription, setNewCategoryDescription] = useState('')

  const [editingServer, setEditingServer] = useState<ServerIdentifier | null>(null)
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editCategoryId, setEditCategoryId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 30000)
    return () => clearInterval(interval)
  }, [])

  async function fetchData() {
    try {
      const [serversRes, categoriesRes] = await Promise.all([
        fetch('/api/identifiers', { credentials: 'include' }),
        fetch('/api/identifier-categories', { credentials: 'include' }),
      ])
      if (!serversRes.ok) throw new Error('Failed to fetch servers')
      const [serversData, categoriesData] = await Promise.all([
        serversRes.json(),
        categoriesRes.ok ? categoriesRes.json() : [],
      ])
      setServers(serversData)
      setCategories(categoriesData)
    } catch (err) {
      console.error('Failed to fetch data:', err)
      setError(err instanceof Error ? err.message : 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  const liveServers = useMemo(() => servers.filter(s => s.ip && s.port), [servers])

  const filteredServers = useMemo(() => {
    const list = tab === 'monitor' ? liveServers : servers
    if (!search) return list
    const q = search.toLowerCase()
    return list.filter(s =>
      s.name.toLowerCase().includes(q) ||
      s.ip?.includes(q) ||
      s.hashedId.includes(q) ||
      s.category?.name.toLowerCase().includes(q)
    )
  }, [servers, liveServers, search, tab])

  const groupedByCategory = useMemo(() => {
    return filteredServers.reduce((acc, server) => {
      const key = server.category?.name || 'Uncategorized'
      if (!acc[key]) acc[key] = []
      acc[key].push(server)
      return acc
    }, {} as Record<string, ServerIdentifier[]>)
  }, [filteredServers])

  const stats = useMemo(() => ({
    total: servers.length,
    live: liveServers.length,
    online: liveServers.filter(s => isOnline(s.lastPlayerUpdate)).length,
    players: liveServers.reduce((sum, s) => sum + s.playerCount, 0),
  }), [servers, liveServers])

  async function createServer() {
    if (!newName.trim()) return
    setCreating(true)
    setError(null)
    try {
      const res = await fetch('/api/identifiers', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim(), description: newDescription.trim() || undefined }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to create server')
      }
      const newServer = await res.json()
      if (newCategoryId) {
        const updateRes = await fetch(`/api/identifiers/${newServer.id}`, {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ categoryId: newCategoryId }),
        })
        if (updateRes.ok) {
          const updated = await updateRes.json()
          setServers(prev => [updated, ...prev])
        } else {
          setServers(prev => [{ ...newServer, playerCount: 0, lastPlayerUpdate: null, _count: { usageEvents: 0 } }, ...prev])
        }
      } else {
        setServers(prev => [{ ...newServer, playerCount: 0, lastPlayerUpdate: null, _count: { usageEvents: 0 } }, ...prev])
      }
      setNewName('')
      setNewDescription('')
      setNewCategoryId(null)
      setShowCreateForm(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create server')
    } finally {
      setCreating(false)
    }
  }

  async function createCategory() {
    if (!newCategoryName.trim()) return
    setCreatingCategory(true)
    setError(null)
    try {
      const res = await fetch('/api/identifier-categories', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCategoryName.trim(), description: newCategoryDescription.trim() || undefined }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to create category')
      }
      const newCat = await res.json()
      setCategories(prev => [...prev, { ...newCat, _count: { identifiers: 0 } }])
      setNewCategoryName('')
      setNewCategoryDescription('')
      setShowCreateCategoryForm(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create category')
    } finally {
      setCreatingCategory(false)
    }
  }

  async function updateServer() {
    if (!editingServer) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/identifiers/${editingServer.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName.trim() || undefined, description: editDescription.trim() || null, categoryId: editCategoryId }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to update server')
      }
      const updated = await res.json()
      setServers(prev => prev.map(s => s.id === updated.id ? { ...s, ...updated } : s))
      setEditingServer(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update server')
    } finally {
      setSaving(false)
    }
  }

  async function deleteServer(id: string) {
    try {
      const res = await fetch(`/api/identifiers/${id}`, { method: 'DELETE', credentials: 'include' })
      if (!res.ok) throw new Error('Failed to delete server')
      setServers(prev => prev.filter(s => s.id !== id))
      setDeleteConfirm(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete server')
    }
  }

  async function copyHashedId(hashedId: string) {
    try {
      await navigator.clipboard.writeText(hashedId)
      setCopiedId(hashedId)
      setTimeout(() => setCopiedId(null), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  function openEditServer(server: ServerIdentifier) {
    setEditingServer(server)
    setEditName(server.name)
    setEditDescription(server.description || '')
    setEditCategoryId(server.categoryId)
  }

  function toggleCategoryCollapse(categoryId: string) {
    setCollapsedCategories(prev => {
      const next = new Set(prev)
      next.has(categoryId) ? next.delete(categoryId) : next.add(categoryId)
      return next
    })
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div className="flex items-center gap-4 mb-8">
          <Link href="/dashboard" className="p-2.5 rounded-xl transition-all hover:scale-105 bg-[var(--glass-bg)] border border-[var(--glass-border)] hover:border-[var(--glass-border-prominent)]">
            <ArrowLeft className="w-5 h-5 text-[var(--text-secondary)]" />
          </Link>
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-1">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-violet-500/20 to-purple-500/20 border border-violet-500/20">
                <Server className="h-6 w-6 text-violet-400" />
              </div>
              <h1 className="text-2xl font-bold text-[var(--text-primary)]">Servers</h1>
            </div>
            <p className="text-[var(--text-muted)] text-sm ml-[52px]">Monitor and manage your game servers</p>
          </div>
          {tab === 'monitor' && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span className="text-xs font-medium text-emerald-400">Live</span>
            </div>
          )}
          {tab === 'manage' && (
            <div className="flex items-center gap-2">
              <button onClick={() => setShowCreateCategoryForm(true)} className="flex items-center gap-2 px-3 py-2 rounded-xl font-medium text-sm transition-colors bg-[var(--glass-bg)] border border-[var(--glass-border)] text-[var(--text-primary)] hover:border-[var(--glass-border-prominent)]">
                <FolderPlus className="w-4 h-4" />
                <span className="hidden sm:inline">Category</span>
              </button>
              <button onClick={() => setShowCreateForm(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-sm transition-colors bg-[var(--accent-primary)] text-white">
                <Plus className="w-4 h-4" />
                <span>New Server</span>
              </button>
            </div>
          )}
        </div>

        <div className="flex gap-2 mb-6 p-1 rounded-xl bg-[var(--glass-bg)] border border-[var(--glass-border)] w-fit">
          <button onClick={() => setTab('monitor')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === 'monitor' ? 'bg-[var(--accent-primary)] text-white' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}>
            <Activity className="w-4 h-4" />
            Live Monitor
          </button>
          <button onClick={() => setTab('manage')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === 'manage' ? 'bg-[var(--accent-primary)] text-white' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}>
            <Settings className="w-4 h-4" />
            Manage
          </button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="p-5 rounded-2xl bg-[var(--glass-bg)] border border-[var(--glass-border)]">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-blue-500/10"><Server className="w-4 h-4 text-blue-400" /></div>
              <span className="text-sm text-[var(--text-muted)]">Total</span>
            </div>
            <div className="text-3xl font-bold text-[var(--text-primary)]">{stats.total}</div>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="p-5 rounded-2xl bg-[var(--glass-bg)] border border-[var(--glass-border)]">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-violet-500/10"><Wifi className="w-4 h-4 text-violet-400" /></div>
              <span className="text-sm text-[var(--text-muted)]">Connected</span>
            </div>
            <div className="text-3xl font-bold text-[var(--text-primary)]">{stats.live}</div>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="p-5 rounded-2xl bg-[var(--glass-bg)] border border-[var(--glass-border)]">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-emerald-500/10"><Activity className="w-4 h-4 text-emerald-400" /></div>
              <span className="text-sm text-[var(--text-muted)]">Online</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-emerald-400">{stats.online}</span>
              <span className="text-sm text-[var(--text-muted)]">/ {stats.live}</span>
            </div>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="p-5 rounded-2xl bg-[var(--glass-bg)] border border-[var(--glass-border)]">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-purple-500/10"><Users className="w-4 h-4 text-purple-400" /></div>
              <span className="text-sm text-[var(--text-muted)]">Players</span>
            </div>
            <div className="text-3xl font-bold text-[var(--text-primary)]">{stats.players}</div>
          </motion.div>
        </div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="mb-6">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
            <input type="text" placeholder="Search servers..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-11 pr-4 py-3 rounded-xl bg-[var(--glass-bg)] border border-[var(--glass-border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)] transition-colors" />
          </div>
        </motion.div>

        {error && (
          <div className="mb-6 p-4 rounded-xl flex items-start gap-3 bg-red-500/10 border border-red-500/30">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <p className="text-red-400 flex-1">{error}</p>
            <button onClick={() => setError(null)} className="text-red-400 hover:opacity-70 text-sm">Dismiss</button>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-[var(--accent-primary)] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredServers.length === 0 ? (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="rounded-2xl p-12 text-center bg-[var(--glass-bg)] border border-[var(--glass-border)]">
            {search ? (
              <>
                <Search className="w-12 h-12 mx-auto mb-4 text-[var(--text-muted)] opacity-50" />
                <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">No Results</h3>
                <p className="text-[var(--text-secondary)]">No servers match &quot;{search}&quot;</p>
              </>
            ) : tab === 'monitor' ? (
              <>
                <Server className="w-12 h-12 mx-auto mb-4 text-[var(--text-muted)] opacity-50" />
                <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">No Live Servers</h3>
                <p className="text-[var(--text-secondary)]">Servers will appear here once they connect via the ServerID plugin.</p>
              </>
            ) : (
              <>
                <Server className="w-12 h-12 mx-auto mb-4 text-[var(--text-muted)] opacity-50" />
                <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">No Servers</h3>
                <p className="text-[var(--text-secondary)] mb-6">Create your first server identifier to start tracking analytics.</p>
                <button onClick={() => setShowCreateForm(true)} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl font-medium bg-[var(--accent-primary)] text-white">
                  <Plus className="w-4 h-4" />
                  <span>Create Server</span>
                </button>
              </>
            )}
          </motion.div>
        ) : (
          <div className="space-y-8">
            {Object.entries(groupedByCategory).map(([category, categoryServers], catIndex) => {
              const catId = categories.find(c => c.name === category)?.id || 'uncategorized'
              const isCollapsed = collapsedCategories.has(catId)
              return (
                <motion.div key={category} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 + catIndex * 0.1 }}>
                  <div className="flex items-center gap-3 mb-4 cursor-pointer" onClick={() => toggleCategoryCollapse(catId)}>
                    <button className="p-0.5">
                      {isCollapsed ? <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" /> : <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />}
                    </button>
                    <Folder className="w-4 h-4 text-[var(--accent-primary)]" />
                    <h2 className="text-sm font-semibold text-[var(--text-primary)] uppercase tracking-wider">{category}</h2>
                    <div className="flex-1 h-px bg-[var(--glass-border)]" />
                    <span className="text-xs text-[var(--text-muted)] bg-[var(--glass-bg)] px-2 py-1 rounded-full border border-[var(--glass-border)]">
                      {categoryServers.length} server{categoryServers.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  {!isCollapsed && (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                      {categoryServers.map((server, idx) => {
                        const online = isOnline(server.lastPlayerUpdate)
                        const hasConnection = server.ip && server.port
                        return (
                          <motion.div key={server.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 + catIndex * 0.1 + idx * 0.03 }}>
                            {tab === 'monitor' ? (
                              <Link href={`/dashboard/servers/${server.id}`} className="group block rounded-2xl p-5 transition-all duration-200 bg-[var(--glass-bg)] border border-[var(--glass-border)] hover:border-[var(--glass-border-prominent)] hover:bg-[var(--glass-bg-prominent)] hover:shadow-xl hover:shadow-black/10">
                                <div className="flex items-start justify-between mb-4">
                                  <div className="flex items-center gap-3 flex-1 min-w-0">
                                    <div className={`relative w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${online ? 'bg-gradient-to-br from-emerald-500/20 to-green-500/20 border border-emerald-500/30' : 'bg-[var(--bg-input)] border border-[var(--glass-border)]'}`}>
                                      <Server className={`w-5 h-5 ${online ? 'text-emerald-400' : 'text-[var(--text-muted)]'}`} />
                                      <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[var(--glass-bg)] ${online ? 'bg-emerald-500' : 'bg-gray-500'}`} />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <h3 className="font-semibold text-[var(--text-primary)] truncate group-hover:text-[var(--accent-primary)] transition-colors">{server.name}</h3>
                                      <p className="text-xs text-[var(--text-muted)] font-mono">{server.ip}:{server.port}</p>
                                    </div>
                                  </div>
                                  <ChevronRight className="w-5 h-5 text-[var(--text-muted)] group-hover:text-[var(--accent-primary)] group-hover:translate-x-1 transition-all shrink-0" />
                                </div>
                                <div className="flex items-center justify-between pt-3 border-t border-[var(--glass-border)]">
                                  <div className="flex items-center gap-3">
                                    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg ${server.playerCount > 0 ? 'bg-blue-500/10 text-blue-400' : 'bg-[var(--bg-input)] text-[var(--text-muted)]'}`}>
                                      <Users className="w-3.5 h-3.5" />
                                      <span className="text-sm font-semibold">{server.playerCount}</span>
                                    </div>
                                    <span className={`flex items-center gap-1 text-xs ${online ? 'text-emerald-400' : 'text-[var(--text-muted)]'}`}>
                                      {online ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                                      {online ? 'Online' : 'Offline'}
                                    </span>
                                  </div>
                                  <span className="text-xs text-[var(--text-muted)]">{formatLastUpdate(server.lastPlayerUpdate)}</span>
                                </div>
                              </Link>
                            ) : (
                              <div className="rounded-2xl p-5 bg-[var(--glass-bg)] border border-[var(--glass-border)]">
                                <div className="flex items-start justify-between mb-3">
                                  <div className="flex items-center gap-3 flex-1 min-w-0">
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${hasConnection ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-[var(--bg-input)] border border-[var(--glass-border)]'}`}>
                                      <Server className={`w-5 h-5 ${hasConnection ? 'text-emerald-400' : 'text-[var(--text-muted)]'}`} />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <h3 className="font-semibold text-[var(--text-primary)] truncate">{server.name}</h3>
                                      {server.description && <p className="text-xs text-[var(--text-muted)] truncate">{server.description}</p>}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <button onClick={() => openEditServer(server)} className="p-2 rounded-lg hover:bg-[var(--bg-card-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
                                      <Edit3 className="w-4 h-4" />
                                    </button>
                                    {deleteConfirm === server.id ? (
                                      <>
                                        <button onClick={() => deleteServer(server.id)} className="px-2 py-1 rounded-lg text-xs font-medium bg-red-500 text-white">Delete</button>
                                        <button onClick={() => setDeleteConfirm(null)} className="px-2 py-1 rounded-lg text-xs font-medium text-[var(--text-muted)]">Cancel</button>
                                      </>
                                    ) : (
                                      <button onClick={() => setDeleteConfirm(server.id)} className="p-2 rounded-lg hover:bg-red-500/10 text-[var(--text-muted)] hover:text-red-400 transition-colors">
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    )}
                                  </div>
                                </div>
                                {hasConnection && (
                                  <div className="flex items-center gap-2 mb-3 text-xs">
                                    <span className="px-2 py-1 rounded-lg bg-[var(--bg-input)] text-[var(--text-secondary)] font-mono">{server.ip}:{server.port}</span>
                                    {online && <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-medium">{server.playerCount} players</span>}
                                  </div>
                                )}
                                <div className="flex items-center gap-2">
                                  <code className="flex-1 px-3 py-2 rounded-lg text-xs font-mono bg-[var(--bg-input)] text-[var(--accent-primary)] truncate">{server.hashedId}</code>
                                  <button onClick={() => copyHashedId(server.hashedId)} className="p-2 rounded-lg hover:bg-[var(--bg-card-hover)] transition-colors" title="Copy ID">
                                    {copiedId === server.hashedId ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-[var(--text-muted)]" />}
                                  </button>
                                </div>
                                <p className="text-xs text-[var(--text-muted)] mt-3">Created {new Date(server.createdAt).toLocaleDateString()}</p>
                              </div>
                            )}
                          </motion.div>
                        )
                      })}
                    </div>
                  )}
                </motion.div>
              )
            })}
          </div>
        )}

        {showCreateForm && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50" onClick={() => setShowCreateForm(false)}>
            <div className="w-full max-w-md rounded-2xl p-8 bg-[var(--bg-secondary)] border border-[var(--glass-border)]" onClick={e => e.stopPropagation()}>
              <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-6">Create Server</h2>
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Name</label>
                  <input type="text" value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g., US Main 1" className="w-full px-4 py-3 rounded-xl bg-[var(--bg-input)] border border-[var(--glass-border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)]" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Description (optional)</label>
                  <input type="text" value={newDescription} onChange={e => setNewDescription(e.target.value)} placeholder="e.g., Primary US server" className="w-full px-4 py-3 rounded-xl bg-[var(--bg-input)] border border-[var(--glass-border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)]" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Category (optional)</label>
                  <select value={newCategoryId || ''} onChange={e => setNewCategoryId(e.target.value || null)} className="w-full px-4 py-3 rounded-xl bg-[var(--bg-input)] border border-[var(--glass-border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]">
                    <option value="">No category</option>
                    {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-[var(--glass-border)]">
                <button onClick={() => setShowCreateForm(false)} className="px-5 py-2.5 rounded-xl font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]">Cancel</button>
                <button onClick={createServer} disabled={!newName.trim() || creating} className="px-5 py-2.5 rounded-xl font-medium bg-[var(--accent-primary)] text-white disabled:opacity-50">{creating ? 'Creating...' : 'Create'}</button>
              </div>
            </div>
          </div>
        )}

        {showCreateCategoryForm && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50" onClick={() => setShowCreateCategoryForm(false)}>
            <div className="w-full max-w-md rounded-2xl p-8 bg-[var(--bg-secondary)] border border-[var(--glass-border)]" onClick={e => e.stopPropagation()}>
              <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-6">Create Category</h2>
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Name</label>
                  <input type="text" value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} placeholder="e.g., Production Servers" className="w-full px-4 py-3 rounded-xl bg-[var(--bg-input)] border border-[var(--glass-border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)]" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Description (optional)</label>
                  <input type="text" value={newCategoryDescription} onChange={e => setNewCategoryDescription(e.target.value)} placeholder="e.g., Live game servers" className="w-full px-4 py-3 rounded-xl bg-[var(--bg-input)] border border-[var(--glass-border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)]" />
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-[var(--glass-border)]">
                <button onClick={() => setShowCreateCategoryForm(false)} className="px-5 py-2.5 rounded-xl font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]">Cancel</button>
                <button onClick={createCategory} disabled={!newCategoryName.trim() || creatingCategory} className="px-5 py-2.5 rounded-xl font-medium bg-[var(--accent-primary)] text-white disabled:opacity-50">{creatingCategory ? 'Creating...' : 'Create'}</button>
              </div>
            </div>
          </div>
        )}

        {editingServer && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50" onClick={() => setEditingServer(null)}>
            <div className="w-full max-w-md rounded-2xl p-8 bg-[var(--bg-secondary)] border border-[var(--glass-border)]" onClick={e => e.stopPropagation()}>
              <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-6">Edit Server</h2>
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Name</label>
                  <input type="text" value={editName} onChange={e => setEditName(e.target.value)} className="w-full px-4 py-3 rounded-xl bg-[var(--bg-input)] border border-[var(--glass-border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Description</label>
                  <input type="text" value={editDescription} onChange={e => setEditDescription(e.target.value)} placeholder="Optional" className="w-full px-4 py-3 rounded-xl bg-[var(--bg-input)] border border-[var(--glass-border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)]" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Category</label>
                  <select value={editCategoryId || ''} onChange={e => setEditCategoryId(e.target.value || null)} className="w-full px-4 py-3 rounded-xl bg-[var(--bg-input)] border border-[var(--glass-border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]">
                    <option value="">No category</option>
                    {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-[var(--glass-border)]">
                <button onClick={() => setEditingServer(null)} className="px-5 py-2.5 rounded-xl font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]">Cancel</button>
                <button onClick={updateServer} disabled={saving} className="px-5 py-2.5 rounded-xl font-medium bg-[var(--accent-primary)] text-white disabled:opacity-50">{saving ? 'Saving...' : 'Save'}</button>
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  )
}
