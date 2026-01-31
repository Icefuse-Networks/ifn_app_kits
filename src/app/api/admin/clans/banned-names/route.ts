/**
 * Admin Banned Clan Names API - List and Create
 *
 * GET  /api/admin/clans/banned-names - List all banned name patterns
 * POST /api/admin/clans/banned-names - Create banned name pattern
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/services/api-auth'
import { auditCreate } from '@/services/audit'
import { listBannedNames, createBannedName } from '@/services/clans'
import { createBannedNameSchema } from '@/lib/validations/clans'
import { logger } from '@/lib/logger'

/**
 * GET /api/admin/clans/banned-names
 * List all banned name patterns
 */
export async function GET(request: NextRequest) {
  const authResult = await requireSession(request)

  if (!authResult.success) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  try {
    const bannedNames = await listBannedNames()
    return NextResponse.json(bannedNames)
  } catch (error) {
    logger.admin.error('Failed to list banned names', error as Error)
    return NextResponse.json({ error: 'Failed to list banned names' }, { status: 500 })
  }
}

/**
 * POST /api/admin/clans/banned-names
 * Create a new banned name pattern
 */
export async function POST(request: NextRequest) {
  const authResult = await requireSession(request)

  if (!authResult.success) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  try {
    const body = await request.json()

    // SECURITY: Zod validated
    const parsed = createBannedNameSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const bannedName = await createBannedName(
      parsed.data.pattern,
      parsed.data.isRegex ?? false,
      parsed.data.reason ?? null,
      authResult.context.actorId
    )

    // SECURITY: Audit logged
    await auditCreate(
      'banned_clan_name',
      bannedName.id,
      authResult.context,
      { pattern: bannedName.pattern, isRegex: bannedName.isRegex },
      request
    )

    return NextResponse.json(bannedName, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create banned name'

    if (message.includes('Invalid regex')) {
      return NextResponse.json({ error: message }, { status: 400 })
    }

    logger.admin.error('Failed to create banned name', error as Error)
    return NextResponse.json({ error: 'Failed to create banned name' }, { status: 500 })
  }
}
