'use client'

import { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  ArrowLeft, Server, Users, ChevronRight, Wifi, WifiOff, Plus,
  Folder, ChevronDown, Activity
} from 'lucide-react'
import Link from 'next/link'
import {
  Modal,
  Input,
  Button,
  IconButton,
  SearchInput,
  Loading,
  EmptyState,
  Alert,
  Dropdown
} from "@/components/ui"

interface IdentifierCategory {
  id: string
  name: string
  description: string | null
}

interface ServerIdentifier {
  id: string
  name: string
  hashedId: string
  ip: string | null
  port: number | null
  playerCount: number
  lastPlayerUpdate: string | null
  category: IdentifierCategory | null
}

function formatLastUpdate(dateStr: string | null): string {
  if (!dateStr) return 'Never'
  const diffSec = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (diffSec < 60) return 'Just now'
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`
  return new Date(dateStr).toLocaleDateString()
}

function isOnline(dateStr: string | null): boolean {
  if (!dateStr) return false
  return Date.now() - new Date(dateStr).getTime() < 300000
}

export default function ServersPage() {
  const [servers, setServers] = useState<ServerIdentifier[]>([])
  const [categories, setCategories] = useState<IdentifierCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set())
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newCategoryId, setNewCategoryId] = useState<string | null>(null)

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
      setServers(await serversRes.json())
      setCategories(categoriesRes.ok ? await categoriesRes.json() : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  const liveServers = useMemo(() => servers.filter(s => s.ip && s.port), [servers])

  const filteredServers = useMemo(() => {
    if (!search) return liveServers
    const q = search.toLowerCase()
    return liveServers.filter(s =>
      s.name.toLowerCase().includes(q) ||
      s.ip?.includes(q) ||
      s.id.toLowerCase().includes(q) ||
      s.hashedId.toLowerCase().includes(q) ||
      s.category?.name.toLowerCase().includes(q)
    )
  }, [liveServers, search])

  const groupedByCategory = useMemo(() => {
    return filteredServers.reduce((acc, server) => {
      const key = server.category?.name || 'Uncategorized'
      if (!acc[key]) acc[key] = []
      acc[key].push(server)
      return acc
    }, {} as Record<string, ServerIdentifier[]>)
  }, [filteredServers])

  const stats = useMemo(() => ({
    live: liveServers.length,
    online: liveServers.filter(s => isOnline(s.lastPlayerUpdate)).length,
    players: liveServers.reduce((sum, s) => sum + s.playerCount, 0),
  }), [liveServers])

  async function createServer() {
    if (!newName.trim()) return
    setCreating(true)
    setError(null)
    try {
      const res = await fetch('/api/identifiers', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim() }),
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to create server')
      const newServer = await res.json()
      if (newCategoryId) {
        await fetch(`/api/identifiers/${newServer.id}`, {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ categoryId: newCategoryId }),
        })
      }
      setNewName('')
      setNewCategoryId(null)
      setShowCreateForm(false)
      fetchData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create server')
    } finally {
      setCreating(false)
    }
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
          <Link href="/dashboard">
            <IconButton icon={<ArrowLeft className="w-5 h-5" />} label="Back to dashboard" />
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
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span className="text-xs font-medium text-emerald-400">Live</span>
            </div>
            <Button
              variant="primary"
              onClick={() => setShowCreateForm(true)}
              icon={<Plus className="w-4 h-4" />}
            >
              New Server
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-6 mb-8">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[var(--glass-bg)] border border-[var(--glass-border)]">
            <div className="p-2 rounded-lg bg-emerald-500/10"><Activity className="w-4 h-4 text-emerald-400" /></div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-bold text-emerald-400">{stats.online}</span>
              <span className="text-sm text-[var(--text-muted)]">/ {stats.live} online</span>
            </div>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[var(--glass-bg)] border border-[var(--glass-border)]">
            <div className="p-2 rounded-lg bg-purple-500/10"><Users className="w-4 h-4 text-purple-400" /></div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-bold text-[var(--text-primary)]">{stats.players}</span>
              <span className="text-sm text-[var(--text-muted)]">players</span>
            </div>
          </motion.div>
        </div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="mb-6">
          <SearchInput
            placeholder="Search by name, IP, or ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </motion.div>

        {error && (
          <Alert variant="error" dismissible onDismiss={() => setError(null)} className="mb-6">
            {error}
          </Alert>
        )}

        {loading ? (
          <Loading text="Loading servers..." />
        ) : filteredServers.length === 0 ? (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
            <EmptyState
              icon={<Server className="w-12 h-12" />}
              title={search ? "No Results" : "No Live Servers"}
              description={search ? `No servers match "${search}"` : "Servers will appear here once they connect via the ServerID plugin."}
            />
          </motion.div>
        ) : (
          <div className="space-y-8">
            {Object.entries(groupedByCategory).map(([category, categoryServers], catIndex) => {
              const catId = categories.find(c => c.name === category)?.id || 'uncategorized'
              const isCollapsed = collapsedCategories.has(catId)
              return (
                <motion.div key={category} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 + catIndex * 0.1 }}>
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
                        return (
                          <motion.div key={server.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 + catIndex * 0.1 + idx * 0.03 }}>
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

        <Modal
          isOpen={showCreateForm}
          onClose={() => setShowCreateForm(false)}
          title="Create Server"
          icon={<Server className="w-5 h-5" />}
          footer={
            <>
              <Button variant="secondary" onClick={() => setShowCreateForm(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={createServer}
                disabled={!newName.trim() || creating}
                loading={creating}
                loadingText="Creating..."
              >
                Create
              </Button>
            </>
          }
        >
          <div className="space-y-5">
            <Input
              label="Name"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="e.g., US Main 1"
            />
            <Dropdown
              value={newCategoryId}
              onChange={setNewCategoryId}
              options={categories.map(cat => ({ value: cat.id, label: cat.name }))}
              placeholder="Select category..."
              emptyOption="No category"
            />
          </div>
        </Modal>
      </motion.div>
    </div>
  )
}
