/**
 * Admin Banned Words Seed API
 *
 * POST /api/admin/moderation/banned-words/seed - Seed database with comprehensive patterns
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/services/api-auth'
import { bulkCreateBannedWords } from '@/services/moderation'
import { BANNED_PATTERNS, PATTERN_COUNT } from '@/lib/banned-patterns'
import { bulkSeedSchema, type ModerationCategory } from '@/lib/validations/moderation'
import { auditCreate } from '@/services/audit'
import { logger } from '@/lib/logger'

/**
 * POST /api/admin/moderation/banned-words/seed
 * Bulk seed the banned words table with comprehensive patterns
 *
 * Optional body:
 * - context: Filter patterns to apply to specific context (default: all)
 * - categories: Filter to specific categories (default: all)
 */
export async function POST(request: NextRequest) {
  const authResult = await requireSession(request)

  if (!authResult.success) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  try {
    let context: string | undefined
    let categories: ModerationCategory[] | undefined

    // Check if there's a body
    const contentType = request.headers.get('content-type')
    if (contentType?.includes('application/json')) {
      const body = await request.json()

      // SECURITY: Zod validated
      const parsed = bulkSeedSchema.safeParse(body)
      if (!parsed.success) {
        return NextResponse.json(
          { error: 'Validation failed', details: parsed.error.flatten() },
          { status: 400 }
        )
      }

      context = parsed.data.context
      categories = parsed.data.categories
    }

    // Filter patterns if needed
    let patternsToSeed = BANNED_PATTERNS.map((p) => ({
      pattern: p.pattern,
      isRegex: p.isRegex,
      context: (context ?? 'all') as 'all' | 'clan_tags' | 'chat' | 'player_names',
      severity: p.severity,
      category: p.category,
      reason: p.reason,
    }))

    if (categories && categories.length > 0) {
      patternsToSeed = patternsToSeed.filter((p) =>
        categories!.includes(p.category as ModerationCategory)
      )
    }

    const result = await bulkCreateBannedWords(patternsToSeed, authResult.context.actorId)

    // SECURITY: Audit logged
    await auditCreate(
      'banned_word',
      'bulk_seed',
      authResult.context,
      {
        totalPatterns: PATTERN_COUNT,
        patternsSeeded: patternsToSeed.length,
        created: result.created,
        skipped: result.skipped,
        context: context ?? 'all',
        categories: categories ?? 'all',
      },
      request
    )

    logger.admin.info('Banned words seeded', {
      created: result.created,
      skipped: result.skipped,
      errors: result.errors.length,
      actorId: authResult.context.actorId,
    })

    return NextResponse.json({
      success: true,
      totalPatternsAvailable: PATTERN_COUNT,
      patternsProcessed: patternsToSeed.length,
      created: result.created,
      skipped: result.skipped,
      errors: result.errors.slice(0, 10), // Only show first 10 errors
      totalErrors: result.errors.length,
    })
  } catch (error) {
    logger.admin.error('Failed to seed banned words', error as Error)
    return NextResponse.json({ error: 'Failed to seed banned words' }, { status: 500 })
  }
}
