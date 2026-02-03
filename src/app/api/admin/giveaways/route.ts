import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { authenticateWithScope, requireSession } from '@/services/api-auth'
import { auditCreate, auditUpdate, auditDelete } from '@/services/audit'
import { logger } from '@/lib/logger'
import { id } from '@/lib/id'
import { prisma } from '@/lib/db'

const createGiveawaySchema = z.object({
  name: z.string().min(1).max(100).trim(),
  description: z.string().max(500).optional(),
  isActive: z.boolean().default(false),
  isGlobal: z.boolean().default(false),
  minPlaytimeHours: z.number().min(0).max(1000).default(2),
  startAt: z.string().datetime().optional().nullable(),
  endAt: z.string().datetime().optional().nullable(),
  serverIdentifiers: z.array(z.string().max(100)).optional(),
})

const updateGiveawaySchema = createGiveawaySchema.partial()

const listQuerySchema = z.object({
  includeInactive: z.enum(['true', 'false']).optional(),
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

    if (!giveawayId) {
      return NextResponse.json({ error: 'Giveaway ID required' }, { status: 400 })
    }

    const existing = await prisma.giveaway.findUnique({ where: { id: giveawayId }, include: { servers: true } })
    if (!existing) {
      return NextResponse.json({ error: 'Giveaway not found' }, { status: 404 })
    }

    const body = await request.json()
    const parsed = updateGiveawaySchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 })
    }

    const { serverIdentifiers, startAt, endAt, ...data } = parsed.data

    const giveaway = await prisma.$transaction(async (tx: typeof prisma) => {
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

    if (!giveawayId) {
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
