/**
 * Tokens API - List and Create
 *
 * GET  /api/tokens - List all tokens
 * POST /api/tokens - Create new token
 *
 * Auth: Session only (admin) - Token auth not allowed for token management
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/services/api-auth'
import { auditCreate } from '@/services/audit'
import { createApiToken, listApiTokens } from '@/lib/api-token'
import { createApiTokenSchema } from '@/lib/validations/kit'
import { logger } from '@/lib/logger'
import type { ApiScope, ApiTokenCreateResponse } from '@/types/api'

/**
 * GET /api/tokens
 * List all API tokens
 */
export async function GET(request: NextRequest) {
  try {
    // SECURITY: Session auth only
    const authResult = await requireSession(request)

    if (!authResult.success) {
      return NextResponse.json(
        { success: false, error: { code: 'AUTH_ERROR', message: authResult.error } },
        { status: authResult.status }
      )
    }

    const tokens = await listApiTokens()

    return NextResponse.json({ success: true, data: tokens })
  } catch (error) {
    logger.admin.error('Failed to list API tokens', error as Error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to list API tokens' } },
      { status: 500 }
    )
  }
}

/**
 * POST /api/tokens
 * Create a new API token
 * IMPORTANT: The full token is only returned once in this response!
 */
export async function POST(request: NextRequest) {
  try {
    // SECURITY: Session auth only
    const authResult = await requireSession(request)

    if (!authResult.success) {
      return NextResponse.json(
        { success: false, error: { code: 'AUTH_ERROR', message: authResult.error } },
        { status: authResult.status }
      )
    }

    const body = await request.json()

    // SECURITY: Zod validated
    const parsed = createApiTokenSchema.safeParse(body)
    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors
      const errorMessages = Object.entries(fieldErrors)
        .map(([field, errors]) => `${field}: ${(errors as string[]).join(', ')}`)
        .join('; ')
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: errorMessages || 'Validation failed', details: parsed.error.flatten() } },
        { status: 400 }
      )
    }

    const { name, scopes, expiresAt, categoryId } = parsed.data

    const { token, record } = await createApiToken({
      name,
      scopes: scopes as ApiScope[],
      createdBy: authResult.context.actorId,
      categoryId: categoryId || null,
      expiresAt,
    })

    // SECURITY: Audit logged
    await auditCreate(
      'api_token',
      record.id,
      authResult.context,
      { name, scopes, expiresAt },
      request
    )

    logger.admin.info('API token created', {
      tokenId: record.id,
      name: record.name,
      actor: authResult.context.actorId,
    })

    // Return full token - only shown once!
    const response: ApiTokenCreateResponse = {
      token,
      id: record.id,
      name: record.name,
      scopes: record.scopes as ApiScope[],
      categoryId: record.categoryId,
      expiresAt: record.expiresAt,
    }

    return NextResponse.json({ success: true, data: response }, { status: 201 })
  } catch (error) {
    logger.admin.error('Failed to create API token', error as Error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create API token' } },
      { status: 500 }
    )
  }
}
