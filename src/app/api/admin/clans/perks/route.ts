/**
 * Admin Clan Perks API - List and Create Perk Definitions
 *
 * GET  /api/admin/clans/perks - List all perk definitions
 * POST /api/admin/clans/perks - Create perk definition
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/services/api-auth'
import { auditCreate } from '@/services/audit'
import { prisma } from '@/lib/db'
import { id } from '@/lib/id'
import { createPerkDefinitionSchema } from '@/lib/validations/clans'
import { logger } from '@/lib/logger'

/**
 * GET /api/admin/clans/perks
 * List all perk definitions
 */
export async function GET(request: NextRequest) {
  const authResult = await requireSession(request)

  if (!authResult.success) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  try {
    // PERF: Select only needed fields
    const perks = await prisma.clanPerkDefinition.findMany({
      select: {
        id: true,
        key: true,
        name: true,
        description: true,
        category: true,
        levelRequired: true,
        prestigeRequired: true,
        effectType: true,
        effectValue: true,
        sortOrder: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: { clans: true },
        },
      },
      orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
    })

    return NextResponse.json(perks)
  } catch (error) {
    logger.admin.error('Failed to list perk definitions', error as Error)
    return NextResponse.json({ error: 'Failed to list perk definitions' }, { status: 500 })
  }
}

/**
 * POST /api/admin/clans/perks
 * Create a new perk definition
 */
export async function POST(request: NextRequest) {
  const authResult = await requireSession(request)

  if (!authResult.success) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  try {
    const body = await request.json()

    // SECURITY: Zod validated
    const parsed = createPerkDefinitionSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    // Check for duplicate key
    const existing = await prisma.clanPerkDefinition.findUnique({
      where: { key: parsed.data.key },
      select: { id: true },
    })

    if (existing) {
      return NextResponse.json({ error: 'A perk with this key already exists' }, { status: 409 })
    }

    const perk = await prisma.clanPerkDefinition.create({
      data: {
        id: id.clanPerkDefinition(),
        key: parsed.data.key,
        name: parsed.data.name,
        description: parsed.data.description || null,
        category: parsed.data.category,
        levelRequired: parsed.data.levelRequired ?? 1,
        prestigeRequired: parsed.data.prestigeRequired ?? 0,
        effectType: parsed.data.effectType,
        effectValue: parsed.data.effectValue,
        sortOrder: parsed.data.sortOrder ?? 0,
        isActive: parsed.data.isActive ?? true,
      },
    })

    // SECURITY: Audit logged
    await auditCreate(
      'clan_perk_definition',
      perk.id,
      authResult.context,
      { key: perk.key, name: perk.name, category: perk.category },
      request
    )

    logger.admin.info('Perk definition created', { perkId: perk.id, key: perk.key })

    return NextResponse.json(perk, { status: 201 })
  } catch (error) {
    logger.admin.error('Failed to create perk definition', error as Error)
    return NextResponse.json({ error: 'Failed to create perk definition' }, { status: 500 })
  }
}
