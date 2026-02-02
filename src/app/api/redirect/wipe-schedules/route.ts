import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { authenticateWithScope, requireSession } from '@/services/api-auth'
import { auditCreate, auditDelete } from '@/services/audit'
import { id } from '@/lib/id'
import { logger } from '@/lib/logger'

const createScheduleSchema = z.object({
  serverIdentifierId: z.string().min(1).max(60),
  dayOfWeek: z.number().min(0).max(6),
  hour: z.number().min(0).max(23),
  minute: z.number().min(0).max(59),
  wipeType: z.enum(['regular', 'force', 'bp']).default('regular'),
})

const deleteScheduleSchema = z.object({
  id: z.string().min(1).max(60),
})

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

    const where = serverId ? { serverIdentifierId: serverId, isActive: true } : { isActive: true }

    const schedules = await prisma.wipeSchedule.findMany({
      where,
      orderBy: [{ dayOfWeek: 'asc' }, { hour: 'asc' }, { minute: 'asc' }],
    })

    const serverIds = [...new Set(schedules.map(s => s.serverIdentifierId))]
    const servers = await prisma.serverIdentifier.findMany({
      where: { id: { in: serverIds } },
      select: { id: true, name: true, hashedId: true },
    })
    const serverMap = new Map(servers.map(s => [s.id, s]))

    const data = schedules.map(s => ({
      id: s.id,
      serverIdentifierId: s.serverIdentifierId,
      serverName: serverMap.get(s.serverIdentifierId)?.name || null,
      serverHashedId: serverMap.get(s.serverIdentifierId)?.hashedId || null,
      dayOfWeek: s.dayOfWeek,
      hour: s.hour,
      minute: s.minute,
      wipeType: s.wipeType,
      createdAt: s.createdAt,
    }))

    return NextResponse.json({ success: true, data })
  } catch (error) {
    logger.admin.error('Failed to fetch wipe schedules', error as Error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch schedules' } },
      { status: 500 }
    )
  }
}

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
    const parsed = createScheduleSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Validation failed', details: parsed.error.flatten() } },
        { status: 400 }
      )
    }

    const { serverIdentifierId, dayOfWeek, hour, minute, wipeType } = parsed.data

    const server = await prisma.serverIdentifier.findUnique({
      where: { id: serverIdentifierId },
      select: { id: true, name: true },
    })

    if (!server) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Server not found' } },
        { status: 404 }
      )
    }

    const existing = await prisma.wipeSchedule.findFirst({
      where: {
        serverIdentifierId,
        dayOfWeek,
        hour,
        minute,
        isActive: true,
      },
    })

    if (existing) {
      return NextResponse.json(
        { success: false, error: { code: 'DUPLICATE', message: 'Schedule already exists for this time' } },
        { status: 409 }
      )
    }

    const schedule = await prisma.wipeSchedule.create({
      data: {
        id: id.wipeSchedule(),
        serverIdentifierId,
        dayOfWeek,
        hour,
        minute,
        wipeType,
        isActive: true,
      },
    })

    await auditCreate('wipe_schedule', schedule.id, authResult.context, {
      serverIdentifierId,
      dayOfWeek,
      hour,
      minute,
      wipeType,
    }, request)

    logger.admin.info('Wipe schedule created', {
      scheduleId: schedule.id,
      serverId: serverIdentifierId,
      actor: authResult.context.actorId,
    })

    return NextResponse.json({
      success: true,
      data: {
        id: schedule.id,
        serverIdentifierId: schedule.serverIdentifierId,
        serverName: server.name,
        dayOfWeek: schedule.dayOfWeek,
        hour: schedule.hour,
        minute: schedule.minute,
        wipeType: schedule.wipeType,
        createdAt: schedule.createdAt,
      },
    }, { status: 201 })
  } catch (error) {
    logger.admin.error('Failed to create wipe schedule', error as Error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create schedule' } },
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
    const parsed = deleteScheduleSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Validation failed' } },
        { status: 400 }
      )
    }

    const schedule = await prisma.wipeSchedule.findUnique({
      where: { id: parsed.data.id },
    })

    if (!schedule) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Schedule not found' } },
        { status: 404 }
      )
    }

    await prisma.wipeSchedule.update({
      where: { id: parsed.data.id },
      data: { isActive: false },
    })

    await auditDelete('wipe_schedule', parsed.data.id, authResult.context, {
      serverIdentifierId: schedule.serverIdentifierId,
      dayOfWeek: schedule.dayOfWeek,
      hour: schedule.hour,
      minute: schedule.minute,
    }, request)

    logger.admin.info('Wipe schedule deleted', {
      scheduleId: parsed.data.id,
      actor: authResult.context.actorId,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.admin.error('Failed to delete wipe schedule', error as Error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete schedule' } },
      { status: 500 }
    )
  }
}
