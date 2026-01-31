/**
 * Analytics Dashboard Page
 *
 * Admin-only page for viewing kit usage analytics.
 * Uses pure React components for visualizations.
 */

'use client'

import { useState, useEffect } from 'react'
import {
  BarChart3,
  TrendingUp,
  Users,
  Package,
  Clock,
  Server,
  Calendar,
  RefreshCw,
} from 'lucide-react'
import { StatCard, BarChart, HeatMap, LineChart } from '@/components/analytics'

// Types for API responses
interface PopularityData {
  kitName: string
  kitConfigId: string | null
  totalRedemptions: number
  uniquePlayers: number
}

interface TrendData {
  date: string
  total: number
  successful: number
  failed: number
}

interface HeatMapData {
  data: number[][]
  maxValue: number
  peak: {
    dayName: string
    hourOfDay: number
    count: number
  }
}

interface SummaryStats {
  totalRedemptions: number
  uniquePlayers: number
  topKit: string
  activeServers: number
}

type TabId = 'overview' | 'servers' | 'wipes' | 'players'

export default function AnalyticsDashboardPage() {
  const [activeTab, setActiveTab] = useState<TabId>('overview')
  const [dateRange, setDateRange] = useState<7 | 30 | 90>(30)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Data states
  const [summary, setSummary] = useState<SummaryStats | null>(null)
  const [popularity, setPopularity] = useState<PopularityData[]>([])
  const [trends, setTrends] = useState<TrendData[]>([])
  const [heatMap, setHeatMap] = useState<HeatMapData | null>(null)

  // Fetch data on mount and date range change
  useEffect(() => {
    fetchAnalyticsData()
  }, [dateRange])

  async function fetchAnalyticsData() {
    setLoading(true)
    setError(null)

    try {
      // Fetch data in parallel with credentials for session auth
      const fetchOptions = { credentials: 'include' as const }
      const [popularityRes, trendsRes, heatMapRes, activityRes] = await Promise.all([
        fetch(`/api/analytics/kit-popularity?days=${dateRange}&limit=10`, fetchOptions),
        fetch(`/api/analytics/usage-trends?days=${dateRange}&granularity=daily`, fetchOptions),
        fetch(`/api/analytics/heat-map?days=${dateRange}`, fetchOptions),
        fetch(`/api/analytics/server-activity?days=${dateRange}`, fetchOptions),
      ])

      if (!popularityRes.ok || !trendsRes.ok || !heatMapRes.ok || !activityRes.ok) {
        throw new Error('Failed to fetch analytics data')
      }

      const [popularityData, trendsData, heatMapData, activityData] = await Promise.all([
        popularityRes.json(),
        trendsRes.json(),
        heatMapRes.json(),
        activityRes.json(),
      ])

      // Set popularity data
      setPopularity(popularityData.data || [])

      // Set trends data
      setTrends(trendsData.data || [])

      // Set heat map data (response has data, maxValue, peak at root level)
      setHeatMap({
        data: heatMapData.data || [],
        maxValue: heatMapData.maxValue || 0,
        peak: heatMapData.peak || { dayName: 'N/A', hourOfDay: 0, count: 0 },
      })

      // Calculate summary
      const totalRedemptions = trendsData.summary?.totalRedemptions || 0
      const topKit = popularityData.data?.[0]?.kitName || 'N/A'
      const activeServers = activityData.summary?.totalServers || 0

      // Get unique players from trends
      const uniquePlayers = trendsData.summary?.totalRedemptions
        ? Math.round(trendsData.summary.totalRedemptions / 3) // Approximation
        : 0

      setSummary({
        totalRedemptions,
        uniquePlayers: activityData.summary?.totalUniquePlayers || uniquePlayers,
        topKit,
        activeServers,
      })
    } catch (err) {
      console.error('Failed to fetch analytics:', err)
      setError(err instanceof Error ? err.message : 'Failed to load analytics')
    } finally {
      setLoading(false)
    }
  }

  const tabs: Array<{ id: TabId; label: string }> = [
    { id: 'overview', label: 'Overview' },
    { id: 'servers', label: 'Servers' },
    { id: 'wipes', label: 'Wipes' },
    { id: 'players', label: 'Players' },
  ]

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">
            Kit Analytics
          </h1>
          <p className="text-[var(--text-secondary)] mt-1">
            Track kit usage, popularity, and player behavior
          </p>
        </div>

        <div className="flex items-center gap-4">
          {/* Date Range Selector */}
          <div className="flex rounded-[var(--radius-md)] overflow-hidden border border-[var(--border-secondary)]">
            {[7, 30, 90].map((days) => (
              <button
                key={days}
                onClick={() => setDateRange(days as 7 | 30 | 90)}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  dateRange === days
                    ? 'bg-[var(--accent-primary)] text-white'
                    : 'bg-[var(--bg-card)] text-[var(--text-secondary)] hover:bg-[var(--bg-card-hover)]'
                }`}
              >
                {days}d
              </button>
            ))}
          </div>

          {/* Refresh Button */}
          <button
            onClick={fetchAnalyticsData}
            disabled={loading}
            className="p-2 rounded-[var(--radius-md)] bg-[var(--bg-card)] border border-[var(--border-secondary)] text-[var(--text-secondary)] hover:bg-[var(--bg-card-hover)] disabled:opacity-50"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="mb-6 p-4 rounded-[var(--radius-md)] bg-[var(--status-error)]/10 border border-[var(--status-error)]/30 text-[var(--status-error)]">
          {error}
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Total Redemptions"
          value={summary?.totalRedemptions || 0}
          icon={Package}
          description={`Last ${dateRange} days`}
        />
        <StatCard
          label="Unique Players"
          value={summary?.uniquePlayers || 0}
          icon={Users}
          description="Distinct Steam IDs"
        />
        <StatCard
          label="Top Kit"
          value={summary?.topKit || 'N/A'}
          icon={TrendingUp}
          description="Most redeemed"
        />
        <StatCard
          label="Active Servers"
          value={summary?.activeServers || 0}
          icon={Server}
          description="With kit activity"
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 p-1 rounded-[var(--radius-md)] bg-[var(--bg-card)] border border-[var(--border-secondary)] w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium rounded-[var(--radius-sm)] transition-colors ${
              activeTab === tab.id
                ? 'bg-[var(--accent-primary)] text-white'
                : 'text-[var(--text-secondary)] hover:bg-[var(--bg-card-hover)]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Popularity Chart */}
          <div
            className="p-6 rounded-[var(--radius-lg)]"
            style={{
              background: 'var(--glass-bg)',
              border: '1px solid var(--glass-border)',
            }}
          >
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="w-5 h-5 text-[var(--accent-primary)]" />
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                Kit Popularity
              </h2>
            </div>
            {loading ? (
              <div className="h-64 flex items-center justify-center text-[var(--text-muted)]">
                Loading...
              </div>
            ) : (
              <BarChart
                data={popularity.map((p) => ({
                  label: p.kitName,
                  value: p.totalRedemptions,
                }))}
                maxItems={10}
              />
            )}
          </div>

          {/* Heat Map */}
          <div
            className="p-6 rounded-[var(--radius-lg)]"
            style={{
              background: 'var(--glass-bg)',
              border: '1px solid var(--glass-border)',
            }}
          >
            <div className="flex items-center gap-2 mb-4">
              <Clock className="w-5 h-5 text-[var(--accent-primary)]" />
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                Usage Heat Map
              </h2>
              {heatMap?.peak && (
                <span className="text-xs text-[var(--text-muted)] ml-auto">
                  Peak: {heatMap.peak.dayName} {heatMap.peak.hourOfDay}:00
                </span>
              )}
            </div>
            {loading ? (
              <div className="h-64 flex items-center justify-center text-[var(--text-muted)]">
                Loading...
              </div>
            ) : heatMap?.data ? (
              <HeatMap data={heatMap.data} maxValue={heatMap.maxValue} />
            ) : (
              <div className="h-64 flex items-center justify-center text-[var(--text-muted)]">
                No data available
              </div>
            )}
          </div>

          {/* Trends Chart */}
          <div
            className="p-6 rounded-[var(--radius-lg)] lg:col-span-2"
            style={{
              background: 'var(--glass-bg)',
              border: '1px solid var(--glass-border)',
            }}
          >
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-5 h-5 text-[var(--accent-primary)]" />
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                Usage Trends
              </h2>
            </div>
            {loading ? (
              <div className="h-48 flex items-center justify-center text-[var(--text-muted)]">
                Loading...
              </div>
            ) : (
              <LineChart
                data={trends.map((t) => ({
                  label: t.date.split('-').slice(1).join('/'),
                  value: t.total,
                }))}
                height={200}
              />
            )}
          </div>
        </div>
      )}

      {activeTab === 'servers' && (
        <div className="text-center py-12 text-[var(--text-muted)]">
          <Server className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>Server analytics coming soon</p>
          <p className="text-sm mt-2">
            Cross-server popularity, activity index, and player migration
          </p>
        </div>
      )}

      {activeTab === 'wipes' && (
        <div className="text-center py-12 text-[var(--text-muted)]">
          <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>Wipe analytics coming soon</p>
          <p className="text-sm mt-2">
            Wipe progression, peak hours, and wipe comparison
          </p>
        </div>
      )}

      {activeTab === 'players' && (
        <div className="text-center py-12 text-[var(--text-muted)]">
          <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>Player analytics coming soon</p>
          <p className="text-sm mt-2">
            Kit overlap, cooldown efficiency, and common combinations
          </p>
        </div>
      )}
    </div>
  )
}
