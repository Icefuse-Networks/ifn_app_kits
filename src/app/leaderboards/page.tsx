/**
 * Public Leaderboards Page
 *
 * Public-facing page showing kit statistics.
 * No authentication required.
 */

'use client'

import { useState, useEffect } from 'react'
import { Trophy, TrendingUp, Server, Clock, RefreshCw } from 'lucide-react'
import Link from 'next/link'

// Types
interface KitStats {
  kitName: string
  totalRedemptions: number
  uniquePlayers: number
  lastRedeemed: string | null
}

interface ServerStats {
  serverId: number
  serverName: string
  totalRedemptions: number
  uniquePlayers: number
}

interface HeatMapData {
  data: number[][]
  peak: {
    dayName: string
    hourOfDay: number
    count: number
  }
}

export default function LeaderboardsPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [topKits, setTopKits] = useState<KitStats[]>([])
  const [serverLeaderboard, setServerLeaderboard] = useState<ServerStats[]>([])
  const [heatMap, setHeatMap] = useState<HeatMapData | null>(null)

  useEffect(() => {
    fetchLeaderboardData()
  }, [])

  async function fetchLeaderboardData() {
    setLoading(true)
    setError(null)

    try {
      // Use public leaderboards endpoint (no auth required)
      const response = await fetch('/api/public/leaderboards')

      if (!response.ok) {
        throw new Error('Failed to fetch leaderboard data')
      }

      const data = await response.json()

      setTopKits(data.topKits || [])
      setServerLeaderboard(data.serverActivity || [])
      setHeatMap(data.heatMap)
    } catch (err) {
      console.error('Failed to fetch leaderboards:', err)
      setError(err instanceof Error ? err.message : 'Failed to load leaderboards')
    } finally {
      setLoading(false)
    }
  }

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
    return num.toString()
  }

  return (
    <div className="min-h-screen bg-[var(--bg-root)]">
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
      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Page Title */}
        <div className="text-center mb-12">
          <Trophy className="w-12 h-12 mx-auto mb-4 text-[var(--accent-primary)]" />
          <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-2">
            Kit Leaderboards
          </h1>
          <p className="text-[var(--text-secondary)]">
            See which kits are most popular across all servers
          </p>
        </div>

        {/* Error State */}
        {error && (
          <div className="mb-6 p-4 rounded-[var(--radius-md)] bg-[var(--status-error)]/10 border border-[var(--status-error)]/30 text-[var(--status-error)] text-center">
            {error}
            <button
              onClick={fetchLeaderboardData}
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
                  All-time
                </span>
              </div>

              <div className="space-y-3">
                {topKits.map((kit, index) => (
                  <div
                    key={kit.kitName}
                    className="flex items-center gap-4 p-3 rounded-[var(--radius-md)] bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)] transition-colors"
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
                  </div>
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
                {serverLeaderboard.map((server, index) => (
                  <div
                    key={server.serverId}
                    className="flex items-center gap-4 p-3 rounded-[var(--radius-md)] bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)] transition-colors"
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
                        {server.serverName}
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
                  </div>
                ))}

                {serverLeaderboard.length === 0 && (
                  <div className="text-center py-8 text-[var(--text-muted)]">
                    No server data available yet
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
      <footer
        className="border-t mt-12"
        style={{
          background: 'var(--glass-bg)',
          borderColor: 'var(--glass-border)',
        }}
      >
        <div className="max-w-6xl mx-auto px-4 py-6 text-center text-sm text-[var(--text-muted)]">
          <p>Icefuse Networks - Kit Statistics</p>
          <p className="mt-1">Data updates in real-time</p>
        </div>
      </footer>
    </div>
  )
}
