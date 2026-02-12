/**
 * API Token Utilities
 *
 * Secure token generation, hashing, and validation.
 * SECURITY: Tokens are stored as SHA-256 hashes, never plaintext.
 */

import { createHash, randomBytes } from 'crypto'
import { prisma } from '@/lib/db'
import type { ApiScope, ApiTokenInfo, ApiTokenRecord } from '@/types/api'

// =============================================================================
// Constants
// =============================================================================

/** Token prefix for identification */
const TOKEN_PREFIX = 'ifn_rust_'

/** Token random part length (32 chars = 128 bits of entropy) */
const TOKEN_RANDOM_LENGTH = 32

/** Prefix length stored for identification (first 8 chars after prefix) */
const STORED_PREFIX_LENGTH = 8

// =============================================================================
// Token Generation
// =============================================================================

/**
 * Generate a new API token
 * Format: ifn_rust_<32 random hex chars>
 *
 * @returns The full token (only shown once!)
 */
export function generateToken(): string {
  const randomPart = randomBytes(TOKEN_RANDOM_LENGTH / 2).toString('hex')
  return `${TOKEN_PREFIX}${randomPart}`
}

/**
 * Hash a token for storage
 * Uses SHA-256 for one-way hashing
 *
 * @param token - Full token to hash
 * @returns Hex-encoded hash
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

/**
 * Extract the prefix from a token for identification
 *
 * @param token - Full token
 * @returns First 8 chars after the prefix
 */
export function getTokenPrefix(token: string): string {
  const withoutPrefix = token.replace(TOKEN_PREFIX, '')
  return withoutPrefix.slice(0, STORED_PREFIX_LENGTH)
}

/**
 * Check if a string looks like a valid token format
 */
export function isValidTokenFormat(token: string): boolean {
  if (!token.startsWith(TOKEN_PREFIX)) {
    return false
  }

  const randomPart = token.slice(TOKEN_PREFIX.length)
  if (randomPart.length !== TOKEN_RANDOM_LENGTH) {
    return false
  }

  // Check if it's valid hex
  return /^[a-f0-9]+$/i.test(randomPart)
}

// =============================================================================
// Token Validation
// =============================================================================

/**
 * Validate a token and return the token record if valid
 *
 * @param token - Full token to validate
 * @returns Token record if valid, null if invalid
 */
export async function validateToken(token: string): Promise<ApiTokenRecord | null> {
  if (!isValidTokenFormat(token)) {
    return null
  }

  const tokenHash = hashToken(token)

  // Find token by hash
  const tokenRecord = await prisma.apiToken.findUnique({
    where: { tokenHash },
  })

  if (!tokenRecord) {
    return null
  }

  // Check if revoked
  if (tokenRecord.revokedAt) {
    return null
  }

  // Check if expired
  if (tokenRecord.expiresAt && tokenRecord.expiresAt < new Date()) {
    return null
  }

  // Update last used timestamp (fire and forget)
  prisma.apiToken.update({
    where: { id: tokenRecord.id },
    data: { lastUsedAt: new Date() },
  }).catch(() => {
    // Ignore errors - this is non-critical
  })

  return tokenRecord as ApiTokenRecord
}

/**
 * Validate token and check for required scope
 *
 * @param token - Full token
 * @param requiredScope - Scope that must be present
 * @returns Token record if valid and has scope, null otherwise
 */
export async function validateTokenWithScope(
  token: string,
  requiredScope: ApiScope
): Promise<ApiTokenRecord | null> {
  const tokenRecord = await validateToken(token)

  if (!tokenRecord) {
    return null
  }

  if (!hasScope(tokenRecord.scopes as ApiScope[], requiredScope)) {
    return null
  }

  return tokenRecord
}

// =============================================================================
// Scope Helpers
// =============================================================================

/**
 * Check if scopes array includes required scope
 * Handles write scopes implying read scopes
 */
export function hasScope(scopes: ApiScope[], required: ApiScope): boolean {
  // Direct match
  if (scopes.includes(required)) {
    return true
  }

  // Write implies read
  if (required === 'kits:read' && scopes.includes('kits:write')) {
    return true
  }
  if (required === 'servers:read' && scopes.includes('servers:write')) {
    return true
  }
  if (required === 'analytics:read' && scopes.includes('analytics:write')) {
    return true
  }

  return false
}

/**
 * Check if scopes include any write permission
 */
export function hasWriteScope(scopes: ApiScope[]): boolean {
  return (
    scopes.includes('kits:write') ||
    scopes.includes('servers:write') ||
    scopes.includes('analytics:write') ||
    scopes.includes('telemetry:write')
  )
}

// =============================================================================
// Token CRUD
// =============================================================================

/**
 * Create a new API token
 *
 * @param name - Display name for the token
 * @param scopes - Granted scopes
 * @param createdBy - User ID who created the token
 * @param categoryId - Optional category ID
 * @param expiresAt - Optional expiration date
 * @returns Object with full token (only shown once!) and record info
 */
