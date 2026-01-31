import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { authenticateWithScope } from '@/services/api-auth'
import { auditCreate, auditUpdate } from '@/services/audit'
import { id } from '@/lib/id'
import { logger } from '@/lib/logger'

const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/
const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^::(?:[0-9a-fA-F]{1,4}:){0,6}[0-9a-fA-F]{1,4}$|^(?:[0-9a-fA-F]{1,4}:){1,7}:$|^(?:[0-9a-fA-F]{1,4}:){0,6}::(?:[0-9a-fA-F]{1,4}:){0,5}[0-9a-fA-F]{1,4}$/

const registerServerSchema = z.object({
  serverName: z.string().min(1).max(255).trim(),
  ip: z.string().min(1).max(45).refine(
    (val) => ipv4Regex.test(val) || ipv6Regex.test(val),
    { message: 'Invalid IPv4 or IPv6 address' }
  ),
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

    const existing = await prisma.serverIdentifier.findFirst({
      where: { ip, port },
      select: { id: true, hashedId: true, name: true, ip: true, port: true, description: true },
    })

    if (existing) {
      const needsUpdate = existing.name !== serverName || existing.ip !== ip

      if (needsUpdate) {
        const oldValues = { name: existing.name, ip: existing.ip }

        await prisma.serverIdentifier.update({
          where: { id: existing.id },
          data: { name: serverName, ip },
        })

        await auditUpdate(
          'server_identifier',
          existing.id,
          authResult.context,
          oldValues,
          { name: serverName, ip },
          request
        )

        logger.admin.info('Server identifier updated', {
          identifierId: existing.id,
          oldName: existing.name,
          newName: serverName,
          ip,
          port,
          actor: authResult.context.actorId,
        })
      }

      return NextResponse.json({
        success: true,
        data: {
          serverId: existing.hashedId,
          serverIdentifierId: existing.id,
          name: serverName,
          isNew: false,
          updated: needsUpdate,
        },
      })
    }

    const identifier = await prisma.serverIdentifier.create({
      data: {
        id: id.serverIdentifier(),
        name: serverName,
        hashedId: id.identifierHash(),
        description: `${ip}:${port} - Auto-registered`,
        ip,
        port,
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
