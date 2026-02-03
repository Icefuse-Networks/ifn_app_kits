import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { authenticateWithScope, requireSession } from '@/services/api-auth'
import { auditCreate, auditDelete } from '@/services/audit'
import { logger } from '@/lib/logger'
import { id } from '@/lib/id'
import { prisma } from '@/lib/db'

const giveawayPlayerSchema = z.object({
  playerName: z.string().min(1).max(255).trim(),
  playerSteamId64: z.string().min(17).max(17).regex(/^\d{17}$/),
  playTime: z.number().min(0),
  server: z.string().min(1).max(255).trim(),
  giveawayId: z.string().max(60).optional(),
})

const listQuerySchema = z.object({
  steamId: z.string().optional(),
  server: z.string().optional(),
  giveawayId: z.string().optional(),
  search: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
})

export async function GET(request: NextRequest) {
  const authResult = await authenticateWithScope(request, 'giveaways:read')
  if (!authResult.success) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  try {
    const { searchParams } = new URL(request.url)
    const parsed = listQuerySchema.safeParse({
      steamId: searchParams.get('steamId') || undefined,
      server: searchParams.get('server') || undefined,
      giveawayId: searchParams.get('giveawayId') || undefined,
      search: searchParams.get('search') || undefined,
      limit: searchParams.get('limit') || undefined,
    })

    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 })
    }

    const { steamId, server, giveawayId, search, limit } = parsed.data
    const where: Record<string, unknown> = {}

    if (steamId) where.playerSteamId64 = steamId
    if (server) where.server = server
    if (giveawayId) where.giveawayId = giveawayId
    if (search) {
      where.OR = [
        { playerSteamId64: { contains: search } },
        { playerName: { contains: search, mode: 'insensitive' } },
      ]
    }

    const players = await prisma.giveawayPlayer.findMany({
      where,
      include: { giveaway: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })

    return NextResponse.json({ success: true, data: players, count: players.length })
  } catch (error) {
    logger.admin.error('Failed to list giveaway players', error as Error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const authResult = await authenticateWithScope(request, 'giveaways:write')
  if (!authResult.success) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  try {
    const body = await request.json()
    const parsed = giveawayPlayerSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 })
    }

    const { playerName, playerSteamId64, playTime, server, giveawayId } = parsed.data

    if (giveawayId) {
      const existing = await prisma.giveawayPlayer.findFirst({
        where: { playerSteamId64, giveawayId },
      })
      if (existing) {
        return NextResponse.json({ success: false, error: 'Player already entered this giveaway' }, { status: 409 })
      }
    }

    const player = await prisma.giveawayPlayer.create({
      data: {
        id: id.giveawayPlayer(),
        playerName,
        playerSteamId64,
        playTime,
        server,
        giveawayId,
      },
    })

    await auditCreate('giveaway_player', player.id, authResult.context, { playerName, playerSteamId64, server }, request)

    return NextResponse.json({ success: true, data: player }, { status: 201 })
  } catch (error) {
    logger.admin.error('Failed to create giveaway player', error as Error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const authResult = await requireSession(request)
  if (!authResult.success) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  try {
    const { searchParams } = new URL(request.url)
    const playerId = searchParams.get('id')

    if (!playerId) {
      return NextResponse.json({ error: 'Player ID required' }, { status: 400 })
    }

    const player = await prisma.giveawayPlayer.findUnique({ where: { id: playerId } })
    if (!player) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 })
    }

    await prisma.giveawayPlayer.delete({ where: { id: playerId } })
    await auditDelete('giveaway_player', playerId, authResult.context, { playerName: player.playerName, playerSteamId64: player.playerSteamId64 }, request)

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.admin.error('Failed to delete giveaway player', error as Error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
