/**
 * Admin Banned Words API - List and Create
 *
 * GET  /api/admin/moderation/banned-words - List all banned word patterns
 * POST /api/admin/moderation/banned-words - Create banned word pattern
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/services/api-auth'
import { auditCreate } from '@/services/audit'
import { listBannedWords, createBannedWord } from '@/services/moderation'
import {
  createBannedWordSchema,
  bannedWordsQuerySchema,
} from '@/lib/validations/moderation'
import { logger } from '@/lib/logger'

/**
 * GET /api/admin/moderation/banned-words
 * List all banned word patterns with optional filtering
 */
export async function GET(request: NextRequest) {
  const authResult = await requireSession(request)

  if (!authResult.success) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  try {
    const { searchParams } = new URL(request.url)
    const query = {
      search: searchParams.get('search') || undefined,
      context: searchParams.get('context') || undefined,
      category: searchParams.get('category') || undefined,
      page: searchParams.get('page') || '1',
      limit: searchParams.get('limit') || '50',
    }

    // SECURITY: Zod validated
    const parsed = bannedWordsQuerySchema.safeParse(query)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { page, limit, ...filters } = parsed.data
    const offset = (page - 1) * limit

    const result = await listBannedWords({ ...filters, limit, offset })

    return NextResponse.json({
      data: result.data,
      total: result.total,
      page,
      limit,
      hasMore: offset + result.data.length < result.total,
    })
  } catch (error) {
    logger.admin.error('Failed to list banned words', error as Error)
    return NextResponse.json({ error: 'Failed to list banned words' }, { status: 500 })
  }
}

/**
 * POST /api/admin/moderation/banned-words
 * Create a new banned word pattern
 */
export async function POST(request: NextRequest) {
  const authResult = await requireSession(request)

  if (!authResult.success) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  try {
    const body = await request.json()

    // SECURITY: Zod validated
    const parsed = createBannedWordSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const bannedWord = await createBannedWord(parsed.data, authResult.context.actorId)

    // SECURITY: Audit logged
    await auditCreate(
      'banned_word',
      bannedWord.id,
      authResult.context,
      { pattern: bannedWord.pattern, context: bannedWord.context, category: bannedWord.category },
      request
    )

    return NextResponse.json(bannedWord, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create banned word'

    if (message.includes('Invalid regex')) {
      return NextResponse.json({ error: message }, { status: 400 })
    }

    if (message.includes('already exists')) {
      return NextResponse.json({ error: message }, { status: 409 })
    }

    logger.admin.error('Failed to create banned word', error as Error)
    return NextResponse.json({ error: 'Failed to create banned word' }, { status: 500 })
  }
}
