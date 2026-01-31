import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { authenticateWithScope } from '@/services/api-auth'
import { auditCreate } from '@/services/audit'
import { id } from '@/lib/id'
import { logger } from '@/lib/logger'

const registerServerSchema = z.object({
  serverName: z.string().min(1).max(100).trim(),
  ip: z.string().min(7).max(45),
  port: z.number().int().min(1).max(65535),
  categoryId: z.string().max(60).nullable().optional(),
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
    const parsed = registerServerSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Validation failed', details: parsed.error.flatten() } },
        { status: 400 }
      )
    }

    const { serverName, ip, port, categoryId } = parsed.data
    const uniqueKey = `${ip}:${port}`

    const existing = await prisma.serverIdentifier.findFirst({
      where: {
        OR: [
          { name: serverName },
          { description: { contains: uniqueKey } },
        ],
      },
      select: { id: true, hashedId: true, name: true },
    })

    if (existing) {
      return NextResponse.json({
        success: true,
        data: {
          serverId: existing.hashedId,
          serverIdentifierId: existing.id,
          name: existing.name,
          isNew: false,
        },
      })
    }

    const identifier = await prisma.serverIdentifier.create({
      data: {
        id: id.serverIdentifier(),
        name: serverName,
        hashedId: id.identifierHash(),
        description: `${uniqueKey} - Auto-registered`,
        categoryId: categoryId || null,
      },
    })

    await auditCreate(
      'server_identifier',
      identifier.id,
      authResult.context,
      { name: identifier.name, hashedId: identifier.hashedId, ip, port },
      request
    )

    logger.admin.info('Server identifier auto-registered', {
      identifierId: identifier.id,
      name: identifier.name,
      ip,
      port,
      actor: authResult.context.actorId,
    })

    return NextResponse.json({
      success: true,
      data: {
        serverId: identifier.hashedId,
        serverIdentifierId: identifier.id,
        name: identifier.name,
        isNew: true,
      },
    }, { status: 201 })
  } catch (error) {
    logger.admin.error('Failed to register server identifier', error as Error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to register server' } },
      { status: 500 }
    )
  }
}
