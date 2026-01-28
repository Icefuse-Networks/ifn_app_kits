/**
 * API Tokens - List and Create
 *
 * GET  /api/v1/tokens - List all tokens
 * POST /api/v1/tokens - Create new token
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
 * GET /api/v1/tokens
 *
 * List all API tokens.
 * Returns token info WITHOUT the actual token value.
 */
export async function GET(request: NextRequest) {
  // SECURITY: Session auth only (no token auth for token management)
  const authResult = await requireSession(request)

  if (!authResult.success) {
    return NextResponse.json(
      { error: authResult.error },
      { status: authResult.status }
    )
  }

  try {
    const tokens = await listApiTokens()

    return NextResponse.json(tokens)
  } catch (error) {
    logger.admin.error('Failed to list API tokens', error as Error)
    return NextResponse.json(
      { error: 'Failed to list API tokens' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/v1/tokens
 *
 * Create a new API token.
 * IMPORTANT: The full token is only returned once in this response!
 */
export async function POST(request: NextRequest) {
  // SECURITY: Session auth only (no token auth for token management)
  const authResult = await requireSession(request)

  if (!authResult.success) {
    return NextResponse.json(
      { error: authResult.error },
      { status: authResult.status }
    )
  }

  try {
    const body = await request.json()

    // SECURITY: Zod validated
    const parsed = createApiTokenSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { name, scopes, expiresAt } = parsed.data

    const { token, record } = await createApiToken({
      name,
      scopes: scopes as ApiScope[],
      createdBy: authResult.context.actorId,
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
      token, // IMPORTANT: Only time the full token is returned
      id: record.id,
      name: record.name,
      scopes: record.scopes as ApiScope[],
      expiresAt: record.expiresAt,
    }

    return NextResponse.json(response, { status: 201 })
  } catch (error) {
    logger.admin.error('Failed to create API token', error as Error)
    return NextResponse.json(
      { error: 'Failed to create API token' },
      { status: 500 }
    )
  }
}
