import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { authenticateWithScope } from '@/services/api-auth'
import { logger } from '@/lib/logger'
import { id } from '@/lib/id'
import { prisma } from '@/lib/db'

const entrySchema = z.object({
  playerName: z.string().min(1).max(255).trim(),
  playerSteamId64: z.string().min(17).max(17).regex(/^\d{17}$/),
  playTime: z.number().min(0),
  server: z.string().min(1).max(255).trim(),
})

const checkQuerySchema = z.object({
  steamId: z.string().min(17).max(17).regex(/^\d{17}$/).optional(),
  server: z.string().optional(),
})

export async function GET(request: NextRequest) {
  const authResult = await authenticateWithScope(request, 'giveaways:read')
  if (!authResult.success) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  try {
    const { searchParams } = new URL(request.url)
    const parsed = checkQuerySchema.safeParse({
      steamId: searchParams.get('steamId') || undefined,
      server: searchParams.get('server') || undefined,
    })

    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 })
    }

    const { steamId, server } = parsed.data

    const now = new Date()
    const activeGiveaway = await prisma.giveaway.findFirst({
      where: {
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
      },
      include: { servers: true },
      orderBy: { createdAt: 'desc' },
    })

    if (!activeGiveaway) {
      return NextResponse.json({
        success: true,
        active: false,
        message: 'No active giveaway',
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
    const parsed = entrySchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 })
    }

    const { playerName, playerSteamId64, playTime, server } = parsed.data

    const now = new Date()
    const activeGiveaway = await prisma.giveaway.findFirst({
      where: {
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
              { servers: { some: { serverIdentifier: server } } },
            ],
          },
        ],
      },
      orderBy: { createdAt: 'desc' },
    })

    if (!activeGiveaway) {
      return NextResponse.json({ success: false, error: 'No active giveaway for this server' }, { status: 400 })
    }

    const minPlaytimeSeconds = activeGiveaway.minPlaytimeHours * 3600
    if (playTime < minPlaytimeSeconds) {
      return NextResponse.json({
        success: false,
        error: `Minimum playtime required: ${activeGiveaway.minPlaytimeHours} hours`,
        required: minPlaytimeSeconds,
        current: playTime,
      }, { status: 400 })
    }

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
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
