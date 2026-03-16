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
 * - since (optional): ISO date string — only include events after this date
 * - sort: wins | totalWinnings | biggestWin (default: totalWinnings)
 * - order: asc | desc (default: desc)
 * - start: offset (default: 0)
 * - length: limit (default: 10, max: 50)
 * - search: player name search
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const serverId = searchParams.get('serverId')
    const gameType = searchParams.get('gameType')
    const sinceRaw = searchParams.get('since')
    const sort = searchParams.get('sort') || 'totalWinnings'
    const order = searchParams.get('order') || 'desc'
    const start = Math.max(0, parseInt(searchParams.get('start') || '0'))
    const length = Math.min(50, Math.max(1, parseInt(searchParams.get('length') || '10')))
    const search = searchParams.get('search')

    const sinceDate = sinceRaw ? new Date(sinceRaw) : null
    const validSince = sinceDate && !isNaN(sinceDate.getTime()) ? sinceDate : null

    const cacheKey = `pub:gamble:${serverId}:${gameType}:${sinceRaw || 'all'}:${sort}:${order}:${start}:${length}:${search || ''}`
    const cached = getCached(cacheKey)
    if (cached) {
      return NextResponse.json(cached)
    }

    // No since = overall, use pre-aggregated stats table (fast)
    if (!validSince) {
      const where: Record<string, unknown> = {}
      if (serverId) where.serverId = serverId
      const validTypes = ['deathroll', 'coinflip', 'diceduel']
      if (gameType && validTypes.includes(gameType)) where.gameType = gameType
      if (search) where.playerName = { contains: search, mode: 'insensitive' }

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

      const response = { draw: 1, recordsTotal: total, recordsFiltered: total, data: serializePrisma(data) }
      setCache(cacheKey, response)
      return NextResponse.json(response)
    }

    // With since: aggregate from win events table
    const eventWhere: Record<string, unknown> = {
      createdAt: { gte: validSince },
    }
    if (serverId) eventWhere.serverId = serverId
    const validTypes = ['deathroll', 'coinflip', 'diceduel']
    if (gameType && validTypes.includes(gameType)) eventWhere.gameType = gameType
    if (search) eventWhere.playerName = { contains: search, mode: 'insensitive' }

    const grouped = await prisma.gamblingWinEvent.groupBy({
      by: ['steamId', 'playerName', 'gameType', 'serverId'],
      where: eventWhere,
      _count: { id: true },
      _sum: { winnings: true, wager: true },
      _max: { winnings: true },
    })

    const mapped = grouped.map(g => ({
      steamId: g.steamId,
      playerName: g.playerName,
      gameType: g.gameType,
      serverId: g.serverId,
      wins: g._count.id,
      totalWinnings: g._sum.winnings || 0,
      totalWagered: g._sum.wager || 0,
      biggestWin: g._max.winnings || 0,
    }))

    const validSortFields: Record<string, keyof typeof mapped[0]> = {
      wins: 'wins',
      totalWinnings: 'totalWinnings',
      biggestWin: 'biggestWin',
      totalWagered: 'totalWagered',
    }
    const sortField = validSortFields[sort] || 'totalWinnings'
    const dir = order === 'asc' ? 1 : -1
    mapped.sort((a, b) => {
      const av = Number(a[sortField]) || 0
      const bv = Number(b[sortField]) || 0
      return (av - bv) * dir
    })

    const total = mapped.length
    const paged = mapped.slice(start, start + length)

    const response = { draw: 1, recordsTotal: total, recordsFiltered: total, data: paged }
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
