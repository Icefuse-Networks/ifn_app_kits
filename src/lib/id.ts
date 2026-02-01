/**
 * Prefixed ID Generation Utility
 *
 * Generates Stripe-style prefixed IDs for different entity types.
 * Format: {prefix}_{uuid}
 *
 * Example: category_550e8400-e29b-41d4-a716-446655440000
 *
 * This makes IDs self-documenting — you can tell what type of entity
 * an ID refers to just by looking at it.
 *
 * Designed for multi-plugin extensibility (Kits, Clans, Stats, etc.)
 * Plugins can register their own ID prefixes at startup.
 *
 * Uses Node.js built-in crypto.randomUUID() — no external dependencies.
 */

import { randomUUID } from 'crypto'

// =============================================================================
// Prefix Registry - Extensible for Plugins
// =============================================================================

/**
 * Prefix definition with metadata
 */
export interface PrefixDefinition {
  key: string
  prefix: string
  displayName: string
  plugin: string
}

/**
 * Prefix registry - plugins register their entity prefixes here
 */
const PREFIX_REGISTRY: Map<string, PrefixDefinition> = new Map()

/**
 * Reverse lookup: prefix string -> key
 */
const PREFIX_TO_KEY: Map<string, string> = new Map()

/**
 * Register an ID prefix for an entity type
 *
 * @example
 * // Register a new entity type for Clans plugin
 * registerPrefix('clan', 'clan', 'Clan', 'clans')
 * registerPrefix('clanMember', 'clanmem', 'Clan Member', 'clans')
 *
 * // Then use it:
 * const clanId = generateIdForPrefix('clan') // "clan_550e8400-..."
 */
export function registerPrefix(
  key: string,
  prefix: string,
  displayName: string,
  plugin: string
): void {
  PREFIX_REGISTRY.set(key, { key, prefix, displayName, plugin })
  PREFIX_TO_KEY.set(prefix, key)
}

/**
 * Check if a prefix key is registered
 */
export function isPrefixRegistered(key: string): boolean {
  return PREFIX_REGISTRY.has(key)
}

/**
 * Get all registered prefix keys
 */
export function getRegisteredPrefixes(): string[] {
  return Array.from(PREFIX_REGISTRY.keys())
}

/**
 * Get prefixes for a specific plugin
 */
export function getPrefixesForPlugin(plugin: string): PrefixDefinition[] {
  return Array.from(PREFIX_REGISTRY.values()).filter((def) => def.plugin === plugin)
}

// =============================================================================
// Core Prefixes (registered at startup)
// =============================================================================

// Core/shared entities
registerPrefix('category', 'category', 'Category', 'core')
registerPrefix('apiToken', 'apitoken', 'API Token', 'core')
registerPrefix('tokenCategory', 'tokcat', 'Token Category', 'core')
registerPrefix('auditLog', 'auditlog', 'Audit Log', 'core')
registerPrefix('gameServer', 'gameserver', 'Game Server', 'core')
registerPrefix('serverWipe', 'wipe', 'Server Wipe', 'core')
registerPrefix('serverIdentifier', 'serverid', 'Server Identifier', 'core')
registerPrefix('serverIdentifierCategory', 'serveridcat', 'Server Identifier Category', 'core')
registerPrefix('identifierHash', 'id', 'Identifier Hash', 'core')

// Kits plugin entities
registerPrefix('kit', 'kit', 'Kit', 'kits')
registerPrefix('kitUsageEvent', 'kitusage', 'Kit Usage Event', 'kits')
registerPrefix('kitUsageDailyStats', 'kitdaily', 'Kit Daily Stats', 'kits')
registerPrefix('kitUsageHourlyStats', 'kithourly', 'Kit Hourly Stats', 'kits')
registerPrefix('kitGlobalStats', 'kitglobal', 'Kit Global Stats', 'kits')

// UI Categories (stored in JSON, not database)
registerPrefix('uiCategory', 'uicat', 'UI Category', 'core')
registerPrefix('uiSubcategory', 'uisub', 'UI Subcategory', 'core')

