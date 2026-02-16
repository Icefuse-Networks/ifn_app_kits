'use client'

import { useState, useEffect, useCallback } from 'react'
import { Target, Server, ChevronDown, Globe, RefreshCw, Search, ChevronLeft, ChevronRight, ArrowUpDown, Trophy } from 'lucide-react'
import Link from 'next/link'
import { Footer } from '@/components/global/Footer'
import { STAT_COLUMNS } from '@/lib/validations/stats'

// Derive display columns from config
const TABLE_COLUMNS = STAT_COLUMNS.filter(c => c.format !== 'json' && c.sortable)

interface ServerIdentifier {
  id: string
  name: string
  categoryId: string | null
}

interface IdentifierCategory {
  id: string
  name: string
}

interface PlayerRow {
  steamid?: string
  name?: string
  clan?: string
  playtimeFormatted?: string
  member_count?: number
  [key: string]: unknown
}

interface StatsResponse {
  success: boolean
  data: PlayerRow[]
  meta: { total: number; filteredTotal: number; limit: number; offset: number; hasMore: boolean }
}

const MEDAL_COLORS = ['text-yellow-400', 'text-gray-300', 'text-orange-400']

export default function PublicStatsPage() {
  const [identifiers, setIdentifiers] = useState<ServerIdentifier[]>([])
  const [categories, setCategories] = useState<IdentifierCategory[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [dropdownOpen, setDropdownOpen] = useState(false)

  const [timeframe, setTimeframe] = useState('wipe')
  const [view, setView] = useState('players')
  const [sort, setSort] = useState('kills')
  const [order, setOrder] = useState('desc')
  const [search, setSearch] = useState('')
  const [offset, setOffset] = useState(0)
  const [limit] = useState(50)

  const [data, setData] = useState<PlayerRow[]>([])
  const [meta, setMeta] = useState<StatsResponse['meta'] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const selectedIdentifier = identifiers.find(i => i.id === selectedId)

  useEffect(() => {
    fetchIdentifiers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function fetchIdentifiers() {
    try {
      const res = await fetch('/api/public/identifiers')
      if (!res.ok) return
      const json = await res.json()
      setIdentifiers(json.identifiers || [])
      setCategories(json.categories || [])
      // Auto-select first server
      if (json.identifiers?.length > 0) {
        setSelectedId(json.identifiers[0].id)
      }
    } catch {
      // No servers available
    }
  }

  const fetchStats = useCallback(async () => {
    if (!selectedId) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        server_id: selectedId,
        timeframe,
        view,
        sort,
        order,
        limit: String(limit),
        offset: String(offset),
      })
      if (search) params.set('search', search)

      const res = await fetch(`/api/public/stats?${params}`)
      const json: StatsResponse = await res.json()
      if (!json.success) throw new Error('Failed to fetch stats')
      setData(json.data)
      setMeta(json.meta)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      setData([])
      setMeta(null)
    } finally {
      setLoading(false)
    }
  }, [selectedId, timeframe, view, sort, order, limit, offset, search])

  useEffect(() => { fetchStats() }, [fetchStats])
  useEffect(() => { setOffset(0) }, [selectedId, timeframe, view, sort, order, search])

  const handleSort = (col: string) => {
    if (sort === col) {
      setOrder(order === 'desc' ? 'asc' : 'desc')
    } else {
      setSort(col)
      setOrder('desc')
    }
  }

  const handleServerSelect = (id: string | null) => {
    setSelectedId(id)
    setDropdownOpen(false)
  }

  const totalPages = meta ? Math.ceil(meta.filteredTotal / limit) : 0
  const currentPage = Math.floor(offset / limit) + 1

  // Group identifiers by category
  const groupedIdentifiers = (() => {
    const groups: Record<string, ServerIdentifier[]> = { uncategorized: [] }
    categories.forEach(cat => { groups[cat.id] = [] })
    identifiers.forEach(identifier => {
      if (identifier.categoryId && groups[identifier.categoryId]) {
        groups[identifier.categoryId].push(identifier)
      } else {
        groups.uncategorized.push(identifier)
      }
    })
    return groups
  })()

  return (
    <div className="min-h-screen bg-[var(--bg-root)] flex flex-col">
      {/* Header */}
      <header
        className="border-b"
        style={{ background: 'var(--glass-bg)', borderColor: 'var(--glass-border)' }}
      >
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link
            href="/"
            className="text-xl font-bold text-[var(--text-primary)] hover:text-[var(--accent-primary)] transition-colors"
          >
            Icefuse
          </Link>
          <nav className="flex items-center gap-4">
            <Link href="/leaderboards" className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
              Kit Leaderboards
            </Link>
            <span className="text-sm text-[var(--accent-primary)] font-medium">Player Stats</span>
          </nav>
        </div>
      </header>

      <main className="flex-1 max-w-6xl mx-auto px-4 py-8 w-full">
        {/* Page Title */}
        <div className="text-center mb-8">
          <Target className="w-12 h-12 mx-auto mb-4 text-[var(--accent-primary)]" />
          <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-2">
            Player Statistics
          </h1>
          <p className="text-[var(--text-secondary)]">
            {selectedId
              ? `Leaderboard for ${selectedIdentifier?.name || 'selected server'}`
              : 'Select a server to view statistics'}
          </p>
        </div>

        {/* Server Selector (reuses existing identifier pattern) */}
        {identifiers.length > 0 && (
          <div className="flex justify-center mb-6">
            <div className="relative">
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-3 px-4 py-3 rounded-[var(--radius-lg)] min-w-[240px] transition-colors"
                style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}
              >
                {selectedId ? (
                  <>
                    <Server className="w-5 h-5 text-[var(--accent-primary)]" />
                    <span className="flex-1 text-left text-[var(--text-primary)]">
                      {selectedIdentifier?.name || 'Unknown'}
                    </span>
                  </>
                ) : (
                  <>
                    <Globe className="w-5 h-5 text-[var(--accent-primary)]" />
                    <span className="flex-1 text-left text-[var(--text-primary)]">Select Server</span>
                  </>
                )}
                <ChevronDown className={`w-4 h-4 text-[var(--text-muted)] transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {dropdownOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setDropdownOpen(false)} />
                  <div
                    className="absolute top-full left-0 right-0 mt-2 py-2 rounded-[var(--radius-lg)] z-50 max-h-80 overflow-y-auto"
                    style={{ background: 'var(--bg-elevated)', border: '1px solid var(--glass-border)', boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)' }}
                  >
                    {categories.map(category => {
                      const catIds = groupedIdentifiers[category.id] || []
                      if (catIds.length === 0) return null
                      return (
                        <div key={category.id}>
                          <div className="px-4 py-1.5 text-xs font-medium text-[var(--text-muted)] uppercase">{category.name}</div>
                          {catIds.map(identifier => (
                            <button
                              key={identifier.id}
                              onClick={() => handleServerSelect(identifier.id)}
                              className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-[var(--bg-card-hover)] ${selectedId === identifier.id ? 'bg-[var(--accent-primary)]/10' : ''}`}
                            >
                              <Server className="w-4 h-4 text-[var(--text-muted)]" />
                              <span className="text-[var(--text-primary)]">{identifier.name}</span>
                            </button>
                          ))}
                        </div>
                      )
                    })}
                    {groupedIdentifiers.uncategorized.length > 0 && (
                      <div>
                        {categories.length > 0 && <div className="px-4 py-1.5 text-xs font-medium text-[var(--text-muted)] uppercase">Other</div>}
                        {groupedIdentifiers.uncategorized.map(identifier => (
                          <button
                            key={identifier.id}
                            onClick={() => handleServerSelect(identifier.id)}
                            className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-[var(--bg-card-hover)] ${selectedId === identifier.id ? 'bg-[var(--accent-primary)]/10' : ''}`}
                          >
                            <Server className="w-4 h-4 text-[var(--text-muted)]" />
                            <span className="text-[var(--text-primary)]">{identifier.name}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Controls */}
        <div className="flex flex-wrap justify-center gap-3 mb-6">
          {/* Timeframe tabs */}
          <div className="flex rounded-[var(--radius-lg)] overflow-hidden" style={{ border: '1px solid var(--glass-border)' }}>
            {['wipe', 'monthly', 'overall'].map(tf => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`px-4 py-2 text-sm font-medium transition-colors ${timeframe === tf
                  ? 'bg-[var(--accent-primary)] text-white'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
                style={timeframe !== tf ? { background: 'var(--glass-bg)' } : {}}
              >
                {tf.charAt(0).toUpperCase() + tf.slice(1)}
              </button>
            ))}
          </div>

          {/* View tabs */}
          <div className="flex rounded-[var(--radius-lg)] overflow-hidden" style={{ border: '1px solid var(--glass-border)' }}>
            {['players', 'clans'].map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-4 py-2 text-sm font-medium transition-colors ${view === v
                  ? 'bg-[var(--accent-primary)] text-white'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
                style={view !== v ? { background: 'var(--glass-bg)' } : {}}
              >
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative">
            <input
              type="text"
              placeholder="Search player or clan..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 rounded-[var(--radius-lg)] text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none"
              style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}
            />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)]" />
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 rounded-[var(--radius-md)] bg-[var(--status-error)]/10 border border-[var(--status-error)]/30 text-[var(--status-error)] text-center">
            {error}
            <button onClick={() => fetchStats()} className="ml-4 underline hover:no-underline">Retry</button>
          </div>
        )}

        {/* Loading */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="w-8 h-8 text-[var(--accent-primary)] animate-spin" />
          </div>
        ) : !selectedId ? (
          <div className="text-center py-20 text-[var(--text-secondary)]">
            <Server className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Select a server above to view the leaderboard.</p>
          </div>
        ) : data.length === 0 ? (
          <div className="text-center py-20 text-[var(--text-secondary)]">
            <Target className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No stats found for this server.</p>
          </div>
        ) : (
          /* Data Table — config-driven columns */
          <div
            className="rounded-[var(--radius-lg)] overflow-hidden"
            style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}
          >
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--glass-border)' }}>
                    <th className="px-4 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase text-left">#</th>
                    <th className="px-4 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase text-left">
                      {view === 'clans' ? 'Clan' : 'Player'}
                    </th>
                    {TABLE_COLUMNS.map(col => (
                      <th
                        key={col.column}
                        onClick={() => handleSort(col.column)}
                        className="px-4 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase text-right cursor-pointer hover:text-[var(--text-primary)] transition-colors whitespace-nowrap"
                      >
                        <div className="flex items-center justify-end gap-1">
                          {col.label}
                          {sort === col.column && <ArrowUpDown className="h-3 w-3 text-[var(--accent-primary)]" />}
                        </div>
                      </th>
                    ))}
                    {view === 'clans' && (
                      <th
                        onClick={() => handleSort('member_count')}
                        className="px-4 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase text-right cursor-pointer hover:text-[var(--text-primary)] transition-colors"
                      >
                        <div className="flex items-center justify-end gap-1">
                          Members
                          {sort === 'member_count' && <ArrowUpDown className="h-3 w-3 text-[var(--accent-primary)]" />}
                        </div>
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {data.map((row, idx) => {
                    const rank = offset + idx + 1
                    return (
                      <tr
                        key={row.steamid || (row.clan as string) || idx}
                        className="hover:bg-[var(--bg-card-hover)] transition-colors"
                        style={{ borderBottom: '1px solid var(--glass-border)' }}
                      >
                        <td className="px-4 py-3 text-sm">
                          {rank <= 3 ? (
                            <Trophy className={`h-5 w-5 ${MEDAL_COLORS[rank - 1]}`} />
                          ) : (
                            <span className="text-[var(--text-muted)]">{rank}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {view === 'players' ? (
                            <div>
                              <span className="text-[var(--text-primary)] font-medium">{row.name || 'Unknown'}</span>
                              {row.clan && <span className="ml-2 text-xs text-[var(--accent-primary)]">[{row.clan}]</span>}
                            </div>
                          ) : (
                            <span className="text-[var(--text-primary)] font-medium">{row.clan}</span>
                          )}
                        </td>
                        {TABLE_COLUMNS.map(col => (
                          <td key={col.column} className="px-4 py-3 text-sm text-right text-[var(--text-secondary)]">
                            {col.format === 'time'
                              ? String(row.playtimeFormatted || row[col.column] || '')
                              : col.format === 'decimal'
                                ? Number(row[col.column] || 0).toFixed(2)
                                : Number(row[col.column] || 0).toLocaleString()
                            }
                          </td>
                        ))}
                        {view === 'clans' && (
                          <td className="px-4 py-3 text-sm text-right text-[var(--text-secondary)]">
                            {Number(row.member_count || 0).toLocaleString()}
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-center items-center gap-3 p-4" style={{ borderTop: '1px solid var(--glass-border)' }}>
                <button
                  onClick={() => setOffset(Math.max(0, offset - limit))}
                  disabled={offset === 0}
                  className="p-2 rounded-lg transition-colors disabled:opacity-50"
                  style={{ background: 'var(--glass-bg)' }}
                >
                  <ChevronLeft className="h-4 w-4 text-[var(--text-muted)]" />
                </button>
                <span className="text-sm text-[var(--text-secondary)]">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setOffset(offset + limit)}
                  disabled={!meta?.hasMore}
                  className="p-2 rounded-lg transition-colors disabled:opacity-50"
                  style={{ background: 'var(--glass-bg)' }}
                >
                  <ChevronRight className="h-4 w-4 text-[var(--text-muted)]" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Meta info */}
        {meta && !loading && (
          <div className="text-center mt-4 text-xs text-[var(--text-muted)]">
            Showing {data.length} of {meta.filteredTotal.toLocaleString()} results
            {meta.total !== meta.filteredTotal && ` (${meta.total.toLocaleString()} total)`}
          </div>
        )}
      </main>

      <Footer />
    </div>
  )
}
