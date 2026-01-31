/**
 * Admin Clans API - List and Create
 *
 * GET  /api/admin/clans - List all clans with filtering
 * POST /api/admin/clans - Create new clan (admin)
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/services/api-auth'
import { auditCreate } from '@/services/audit'
import { listClans, createClan } from '@/services/clans'
import { clanListQuerySchema, createClanSchema } from '@/lib/validations/clans'
import { logger } from '@/lib/logger'

/**
 * GET /api/admin/clans
 * List all clans with pagination and filtering
 */
export async function GET(request: NextRequest) {
  const authResult = await requireSession(request)

  if (!authResult.success) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  try {
    const { searchParams } = new URL(request.url)

    // SECURITY: Zod validated
    const parsed = clanListQuerySchema.safeParse({
      search: searchParams.get('search') || undefined,
      sortBy: searchParams.get('sortBy') || undefined,
      sortOrder: searchParams.get('sortOrder') || undefined,
      page: searchParams.get('page') || undefined,
      limit: searchParams.get('limit') || undefined,
    })

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const result = await listClans(parsed.data)
    return NextResponse.json(result)
  } catch (error) {
    logger.admin.error('Failed to list clans', error as Error)
    return NextResponse.json({ error: 'Failed to list clans' }, { status: 500 })
  }
}

/**
 * POST /api/admin/clans
 * Create a new clan (admin operation)
 */
export async function POST(request: NextRequest) {
  const authResult = await requireSession(request)

  if (!authResult.success) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  try {
    const body = await request.json()

    // SECURITY: Zod validated
    const parsed = createClanSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const clan = await createClan(parsed.data)

    // SECURITY: Audit logged
    await auditCreate('clan', clan.id, authResult.context, { tag: clan.tag, ownerId: clan.ownerId }, request)

    return NextResponse.json(clan, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create clan'

    // Check for known errors
    if (message.includes('not allowed') || message.includes('already exists') || message.includes('already in a clan')) {
      return NextResponse.json({ error: message }, { status: 409 })
    }

    logger.admin.error('Failed to create clan', error as Error)
    return NextResponse.json({ error: 'Failed to create clan' }, { status: 500 })
  }
}
