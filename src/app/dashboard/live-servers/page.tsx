'use client'

import { useState, useEffect } from 'react'
import { ArrowLeft, Server, Users, Clock, Activity, X, ChevronRight } from 'lucide-react'
import Link from 'next/link'

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
  ip: string | null
  port: number | null
  connectEndpoint: string | null
  playerData: PlayerData[] | null
  playerCount: number
  lastPlayerUpdate: string | null
  categoryId: string | null
  category: { id: string; name: string } | null
}

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

export default function LiveServersPage() {
  const [servers, setServers] = useState<ServerIdentifier[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedServer, setSelectedServer] = useState<ServerIdentifier | null>(null)

  useEffect(() => {
    fetchServers()
    const interval = setInterval(fetchServers, 30000)
    return () => clearInterval(interval)
  }, [])

  async function fetchServers() {
    try {
      const res = await fetch('/api/identifiers', { credentials: 'include' })
      if (!res.ok) throw new Error('Failed to fetch')
      const data = await res.json()
      setServers(data.filter((s: ServerIdentifier) => s.ip && s.port))
    } catch (err) {
      console.error('Failed to fetch servers:', err)
    } finally {
      setLoading(false)
    }
  }

  const groupedByCategory = servers.reduce((acc, server) => {
    const key = server.category?.name || 'Uncategorized'
    if (!acc[key]) acc[key] = []
    acc[key].push(server)
    return acc
  }, {} as Record<string, ServerIdentifier[]>)

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      <div className="flex items-center gap-4 mb-8">
        <Link
          href="/dashboard"
          className="p-2 rounded-lg transition-colors hover:bg-[var(--bg-card-hover)]"
          style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}
        >
          <ArrowLeft className="w-5 h-5 text-[var(--text-secondary)]" />
        </Link>
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-1">Live Server Monitor</h1>
          <p className="text-[var(--text-secondary)]">
            Real-time player data from plugin-connected servers
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
          <Activity className="w-4 h-4" />
          <span>Auto-refresh: 30s</span>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-[var(--accent-primary)] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : servers.length === 0 ? (
        <div
          className="rounded-xl p-12 text-center"
          style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}
        >
          <Server className="w-12 h-12 mx-auto mb-4 text-[var(--text-muted)]" />
          <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">No Servers Found</h3>
          <p className="text-[var(--text-secondary)]">
            Servers with IP and port will appear here once they register via the ServerID plugin.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(groupedByCategory).map(([category, categoryServers]) => (
            <div key={category}>
              <h2 className="text-sm font-medium text-[var(--text-muted)] mb-4 px-1">
                {category} ({categoryServers.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {categoryServers.map((server) => (
                  <div
                    key={server.id}
                    onClick={() => setSelectedServer(server)}
                    className="rounded-xl p-5 cursor-pointer transition-all hover:scale-[1.02] hover:shadow-lg"
                    style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-lg flex items-center justify-center"
                          style={{ background: server.playerCount > 0 ? 'rgba(34, 197, 94, 0.2)' : 'rgba(107, 114, 128, 0.2)' }}
                        >
                          <Server
                            className="w-5 h-5"
                            style={{ color: server.playerCount > 0 ? 'rgb(34, 197, 94)' : 'var(--text-muted)' }}
                          />
                        </div>
                        <div>
                          <h3 className="font-semibold text-[var(--text-primary)] line-clamp-1">
                            {server.name}
                          </h3>
                          <p className="text-xs text-[var(--text-muted)]">
                            {server.ip}:{server.port}
                          </p>
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-[var(--text-muted)]" />
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-[var(--accent-primary)]" />
                        <span className="text-lg font-bold text-[var(--text-primary)]">
                          {server.playerCount}
                        </span>
                        <span className="text-sm text-[var(--text-muted)]">players</span>
                      </div>
                      <div className="flex-1" />
                      <span className="text-xs text-[var(--text-muted)]">
                        {formatLastUpdate(server.lastPlayerUpdate)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedServer && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50"
          onClick={() => setSelectedServer(null)}
        >
          <div
            className="w-full max-w-2xl max-h-[80vh] rounded-xl overflow-hidden flex flex-col"
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-6 border-b border-[var(--glass-border)]">
              <div>
                <h2 className="text-xl font-semibold text-[var(--text-primary)]">
                  {selectedServer.name}
                </h2>
                <p className="text-sm text-[var(--text-muted)]">
                  {selectedServer.ip}:{selectedServer.port}
                  {selectedServer.connectEndpoint && ` • connect ${selectedServer.connectEndpoint}`}
                </p>
              </div>
              <button
                onClick={() => setSelectedServer(null)}
                className="p-2 rounded-lg hover:bg-[var(--bg-card-hover)] text-[var(--text-muted)]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {!selectedServer.playerData || selectedServer.playerData.length === 0 ? (
                <div className="text-center py-12 text-[var(--text-muted)]">
                  <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No players online</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="grid grid-cols-12 gap-2 px-4 py-2 text-xs font-medium text-[var(--text-muted)] uppercase">
                    <div className="col-span-5">Player</div>
                    <div className="col-span-3">Steam ID</div>
                    <div className="col-span-2 text-right">Connected</div>
                    <div className="col-span-2 text-right">Idle</div>
                  </div>
                  {selectedServer.playerData.map((player, idx) => (
                    <div
                      key={player.steamId}
                      className="grid grid-cols-12 gap-2 px-4 py-3 rounded-lg items-center"
                      style={{ background: idx % 2 === 0 ? 'var(--bg-input)' : 'transparent' }}
                    >
                      <div className="col-span-5 font-medium text-[var(--text-primary)] truncate">
                        {player.playerName}
                      </div>
                      <div className="col-span-3 text-sm text-[var(--text-secondary)] font-mono">
                        {player.steamId}
                      </div>
                      <div className="col-span-2 text-right text-sm text-[var(--text-secondary)]">
                        <div className="flex items-center justify-end gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDuration(player.connectionTime)}
                        </div>
                      </div>
                      <div className="col-span-2 text-right text-sm">
                        <span
                          className="px-2 py-0.5 rounded text-xs font-medium"
                          style={{
                            background: player.idleTime > 300 ? 'rgba(239, 68, 68, 0.2)' : player.idleTime > 60 ? 'rgba(234, 179, 8, 0.2)' : 'rgba(34, 197, 94, 0.2)',
                            color: player.idleTime > 300 ? 'rgb(239, 68, 68)' : player.idleTime > 60 ? 'rgb(234, 179, 8)' : 'rgb(34, 197, 94)',
                          }}
                        >
                          {formatDuration(player.idleTime)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-[var(--glass-border)] text-xs text-[var(--text-muted)] text-center">
              Last updated: {formatLastUpdate(selectedServer.lastPlayerUpdate)}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
