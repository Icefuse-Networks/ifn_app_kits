import { NextRequest, NextResponse } from 'next/server'
import { clickhouse } from '@/lib/clickhouse'

interface CacheEntry<T> {
  data: T
  timestamp: number
}

const kothCache = new Map<string, CacheEntry<unknown>>()
const CACHE_TTL = 60_000

function getCached<T>(key: string): T | null {
  const entry = kothCache.get(key)
  if (entry && Date.now() - entry.timestamp < CACHE_TTL) {
    return entry.data as T
  }
  return null
}

function setCache(key: string, data: unknown): void {
  kothCache.set(key, { data, timestamp: Date.now() })
}

/**
 * GET /api/public/koth
 * Public KOTH leaderboard (used by in-game PlayerRanks UI)
 *
 * Aggregates from ClickHouse event_completions table (event_type = 'koth')
 *
 * Query params:
 * - serverId (optional): filter by server
 * - timeframe (optional): wipe | monthly | overall (default: overall)
 * - sort: wins | totalKills | avgKills (default: wins)
 * - order: asc | desc (default: desc)
 * - start: offset (default: 0)
 * - length: limit (default: 10, max: 50)
 * - search: player name search
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const serverId = searchParams.get('serverId') || ''
    const timeframe = searchParams.get('timeframe') || 'overall'
    const sort = searchParams.get('sort') || 'wins'
    const order = searchParams.get('order') || 'desc'
    const start = Math.max(0, parseInt(searchParams.get('start') || '0'))
    const length = Math.min(50, Math.max(1, parseInt(searchParams.get('length') || '10')))
    const search = searchParams.get('search') || ''

    const cacheKey = `pub:koth:${serverId}:${timeframe}:${sort}:${order}:${start}:${length}:${search}`
    const cached = getCached(cacheKey)
    if (cached) {
      return NextResponse.json(cached)
    }

    // Build time filter
    let timeFilter = ''
    const timeParams: Record<string, unknown> = {}
    if (timeframe === 'monthly') {
      timeFilter = `AND timestamp >= toStartOfMonth(now64(3))`
    } else if (timeframe === 'wipe') {
      // Last Thursday (Rust force wipe)
      timeFilter = `AND timestamp >= toStartOfDay(now64(3) - INTERVAL toDayOfWeek(now64(3), 1) - 4 < 0 ? toDayOfWeek(now64(3), 1) + 3 : toDayOfWeek(now64(3), 1) - 4 DAY)`
    }

    // Validate sort field
    const validSorts: Record<string, string> = {
      wins: 'wins',
      totalKills: 'total_kills',
      avgKills: 'avg_kills',
    }
    const sortCol = validSorts[sort] || 'wins'
    const sortDir = order === 'asc' ? 'ASC' : 'DESC'

    // Search filter
    const searchFilter = search ? `AND winner_name ILIKE {search:String}` : ''
    const searchParam = search ? `%${search}%` : ''

    // Server filter
    const serverFilter = serverId ? `AND server_id = {server_id:String}` : ''

    // For wipe timeframe, use a simpler approach - calculate Thursday in the app
    let wipeTimeFilter = ''
    if (timeframe === 'wipe') {
      const now = new Date()
      const day = now.getUTCDay() // 0=Sun, 4=Thu
      const diff = day >= 4 ? day - 4 : day + 3
      const wipeDate = new Date(now)
      wipeDate.setUTCDate(wipeDate.getUTCDate() - diff)
      wipeDate.setUTCHours(0, 0, 0, 0)
      timeFilter = `AND timestamp >= {wipe_date:DateTime64(3)}`
      timeParams.wipe_date = wipeDate.toISOString().replace('T', ' ').replace('Z', '')
    }

    // Count total
    const countResult = await clickhouse.query({
      query: `
        SELECT COUNT(DISTINCT winner_steam_id) as count
        FROM event_completions
        WHERE event_type = 'koth'
          ${timeFilter}
          ${serverFilter}
          ${searchFilter}
      `,
      query_params: { ...timeParams, server_id: serverId, search: searchParam },
      format: 'JSONEachRow',
    })
    const countRows = await countResult.json<{ count: string }>()
    const recordsTotal = parseInt(countRows[0]?.count || '0', 10)

    // Aggregated leaderboard
    const dataResult = await clickhouse.query({
      query: `
        SELECT
          winner_steam_id as steamId,
          any(winner_name) as playerName,
          any(winner_clan_tag) as clanTag,
          COUNT(*) as wins,
          SUM(winner_kills) as total_kills,
          AVG(winner_kills) as avg_kills
        FROM event_completions
        WHERE event_type = 'koth'
          ${timeFilter}
          ${serverFilter}
          ${searchFilter}
        GROUP BY winner_steam_id
        ORDER BY ${sortCol} ${sortDir}
        LIMIT {length:UInt32} OFFSET {start:UInt32}
      `,
      query_params: { ...timeParams, server_id: serverId, search: searchParam, length, start },
      format: 'JSONEachRow',
    })

    const rows = await dataResult.json<{
      steamId: string
      playerName: string
      clanTag: string | null
      wins: string
      total_kills: string
      avg_kills: string
    }>()

    const data = rows.map(r => ({
      steamId: r.steamId,
      playerName: r.playerName,
      clanTag: r.clanTag || '',
      wins: parseInt(r.wins, 10),
      totalKills: parseInt(r.total_kills, 10),
      avgKills: parseFloat(parseFloat(r.avg_kills).toFixed(1)),
    }))

    const response = {
      draw: 1,
      recordsTotal,
      recordsFiltered: recordsTotal,
      data,
    }

    setCache(cacheKey, response)
    return NextResponse.json(response)
  } catch (error) {
    console.error('Public KOTH stats error:', error)
    return NextResponse.json(
      { draw: 1, recordsTotal: 0, recordsFiltered: 0, data: [] },
      { status: 200 }
    )
  }
}
