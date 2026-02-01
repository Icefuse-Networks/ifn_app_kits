import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { authenticateWithScope } from '@/services/api-auth'
import { logger } from '@/lib/logger'

const playerSchema = z.object({
  steamId: z.string().min(1).max(20),
  playerName: z.string().min(1).max(100),
  connectionTime: z.number().int().min(0),
  idleTime: z.number().int().min(0),
})

const playersUpdateSchema = z.object({
  serverId: z.string().min(1).max(60),
  playerCount: z.number().int().min(0),
  players: z.array(playerSchema).max(500),
})

export async function POST(request: NextRequest) {
  const authResult = await authenticateWithScope(request, 'identifiers:register')

  if (!authResult.success) {
    return NextResponse.json(
      { success: false, error: { code: 'AUTH_ERROR', message: authResult.error } },
      { status: authResult.status }
    )
  }

  try {
    const body = await request.json()
    const parsed = playersUpdateSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Validation failed', details: parsed.error.flatten() } },
        { status: 400 }
      )
    }

    const { serverId, playerCount, players } = parsed.data

    const identifier = await prisma.serverIdentifier.findFirst({
      where: { hashedId: serverId },
      select: { id: true },
    })

    if (!identifier) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Server identifier not found' } },
        { status: 404 }
      )
    }

    await prisma.serverIdentifier.update({
      where: { id: identifier.id },
      data: {
        playerData: players,
        playerCount,
        lastPlayerUpdate: new Date(),
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.admin.error('Failed to update player data', error as Error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update player data' } },
      { status: 500 }
    )
  }
}
