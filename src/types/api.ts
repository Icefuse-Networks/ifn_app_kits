/**
 * API Type Definitions
 *
 * Types for API authentication, scopes, and responses.
 * Designed for multi-plugin extensibility (Kits, Clans, Stats, etc.)
 */

// =============================================================================
// API Token Scopes - Extensible Registry
// =============================================================================

/**
 * Scope format: `namespace:action`
 * - namespace: plugin identifier (kits, clans, stats, servers, analytics, telemetry)
 * - action: read | write
 *
 * Examples: 'kits:read', 'clans:write', 'stats:read'
 */
export type ApiScope = string

/**
 * Scope definition with metadata
 */
export interface ScopeDefinition {
  scope: ApiScope
  description: string
  plugin: string
}

/**
 * Scope registry - extensible for plugins
 * Plugins register their scopes here
 */
export const SCOPE_REGISTRY: Map<ApiScope, ScopeDefinition> = new Map()

/**
 * Register a scope with the registry
 */
export function registerScope(scope: ApiScope, description: string, plugin: string): void {
  SCOPE_REGISTRY.set(scope, { scope, description, plugin })
}

/**
 * Check if a scope is registered
 */
export function isValidScope(scope: ApiScope): boolean {
  return SCOPE_REGISTRY.has(scope)
}

/**
 * Get all registered scopes
 */
export function getRegisteredScopes(): ApiScope[] {
  return Array.from(SCOPE_REGISTRY.keys())
}

/**
 * Get scopes for a specific plugin
 */
export function getScopesForPlugin(plugin: string): ApiScope[] {
  return Array.from(SCOPE_REGISTRY.entries())
    .filter(([, def]) => def.plugin === plugin)
    .map(([scope]) => scope)
}

// -----------------------------------------------------------------------------
// Core Plugin Scopes (registered at startup)
// -----------------------------------------------------------------------------

// Kits plugin scopes
registerScope('kits:read', 'Read kit configurations', 'kits')
registerScope('kits:write', 'Create, update, and delete kit configurations', 'kits')

// Servers (shared across plugins)
registerScope('servers:read', 'Read game server information', 'core')
registerScope('servers:write', 'Create, update, and delete game servers', 'core')

// Analytics (shared across plugins)
registerScope('analytics:read', 'Read analytics and statistics', 'core')
registerScope('analytics:write', 'Submit analytics events from game servers', 'core')

// Telemetry (shared across plugins)
registerScope('telemetry:write', 'Submit telemetry and health data from game servers', 'core')

// Identifiers (server registration)
registerScope('identifiers:register', 'Register new server identifiers dynamically', 'core')

// Clans plugin scopes
registerScope('clans:read', 'Read clan information', 'clans')
registerScope('clans:write', 'Create, update, and delete clans', 'clans')

// Redirect plugin scopes
registerScope('redirect:read', 'Read redirect configuration and logs', 'redirect')
registerScope('redirect:write', 'Manage redirect configuration and submit logs', 'redirect')

// LootManager plugin scopes
registerScope('lootmanager:read', 'Read loot configurations from game servers', 'lootmanager')
registerScope('lootmanager:write', 'Create and update loot configurations', 'lootmanager')

// IcefuseBases plugin scopes
registerScope('bases:read', 'Read IcefuseBases configurations from game servers', 'bases')
registerScope('bases:write', 'Create and update IcefuseBases configurations', 'bases')

// Giveaway plugin scopes
registerScope('giveaways:read', 'Read giveaway players', 'giveaways')
registerScope('giveaways:write', 'Create and delete giveaway players', 'giveaways')

// Announcements plugin scopes
registerScope('announcements:read', 'Read server announcements', 'announcements')
registerScope('announcements:write', 'Create, update, and delete server announcements', 'announcements')

// Stats plugin scopes
registerScope('stats:read', 'Read player statistics and leaderboards', 'stats')
registerScope('stats:write', 'Submit player statistics from game servers', 'stats')

// Feedback plugin scopes
registerScope('feedback:read', 'Read feedback submissions and reward queue', 'feedback')
registerScope('feedback:write', 'Submit feedback and manage reward status', 'feedback')

/**
 * All available scopes (for backwards compatibility)
 */
export const API_SCOPES: ApiScope[] = getRegisteredScopes()

