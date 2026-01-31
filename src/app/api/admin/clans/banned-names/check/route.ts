/**
 * Admin Banned Name Check API
 *
 * POST /api/admin/clans/banned-names/check - Check if a name is banned
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/services/api-auth'
import { isTagBanned } from '@/services/clans'
import { z } from 'zod'

const checkSchema = z.object({
  tag: z.string().min(1).max(10),
})

/**
 * POST /api/admin/clans/banned-names/check
 * Check if a clan tag is banned
 */
export async function POST(request: NextRequest) {
  const authResult = await requireSession(request)

  if (!authResult.success) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  try {
    const body = await request.json()

    // SECURITY: Zod validated
    const parsed = checkSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const isBanned = await isTagBanned(parsed.data.tag)

    return NextResponse.json({ tag: parsed.data.tag, isBanned })
  } catch {
    return NextResponse.json({ error: 'Failed to check tag' }, { status: 500 })
  }
}
