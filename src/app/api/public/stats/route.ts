/**
 * Public Stats Leaderboard API
 *
 * GET /api/public/stats - Public leaderboard query (no auth required)
 *
 * Uses existing /api/public/identifiers for server selection (no duplicate logic).
 * More restrictive limits than the authenticated version.
 * Uses modular STAT_COLUMNS config — adding a new stat requires zero changes here.
 */

import { NextRequest, NextResponse } from 'next/server'
import { clickhouse } from '@/lib/clickhouse'
import { logger } from '@/lib/logger'
import {
  publicStatsQuerySchema,
  TIMEFRAME_TABLE,
  CACHE_TTL,
  ALLOWED_SORT_COLUMNS,
  normalizeStatRow,
  buildClanSelectColumns,
} from '@/lib/validations/stats'

// =============================================================================
// Cache (longer TTL for public)
// =============================================================================

interface CacheEntry<T> {
  data: T
  timestamp: number
}

const publicStatsCache = new Map<string, CacheEntry<unknown>>()

function getCached<T>(key: string, ttl: number): T | null {
  const entry = publicStatsCache.get(key)
  if (entry && Date.now() - entry.timestamp < ttl) {
    return entry.data as T
  }
  return null
}

function setCache(key: string, data: unknown): void {
  publicStatsCache.set(key, { data, timestamp: Date.now() })
}

// =============================================================================
// GET Handler
// =============================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const query = publicStatsQuerySchema.safeParse({
      server_id: searchParams.get('server_id'),
      timeframe: searchParams.get('timeframe'),
      view: searchParams.get('view'),
      sort: searchParams.get('sort'),
      order: searchParams.get('order'),
      limit: searchParams.get('limit'),
      offset: searchParams.get('offset'),
      search: searchParams.get('search'),
    })

    if (!query.success) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid query parameters', details: query.error.flatten() } },
        { status: 400 }
      )
    }

    const { server_id, timeframe, view, sort, order, limit, offset, search } = query.data
    const table = TIMEFRAME_TABLE[timeframe]
    // Public uses 2x TTL
    const ttl = (CACHE_TTL[timeframe] || 60_000) * 2

    const safeSort = ALLOWED_SORT_COLUMNS.has(sort) ? sort : 'kills'
    const safeOrder = order === 'asc' ? 'ASC' : 'DESC'

    const cacheKey = `pub:${view}:${table}:${server_id}:${search || ''}:${safeSort}:${safeOrder}:${limit}:${offset}`
    const cached = getCached(cacheKey, ttl)
    if (cached) {
      return NextResponse.json(cached)
    }

    if (view === 'clans') {
      return handleClansQuery(table, server_id, search, safeSort, safeOrder, limit, offset, cacheKey, ttl)
    }

    return handlePlayersQuery(table, server_id, search, safeSort, safeOrder, limit, offset, cacheKey, ttl)
  } catch (error) {
    logger.stats.error('Failed to fetch public stats', error as Error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch statistics' } },
      { status: 500 }
    )
  }
}

async function handlePlayersQuery(
  table: string, serverId: string, search: string | undefined,
  sort: string, order: string, limit: number, offset: number,
  cacheKey: string, _ttl: number,
) {
  const params: Record<string, string | number> = { server_id: serverId, limit, offset }
  let whereSearch = ''
  if (search) {
    params.search = `%${search}%`
    whereSearch = ` AND (name ILIKE {search:String} OR steamid = {search_exact:String} OR clan ILIKE {search:String})`
    params.search_exact = search
  }

  const totalResult = await clickhouse.query({
    query: `SELECT count() as cnt FROM ${table} FINAL WHERE server_id = {server_id:String}`,
    query_params: { server_id: serverId },
    format: 'JSONEachRow',
  })
  const totalRows = await totalResult.json<{ cnt: string }>()
  const total = Number(totalRows[0]?.cnt || 0)

  let filteredTotal = total
  if (search) {
    const filteredResult = await clickhouse.query({
      query: `SELECT count() as cnt FROM ${table} FINAL WHERE server_id = {server_id:String}${whereSearch}`,
      query_params: params,
      format: 'JSONEachRow',
    })
    const filteredRows = await filteredResult.json<{ cnt: string }>()
    filteredTotal = Number(filteredRows[0]?.cnt || 0)
  }

  const dataResult = await clickhouse.query({
    query: `SELECT * FROM ${table} FINAL WHERE server_id = {server_id:String}${whereSearch} ORDER BY ${sort} ${order} LIMIT {limit:UInt32} OFFSET {offset:UInt32}`,
    query_params: params,
    format: 'JSONEachRow',
  })
  const rows = await dataResult.json<Record<string, unknown>>()

  const data = rows.map(normalizeStatRow)

  const response = {
    success: true,
    data,
    meta: { total, filteredTotal, limit, offset, hasMore: offset + limit < filteredTotal },
  }

  setCache(cacheKey, response)
  return NextResponse.json(response)
}

async function handleClansQuery(
  table: string, serverId: string, search: string | undefined,
  sort: string, order: string, limit: number, offset: number,
  cacheKey: string, _ttl: number,
) {
  const params: Record<string, string | number> = { server_id: serverId, limit, offset }
  let whereSearch = ''
  if (search) {
    params.search = `%${search}%`
    whereSearch = ` AND clan ILIKE {search:String}`
  }

  const baseWhere = `WHERE server_id = {server_id:String} AND clan != ''${whereSearch}`

  const totalResult = await clickhouse.query({
    query: `SELECT count(DISTINCT clan) as cnt FROM ${table} FINAL WHERE server_id = {server_id:String} AND clan != ''`,
    query_params: { server_id: serverId },
    format: 'JSONEachRow',
  })
  const totalRows = await totalResult.json<{ cnt: string }>()
  const total = Number(totalRows[0]?.cnt || 0)

  let filteredTotal = total
  if (search) {
    const filteredResult = await clickhouse.query({
      query: `SELECT count(DISTINCT clan) as cnt FROM ${table} FINAL ${baseWhere}`,
      query_params: params,
      format: 'JSONEachRow',
    })
    const filteredRows = await filteredResult.json<{ cnt: string }>()
    filteredTotal = Number(filteredRows[0]?.cnt || 0)
  }

  const dataResult = await clickhouse.query({
    query: `
      SELECT
        ${buildClanSelectColumns()}
      FROM ${table} FINAL
      ${baseWhere}
      GROUP BY clan
      ORDER BY ${sort} ${order}
      LIMIT {limit:UInt32} OFFSET {offset:UInt32}
    `,
    query_params: params,
    format: 'JSONEachRow',
  })
  const rows = await dataResult.json<Record<string, unknown>>()

  const data = rows.map(row => {
    const normalized = normalizeStatRow(row)
    normalized.member_count = Number(row.member_count) || 0
    return normalized
  })

  const response = {
    success: true,
    data,
    meta: { total, filteredTotal, limit, offset, hasMore: offset + limit < filteredTotal },
  }

  setCache(cacheKey, response)
  return NextResponse.json(response)
}
