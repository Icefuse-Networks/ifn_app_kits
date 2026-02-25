'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Target, Server, Globe, ArrowUpDown, Trophy } from 'lucide-react'
import Link from 'next/link'
import { Footer } from '@/components/global/Footer'
import { STAT_COLUMNS } from '@/lib/validations/stats'
import { Dropdown, DropdownOption } from '@/components/ui/Dropdown'
import { SearchInput } from '@/components/ui/SearchInput'
import { Loading } from '@/components/ui/Loading'
import { EmptyState } from '@/components/ui/EmptyState'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { SimplePagination } from '@/components/ui/Pagination'

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

const MEDAL_COLORS = ['text-[var(--status-warning)]', 'text-[var(--text-secondary)]', 'text-[var(--status-warning)]']

export default function PublicStatsPage() {
  const [identifiers, setIdentifiers] = useState<ServerIdentifier[]>([])
  const [categories, setCategories] = useState<IdentifierCategory[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)

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

  const totalPages = meta ? Math.ceil(meta.filteredTotal / limit) : 0
  const currentPage = Math.floor(offset / limit) + 1

  // Create dropdown options from identifiers
  const serverOptions: DropdownOption[] = [
    ...categories.flatMap(category => {
      const categoryServers = identifiers.filter(i => i.categoryId === category.id)
      return categoryServers.map(server => ({
        value: server.id,
        label: server.name,
        description: category.name,
        icon: <Server className="w-4 h-4" /> as React.ReactNode,
      }))
    }),
    ...identifiers
      .filter(i => !i.categoryId)
      .map(server => ({
        value: server.id,
        label: server.name,
        icon: <Server className="w-4 h-4" /> as React.ReactNode,
      }))
  ]

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

        {/* Server Selector */}
        {identifiers.length > 0 && (
          <div className="flex justify-center mb-6">
            <Dropdown
              value={selectedId}
              options={serverOptions}
              onChange={(value) => setSelectedId(value)}
              placeholder="Select Server"
              emptyOption="All Servers (Global)"
              searchable
              clearable
              className="min-w-[240px]"
            />
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
          <SearchInput
            placeholder="Search player or clan..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            onClear={() => setSearch('')}
          />
        </div>

        {/* Error */}
        {error && (
          <Alert variant="error" className="mb-6">
            <div className="flex items-center justify-center gap-4">
              <span>{error}</span>
              <Button variant="outline" size="sm" onClick={() => fetchStats()}>
                Retry
              </Button>
            </div>
          </Alert>
        )}

        {/* Loading */}
        {loading ? (
          <Loading size="lg" text="Loading statistics..." />
        ) : !selectedId ? (
          <EmptyState
            icon={<Server className="w-12 h-12" />}
            title="No Server Selected"
            description="Select a server above to view the leaderboard."
          />
        ) : data.length === 0 ? (
          <EmptyState
            icon={<Target className="w-12 h-12" />}
            title="No Stats Found"
            description="No statistics available for this server."
          />
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
              <div className="flex justify-center p-4" style={{ borderTop: '1px solid var(--glass-border)' }}>
                <SimplePagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={(page) => setOffset((page - 1) * limit)}
                  showPageInfo
                />
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
