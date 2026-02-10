import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { clickhouse } from '@/lib/clickhouse'
import { authenticateWithScope } from '@/services/api-auth'
import { logger } from '@/lib/logger'
import { auditUpdate } from '@/services/audit'

const playerSchema = z.object({
  steamId: z.string().min(1).max(20),
  playerName: z.string().min(1).max(100),
  connectionTime: z.number().int().min(0),
  idleTime: z.number().int().min(0),
})

const playersUpdateSchema = z.object({
  serverId: z.string().min(1).max(60),
  serverName: z.string().min(1).max(100).optional(),
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

    const { serverId, serverName, playerCount, players } = parsed.data

    const identifier = await prisma.serverIdentifier.findFirst({
      where: { hashedId: serverId },
      select: { id: true, name: true, ip: true, port: true, categoryId: true, category: { select: { name: true } } },
    })

    if (!identifier) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Server identifier not found' } },
        { status: 404 }
      )
    }

    // SECURITY: Session-derived context from auth
    // Update server name if provided and different
    const updateData: any = {
      playerData: players,
      playerCount,
      lastPlayerUpdate: new Date(),
    }

    const nameChanged = serverName && serverName !== identifier.name
    if (nameChanged) {
      updateData.name = serverName
    }

    await prisma.serverIdentifier.update({
      where: { id: identifier.id },
      data: updateData,
    })

    // SECURITY: Audit logged - server name change
    if (nameChanged) {
      await auditUpdate(
        'server_identifier',
        identifier.id,
        authResult.context,
        { name: identifier.name },
        { name: serverName },
        request
      ).catch(err => logger.admin.error('Audit log failed', err))
    }

    if (identifier.ip && identifier.port) {
      const currentName = serverName || identifier.name
      clickhouse.insert({
        table: 'server_population_stats',
        values: [{
          server_id: serverId,
          server_name: currentName,
          server_ip: identifier.ip,
          server_port: identifier.port,
          category_id: identifier.categoryId ? parseInt(identifier.categoryId, 10) || 0 : 0,
          category: identifier.category?.name || '',
          players: playerCount,
          max_players: 0,
          last_wipe: null,
          next_wipe: null,
          days_since_wipe: null,
        }],
        format: 'JSONEachRow',
      }).catch(err => logger.admin.error('Failed to insert population stats', err))
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.admin.error('Failed to update player data', error as Error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update player data' } },
      { status: 500 }
    )
  }
}
