/**
 * Admin Clan Perk Definition API - Get, Update, Delete
 *
 * GET    /api/admin/clans/perks/[id] - Get perk definition details
 * PATCH  /api/admin/clans/perks/[id] - Update perk definition
 * DELETE /api/admin/clans/perks/[id] - Delete perk definition
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/services/api-auth'
import { auditUpdate, auditDelete } from '@/services/audit'
import { prisma } from '@/lib/db'
import { updatePerkDefinitionSchema } from '@/lib/validations/clans'
import { logger } from '@/lib/logger'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /api/admin/clans/perks/[id]
 * Get perk definition details including which clans have it
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const authResult = await requireSession(request)

  if (!authResult.success) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  try {
    const { id } = await params

    const perk = await prisma.clanPerkDefinition.findUnique({
      where: { id },
      include: {
        clans: {
          include: {
            clan: {
              select: { id: true, tag: true, tagColor: true },
            },
          },
        },
      },
    })

    if (!perk) {
      return NextResponse.json({ error: 'Perk definition not found' }, { status: 404 })
    }

    return NextResponse.json(perk)
  } catch (error) {
    logger.admin.error('Failed to get perk definition', error as Error)
    return NextResponse.json({ error: 'Failed to get perk definition' }, { status: 500 })
  }
}

/**
 * PATCH /api/admin/clans/perks/[id]
 * Update perk definition
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const authResult = await requireSession(request)

  if (!authResult.success) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  try {
    const { id } = await params
    const body = await request.json()

    // SECURITY: Zod validated
    const parsed = updatePerkDefinitionSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    // Get old values for audit
    const oldPerk = await prisma.clanPerkDefinition.findUnique({
      where: { id },
      select: {
        name: true,
        description: true,
        category: true,
        levelRequired: true,
        prestigeRequired: true,
        effectType: true,
        effectValue: true,
        sortOrder: true,
        isActive: true,
      },
    })

    if (!oldPerk) {
      return NextResponse.json({ error: 'Perk definition not found' }, { status: 404 })
    }

    const updatedPerk = await prisma.clanPerkDefinition.update({
      where: { id },
      data: parsed.data,
    })

    // SECURITY: Audit logged
    await auditUpdate('clan_perk_definition', id, authResult.context, oldPerk, parsed.data, request)

    logger.admin.info('Perk definition updated', { perkId: id, changes: Object.keys(parsed.data) })

    return NextResponse.json(updatedPerk)
  } catch (error) {
    logger.admin.error('Failed to update perk definition', error as Error)
    return NextResponse.json({ error: 'Failed to update perk definition' }, { status: 500 })
  }
}

/**
 * DELETE /api/admin/clans/perks/[id]
 * Delete perk definition (also removes from all clans)
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const authResult = await requireSession(request)

  if (!authResult.success) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  try {
    const { id } = await params

    // Get old values for audit
    const oldPerk = await prisma.clanPerkDefinition.findUnique({
      where: { id },
      select: { key: true, name: true, category: true },
    })

    if (!oldPerk) {
      return NextResponse.json({ error: 'Perk definition not found' }, { status: 404 })
    }

    // Cascade delete will handle ClanPerk records
    await prisma.clanPerkDefinition.delete({
      where: { id },
    })

    // SECURITY: Audit logged
    await auditDelete('clan_perk_definition', id, authResult.context, oldPerk, request)

    logger.admin.info('Perk definition deleted', { perkId: id })

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.admin.error('Failed to delete perk definition', error as Error)
    return NextResponse.json({ error: 'Failed to delete perk definition' }, { status: 500 })
  }
}
