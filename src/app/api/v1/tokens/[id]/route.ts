/**
 * API Token - Get and Revoke by ID
 *
 * GET    /api/v1/tokens/[id] - Get token info
 * DELETE /api/v1/tokens/[id] - Revoke token
 *
 * Auth: Session only (admin) - Token auth not allowed for token management
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/services/api-auth'
import { auditDelete } from '@/services/audit'
import { getApiTokenById, revokeApiToken } from '@/lib/api-token'
import { tokenIdSchema } from '@/lib/validations/kit'
import { logger } from '@/lib/logger'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /api/v1/tokens/[id]
 *
 * Get token info by ID.
 * Does NOT return the actual token value.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  // SECURITY: Session auth only
  const authResult = await requireSession(request)

  if (!authResult.success) {
    return NextResponse.json(
      { error: authResult.error },
      { status: authResult.status }
    )
  }

  try {
    const { id } = await params

    // SECURITY: Zod validated
    const parsed = tokenIdSchema.safeParse({ id })
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid token ID' }, { status: 400 })
    }

    const token = await getApiTokenById(parsed.data.id)

    if (!token) {
      return NextResponse.json({ error: 'Token not found' }, { status: 404 })
    }

    return NextResponse.json(token)
  } catch (error) {
    logger.admin.error('Failed to fetch API token', error as Error)
    return NextResponse.json(
      { error: 'Failed to fetch API token' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/v1/tokens/[id]
 *
 * Revoke a token (soft delete - marks as revoked).
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  // SECURITY: Session auth only
  const authResult = await requireSession(request)

  if (!authResult.success) {
    return NextResponse.json(
      { error: authResult.error },
      { status: authResult.status }
    )
  }

  try {
    const { id } = await params

    // SECURITY: Zod validated
    const parsed = tokenIdSchema.safeParse({ id })
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid token ID' }, { status: 400 })
    }

    // Get token info for audit
    const token = await getApiTokenById(parsed.data.id)

    if (!token) {
      return NextResponse.json({ error: 'Token not found' }, { status: 404 })
    }

    if (token.isRevoked) {
      return NextResponse.json({ error: 'Token already revoked' }, { status: 400 })
    }

    await revokeApiToken(parsed.data.id)

    // SECURITY: Audit logged
    await auditDelete(
      'api_token',
      parsed.data.id,
      authResult.context,
      { name: token.name, scopes: token.scopes },
      request
    )

    logger.admin.info('API token revoked', {
      tokenId: parsed.data.id,
      name: token.name,
      actor: authResult.context.actorId,
    })

    return NextResponse.json({ success: true, message: 'Token revoked' })
  } catch (error) {
    logger.admin.error('Failed to revoke API token', error as Error)
    return NextResponse.json(
      { error: 'Failed to revoke API token' },
      { status: 500 }
    )
  }
}
