/**
 * Admin Banned Clan Name API - Delete
 *
 * DELETE /api/admin/clans/banned-names/[id] - Delete banned name pattern
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/services/api-auth'
import { auditDelete } from '@/services/audit'
import { deleteBannedName } from '@/services/clans'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * DELETE /api/admin/clans/banned-names/[id]
 * Delete a banned name pattern
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const authResult = await requireSession(request)

  if (!authResult.success) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  try {
    const { id } = await params

    // Get old values for audit
    const oldBannedName = await prisma.bannedClanName.findUnique({
      where: { id },
      select: { id: true, pattern: true, isRegex: true },
    })

    if (!oldBannedName) {
      return NextResponse.json({ error: 'Banned name not found' }, { status: 404 })
    }

    await deleteBannedName(id)

    // SECURITY: Audit logged
    await auditDelete(
      'banned_clan_name',
      id,
      authResult.context,
      { pattern: oldBannedName.pattern, isRegex: oldBannedName.isRegex },
      request
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.admin.error('Failed to delete banned name', error as Error)
    return NextResponse.json({ error: 'Failed to delete banned name' }, { status: 500 })
  }
}
