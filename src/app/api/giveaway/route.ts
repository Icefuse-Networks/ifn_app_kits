import { NextRequest, NextResponse } from 'next/server'
import { randomInt } from 'crypto'
import { z } from 'zod'
import { authenticateWithScope } from '@/services/api-auth'
import { logger } from '@/lib/logger'
import { id } from '@/lib/id'
import { prisma } from '@/lib/db'

// SECURITY: Cryptographically secure Fisher-Yates shuffle (replaces Math.random sort)
function cryptoShuffle<T>(array: T[]): T[] {
  const arr = [...array]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randomInt(0, i + 1)
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

// SECURITY: Zod validated input schemas
const entrySchema = z.object({
  playerName: z.string().min(1).max(255).trim(),
  playerSteamId64: z.string().min(17).max(17).regex(/^\d{17}$/),
  playTime: z.number().min(0),
  server: z.string().min(1).max(255).trim(),
})

const checkQuerySchema = z.object({
  steamId: z.string().min(17).max(17).regex(/^\d{17}$/).optional(),
  server: z.string().min(1).max(255).optional(),
})

// Shared active giveaway query builder - enforces time window + server match
function buildActiveGiveawayWhere(server?: string) {
  const now = new Date()
  return {
    isActive: true,
    AND: [
      {
        OR: [
          { startAt: null, endAt: null },
          { startAt: { lte: now }, endAt: null },
          { startAt: null, endAt: { gte: now } },
          { startAt: { lte: now }, endAt: { gte: now } },
        ],
      },
      {
        OR: [
          { isGlobal: true },
          ...(server ? [{ servers: { some: { serverIdentifier: server } } }] : []),
        ],
      },
    ],
  }
}

// Auto-lifecycle: activate/deactivate giveaways based on time window
async function processGiveawayLifecycle() {
  const now = new Date()

  // Auto-activate: startAt <= now, not yet active, not already ended
  await prisma.giveaway.updateMany({
    where: {
      isActive: false,
      startAt: { lte: now },
      endedAt: null,
      OR: [
        { endAt: null },
        { endAt: { gt: now } },
      ],
    },
    data: { isActive: true },
  })

  // Auto-end + pick winner: endAt <= now, still active
  const expiredGiveaways = await prisma.giveaway.findMany({
    where: {
      isActive: true,
      endAt: { lte: now },
      endedAt: null,
    },
    include: { players: true },
  })

  for (const giveaway of expiredGiveaways) {
    const winnerCount = Math.min(giveaway.maxWinners, giveaway.players.length)
    // SECURITY: Crypto-secure shuffle to prevent predictable winner selection
    const shuffled = cryptoShuffle(giveaway.players)
    const winners = shuffled.slice(0, winnerCount)

    if (winners.length > 0) {
      await prisma.giveawayPlayer.updateMany({
        where: { id: { in: winners.map(w => w.id) } },
        data: { isWinner: true },
      })
    }

    const primaryWinner = winners[0]
    await prisma.giveaway.update({
      where: { id: giveaway.id },
      data: {
        isActive: false,
        endedAt: now,
        ...(primaryWinner ? {
          winnerId: primaryWinner.id,
          winnerName: primaryWinner.playerName,
          winnerSteamId64: primaryWinner.playerSteamId64,
        } : {}),
      },
    })

    const winnerNames = winners.map(w => w.playerName).join(', ')
    logger.admin.info(`Giveaway "${giveaway.name}" auto-ended. Winners: ${winnerNames || 'none'}`)
  }
}

export async function GET(request: NextRequest) {
  // SECURITY: Scope check
  const authResult = await authenticateWithScope(request, 'giveaways:read')
  if (!authResult.success) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  try {
    // Auto-start/stop giveaways based on time window
    await processGiveawayLifecycle()

    const { searchParams } = new URL(request.url)
    // SECURITY: Zod validated
    const parsed = checkQuerySchema.safeParse({
      steamId: searchParams.get('steamId') || undefined,
      server: searchParams.get('server') || undefined,
    })

    if (!parsed.success) {
      return NextResponse.json({ error: { code: 'VALIDATION_ERROR', details: parsed.error.flatten() } }, { status: 400 })
    }

    const { steamId, server } = parsed.data

    const activeGiveaway = await prisma.giveaway.findFirst({
      where: buildActiveGiveawayWhere(server),
      include: { servers: true },
      orderBy: { createdAt: 'desc' },
    })

    if (!activeGiveaway) {
      // Return most recently ended giveaway for winner announcement
      const recentlyEnded = await prisma.giveaway.findFirst({
        where: {
          endedAt: { not: null },
          ...(server ? {
            OR: [
              { isGlobal: true },
              { servers: { some: { serverIdentifier: server } } },
            ],
          } : {}),
        },
        orderBy: { endedAt: 'desc' },
      })

      return NextResponse.json({
        success: true,
        active: false,
        message: 'No active giveaway',
        giveaway: recentlyEnded ? {
          id: recentlyEnded.id,
          name: recentlyEnded.name,
          winnerName: recentlyEnded.winnerName,
          winnerSteamId64: recentlyEnded.winnerSteamId64,
        } : null,
        data: [],
        count: 0,
      })
    }

    if (steamId) {
      const entry = await prisma.giveawayPlayer.findFirst({
        where: { playerSteamId64: steamId, giveawayId: activeGiveaway.id },
      })

      return NextResponse.json({
        success: true,
        active: true,
        giveaway: {
          id: activeGiveaway.id,
          name: activeGiveaway.name,
          minPlaytimeHours: activeGiveaway.minPlaytimeHours,
          endAt: activeGiveaway.endAt,
        },
        hasEntered: !!entry,
        data: entry ? [entry] : [],
        count: entry ? 1 : 0,
      })
    }

    return NextResponse.json({
      success: true,
      active: true,
      giveaway: {
        id: activeGiveaway.id,
        name: activeGiveaway.name,
        minPlaytimeHours: activeGiveaway.minPlaytimeHours,
        endAt: activeGiveaway.endAt,
      },
    })
  } catch (error) {
    logger.admin.error('Failed to check giveaway', error as Error)
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Operation failed' } }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  // SECURITY: Scope check
  const authResult = await authenticateWithScope(request, 'giveaways:write')
  if (!authResult.success) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  try {
    const body = await request.json()
    // SECURITY: Zod validated
    const parsed = entrySchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: { code: 'VALIDATION_ERROR', details: parsed.error.flatten() } }, { status: 400 })
    }

    const { playerName, playerSteamId64, playTime, server } = parsed.data

    // SECURITY: Fail-closed - verify giveaway is active before allowing entry
    const activeGiveaway = await prisma.giveaway.findFirst({
      where: buildActiveGiveawayWhere(server),
      orderBy: { createdAt: 'desc' },
    })

    if (!activeGiveaway) {
      return NextResponse.json({ success: false, error: 'No active giveaway for this server' }, { status: 400 })
    }

    // SECURITY: Server-side playtime enforcement
    const minPlaytimeSeconds = activeGiveaway.minPlaytimeHours * 3600
    if (playTime < minPlaytimeSeconds) {
      return NextResponse.json({
        success: false,
        error: `Minimum playtime required: ${activeGiveaway.minPlaytimeHours} hours`,
        required: minPlaytimeSeconds,
        current: playTime,
      }, { status: 400 })
    }

    // SECURITY: Idempotency check - prevent duplicate entries
    const existing = await prisma.giveawayPlayer.findFirst({
      where: { playerSteamId64, giveawayId: activeGiveaway.id },
    })

    if (existing) {
      return NextResponse.json({ success: false, error: 'Already entered this giveaway' }, { status: 409 })
    }

    const player = await prisma.giveawayPlayer.create({
      data: {
        id: id.giveawayPlayer(),
        playerName,
        playerSteamId64,
        playTime,
        server,
        giveawayId: activeGiveaway.id,
      },
    })

    return NextResponse.json({
      success: true,
      data: player,
      giveaway: { id: activeGiveaway.id, name: activeGiveaway.name },
    }, { status: 201 })
  } catch (error) {
    logger.admin.error('Failed to enter giveaway', error as Error)
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Operation failed' } }, { status: 500 })
  }
}