/**
 * Scope descriptions for UI (for backwards compatibility)
 */
export const SCOPE_DESCRIPTIONS: Record<string, string> = Object.fromEntries(
  Array.from(SCOPE_REGISTRY.entries()).map(([scope, def]) => [scope, def.description])
)

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
// Audit Log Types - Extensible Registry
// =============================================================================

/**
 * Audit action types
 */
export type AuditAction = 'create' | 'update' | 'delete'

/**
 * Auditable resource types - string-based for plugin extensibility
 * Format: `plugin_resource` (e.g., 'kit_config', 'clan_member', 'player_stat')
 */
export type AuditResourceType = string

/**
 * Resource type definition with metadata
 */
export interface ResourceTypeDefinition {
  type: AuditResourceType
  displayName: string
  plugin: string
}

/**
 * Resource type registry - extensible for plugins
 */
export const RESOURCE_TYPE_REGISTRY: Map<AuditResourceType, ResourceTypeDefinition> = new Map()

/**
 * Register an auditable resource type
 */
export function registerResourceType(type: AuditResourceType, displayName: string, plugin: string): void {
  RESOURCE_TYPE_REGISTRY.set(type, { type, displayName, plugin })
}

/**
 * Check if a resource type is registered
 */
export function isValidResourceType(type: AuditResourceType): boolean {
  return RESOURCE_TYPE_REGISTRY.has(type)
}

/**
 * Get all registered resource types
 */
export function getRegisteredResourceTypes(): AuditResourceType[] {
  return Array.from(RESOURCE_TYPE_REGISTRY.keys())
}

// -----------------------------------------------------------------------------
// Core Resource Types (registered at startup)
// -----------------------------------------------------------------------------

// Core/shared resources
registerResourceType('game_server', 'Game Server', 'core')
registerResourceType('api_token', 'API Token', 'core')
registerResourceType('token_category', 'Token Category', 'core')
registerResourceType('server_identifier', 'Server Identifier', 'core')
registerResourceType('server_identifier_category', 'Server Identifier Category', 'core')

// Kits plugin resources
registerResourceType('kit_config', 'Kit Configuration', 'kits')

// Clans plugin resources
registerResourceType('clan', 'Clan', 'clans')
registerResourceType('clan_member', 'Clan Member', 'clans')
registerResourceType('clan_role', 'Clan Role', 'clans')
registerResourceType('clan_alliance', 'Clan Alliance', 'clans')
registerResourceType('clan_enemy', 'Clan Enemy', 'clans')
registerResourceType('clan_perk', 'Clan Perk', 'clans')
registerResourceType('clan_perk_definition', 'Perk Definition', 'clans')
registerResourceType('banned_clan_name', 'Banned Clan Name', 'clans')

// Redirect plugin resources
registerResourceType('redirect_config', 'Redirect Configuration', 'redirect')
registerResourceType('redirect_log', 'Redirect Log', 'redirect')
registerResourceType('redirect_queue', 'Redirect Queue', 'redirect')
registerResourceType('wipe_schedule', 'Wipe Schedule', 'redirect')

// LootManager plugin resources
registerResourceType('loot_config', 'Loot Configuration', 'lootmanager')
registerResourceType('loot_mapping', 'Loot Mapping', 'lootmanager')

// IcefuseBases plugin resources
registerResourceType('bases_config', 'Bases Configuration', 'bases')
registerResourceType('bases_mapping', 'Bases Mapping', 'bases')

// Giveaway plugin resources
registerResourceType('giveaway_player', 'Giveaway Player', 'giveaways')
registerResourceType('giveaway', 'Giveaway', 'giveaways')
registerResourceType('giveaway_server', 'Giveaway Server', 'giveaways')

// Announcements plugin resources
registerResourceType('announcement', 'Announcement', 'announcements')

// Stats plugin resources
registerResourceType('player_stat', 'Player Statistic', 'stats')
registerResourceType('stats_wipe', 'Stats Wipe Event', 'stats')

// Feedback plugin resources
registerResourceType('feedback', 'Feedback', 'feedback')
registerResourceType('feedback_reward', 'Feedback Reward', 'feedback')

/**
 * Known resource types (for backwards compatibility and type hints)
 */
export const AUDIT_RESOURCE_TYPES = getRegisteredResourceTypes()

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
