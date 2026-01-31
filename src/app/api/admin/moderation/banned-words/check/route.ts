/**
 * Admin Content Check API
 *
 * POST /api/admin/moderation/banned-words/check - Check if content is banned
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/services/api-auth'
import { checkContent } from '@/services/moderation'
import { checkContentSchema } from '@/lib/validations/moderation'

/**
 * POST /api/admin/moderation/banned-words/check
 * Check if content contains banned words
 */
export async function POST(request: NextRequest) {
  const authResult = await requireSession(request)

  if (!authResult.success) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  try {
    const body = await request.json()

    // SECURITY: Zod validated
    const parsed = checkContentSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const result = await checkContent(parsed.data.text, parsed.data.context)

    return NextResponse.json({
      text: parsed.data.text,
      context: parsed.data.context,
      ...result,
    })
  } catch {
    return NextResponse.json({ error: 'Failed to check content' }, { status: 500 })
  }
}