// Clans plugin entities
registerPrefix('clan', 'clan', 'Clan', 'clans')
registerPrefix('clanMember', 'clanmem', 'Clan Member', 'clans')
registerPrefix('clanRole', 'clanrole', 'Clan Role', 'clans')
registerPrefix('clanInvite', 'claninv', 'Clan Invite', 'clans')
registerPrefix('clanApplication', 'clanapp', 'Clan Application', 'clans')
registerPrefix('clanAlliance', 'clanally', 'Clan Alliance', 'clans')
registerPrefix('clanEnemy', 'clanenemy', 'Clan Enemy', 'clans')
registerPrefix('clanWipeStats', 'clanstats', 'Clan Wipe Stats', 'clans')
registerPrefix('clanPrestige', 'clanpres', 'Clan Prestige', 'clans')
registerPrefix('clanPerkDefinition', 'perkdef', 'Perk Definition', 'clans')
registerPrefix('clanPerk', 'clanperk', 'Clan Perk', 'clans')
registerPrefix('bannedClanName', 'bannedname', 'Banned Clan Name', 'clans') // Legacy
registerPrefix('clanEvent', 'clanevent', 'Clan Event', 'clans')

// Moderation plugin entities (global content moderation)
registerPrefix('bannedWord', 'bannedword', 'Banned Word', 'moderation')

// Redirect plugin entities
registerPrefix('redirectConfig', 'redircfg', 'Redirect Config', 'redirect')
registerPrefix('redirectLog', 'redirlog', 'Redirect Log', 'redirect')

// -----------------------------------------------------------------------------
// Future Plugin Prefixes (uncomment when adding plugins)
// -----------------------------------------------------------------------------
// registerPrefix('playerStat', 'pstat', 'Player Stat', 'stats')
// registerPrefix('killEvent', 'kill', 'Kill Event', 'stats')
// registerPrefix('deathEvent', 'death', 'Death Event', 'stats')

// =============================================================================
// Legacy Type Support
// =============================================================================

/**
 * Known ID types (for backwards compatibility)
 * New code should use registerPrefix() for extensibility
 */
export type IdType =
  // Core entities
  | 'category'
  | 'apiToken'
  | 'tokenCategory'
  | 'auditLog'
  | 'gameServer'
  | 'serverWipe'
  | 'serverIdentifier'
  | 'serverIdentifierCategory'
  | 'identifierHash'
  | 'uiCategory'
  | 'uiSubcategory'
  // Kits plugin
  | 'kit'
  | 'kitUsageEvent'
  | 'kitUsageDailyStats'
  | 'kitUsageHourlyStats'
  | 'kitGlobalStats'
  // Clans plugin
  | 'clan'
  | 'clanMember'
  | 'clanRole'
  | 'clanInvite'
  | 'clanApplication'
  | 'clanAlliance'
  | 'clanEnemy'
  | 'clanWipeStats'
  | 'clanPrestige'
  | 'clanPerkDefinition'
  | 'clanPerk'
  | 'bannedClanName' // Legacy
  | 'clanEvent'
  // Moderation plugin
  | 'bannedWord'
  // Redirect plugin
  | 'redirectConfig'
  | 'redirectLog'

// =============================================================================
// Core Functions
// =============================================================================

/**
 * Generates a prefixed ID for a registered entity type
 * @param key - The registered key for the entity type
 * @returns A prefixed UUID (e.g., "category_550e8400-e29b-41d4-a716-446655440000")
 * @throws Error if the key is not registered
 *
 * @example
 * const categoryId = generateId('category')  // "category_550e8400-..."
 * const kitId = generateId('kit')            // "kit_550e8400-..."
 */
export function generateId(key: string): string {
  const def = PREFIX_REGISTRY.get(key)
  if (!def) {
    throw new Error(`Unknown ID type: ${key}. Register it first with registerPrefix().`)
  }
  return `${def.prefix}_${randomUUID()}`
}

/**
 * Generate an ID for a dynamically registered prefix
 * Use this when you've registered custom prefixes at runtime
 */
export function generateIdForPrefix(key: string): string {
  return generateId(key)
}

/**
 * Validates that a string is a valid prefixed ID of the given type
 * @param id - The ID to validate
 * @param key - The expected entity type key
 * @returns True if the ID is valid for the given type
 *
 * @example
 * isValidPrefixedId('category_550e8400-...', 'category')  // true
 * isValidPrefixedId('kit_550e8400-...', 'category')       // false
 * isValidPrefixedId('invalid', 'category')                // false
 */
export function isValidPrefixedId(id: string, key: string): boolean {
  const def = PREFIX_REGISTRY.get(key)
  if (!def) return false

  if (!id.startsWith(`${def.prefix}_`)) return false

  // Validate UUID portion (36 chars: 8-4-4-4-12 with hyphens)
  const uuidPart = id.slice(def.prefix.length + 1)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  return uuidRegex.test(uuidPart)
}

/**
 * Extracts the UUID portion from a prefixed ID
 * @param prefixedId - A prefixed ID (e.g., "category_550e8400-...")
 * @returns The UUID portion (e.g., "550e8400-...")
 */
