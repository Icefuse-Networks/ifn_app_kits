/**
 * API Type Definitions
 *
 * Types for API authentication, scopes, and responses.
 */

// =============================================================================
// API Token Scopes
// =============================================================================

/**
 * Available API token scopes
 */
export type ApiScope =
  | 'kits:read'        // Read kit configs
  | 'kits:write'       // Create/update/delete kits
  | 'servers:read'     // Read game servers
  | 'servers:write'    // Create/update/delete servers
  | 'analytics:read'   // Read analytics data
  | 'analytics:write'  // Write analytics events
  | 'telemetry:write'  // Submit telemetry data

/**
 * All available scopes
 */
export const API_SCOPES: ApiScope[] = [
  'kits:read',
  'kits:write',
  'servers:read',
  'servers:write',
  'analytics:read',
  'analytics:write',
  'telemetry:write',
]

/**
 * Scope descriptions for UI
 */
export const SCOPE_DESCRIPTIONS: Record<ApiScope, string> = {
  'kits:read': 'Read kit configurations',
  'kits:write': 'Create, update, and delete kit configurations',
  'servers:read': 'Read game server information',
  'servers:write': 'Create, update, and delete game servers',
  'analytics:read': 'Read kit usage analytics and statistics',
  'analytics:write': 'Submit kit usage events from game servers',
  'telemetry:write': 'Submit telemetry and health data from game servers',
}

/**
 * Default scopes for new tokens
 */
export const DEFAULT_SCOPES: ApiScope[] = ['kits:read']

// =============================================================================
// Auth Context
// =============================================================================

/**
 * Authentication context passed to route handlers
 */
export interface AuthContext {
  /** Type of authentication used */
  type: 'token' | 'session'
  /** Actor identifier (token ID or user ID) */
  actorId: string
  /** Actor display name (token name or user name) */
  actorName: string
  /** Granted scopes */
  scopes: ApiScope[]
}

// =============================================================================
// API Token Types
// =============================================================================

/**
 * Token category for organizing tokens by plugin/purpose
 */
export interface TokenCategory {
  id: string
  name: string
  description: string | null
  color: string | null
  createdAt: Date
  updatedAt: Date
  _count?: {
    tokens: number
  }
}

/**
 * API token as stored in database
 */
export interface ApiTokenRecord {
  id: string
  name: string
  tokenHash: string
  tokenPrefix: string
  scopes: string[]
  createdBy: string
  categoryId: string | null
  createdAt: Date
  lastUsedAt: Date | null
  expiresAt: Date | null
  revokedAt: Date | null
}

/**
 * API token for list display (no hash)
 */
export interface ApiTokenInfo {
  id: string
  name: string
  tokenPrefix: string
  scopes: ApiScope[]
  createdBy: string
  categoryId: string | null
  category?: TokenCategory | null
  createdAt: Date
  lastUsedAt: Date | null
  expiresAt: Date | null
  revokedAt: Date | null
  isExpired: boolean
  isRevoked: boolean
}

/**
 * Response when creating a new token
 * IMPORTANT: Full token is only returned once on creation
 */
export interface ApiTokenCreateResponse {
  token: string
  id: string
  name: string
  scopes: ApiScope[]
  categoryId: string | null
  expiresAt: Date | null
}

// =============================================================================
// API Response Types
// =============================================================================

/**
 * Standard API error response
 */
export interface ApiError {
  error: string
  details?: unknown
  status?: number
}

/**
 * Standard API success response
 */
export interface ApiSuccess<T = unknown> {
  data: T
}

/**
 * Paginated list response
 */
export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
  hasMore: boolean
}

// =============================================================================
// Audit Log Types
// =============================================================================

/**
 * Audit action types
 */
export type AuditAction = 'create' | 'update' | 'delete'

/**
 * Auditable resource types
 */
export type AuditResourceType = 'kit_config' | 'game_server' | 'api_token' | 'server_identifier' | 'server_identifier_category' | 'token_category'

/**
 * Audit log entry
 */
export interface AuditLogEntry {
  id: string
  action: AuditAction
  resourceType: AuditResourceType
  resourceId: string
  actorType: 'token' | 'session'
  actorId: string
  oldValues: unknown | null
  newValues: unknown | null
  ipAddress: string | null
  userAgent: string | null
  createdAt: Date
}
