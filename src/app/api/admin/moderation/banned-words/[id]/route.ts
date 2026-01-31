/**
 * Admin Banned Word API - Get, Update, Delete
 *
 * GET    /api/admin/moderation/banned-words/[id] - Get banned word details
 * PATCH  /api/admin/moderation/banned-words/[id] - Update banned word
 * DELETE /api/admin/moderation/banned-words/[id] - Delete banned word
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/services/api-auth'
import { auditUpdate, auditDelete } from '@/services/audit'
import { getBannedWord, updateBannedWord, deleteBannedWord } from '@/services/moderation'
import { updateBannedWordSchema } from '@/lib/validations/moderation'
import { logger } from '@/lib/logger'

interface RouteContext {
  params: Promise<{ id: string }>
}

/**
 * GET /api/admin/moderation/banned-words/[id]
 * Get banned word details
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const authResult = await requireSession(request)

  if (!authResult.success) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  try {
    const { id } = await context.params
    const bannedWord = await getBannedWord(id)

    if (!bannedWord) {
      return NextResponse.json({ error: 'Banned word not found' }, { status: 404 })
    }

    return NextResponse.json(bannedWord)
  } catch (error) {
    logger.admin.error('Failed to get banned word', error as Error)
    return NextResponse.json({ error: 'Failed to get banned word' }, { status: 500 })
  }
}

/**
 * PATCH /api/admin/moderation/banned-words/[id]
 * Update a banned word
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  const authResult = await requireSession(request)

  if (!authResult.success) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  try {
    const { id } = await context.params
    const body = await request.json()

    // Verify banned word exists
    const existing = await getBannedWord(id)
    if (!existing) {
      return NextResponse.json({ error: 'Banned word not found' }, { status: 404 })
    }

    // SECURITY: Zod validated
    const parsed = updateBannedWordSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const oldValues = {
      pattern: existing.pattern,
      context: existing.context,
      category: existing.category,
      severity: existing.severity,
    }

    const bannedWord = await updateBannedWord(id, parsed.data)

    // SECURITY: Audit logged
    await auditUpdate('banned_word', id, authResult.context, oldValues, parsed.data, request)

    return NextResponse.json(bannedWord)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update banned word'

    if (message.includes('Invalid regex')) {
      return NextResponse.json({ error: message }, { status: 400 })
    }

    logger.admin.error('Failed to update banned word', error as Error)
    return NextResponse.json({ error: 'Failed to update banned word' }, { status: 500 })
  }
}

/**
 * DELETE /api/admin/moderation/banned-words/[id]
 * Delete a banned word
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  const authResult = await requireSession(request)

  if (!authResult.success) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  try {
    const { id } = await context.params

    // Verify banned word exists
    const existing = await getBannedWord(id)
    if (!existing) {
      return NextResponse.json({ error: 'Banned word not found' }, { status: 404 })
    }

    await deleteBannedWord(id)

    // SECURITY: Audit logged
    await auditDelete(
      'banned_word',
      id,
      authResult.context,
      { pattern: existing.pattern, context: existing.context },
      request
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.admin.error('Failed to delete banned word', error as Error)
    return NextResponse.json({ error: 'Failed to delete banned word' }, { status: 500 })
  }
}
