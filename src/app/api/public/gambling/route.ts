import { NextRequest, NextResponse } from 'next/server'
import { prisma, serializePrisma } from '@/lib/db'

interface CacheEntry<T> {
  data: T
  timestamp: number
}

const gamblingCache = new Map<string, CacheEntry<unknown>>()
const CACHE_TTL = 60_000

function getCached<T>(key: string): T | null {
  const entry = gamblingCache.get(key)
  if (entry && Date.now() - entry.timestamp < CACHE_TTL) {
    return entry.data as T
  }
  return null
}

function setCache(key: string, data: unknown): void {
  gamblingCache.set(key, { data, timestamp: Date.now() })
}

/**
 * GET /api/public/gambling
 * Public gambling leaderboard (used by in-game PlayerRanks UI)
 *
 * Query params:
 * - serverId (optional): filter by server
 * - gameType (optional): deathroll | coinflip | diceduel
 * - sort: wins | totalWinnings | biggestWin (default: totalWinnings)
 * - order: asc | desc (default: desc)
 * - start: offset (default: 0)
 * - length: limit (default: 10, max: 50)
 * - search: player name search
 *
 * Returns DataTables-compatible response for PlayerRanks.cs
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const serverId = searchParams.get('serverId')
    const gameType = searchParams.get('gameType')
    const sort = searchParams.get('sort') || 'totalWinnings'
    const order = searchParams.get('order') || 'desc'
    const start = Math.max(0, parseInt(searchParams.get('start') || '0'))
    const length = Math.min(50, Math.max(1, parseInt(searchParams.get('length') || '10')))
    const search = searchParams.get('search')

    const cacheKey = `pub:gamble:${serverId}:${gameType}:${sort}:${order}:${start}:${length}:${search || ''}`
    const cached = getCached(cacheKey)
    if (cached) {
      return NextResponse.json(cached)
    }

    const where: Record<string, unknown> = {}
    if (serverId) where.serverId = serverId
    const validTypes = ['deathroll', 'coinflip', 'diceduel']
    if (gameType && validTypes.includes(gameType)) {
      where.gameType = gameType
    }
    if (search) {
      where.playerName = { contains: search, mode: 'insensitive' }
    }

    const validSortFields = ['wins', 'totalWinnings', 'biggestWin', 'totalWagered']
    const orderByField = validSortFields.includes(sort) ? sort : 'totalWinnings'
    const orderDir = order === 'asc' ? 'asc' : 'desc'

    const [data, total] = await Promise.all([
      prisma.gamblingPlayerStats.findMany({
        where,
        orderBy: { [orderByField]: orderDir },
        skip: start,
        take: length,
      }),
      prisma.gamblingPlayerStats.count({ where }),
    ])

    const response = {
      draw: 1,
      recordsTotal: total,
      recordsFiltered: total,
      data: serializePrisma(data),
    }

    setCache(cacheKey, response)
    return NextResponse.json(response)
  } catch (error) {
    console.error('Public gambling stats error:', error)
    return NextResponse.json(
      { draw: 1, recordsTotal: 0, recordsFiltered: 0, data: [] },
      { status: 200 }
    )
  }
}
