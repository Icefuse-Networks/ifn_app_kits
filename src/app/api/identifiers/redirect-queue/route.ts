import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { authenticateWithScope, requireSession } from '@/services/api-auth'
import { auditCreate, auditUpdate } from '@/services/audit'
import { id } from '@/lib/id'
import { logger } from '@/lib/logger'

const queueRedirectSchema = z.object({
  sourceServerId: z.string().min(1).max(60),
  targetServerId: z.string().min(1).max(60),
  reason: z.string().max(50).optional(),
  players: z.array(z.object({
    steamId: z.string().min(1).max(20),
    playerName: z.string().max(100).optional(),
  })).min(1).max(500),
})

const pollQueueSchema = z.object({
  serverId: z.string().min(1).max(60),
})

const completeRedirectSchema = z.object({
  ids: z.array(z.string().min(1).max(60)).min(1).max(100),
  status: z.enum(['completed', 'failed']),
  failureReason: z.string().max(200).optional(),
})

const cancelRedirectSchema = z.object({
  ids: z.array(z.string().min(1).max(60)).min(1).max(100),
})

export async function POST(request: NextRequest) {
  const authResult = await requireSession(request)
  if (!authResult.success) {
    return NextResponse.json(
      { success: false, error: { code: 'AUTH_ERROR', message: authResult.error } },
      { status: authResult.status }
    )
  }

  try {
    const body = await request.json()
    const parsed = queueRedirectSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Validation failed', details: parsed.error.flatten() } },
        { status: 400 }
      )
    }

    const { sourceServerId, targetServerId, players, reason } = parsed.data

    const [sourceServer, targetServer] = await Promise.all([
      prisma.serverIdentifier.findFirst({ where: { hashedId: sourceServerId }, select: { id: true, hashedId: true, ip: true, port: true } }),
      prisma.serverIdentifier.findFirst({ where: { hashedId: targetServerId }, select: { id: true, hashedId: true, ip: true, port: true, name: true } }),
    ])

    if (!sourceServer) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Source server not found' } },
        { status: 404 }
      )
    }

    if (!targetServer) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Target server not found' } },
        { status: 404 }
      )
    }

    const queueEntries = players.map(p => ({
      id: id.redirectQueue(),
      sourceServerId: sourceServer.hashedId,
      targetServerId: targetServer.hashedId,
      steamId: p.steamId,
      playerName: p.playerName || null,
      status: 'pending',
      reason: reason || null,
      createdBy: authResult.context.actorId,
    }))

    await prisma.redirectQueue.createMany({ data: queueEntries })

    for (const entry of queueEntries) {
      await auditCreate('redirect_queue', entry.id, authResult.context, {
        sourceServerId: entry.sourceServerId,
        targetServerId: entry.targetServerId,
        steamId: entry.steamId,
      }, request)
    }

    logger.admin.info('Redirect queued', {
      count: players.length,
      sourceServerId,
      targetServerId,
      actor: authResult.context.actorId,
    })

    return NextResponse.json({
      success: true,
      data: {
        queued: queueEntries.length,
        targetServer: { ip: targetServer.ip, port: targetServer.port, name: targetServer.name },
      },
    }, { status: 201 })
  } catch (error) {
    logger.admin.error('Failed to queue redirect', error as Error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to queue redirect' } },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  const authResult = await authenticateWithScope(request, 'redirect:read')
  if (!authResult.success) {
    return NextResponse.json(
      { success: false, error: { code: 'AUTH_ERROR', message: authResult.error } },
      { status: authResult.status }
    )
  }

  try {
    const { searchParams } = new URL(request.url)
    const serverId = searchParams.get('serverId')

    if (!serverId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'serverId required' } },
        { status: 400 }
      )
    }

    const parsed = pollQueueSchema.safeParse({ serverId })
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid serverId' } },
        { status: 400 }
      )
    }

    const pendingRedirects = await prisma.redirectQueue.findMany({
      where: {
        sourceServerId: serverId,
        status: 'pending',
      },
      orderBy: { createdAt: 'asc' },
      take: 100,
    })

    if (pendingRedirects.length === 0) {
      return NextResponse.json({ success: true, data: { redirects: [] } })
    }

    const targetServerIds = [...new Set(pendingRedirects.map(r => r.targetServerId))]
    const targetServers = await prisma.serverIdentifier.findMany({
      where: { hashedId: { in: targetServerIds } },
      select: { hashedId: true, ip: true, port: true, name: true },
    })

    const serverMap = new Map(targetServers.map(s => [s.hashedId, s]))

    const redirects = pendingRedirects.map(r => {
      const target = serverMap.get(r.targetServerId)
      return {
        id: r.id,
        steamId: r.steamId,
        playerName: r.playerName,
        reason: r.reason || null,
        targetIp: target?.ip || null,
        targetPort: target?.port || null,
        targetName: target?.name || null,
      }
    })

    return NextResponse.json({ success: true, data: { redirects } })
  } catch (error) {
    logger.admin.error('Failed to poll redirect queue', error as Error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to poll queue' } },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  const authResult = await authenticateWithScope(request, 'redirect:write')
  if (!authResult.success) {
    return NextResponse.json(
      { success: false, error: { code: 'AUTH_ERROR', message: authResult.error } },
      { status: authResult.status }
    )
  }

  try {
    const body = await request.json()
    const parsed = completeRedirectSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Validation failed', details: parsed.error.flatten() } },
        { status: 400 }
      )
    }

    const { ids, status, failureReason } = parsed.data

    const result = await prisma.redirectQueue.updateMany({
      where: {
        id: { in: ids },
        status: 'pending',
      },
      data: {
        status,
        failureReason: failureReason || null,
        processedAt: new Date(),
      },
    })

    for (const entryId of ids) {
      await auditUpdate('redirect_queue', entryId, authResult.context, { status: 'pending' }, { status }, request)
    }

    logger.admin.info('Redirect queue updated', {
      count: result.count,
      status,
      actor: authResult.context.actorId,
    })

    return NextResponse.json({ success: true, data: { updated: result.count } })
  } catch (error) {
    logger.admin.error('Failed to update redirect queue', error as Error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update queue' } },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  const authResult = await requireSession(request)
  if (!authResult.success) {
    return NextResponse.json(
      { success: false, error: { code: 'AUTH_ERROR', message: authResult.error } },
      { status: authResult.status }
    )
  }

  try {
    const body = await request.json()
    const parsed = cancelRedirectSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Validation failed', details: parsed.error.flatten() } },
        { status: 400 }
      )
    }

    const { ids } = parsed.data

    const result = await prisma.redirectQueue.deleteMany({
      where: {
        id: { in: ids },
        status: 'pending',
      },
    })

    logger.admin.info('Redirect queue entries cancelled', {
      count: result.count,
      actor: authResult.context.actorId,
    })

    return NextResponse.json({ success: true, data: { cancelled: result.count } })
  } catch (error) {
    logger.admin.error('Failed to cancel redirect queue', error as Error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to cancel redirects' } },
      { status: 500 }
    )
  }
}
