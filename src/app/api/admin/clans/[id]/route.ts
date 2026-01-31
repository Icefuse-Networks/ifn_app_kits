/**
 * Admin Clan API - Get, Update, Delete
 *
 * GET    /api/admin/clans/[id] - Get clan details
 * PATCH  /api/admin/clans/[id] - Update clan
 * DELETE /api/admin/clans/[id] - Disband clan
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/services/api-auth'
import { auditUpdate, auditDelete } from '@/services/audit'
import { getClanById, getClanByTag, updateClan, deleteClan } from '@/services/clans'
import { adminUpdateClanSchema } from '@/lib/validations/clans'
import { logger } from '@/lib/logger'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /api/admin/clans/[id]
 * Get clan details by ID or tag
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const authResult = await requireSession(request)

  if (!authResult.success) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  try {
    const { id } = await params

    // Support both ID and tag lookups
    let clan
    if (id.startsWith('clan_')) {
      clan = await getClanById(id)
    } else {
      clan = await getClanByTag(id)
    }

    if (!clan) {
      return NextResponse.json({ error: 'Clan not found' }, { status: 404 })
    }

    return NextResponse.json(clan)
  } catch (error) {
    logger.admin.error('Failed to get clan', error as Error)
    return NextResponse.json({ error: 'Failed to get clan' }, { status: 500 })
  }
}

/**
 * PATCH /api/admin/clans/[id]
 * Update clan (admin can change tag, owner, etc.)
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
    const parsed = adminUpdateClanSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    // Get clan ID if tag was provided
    let clanId = id
    if (!id.startsWith('clan_')) {
      const clan = await getClanByTag(id)
      if (!clan) {
        return NextResponse.json({ error: 'Clan not found' }, { status: 404 })
      }
      clanId = clan.id
    }

    // Get old values for audit
    const oldClan = await getClanById(clanId)
    if (!oldClan) {
      return NextResponse.json({ error: 'Clan not found' }, { status: 404 })
    }

    const updatedClan = await updateClan(clanId, parsed.data)

    // SECURITY: Audit logged
    await auditUpdate(
      'clan',
      clanId,
      authResult.context,
      { tag: oldClan.tag, description: oldClan.description, tagColor: oldClan.tagColor },
      parsed.data,
      request
    )

    return NextResponse.json(updatedClan)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update clan'

    if (message.includes('not allowed') || message.includes('already exists')) {
      return NextResponse.json({ error: message }, { status: 409 })
    }

    logger.admin.error('Failed to update clan', error as Error)
    return NextResponse.json({ error: 'Failed to update clan' }, { status: 500 })
  }
}

/**
 * DELETE /api/admin/clans/[id]
 * Disband/delete a clan
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const authResult = await requireSession(request)

  if (!authResult.success) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  try {
    const { id } = await params

    // Get clan ID if tag was provided
    let clanId = id
    let oldClan
    if (!id.startsWith('clan_')) {
      oldClan = await getClanByTag(id)
      if (!oldClan) {
        return NextResponse.json({ error: 'Clan not found' }, { status: 404 })
      }
      clanId = oldClan.id
    } else {
      oldClan = await getClanById(clanId)
      if (!oldClan) {
        return NextResponse.json({ error: 'Clan not found' }, { status: 404 })
      }
    }

    await deleteClan(clanId)

    // SECURITY: Audit logged
    await auditDelete(
      'clan',
      clanId,
      authResult.context,
      { tag: oldClan.tag, ownerId: oldClan.ownerId },
      request
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.admin.error('Failed to delete clan', error as Error)
    return NextResponse.json({ error: 'Failed to delete clan' }, { status: 500 })
  }
}