export function extractUuid(prefixedId: string): string {
  const underscoreIndex = prefixedId.indexOf('_')
  return underscoreIndex !== -1 ? prefixedId.slice(underscoreIndex + 1) : prefixedId
}

/**
 * Gets the prefix string for a given entity type key
 * @param key - The entity type key
 * @returns The prefix string, or undefined if not registered
 */
export function getPrefix(key: string): string | undefined {
  return PREFIX_REGISTRY.get(key)?.prefix
}

/**
 * Extracts the entity type key from a prefixed ID
 * @param prefixedId - A prefixed ID
 * @returns The entity type key, or null if not recognized
 *
 * @example
 * getIdType('category_550e8400-...')  // 'category'
 * getIdType('kit_550e8400-...')       // 'kit'
 * getIdType('unknown_123')            // null
 */
export function getIdType(prefixedId: string): string | null {
  const underscoreIndex = prefixedId.indexOf('_')
  if (underscoreIndex === -1) return null

  const prefix = prefixedId.slice(0, underscoreIndex)
  return PREFIX_TO_KEY.get(prefix) ?? null
}

/**
 * Creates a Zod refinement for validating prefixed IDs
 * Use with z.string().refine(validatePrefixedId('category'))
 *
 * @example
 * const schema = z.object({
 *   categoryId: z.string().refine(validatePrefixedId('category'), {
 *     message: 'Invalid category ID format'
 *   })
 * })
 */
export function validatePrefixedId(key: string) {
  return (idValue: string) => isValidPrefixedId(idValue, key)
}

// =============================================================================
// Helper Object (for backwards compatibility and autocomplete)
// =============================================================================

/**
 * Helper object for generating IDs — provides autocomplete for core entity types
 *
 * For dynamically registered types, use generateId(key) directly.
 *
 * @example
 * await prisma.kitConfig.create({
 *   data: {
 *     id: id.category(),
 *     name: 'My Config',
 *     ...
 *   }
 * })
 */
export const id = {
  // Core entities
  category: () => generateId('category'),
  apiToken: () => generateId('apiToken'),
  tokenCategory: () => generateId('tokenCategory'),
  auditLog: () => generateId('auditLog'),
  gameServer: () => generateId('gameServer'),
  serverWipe: () => generateId('serverWipe'),
  serverIdentifier: () => generateId('serverIdentifier'),
  serverIdentifierCategory: () => generateId('serverIdentifierCategory'),
  identifierHash: () => generateId('identifierHash'),

  // Kits plugin
  kit: () => generateId('kit'),
  kitUsageEvent: () => generateId('kitUsageEvent'),
  kitUsageDailyStats: () => generateId('kitUsageDailyStats'),
  kitUsageHourlyStats: () => generateId('kitUsageHourlyStats'),
  kitGlobalStats: () => generateId('kitGlobalStats'),

  // Clans plugin
  clan: () => generateId('clan'),
  clanMember: () => generateId('clanMember'),
  clanRole: () => generateId('clanRole'),
  clanInvite: () => generateId('clanInvite'),
  clanApplication: () => generateId('clanApplication'),
  clanAlliance: () => generateId('clanAlliance'),
  clanEnemy: () => generateId('clanEnemy'),
  clanWipeStats: () => generateId('clanWipeStats'),
  clanPrestige: () => generateId('clanPrestige'),
  clanPerkDefinition: () => generateId('clanPerkDefinition'),
  clanPerk: () => generateId('clanPerk'),
  bannedClanName: () => generateId('bannedClanName'), // Legacy
  clanEvent: () => generateId('clanEvent'),

  // UI Categories
  uiCategory: () => generateId('uiCategory'),
  uiSubcategory: () => generateId('uiSubcategory'),

  // Moderation plugin
  bannedWord: () => generateId('bannedWord'),

  // Redirect plugin
  redirectConfig: () => generateId('redirectConfig'),
  redirectLog: () => generateId('redirectLog'),
} as const

/**
 * All available prefixes — useful for documentation or debugging
 * Returns a snapshot of currently registered prefixes
 */
export function getIdPrefixes(): Record<string, string> {
  const result: Record<string, string> = {}
  for (const [key, def] of PREFIX_REGISTRY) {
    result[key] = def.prefix
  }
  return result
}

/**
 * Legacy export for backwards compatibility
 * @deprecated Use getIdPrefixes() for the current registry state
 */
export const ID_PREFIXES = getIdPrefixes()
