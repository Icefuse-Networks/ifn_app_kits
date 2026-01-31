/**
 * Public Leaderboards Page
 *
 * Public-facing page showing kit statistics.
 * Supports global view and per-server filtering.
 * No authentication required.
 */

'use client'

import { useState, useEffect, useCallback } from 'react'
import { Trophy, TrendingUp, Server, Clock, RefreshCw, ChevronDown, Globe, Users } from 'lucide-react'
import Link from 'next/link'
import { Footer } from '@/components/global/Footer'

// Types
interface KitStats {
  kitName: string
  totalRedemptions: number
  uniquePlayers: number
  lastRedeemed: string | null
}

interface IdentifierStats {
  identifierId: string
  identifierName: string
  totalRedemptions: number
  uniquePlayers: number
}

interface PlayerStats {
  steamId: string
  playerName: string | null
  totalRedemptions: number
  uniqueKits: number
  lastRedeemed: string | null
}

interface HeatMapData {
  data: number[][]
  peak: {
    dayName: string
    hourOfDay: number
    count: number
  }
}

interface ServerIdentifier {
  id: string
  name: string
  categoryId: string | null
}

interface IdentifierCategory {
  id: string
  name: string
}

export default function LeaderboardsPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [topKits, setTopKits] = useState<KitStats[]>([])
  const [identifierLeaderboard, setIdentifierLeaderboard] = useState<IdentifierStats[]>([])
  const [heatMap, setHeatMap] = useState<HeatMapData | null>(null)
  const [topPlayers, setTopPlayers] = useState<PlayerStats[]>([])

  // Server selection state
  const [identifiers, setIdentifiers] = useState<ServerIdentifier[]>([])
  const [categories, setCategories] = useState<IdentifierCategory[]>([])
  const [selectedIdentifierId, setSelectedIdentifierId] = useState<string | null>(null)
  const [selectedKitName, setSelectedKitName] = useState<string | null>(null)
  const [dropdownOpen, setDropdownOpen] = useState(false)

  // Get selected identifier name for display
  const selectedIdentifier = identifiers.find((i) => i.id === selectedIdentifierId)

  useEffect(() => {
    fetchIdentifiers()
  }, [])

  const fetchLeaderboardData = useCallback(
    async (identifierId: string | null, kitName: string | null = null) => {
      setLoading(true)
      setError(null)

      try {
        const params = new URLSearchParams()
        if (identifierId) params.set('identifierId', identifierId)
        if (kitName) params.set('kitName', kitName)

        const url = params.toString()
          ? `/api/public/leaderboards?${params.toString()}`
          : '/api/public/leaderboards'

        const response = await fetch(url)

        if (!response.ok) {
          throw new Error('Failed to fetch leaderboard data')
        }

        const data = await response.json()

        setTopKits(data.topKits || [])
        setIdentifierLeaderboard(data.identifierActivity || [])
        setHeatMap(data.heatMap)
        setTopPlayers(data.topPlayers || [])
      } catch (err) {
        console.error('Failed to fetch leaderboards:', err)
        setError(err instanceof Error ? err.message : 'Failed to load leaderboards')
      } finally {
        setLoading(false)
      }
    },
    []
  )

  async function fetchIdentifiers() {
    try {
      const response = await fetch('/api/public/identifiers')

      if (!response.ok) {
        throw new Error('Failed to fetch identifiers')
      }

      const data = await response.json()
      setIdentifiers(data.identifiers || [])
      setCategories(data.categories || [])

      // Fetch initial leaderboard data (global)
      fetchLeaderboardData(null)
    } catch (err) {
      console.error('Failed to fetch identifiers:', err)
      // Still try to fetch leaderboard data
      fetchLeaderboardData(null)
    }
  }

  function handleIdentifierSelect(identifierId: string | null) {
    setSelectedIdentifierId(identifierId)
    setSelectedKitName(null) // Clear kit filter when changing server
    setDropdownOpen(false)
    fetchLeaderboardData(identifierId, null)
  }

  function handleKitSelect(kitName: string | null) {
    setSelectedKitName(kitName)
    fetchLeaderboardData(selectedIdentifierId, kitName)
  }

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
    return num.toString()
  }

  // Group identifiers by category for dropdown
  const groupedIdentifiers = (() => {
    const groups: Record<string, ServerIdentifier[]> = { uncategorized: [] }

    categories.forEach((cat) => {
      groups[cat.id] = []
    })

    identifiers.forEach((identifier) => {
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
        style={{
          background: 'var(--glass-bg)',
          borderColor: 'var(--glass-border)',
        }}
      >
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link
            href="/"
            className="text-xl font-bold text-[var(--text-primary)] hover:text-[var(--accent-primary)] transition-colors"
          >
            Icefuse Kit Manager
          </Link>
          <nav className="flex items-center gap-4">
            <span className="text-sm text-[var(--text-secondary)]">Leaderboards</span>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl mx-auto px-4 py-8 w-full">
        {/* Page Title */}
        <div className="text-center mb-8">
          <Trophy className="w-12 h-12 mx-auto mb-4 text-[var(--accent-primary)]" />
          <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-2">
            Kit Leaderboards
          </h1>
          <p className="text-[var(--text-secondary)]">
            {selectedIdentifierId
              ? `Statistics for ${selectedIdentifier?.name || 'selected server'}`
              : 'Global statistics across all servers'}
          </p>
        </div>

        {/* Server Selector */}
        {identifiers.length > 0 && (
          <div className="flex justify-center mb-8">
            <div className="relative">
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-3 px-4 py-3 rounded-[var(--radius-lg)] min-w-[240px] transition-colors"
                style={{
                  background: 'var(--glass-bg)',
                  border: '1px solid var(--glass-border)',
                }}
              >
                {selectedIdentifierId ? (
                  <>
                    <Server className="w-5 h-5 text-[var(--accent-primary)]" />
                    <span className="flex-1 text-left text-[var(--text-primary)]">
                      {selectedIdentifier?.name || 'Unknown'}
                    </span>
                  </>
                ) : (
                  <>
                    <Globe className="w-5 h-5 text-[var(--accent-primary)]" />
                    <span className="flex-1 text-left text-[var(--text-primary)]">
                      All Servers (Global)
                    </span>
                  </>
                )}
                <ChevronDown
                  className={`w-4 h-4 text-[var(--text-muted)] transition-transform ${
                    dropdownOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {dropdownOpen && (
                <>
                  {/* Backdrop */}
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setDropdownOpen(false)}
                  />

                  {/* Dropdown */}
                  <div
                    className="absolute top-full left-0 right-0 mt-2 py-2 rounded-[var(--radius-lg)] z-50 max-h-80 overflow-y-auto"
                    style={{
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--glass-border)',
                      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
                    }}
                  >
                    {/* Global option */}
                    <button
                      onClick={() => handleIdentifierSelect(null)}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-[var(--bg-card-hover)] ${
                        !selectedIdentifierId ? 'bg-[var(--accent-primary)]/10' : ''
                      }`}
                    >
                      <Globe className="w-4 h-4 text-[var(--accent-primary)]" />
                      <span className="text-[var(--text-primary)]">All Servers (Global)</span>
                    </button>

                    <div className="my-2 border-t border-[var(--glass-border)]" />

                    {/* Categorized identifiers */}
                    {categories.map((category) => {
                      const categoryIdentifiers = groupedIdentifiers[category.id] || []
                      if (categoryIdentifiers.length === 0) return null

                      return (
                        <div key={category.id}>
                          <div className="px-4 py-1.5 text-xs font-medium text-[var(--text-muted)] uppercase">
                            {category.name}
                          </div>
                          {categoryIdentifiers.map((identifier) => (
                            <button
                              key={identifier.id}
                              onClick={() => handleIdentifierSelect(identifier.id)}
                              className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-[var(--bg-card-hover)] ${
                                selectedIdentifierId === identifier.id
                                  ? 'bg-[var(--accent-primary)]/10'
                                  : ''
                              }`}
                            >
                              <Server className="w-4 h-4 text-[var(--text-muted)]" />
                              <span className="text-[var(--text-primary)]">{identifier.name}</span>
                            </button>
                          ))}
                        </div>
                      )
                    })}

                    {/* Uncategorized identifiers */}
                    {groupedIdentifiers.uncategorized.length > 0 && (
                      <div>
                        {categories.length > 0 && (
                          <div className="px-4 py-1.5 text-xs font-medium text-[var(--text-muted)] uppercase">
                            Other
                          </div>
                        )}
                        {groupedIdentifiers.uncategorized.map((identifier) => (
                          <button
                            key={identifier.id}
                            onClick={() => handleIdentifierSelect(identifier.id)}
                            className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-[var(--bg-card-hover)] ${
                              selectedIdentifierId === identifier.id
                                ? 'bg-[var(--accent-primary)]/10'
                                : ''
                            }`}
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

        {/* Error State */}
        {error && (
          <div className="mb-6 p-4 rounded-[var(--radius-md)] bg-[var(--status-error)]/10 border border-[var(--status-error)]/30 text-[var(--status-error)] text-center">
            {error}
            <button
              onClick={() => fetchLeaderboardData(selectedIdentifierId)}
              className="ml-4 underline hover:no-underline"
            >
              Retry
            </button>
          </div>
        )}

        {/* Loading State */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="w-8 h-8 text-[var(--accent-primary)] animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Top Kits */}
            <div
              className="p-6 rounded-[var(--radius-lg)]"
              style={{
                background: 'var(--glass-bg)',
                border: '1px solid var(--glass-border)',
              }}
            >
              <div className="flex items-center gap-2 mb-6">
                <TrendingUp className="w-5 h-5 text-[var(--accent-primary)]" />
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                  Most Popular Kits
                </h2>
                <span className="text-xs text-[var(--text-muted)] ml-auto">
                  {selectedIdentifierId ? 'This server' : 'All-time'}
                </span>
              </div>

              {/* Kit filter indicator */}
              {selectedKitName && (
                <div className="flex items-center gap-2 mb-4 p-2 rounded-[var(--radius-md)] bg-[var(--accent-primary)]/10">
                  <span className="text-xs text-[var(--text-secondary)]">
                    Filtering players by:
                  </span>
                  <span className="text-xs font-medium text-[var(--accent-primary)]">
                    {selectedKitName}
                  </span>
                  <button
                    onClick={() => handleKitSelect(null)}
                    className="ml-auto text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                  >
                    Clear
                  </button>
                </div>
              )}

              <div className="space-y-3">
                {topKits.map((kit, index) => (
                  <button
                    key={kit.kitName}
                    onClick={() => handleKitSelect(kit.kitName)}
                    className={`w-full flex items-center gap-4 p-3 rounded-[var(--radius-md)] transition-colors text-left ${
                      selectedKitName === kit.kitName
                        ? 'bg-[var(--accent-primary)]/10 ring-1 ring-[var(--accent-primary)]'
                        : 'bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)]'
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                        index === 0
                          ? 'bg-yellow-500/20 text-yellow-400'
                          : index === 1
                          ? 'bg-gray-400/20 text-gray-300'
                          : index === 2
                          ? 'bg-orange-500/20 text-orange-400'
                          : 'bg-[var(--bg-input)] text-[var(--text-muted)]'
                      }`}
                    >
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-[var(--text-primary)]">
                        {kit.kitName}
                      </div>
                      <div className="text-xs text-[var(--text-muted)]">
                        {kit.uniquePlayers.toLocaleString()} players
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-[var(--accent-primary)]">
                        {formatNumber(kit.totalRedemptions)}
                      </div>
                      <div className="text-xs text-[var(--text-muted)]">
                        redemptions
                      </div>
                    </div>
                  </button>
                ))}

                {topKits.length === 0 && (
                  <div className="text-center py-8 text-[var(--text-muted)]">
                    No kit data available yet
                  </div>
                )}
              </div>
            </div>

            {/* Server Leaderboard */}
            <div
              className="p-6 rounded-[var(--radius-lg)]"
              style={{
                background: 'var(--glass-bg)',
                border: '1px solid var(--glass-border)',
              }}
            >
              <div className="flex items-center gap-2 mb-6">
                <Server className="w-5 h-5 text-[var(--accent-primary)]" />
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                  Server Leaderboard
                </h2>
                <span className="text-xs text-[var(--text-muted)] ml-auto">
                  Last 30 days
                </span>
              </div>

              <div className="space-y-3">
                {identifierLeaderboard.map((server, index) => (
                  <button
                    key={server.identifierId}
                    onClick={() => handleIdentifierSelect(server.identifierId)}
                    className="w-full flex items-center gap-4 p-3 rounded-[var(--radius-md)] bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)] transition-colors text-left"
                  >
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                        index === 0
                          ? 'bg-yellow-500/20 text-yellow-400'
                          : index === 1
                          ? 'bg-gray-400/20 text-gray-300'
                          : index === 2
                          ? 'bg-orange-500/20 text-orange-400'
                          : 'bg-[var(--bg-input)] text-[var(--text-muted)]'
                      }`}
                    >
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-[var(--text-primary)]">
                        {server.identifierName}
                      </div>
                      <div className="text-xs text-[var(--text-muted)]">
                        {server.uniquePlayers.toLocaleString()} active players
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-[var(--status-success)]">
                        {formatNumber(server.totalRedemptions)}
                      </div>
                      <div className="text-xs text-[var(--text-muted)]">
                        redemptions
                      </div>
                    </div>
                  </button>
                ))}

                {identifierLeaderboard.length === 0 && (
                  <div className="text-center py-8 text-[var(--text-muted)]">
                    No server data available yet
                  </div>
                )}
              </div>
            </div>

            {/* Top Players */}
            <div
              className="p-6 rounded-[var(--radius-lg)] lg:col-span-2"
              style={{
                background: 'var(--glass-bg)',
                border: '1px solid var(--glass-border)',
              }}
            >
              <div className="flex items-center gap-2 mb-6">
                <Users className="w-5 h-5 text-[var(--accent-primary)]" />
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                  Top Players
                </h2>
                <span className="text-xs text-[var(--text-muted)] ml-auto">
                  {selectedKitName ? `For ${selectedKitName}` : 'All kits'} • Last 30 days
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {topPlayers.map((player, index) => (
                  <div
                    key={player.steamId}
                    className="flex items-center gap-3 p-3 rounded-[var(--radius-md)] bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)] transition-colors"
                  >
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 ${
                        index === 0
                          ? 'bg-yellow-500/20 text-yellow-400'
                          : index === 1
                          ? 'bg-gray-400/20 text-gray-300'
                          : index === 2
                          ? 'bg-orange-500/20 text-orange-400'
                          : 'bg-[var(--bg-input)] text-[var(--text-muted)]'
                      }`}
                    >
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-[var(--text-primary)] truncate">
                        {player.playerName || 'Unknown Player'}
                      </div>
                      <div className="text-xs text-[var(--text-muted)]">
                        {player.uniqueKits} kit{player.uniqueKits !== 1 ? 's' : ''} used
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="font-bold text-[var(--status-info)]">
                        {formatNumber(player.totalRedemptions)}
                      </div>
                      <div className="text-xs text-[var(--text-muted)]">claims</div>
                    </div>
                  </div>
                ))}

                {topPlayers.length === 0 && (
                  <div className="col-span-full text-center py-8 text-[var(--text-muted)]">
                    No player data available yet
                  </div>
                )}
              </div>
            </div>

            {/* Activity Heat Map */}
            <div
              className="p-6 rounded-[var(--radius-lg)] lg:col-span-2"
              style={{
                background: 'var(--glass-bg)',
                border: '1px solid var(--glass-border)',
              }}
            >
              <div className="flex items-center gap-2 mb-6">
                <Clock className="w-5 h-5 text-[var(--accent-primary)]" />
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                  When Are Kits Used?
                </h2>
                {heatMap?.peak && (
                  <span className="text-xs text-[var(--text-muted)] ml-auto">
                    Peak activity: {heatMap.peak.dayName} at {heatMap.peak.hourOfDay}:00 UTC
                  </span>
                )}
              </div>

              {heatMap?.data ? (
                <div className="space-y-2">
                  <div className="flex pl-10">
                    {['12a', '3a', '6a', '9a', '12p', '3p', '6p', '9p'].map(
                      (label) => (
                        <div
                          key={label}
                          className="text-xs text-[var(--text-muted)]"
                          style={{ width: `${100 / 8}%` }}
                        >
                          {label}
                        </div>
                      )
                    )}
                  </div>

                  <div className="space-y-1">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(
                      (day, dayIndex) => (
                        <div key={day} className="flex items-center gap-2">
                          <div className="w-8 text-xs text-[var(--text-muted)] text-right">
                            {day}
                          </div>
                          <div className="flex-1 flex gap-[2px]">
                            {heatMap.data[dayIndex]?.map((value, hourIndex) => {
                              const intensity = Math.min(
                                value / (heatMap.peak?.count || 1),
                                1
                              )
                              let bg = 'var(--bg-input)'
                              if (value > 0) {
                                if (intensity < 0.25)
                                  bg = 'rgba(0, 213, 255, 0.2)'
                                else if (intensity < 0.5)
                                  bg = 'rgba(0, 213, 255, 0.4)'
                                else if (intensity < 0.75)
                                  bg = 'rgba(0, 213, 255, 0.6)'
                                else bg = 'rgba(0, 213, 255, 0.9)'
                              }
                              return (
                                <div
                                  key={hourIndex}
                                  className="flex-1 aspect-square rounded-[2px]"
                                  style={{ background: bg }}
                                  title={`${day} ${hourIndex}:00 - ${value} redemptions`}
                                />
                              )
                            })}
                          </div>
                        </div>
                      )
                    )}
                  </div>

                  <div className="flex items-center justify-end gap-2 text-xs text-[var(--text-muted)] mt-4">
                    <span>Less</span>
                    <div className="flex gap-[2px]">
                      {[
                        'var(--bg-input)',
                        'rgba(0, 213, 255, 0.2)',
                        'rgba(0, 213, 255, 0.4)',
                        'rgba(0, 213, 255, 0.6)',
                        'rgba(0, 213, 255, 0.9)',
                      ].map((color, i) => (
                        <div
                          key={i}
                          className="w-3 h-3 rounded-[2px]"
                          style={{ background: color }}
                        />
                      ))}
                    </div>
                    <span>More</span>
                  </div>
                </div>
              ) : (
                <div className="h-48 flex items-center justify-center text-[var(--text-muted)]">
                  No activity data available yet
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <Footer />
    </div>
  )
}
