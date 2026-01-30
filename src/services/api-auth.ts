/**
 * Unified API Authentication Service
 *
 * Handles both API token and session-based authentication.
 * SECURITY: All API routes should use this service for auth.
 */

import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { validateToken, hasScope } from '@/lib/api-token'
import { isRootUser } from '@/services/admin-auth'
import type { ApiScope, AuthContext, ApiTokenRecord } from '@/types/api'
import { API_SCOPES } from '@/types/api'

// =============================================================================
// Auth Result Types
// =============================================================================

export type AuthResult =
  | { success: true; context: AuthContext }
  | { success: false; error: string; status: 401 | 403 }

// =============================================================================
// Token Extraction
// =============================================================================

/**
 * Extract Bearer token from Authorization header
 */
function extractBearerToken(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization')

  if (!authHeader) {
    return null
  }

  if (!authHeader.startsWith('Bearer ')) {
    return null
  }

  return authHeader.slice(7).trim()
}

// =============================================================================
// Authentication
// =============================================================================

/**
 * Authenticate a request using token or session
 *
 * Priority:
 * 1. Bearer token (API access)
 * 2. Session (Admin UI access)
 *
 * @param request - NextRequest object
 * @returns AuthResult with context or error
 */
export async function authenticate(request: NextRequest): Promise<AuthResult> {
  // Try token auth first
  const token = extractBearerToken(request)

  if (token) {
    const tokenRecord = await validateToken(token)

    if (tokenRecord) {
      return {
        success: true,
        context: {
          type: 'token',
          actorId: tokenRecord.id,
          actorName: tokenRecord.name,
          scopes: tokenRecord.scopes as ApiScope[],
        },
      }
    }

    // Token provided but invalid
    return {
      success: false,
      error: 'Invalid or expired API token',
      status: 401,
    }
  }

  // Fall back to session auth
  const session = await getServerSession(authOptions())

  if (!session?.user) {
    return {
      success: false,
      error: 'Authentication required',
      status: 401,
    }
  }

  // Check if user is root user (admin)
  const isRoot = await isRootUser(session.user.steamId, session.user.email || undefined)

  if (!isRoot) {
    return {
      success: false,
      error: 'Admin access required',
      status: 403,
    }
  }

  // Session users get all scopes
  return {
    success: true,
    context: {
      type: 'session',
      actorId: session.user.id,
      actorName: session.user.name || session.user.email || 'Unknown',
      scopes: [...API_SCOPES], // All scopes for session users
    },
  }
}

/**
 * Authenticate and require a specific scope
 *
 * @param request - NextRequest object
 * @param requiredScope - Scope that must be present
 * @returns AuthResult with context or error
 */
export async function authenticateWithScope(
  request: NextRequest,
  requiredScope: ApiScope
): Promise<AuthResult> {
  const result = await authenticate(request)

  if (!result.success) {
    return result
  }

  if (!hasScope(result.context.scopes, requiredScope)) {
    return {
      success: false,
      error: `Missing required scope: ${requiredScope}`,
      status: 403,
    }
  }

  return result
}

/**
 * Authenticate and require any of the specified scopes
 */
export async function authenticateWithAnyScope(
  request: NextRequest,
  requiredScopes: ApiScope[]
): Promise<AuthResult> {
  const result = await authenticate(request)

  if (!result.success) {
    return result
  }

  const hasAnyScope = requiredScopes.some((scope) =>
    hasScope(result.context.scopes, scope)
  )

  if (!hasAnyScope) {
    return {
      success: false,
      error: `Missing required scope. Need one of: ${requiredScopes.join(', ')}`,
      status: 403,
    }
  }

  return result
}

// =============================================================================
// Convenience Helpers
// =============================================================================

/**
 * Require authentication for kits:read
 */
export async function requireKitsRead(request: NextRequest): Promise<AuthResult> {
  return authenticateWithScope(request, 'kits:read')
}

/**
 * Require authentication for kits:write
 */
export async function requireKitsWrite(request: NextRequest): Promise<AuthResult> {
  return authenticateWithScope(request, 'kits:write')
}

/**
 * Require authentication for servers:read
 */
export async function requireServersRead(request: NextRequest): Promise<AuthResult> {
  return authenticateWithScope(request, 'servers:read')
}

/**
 * Require authentication for servers:write
 */
export async function requireServersWrite(request: NextRequest): Promise<AuthResult> {
  return authenticateWithScope(request, 'servers:write')
}

/**
 * Require authentication for analytics:read
 */
export async function requireAnalyticsRead(request: NextRequest): Promise<AuthResult> {
  return authenticateWithScope(request, 'analytics:read')
}

/**
 * Require authentication for analytics:write
 */
export async function requireAnalyticsWrite(request: NextRequest): Promise<AuthResult> {
  return authenticateWithScope(request, 'analytics:write')
}

/**
 * Require session authentication only (no token auth)
 * Used for sensitive operations like token management
 */
export async function requireSession(request: NextRequest): Promise<AuthResult> {
  const session = await getServerSession(authOptions())

  if (!session?.user) {
    return {
      success: false,
      error: 'Session authentication required',
      status: 401,
    }
  }

  const isRoot = await isRootUser(session.user.steamId, session.user.email || undefined)

  if (!isRoot) {
    return {
      success: false,
      error: 'Admin access required',
      status: 403,
    }
  }

  return {
    success: true,
    context: {
      type: 'session',
      actorId: session.user.id,
      actorName: session.user.name || session.user.email || 'Unknown',
      scopes: [...API_SCOPES],
    },
  }
}
