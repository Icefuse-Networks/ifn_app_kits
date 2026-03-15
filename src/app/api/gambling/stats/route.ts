import { NextRequest, NextResponse } from 'next/server'
import { prisma, serializePrisma } from '@/lib/db'
import { requireGamblingRead, requireGamblingWrite } from '@/services/api-auth'
import { generateId } from '@/lib/id'
import { z } from 'zod'

const VALID_GAME_TYPES = ['deathroll', 'coinflip', 'diceduel'] as const

const submitWinSchema = z.object({
  steamId: z.string().min(1).max(20),
  playerName: z.string().min(1).max(100),
  gameType: z.enum(VALID_GAME_TYPES),
  wager: z.number().int().positive(),
  winnings: z.number().int().positive(),
  serverId: z.string().min(1).max(100),
})

const batchSubmitSchema = z.object({
  events: z.array(submitWinSchema).min(1).max(50),
})

/**
 * GET /api/gambling/stats
 * Fetch gambling leaderboard/stats
 *
 * Query params:
 * - serverId (optional): filter by server
 * - gameType (optional): filter by game type
 * - sortBy: 'wins' | 'totalWinnings' | 'biggestWin' (default: totalWinnings)
 * - order: 'asc' | 'desc' (default: desc)
 * - page: page number (default: 0)
 * - limit: results per page (default: 10, max: 50)
 * - search: player name search
 * - steamId: get stats for specific player
 */
export async function GET(request: NextRequest) {
  const authResult = await requireGamblingRead(request)
  if (!authResult.success) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: authResult.error } },
      { status: authResult.status }
    )
  }

  const { searchParams } = new URL(request.url)
  const serverId = searchParams.get('serverId')
  const gameType = searchParams.get('gameType')
  const sortBy = searchParams.get('sortBy') || 'totalWinnings'
  const order = searchParams.get('order') || 'desc'
  const page = Math.max(0, parseInt(searchParams.get('page') || '0'))
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '10')))
  const search = searchParams.get('search')
  const steamId = searchParams.get('steamId')

  try {
    const where: Record<string, unknown> = {}
    if (serverId) where.serverId = serverId
    if (gameType && VALID_GAME_TYPES.includes(gameType as typeof VALID_GAME_TYPES[number])) {
      where.gameType = gameType
    }
    if (search) {
      where.playerName = { contains: search, mode: 'insensitive' }
    }
    if (steamId) {
      where.steamId = steamId
    }

    const validSortFields = ['wins', 'totalWinnings', 'biggestWin', 'totalWagered', 'lastPlayedAt']
    const orderByField = validSortFields.includes(sortBy) ? sortBy : 'totalWinnings'
    const orderDir = order === 'asc' ? 'asc' : 'desc'

    const [data, total] = await Promise.all([
      prisma.gamblingPlayerStats.findMany({
        where,
        orderBy: { [orderByField]: orderDir },
        skip: page * limit,
        take: limit,
      }),
      prisma.gamblingPlayerStats.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      data: serializePrisma(data),
      recordsTotal: total,
      recordsFiltered: total,
      page,
      limit,
    })
  } catch (error) {
    console.error('Gambling stats GET error:', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch gambling stats' } },
      { status: 500 }
    )
  }
}

/**
 * POST /api/gambling/stats
 * Submit gambling win event(s) from game server
 *
 * Body: { events: [{ steamId, playerName, gameType, wager, winnings, serverId }] }
 * OR single: { steamId, playerName, gameType, wager, winnings, serverId }
 */
export async function POST(request: NextRequest) {
  const authResult = await requireGamblingWrite(request)
  if (!authResult.success) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: authResult.error } },
      { status: authResult.status }
    )
  }

  try {
    const body = await request.json()

    // Support single event or batch
    let events: z.infer<typeof submitWinSchema>[]
    if (body.events) {
      const parsed = batchSubmitSchema.safeParse(body)
      if (!parsed.success) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid request body', details: parsed.error.flatten() } },
          { status: 400 }
        )
      }
      events = parsed.data.events
    } else {
      const parsed = submitWinSchema.safeParse(body)
      if (!parsed.success) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid request body', details: parsed.error.flatten() } },
          { status: 400 }
        )
      }
      events = [parsed.data]
    }

    // Process all events in a transaction
    await prisma.$transaction(async (tx) => {
      for (const event of events) {
        // Create win event
        await tx.gamblingWinEvent.create({
          data: {
            id: generateId('gamblingWinEvent'),
            steamId: event.steamId,
            playerName: event.playerName,
            gameType: event.gameType,
            wager: event.wager,
            winnings: event.winnings,
            serverId: event.serverId,
          },
        })

        // Upsert player stats
        const existing = await tx.gamblingPlayerStats.findUnique({
          where: {
            steamId_serverId_gameType: {
              steamId: event.steamId,
              serverId: event.serverId,
              gameType: event.gameType,
            },
          },
        })

        if (existing) {
          await tx.gamblingPlayerStats.update({
            where: { id: existing.id },
            data: {
              playerName: event.playerName,
              wins: { increment: 1 },
              totalWinnings: { increment: event.winnings },
              totalWagered: { increment: event.wager },
              biggestWin: event.winnings > existing.biggestWin ? event.winnings : existing.biggestWin,
              lastPlayedAt: new Date(),
            },
          })
        } else {
          await tx.gamblingPlayerStats.create({
            data: {
              id: generateId('gamblingPlayerStats'),
              steamId: event.steamId,
              playerName: event.playerName,
              serverId: event.serverId,
              gameType: event.gameType,
              wins: 1,
              totalWinnings: event.winnings,
              totalWagered: event.wager,
              biggestWin: event.winnings,
              lastPlayedAt: new Date(),
            },
          })
        }
      }
    })

    return NextResponse.json({ success: true, processed: events.length })
  } catch (error) {
    console.error('Gambling stats POST error:', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to submit gambling stats' } },
      { status: 500 }
    )
  }
}
