/**
 * Public Leaderboards Page
 *
 * Public-facing page showing kit statistics.
 * Supports global view and per-server filtering.
 * No authentication required.
 */

'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Trophy, TrendingUp, Server, Clock, Globe, Users, ExternalLink } from 'lucide-react'
import Link from 'next/link'
import { Footer } from '@/components/global/Footer'
import { Dropdown, DropdownOption } from '@/components/global/Dropdown'
import { Loading } from '@/components/ui/Loading'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { EmptyState } from '@/components/ui/EmptyState'
import { Badge } from '@/components/ui/Badge'

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

  // Get selected identifier name for display
  const selectedIdentifier = identifiers.find((i) => i.id === selectedIdentifierId)

  useEffect(() => {
    fetchIdentifiers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  function handleKitSelect(kitName: string | null) {
    setSelectedKitName(kitName)
    fetchLeaderboardData(selectedIdentifierId, kitName)
  }

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
    return num.toString()
  }

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
            <Dropdown
              value={selectedIdentifierId}
              options={serverOptions}
              onChange={(value) => {
                setSelectedIdentifierId(value)
                setSelectedKitName(null)
                fetchLeaderboardData(value, null)
              }}
              placeholder="All Servers (Global)"
              emptyOption="All Servers (Global)"
              searchable
              clearable
              className="min-w-[240px]"
            />
          </div>
        )}

        {/* Error State */}
        {error && (
          <Alert variant="error" className="mb-6">
            <div className="flex items-center justify-center gap-4">
              <span>{error}</span>
              <Button variant="outline" size="sm" onClick={() => fetchLeaderboardData(selectedIdentifierId)}>
                Retry
              </Button>
            </div>
          </Alert>
        )}

        {/* Loading State */}
        {loading ? (
          <Loading size="lg" text="Loading leaderboard data..." />
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
                  <Badge variant="primary">{selectedKitName}</Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleKitSelect(null)}
                    className="ml-auto"
                  >
                    Clear
                  </Button>
                </div>
              )}

              <div className="space-y-3">
                {topKits.map((kit, index) => (
                  <div
                    key={kit.kitName}
                    className={`flex items-center gap-4 p-3 rounded-[var(--radius-md)] transition-colors ${
                      selectedKitName === kit.kitName
                        ? 'bg-[var(--accent-primary)]/10 ring-1 ring-[var(--accent-primary)]'
                        : 'bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)]'
                    }`}
                  >
                    <button
                      onClick={() => handleKitSelect(kit.kitName)}
                      className="flex items-center gap-4 flex-1 text-left"
                    >
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                          index === 0
                            ? 'bg-[var(--status-warning)]/20 text-[var(--status-warning)]'
                            : index === 1
                            ? 'bg-[var(--text-muted)]/20 text-[var(--text-secondary)]'
                            : index === 2
                            ? 'bg-[var(--status-warning)]/20 text-[var(--status-warning)]'
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
                    <Link
                      href={`/kits/${encodeURIComponent(kit.kitName)}`}
                      className="p-2 rounded-[var(--radius-md)] text-[var(--text-muted)] hover:text-[var(--accent-primary)] hover:bg-[var(--bg-input)] transition-colors"
                      title="View kit contents"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </Link>
                  </div>
                ))}

                {topKits.length === 0 && (
                  <EmptyState
                    icon={<TrendingUp className="w-8 h-8" />}
                    title="No Kit Data"
                    description="No kit data available yet"
                  />
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
                    onClick={() => {
                      setSelectedIdentifierId(server.identifierId)
                      setSelectedKitName(null)
                      fetchLeaderboardData(server.identifierId, null)
                    }}
                    className="w-full flex items-center gap-4 p-3 rounded-[var(--radius-md)] bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)] transition-colors text-left"
                  >
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                        index === 0
                          ? 'bg-[var(--status-warning)]/20 text-[var(--status-warning)]'
                          : index === 1
                          ? 'bg-[var(--text-muted)]/20 text-[var(--text-secondary)]'
                          : index === 2
                          ? 'bg-[var(--status-warning)]/20 text-[var(--status-warning)]'
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
                  <EmptyState
                    icon={<Server className="w-8 h-8" />}
                    title="No Server Data"
                    description="No server data available yet"
                  />
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
                          ? 'bg-[var(--status-warning)]/20 text-[var(--status-warning)]'
                          : index === 1
                          ? 'bg-[var(--text-muted)]/20 text-[var(--text-secondary)]'
                          : index === 2
                          ? 'bg-[var(--status-warning)]/20 text-[var(--status-warning)]'
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
                  <div className="col-span-full">
                    <EmptyState
                      icon={<Users className="w-8 h-8" />}
                      title="No Player Data"
                      description="No player data available yet"
                    />
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
                <EmptyState
                  icon={<Clock className="w-8 h-8" />}
                  title="No Activity Data"
                  description="No activity data available yet"
                  className="h-48"
                />
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
