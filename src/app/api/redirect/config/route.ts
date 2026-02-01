import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { authenticateWithScope, requireSession } from '@/services/api-auth'
import { auditCreate, auditUpdate } from '@/services/audit'
import { id } from '@/lib/id'
import { logger } from '@/lib/logger'

interface RedirectConfig {
  staffGroups: string[]
  afkTimeSeconds: number
  checkInterval: number
  configUpdateInterval: number
  maxRedirectAttempts: number
  enableAFKRedirect: boolean
  minPlayersForEmptyServer: number
  maxPlayersForEmptyServer: number
  preferredEmptyServers: string[]
  excludedServers: string[]
}

const defaultConfig: RedirectConfig = {
  staffGroups: [],
  afkTimeSeconds: 3600,
  checkInterval: 30.0,
  configUpdateInterval: 120.0,
  maxRedirectAttempts: 3,
  enableAFKRedirect: true,
  minPlayersForEmptyServer: 0,
  maxPlayersForEmptyServer: 2,
  preferredEmptyServers: [],
  excludedServers: []
}

const updateConfigSchema = z.object({
  staffGroups: z.array(z.string()).default([]),
  afkTimeSeconds: z.number().min(0),
  checkInterval: z.number().min(1),
  configUpdateInterval: z.number().min(1),
  maxRedirectAttempts: z.number().min(1),
  enableAFKRedirect: z.boolean(),
  minPlayersForEmptyServer: z.number().min(0),
  maxPlayersForEmptyServer: z.number().min(0),
  preferredEmptyServers: z.array(z.string()).default([]),
  excludedServers: z.array(z.string()).default([])
}).refine(data => data.minPlayersForEmptyServer <= data.maxPlayersForEmptyServer, {
  message: 'minPlayersForEmptyServer must be <= maxPlayersForEmptyServer'
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
    const config = await prisma.redirectConfig.findFirst({
      where: { isActive: true },
      orderBy: { updatedAt: 'desc' }
    })

    if (!config) {
      const newConfig = await prisma.redirectConfig.create({
        data: {
          id: id.redirectConfig(),
          staffGroups: JSON.stringify(defaultConfig.staffGroups),
          afkTimeSeconds: defaultConfig.afkTimeSeconds,
          checkInterval: defaultConfig.checkInterval,
          configUpdateInterval: defaultConfig.configUpdateInterval,
          maxRedirectAttempts: defaultConfig.maxRedirectAttempts,
          enableAFKRedirect: defaultConfig.enableAFKRedirect,
          minPlayersForEmptyServer: defaultConfig.minPlayersForEmptyServer,
          maxPlayersForEmptyServer: defaultConfig.maxPlayersForEmptyServer,
          preferredEmptyServers: JSON.stringify(defaultConfig.preferredEmptyServers),
          excludedServers: JSON.stringify(defaultConfig.excludedServers),
          isActive: true
        }
      })

      return NextResponse.json({
        success: true,
        data: {
          ...defaultConfig,
          id: newConfig.id,
          createdAt: newConfig.createdAt,
          updatedAt: newConfig.updatedAt
        }
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        id: config.id,
        staffGroups: JSON.parse(config.staffGroups) as string[],
        afkTimeSeconds: config.afkTimeSeconds,
        checkInterval: config.checkInterval,
        configUpdateInterval: config.configUpdateInterval,
        maxRedirectAttempts: config.maxRedirectAttempts,
        enableAFKRedirect: config.enableAFKRedirect,
        minPlayersForEmptyServer: config.minPlayersForEmptyServer,
        maxPlayersForEmptyServer: config.maxPlayersForEmptyServer,
        preferredEmptyServers: JSON.parse(config.preferredEmptyServers) as string[],
        excludedServers: JSON.parse(config.excludedServers) as string[],
        createdAt: config.createdAt,
        updatedAt: config.updatedAt
      }
    })
  } catch (error) {
    logger.admin.error('Failed to fetch redirect config', error as Error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch configuration' } },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  const authResult = await requireSession(request)

  if (!authResult.success) {
    return NextResponse.json(
      { success: false, error: { code: 'AUTH_ERROR', message: authResult.error } },
      { status: authResult.status }
    )
  }

  try {
    const body = await request.json()
    const parsed = updateConfigSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Validation failed', details: parsed.error.flatten() } },
        { status: 400 }
      )
    }

    const data = parsed.data

    const cleanConfig = {
      staffGroups: [...new Set(data.staffGroups.filter(g => g.trim() !== ''))],
      afkTimeSeconds: data.afkTimeSeconds,
      checkInterval: data.checkInterval,
      configUpdateInterval: data.configUpdateInterval,
      maxRedirectAttempts: data.maxRedirectAttempts,
      enableAFKRedirect: data.enableAFKRedirect,
      minPlayersForEmptyServer: data.minPlayersForEmptyServer,
      maxPlayersForEmptyServer: data.maxPlayersForEmptyServer,
      preferredEmptyServers: [...new Set(data.preferredEmptyServers.filter(s => s.trim() !== ''))],
      excludedServers: [...new Set(data.excludedServers.filter(s => s.trim() !== ''))]
    }

    const oldConfig = await prisma.redirectConfig.findFirst({
      where: { isActive: true }
    })

    await prisma.redirectConfig.updateMany({
      where: { isActive: true },
      data: { isActive: false }
    })

    const newConfig = await prisma.redirectConfig.create({
      data: {
        id: id.redirectConfig(),
        staffGroups: JSON.stringify(cleanConfig.staffGroups),
        afkTimeSeconds: cleanConfig.afkTimeSeconds,
        checkInterval: cleanConfig.checkInterval,
        configUpdateInterval: cleanConfig.configUpdateInterval,
        maxRedirectAttempts: cleanConfig.maxRedirectAttempts,
        enableAFKRedirect: cleanConfig.enableAFKRedirect,
        minPlayersForEmptyServer: cleanConfig.minPlayersForEmptyServer,
        maxPlayersForEmptyServer: cleanConfig.maxPlayersForEmptyServer,
        preferredEmptyServers: JSON.stringify(cleanConfig.preferredEmptyServers),
        excludedServers: JSON.stringify(cleanConfig.excludedServers),
        isActive: true
      }
    })

    if (oldConfig) {
      await auditUpdate(
        'redirect_config',
        newConfig.id,
        authResult.context,
        { id: oldConfig.id },
        cleanConfig,
        request
      )
    } else {
      await auditCreate(
        'redirect_config',
        newConfig.id,
        authResult.context,
        cleanConfig,
        request
      )
    }

    logger.admin.info('Redirect config updated', {
      configId: newConfig.id,
      actor: authResult.context.actorId
    })

    return NextResponse.json({
      success: true,
      data: {
        id: newConfig.id,
        ...cleanConfig,
        createdAt: newConfig.createdAt,
        updatedAt: newConfig.updatedAt
      }
    })
  } catch (error) {
    logger.admin.error('Failed to update redirect config', error as Error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update configuration' } },
      { status: 500 }
    )
  }
}
