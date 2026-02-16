import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { authenticateWithScope, requireSession } from '@/services/api-auth'
import { auditCreate, auditUpdate, auditDelete } from '@/services/audit'
import { logger } from '@/lib/logger'
import { id } from '@/lib/id'
import { prisma } from '@/lib/db'

// SECURITY: Zod validated input schemas
const createGiveawaySchema = z.object({
  name: z.string().min(1).max(100).trim(),
  description: z.string().max(500).optional(),
  isActive: z.boolean().default(false),
  isGlobal: z.boolean().default(false),
  minPlaytimeHours: z.number().min(0).max(1000).default(2),
  maxWinners: z.number().int().min(1).max(100).default(1),
  startAt: z.string().datetime().optional().nullable(),
  endAt: z.string().datetime().optional().nullable(),
  serverIdentifiers: z.array(z.string().min(1).max(100)).max(100).optional(),
})

const updateGiveawaySchema = createGiveawaySchema.partial().extend({
  winnerId: z.string().max(60).optional().nullable(),
  winnerName: z.string().max(255).optional().nullable(),
  winnerSteamId64: z.string().min(17).max(17).regex(/^\d{17}$/).optional().nullable(),
  endedAt: z.string().datetime().optional().nullable(),
})

const listQuerySchema = z.object({
  includeInactive: z.enum(['true', 'false']).optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
})

/**
 * Auto-lifecycle: activate giveaways whose startAt has passed,
 * deactivate + pick winner for giveaways whose endAt has passed.
 */
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

  // Auto-end: endAt <= now, still active
  const expiredGiveaways = await prisma.giveaway.findMany({
    where: {
      isActive: true,
      endAt: { lte: now },
      endedAt: null,
    },
    include: { players: true },
  })

  for (const giveaway of expiredGiveaways) {
    // Pick random winner(s) from entries
    const winnerCount = Math.min(giveaway.maxWinners, giveaway.players.length)
    const shuffled = [...giveaway.players].sort(() => Math.random() - 0.5)
    const winners = shuffled.slice(0, winnerCount)

    // Mark winners on player records
    if (winners.length > 0) {
      await prisma.giveawayPlayer.updateMany({
        where: { id: { in: winners.map(w => w.id) } },
        data: { isWinner: true },
      })
    }

    // Store primary winner on giveaway for quick display
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
    logger.admin.info(`Giveaway "${giveaway.name}" auto-ended. Winners: ${winnerNames || 'none (no entries)'}`)
  }
}

export async function GET(request: NextRequest) {
  const authResult = await authenticateWithScope(request, 'giveaways:read')
  if (!authResult.success) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  try {
    // Auto-start/stop giveaways based on time window
    await processGiveawayLifecycle()

    const { searchParams } = new URL(request.url)
    const parsed = listQuerySchema.safeParse({
      includeInactive: searchParams.get('includeInactive') || undefined,
      limit: searchParams.get('limit') || undefined,
    })

    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 })
    }

    const { includeInactive, limit } = parsed.data
    const where = includeInactive === 'true' ? {} : { isActive: true }

    const giveaways = await prisma.giveaway.findMany({
      where,
      include: {
        servers: true,
        _count: { select: { players: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })

    return NextResponse.json({ success: true, data: giveaways })
  } catch (error) {
    logger.admin.error('Failed to list giveaways', error as Error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const authResult = await requireSession(request)
  if (!authResult.success) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  try {
    const body = await request.json()
    const parsed = createGiveawaySchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 })
    }

    const { serverIdentifiers, startAt, endAt, ...data } = parsed.data
    const giveawayId = id.giveaway()

    const giveaway = await prisma.giveaway.create({
      data: {
        id: giveawayId,
        ...data,
        startAt: startAt ? new Date(startAt) : null,
        endAt: endAt ? new Date(endAt) : null,
        servers: serverIdentifiers?.length ? {
          create: serverIdentifiers.map(si => ({
            id: id.giveawayServer(),
            serverIdentifier: si,
          })),
        } : undefined,
      },
      include: { servers: true },
    })

    await auditCreate('giveaway', giveaway.id, authResult.context, { name: giveaway.name, isGlobal: giveaway.isGlobal }, request)

    return NextResponse.json({ success: true, data: giveaway }, { status: 201 })
  } catch (error) {
    logger.admin.error('Failed to create giveaway', error as Error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  const authResult = await requireSession(request)
  if (!authResult.success) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  try {
    const { searchParams } = new URL(request.url)
    const giveawayId = searchParams.get('id')

    // SECURITY: Zod validated ID
    if (!giveawayId || giveawayId.length > 60) {
      return NextResponse.json({ error: 'Giveaway ID required' }, { status: 400 })
    }

    const existing = await prisma.giveaway.findUnique({ where: { id: giveawayId }, include: { servers: true } })
    if (!existing) {
      return NextResponse.json({ error: 'Giveaway not found' }, { status: 404 })
    }

    const body = await request.json()
    // SECURITY: Zod validated
    const parsed = updateGiveawaySchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: { code: 'VALIDATION_ERROR', details: parsed.error.flatten() } }, { status: 400 })
    }

    const { serverIdentifiers, startAt, endAt, endedAt, ...data } = parsed.data

    const giveaway = await prisma.$transaction(async (tx) => {
      if (serverIdentifiers !== undefined) {
        await tx.giveawayServer.deleteMany({ where: { giveawayId } })
        if (serverIdentifiers.length > 0) {
          await tx.giveawayServer.createMany({
            data: serverIdentifiers.map(si => ({
              id: id.giveawayServer(),
              giveawayId,
              serverIdentifier: si,
            })),
          })
        }
      }

      return tx.giveaway.update({
        where: { id: giveawayId },
        data: {
          ...data,
          startAt: startAt !== undefined ? (startAt ? new Date(startAt) : null) : undefined,
          endAt: endAt !== undefined ? (endAt ? new Date(endAt) : null) : undefined,
          endedAt: endedAt !== undefined ? (endedAt ? new Date(endedAt) : null) : undefined,
        },
        include: { servers: true },
      })
    })

    await auditUpdate('giveaway', giveawayId, authResult.context, { name: existing.name }, { name: giveaway.name, isActive: giveaway.isActive }, request)

    return NextResponse.json({ success: true, data: giveaway })
  } catch (error) {
    logger.admin.error('Failed to update giveaway', error as Error)
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
    const giveawayId = searchParams.get('id')

    // SECURITY: Validate ID
    if (!giveawayId || giveawayId.length > 60) {
      return NextResponse.json({ error: 'Giveaway ID required' }, { status: 400 })
    }

    const giveaway = await prisma.giveaway.findUnique({ where: { id: giveawayId } })
    if (!giveaway) {
      return NextResponse.json({ error: 'Giveaway not found' }, { status: 404 })
    }

    await prisma.giveaway.delete({ where: { id: giveawayId } })
    await auditDelete('giveaway', giveawayId, authResult.context, { name: giveaway.name }, request)

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.admin.error('Failed to delete giveaway', error as Error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
