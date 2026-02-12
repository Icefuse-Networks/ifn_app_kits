/**
 * Tokens API - Single Token Operations
 *
 * GET    /api/tokens/[id] - Get token info
 * PUT    /api/tokens/[id] - Update token
 * DELETE /api/tokens/[id] - Delete token
 *
 * Auth: Session only (admin) - Token auth not allowed for token management
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/services/api-auth'
import { auditUpdate, auditDelete } from '@/services/audit'
import { getApiTokenById, updateApiToken, deleteApiToken } from '@/lib/api-token'
import { tokenIdSchema, updateApiTokenSchema } from '@/lib/validations/kit'
import { logger } from '@/lib/logger'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * GET /api/tokens/[id]
 * Get token info (without the actual token value)
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    // SECURITY: Session auth only
    const authResult = await requireSession(request)

    if (!authResult.success) {
      return NextResponse.json(
        { success: false, error: { code: 'AUTH_ERROR', message: authResult.error } },
        { status: authResult.status }
      )
    }

    const params = await context.params
    const parsed = tokenIdSchema.safeParse({ id: params.id })

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid token ID' } },
        { status: 400 }
      )
    }

    const token = await getApiTokenById(parsed.data.id)

    if (!token) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Token not found' } },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, data: token })
  } catch (error) {
    logger.admin.error('Failed to get API token', error as Error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to get API token' } },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/tokens/[id]
 * Update token name, scopes, or category
 */
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    // SECURITY: Session auth only
    const authResult = await requireSession(request)

    if (!authResult.success) {
      return NextResponse.json(
        { success: false, error: { code: 'AUTH_ERROR', message: authResult.error } },
        { status: authResult.status }
      )
    }

    const params = await context.params
    const idParsed = tokenIdSchema.safeParse({ id: params.id })

    if (!idParsed.success) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid token ID' } },
        { status: 400 }
      )
    }

    const body = await request.json()

    // SECURITY: Zod validated
    const parsed = updateApiTokenSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Validation failed', details: parsed.error.flatten() } },
        { status: 400 }
      )
    }

    // Get existing token for audit
    const existing = await getApiTokenById(idParsed.data.id)

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Token not found' } },
        { status: 404 }
      )
    }

    const updated = await updateApiToken(idParsed.data.id, parsed.data)

    // SECURITY: Audit logged
    await auditUpdate(
      'api_token',
      idParsed.data.id,
      authResult.context,
      { name: existing.name, scopes: existing.scopes },
      { name: updated.name, scopes: updated.scopes },
      request
    )

    logger.admin.info('API token updated', {
      tokenId: idParsed.data.id,
      name: updated.name,
      actor: authResult.context.actorId,
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    logger.admin.error('Failed to update API token', error as Error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update API token' } },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/tokens/[id]
 * Delete a token permanently
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    // SECURITY: Session auth only
    const authResult = await requireSession(request)

    if (!authResult.success) {
      return NextResponse.json(
        { success: false, error: { code: 'AUTH_ERROR', message: authResult.error } },
        { status: authResult.status }
      )
    }

    const params = await context.params
    const parsed = tokenIdSchema.safeParse({ id: params.id })

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid token ID' } },
        { status: 400 }
      )
    }

    // Get existing token for audit
    const existing = await getApiTokenById(parsed.data.id)

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Token not found' } },
        { status: 404 }
      )
    }

    await deleteApiToken(parsed.data.id)

    // SECURITY: Audit logged
    await auditDelete(
      'api_token',
      parsed.data.id,
      authResult.context,
      { name: existing.name, scopes: existing.scopes },
      request
    )

    logger.admin.info('API token deleted', {
      tokenId: parsed.data.id,
      name: existing.name,
      actor: authResult.context.actorId,
    })

    return NextResponse.json({ success: true, data: null })
  } catch (error) {
    logger.admin.error('Failed to delete API token', error as Error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete API token' } },
      { status: 500 }
    )
  }
}
