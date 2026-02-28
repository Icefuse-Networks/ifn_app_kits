/**
 * Unified API Authentication Service
 *
 * Handles both API token and session-based authentication.
 * SECURITY: All API routes should use this service for auth.
 */

import { NextRequest } from 'next/server'
import { auth } from '@/lib/icefuse-auth'
import { isAdmin } from '@icefuse/auth'
import { validateToken, hasScope } from '@/lib/api-token'
import type { ApiScope, AuthContext } from '@/types/api'
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
  const session = await auth()

  if (!session?.user) {
    return {
      success: false,
      error: 'Authentication required',
      status: 401,
    }
  }

  // SECURITY: OIDC claims check (synchronous, no API call)
  const userIsAdmin = isAdmin(session)

  if (!userIsAdmin) {
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
 * Require authentication for telemetry:write
 */
export async function requireTelemetryWrite(request: NextRequest): Promise<AuthResult> {
  return authenticateWithScope(request, 'telemetry:write')
}

/**
 * Require authentication for redirect:read
 */
export async function requireRedirectRead(request: NextRequest): Promise<AuthResult> {
  return authenticateWithScope(request, 'redirect:read')
}

/**
 * Require authentication for redirect:write
 */
export async function requireRedirectWrite(request: NextRequest): Promise<AuthResult> {
  return authenticateWithScope(request, 'redirect:write')
}

/**
 * Require authentication for lootmanager:read
 */
export async function requireLootManagerRead(request: NextRequest): Promise<AuthResult> {
  return authenticateWithScope(request, 'lootmanager:read')
}

/**
 * Require authentication for lootmanager:write
 */
export async function requireLootManagerWrite(request: NextRequest): Promise<AuthResult> {
  return authenticateWithScope(request, 'lootmanager:write')
}

/**
 * Require authentication for bases:read
 */
export async function requireBasesRead(request: NextRequest): Promise<AuthResult> {
  return authenticateWithScope(request, 'bases:read')
}

/**
 * Require authentication for bases:write
 */
export async function requireBasesWrite(request: NextRequest): Promise<AuthResult> {
  return authenticateWithScope(request, 'bases:write')
}

/**
 * Require authentication for announcements:read
 */
export async function requireAnnouncementsRead(request: NextRequest): Promise<AuthResult> {
  return authenticateWithScope(request, 'announcements:read')
}

/**
 * Require authentication for announcements:write
 */
export async function requireAnnouncementsWrite(request: NextRequest): Promise<AuthResult> {
  return authenticateWithScope(request, 'announcements:write')
}

/**
 * Require authentication for shop:read
 */
export async function requireShopRead(request: NextRequest): Promise<AuthResult> {
  return authenticateWithScope(request, 'shop:read')
}

/**
 * Require authentication for shop:write
 */
export async function requireShopWrite(request: NextRequest): Promise<AuthResult> {
  return authenticateWithScope(request, 'shop:write')
}

/**
 * Require session authentication only (no token auth)
 * Used for sensitive operations like token management
 */
export async function requireSession(_request: NextRequest): Promise<AuthResult> {
  const session = await auth()

  if (!session?.user) {
    return {
      success: false,
      error: 'Session authentication required',
      status: 401,
    }
  }

  // SECURITY: OIDC claims check (synchronous, no API call)
  const userIsAdmin = isAdmin(session)

  if (!userIsAdmin) {
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