export async function createApiToken(params: {
  name: string
  scopes: ApiScope[]
  createdBy: string
  categoryId?: string | null
  expiresAt?: Date | null
}): Promise<{ token: string; record: ApiTokenRecord }> {
  const token = generateToken()
  const tokenHash = hashToken(token)
  const tokenPrefix = getTokenPrefix(token)

  const record = await prisma.apiToken.create({
    data: {
      name: params.name,
      tokenHash,
      tokenPrefix,
      scopes: params.scopes,
      createdBy: params.createdBy,
      categoryId: params.categoryId || null,
      expiresAt: params.expiresAt || null,
    },
  })

  return {
    token, // Full token - only returned once!
    record: record as ApiTokenRecord,
  }
}

/**
 * Update an API token's name, scopes, or category
 */
export async function updateApiToken(
  id: string,
  updates: {
    name?: string
    scopes?: ApiScope[]
    categoryId?: string | null
  }
): Promise<ApiTokenInfo> {
  const token = await prisma.apiToken.update({
    where: { id },
    data: {
      ...(updates.name !== undefined && { name: updates.name }),
      ...(updates.scopes !== undefined && { scopes: updates.scopes }),
      ...(updates.categoryId !== undefined && { categoryId: updates.categoryId }),
    },
    select: {
      id: true,
      name: true,
      tokenPrefix: true,
      scopes: true,
      createdBy: true,
      categoryId: true,
      createdAt: true,
      lastUsedAt: true,
      expiresAt: true,
      revokedAt: true,
      category: {
        select: {
          id: true,
          name: true,
          description: true,
          color: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    },
  })

  const now = new Date()

  return {
    id: token.id,
    name: token.name,
    tokenPrefix: token.tokenPrefix,
    scopes: token.scopes as ApiScope[],
    createdBy: token.createdBy,
    categoryId: token.categoryId,
    category: token.category,
    createdAt: token.createdAt,
    lastUsedAt: token.lastUsedAt,
    expiresAt: token.expiresAt,
    revokedAt: token.revokedAt,
    isExpired: token.expiresAt ? token.expiresAt < now : false,
    isRevoked: token.revokedAt !== null,
  }
}

/**
 * List all tokens for a user
 */
export async function listApiTokens(createdBy?: string): Promise<ApiTokenInfo[]> {
  const where = createdBy ? { createdBy } : {}

  const tokens = await prisma.apiToken.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      tokenPrefix: true,
      scopes: true,
      createdBy: true,
      categoryId: true,
      createdAt: true,
      lastUsedAt: true,
      expiresAt: true,
      revokedAt: true,
      category: {
        select: {
          id: true,
          name: true,
          description: true,
          color: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    },
  })

  const now = new Date()

  return tokens.map((t) => ({
    id: t.id,
    name: t.name,
    tokenPrefix: t.tokenPrefix,
    scopes: t.scopes as ApiScope[],
    createdBy: t.createdBy,
    categoryId: t.categoryId,
    category: t.category,
    createdAt: t.createdAt,
    lastUsedAt: t.lastUsedAt,
    expiresAt: t.expiresAt,
    revokedAt: t.revokedAt,
    isExpired: t.expiresAt ? t.expiresAt < now : false,
    isRevoked: t.revokedAt !== null,
  }))
}

/**
 * Revoke a token by ID
 */
export async function revokeApiToken(id: string): Promise<void> {
  await prisma.apiToken.update({
    where: { id },
    data: { revokedAt: new Date() },
  })
}

/**
 * Delete a token permanently
 */
export async function deleteApiToken(id: string): Promise<void> {
  await prisma.apiToken.delete({
    where: { id },
  })
}

/**
 * Get token info by ID (without hash)
 */
export async function getApiTokenById(id: string): Promise<ApiTokenInfo | null> {
  const token = await prisma.apiToken.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      tokenPrefix: true,
      scopes: true,
      createdBy: true,
      categoryId: true,
      createdAt: true,
      lastUsedAt: true,
      expiresAt: true,
      revokedAt: true,
      category: {
        select: {
          id: true,
          name: true,
          description: true,
          color: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    },
  })

  if (!token) return null

  const now = new Date()

  return {
    id: token.id,
    name: token.name,
    tokenPrefix: token.tokenPrefix,
    scopes: token.scopes as ApiScope[],
    createdBy: token.createdBy,
    categoryId: token.categoryId,
    category: token.category,
    createdAt: token.createdAt,
    lastUsedAt: token.lastUsedAt,
    expiresAt: token.expiresAt,
    revokedAt: token.revokedAt,
    isExpired: token.expiresAt ? token.expiresAt < now : false,
    isRevoked: token.revokedAt !== null,
  }
}
