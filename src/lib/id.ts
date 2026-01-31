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
 * Uses Node.js built-in crypto.randomUUID() — no external dependencies.
 */

import { randomUUID } from 'crypto'

// =============================================================================
// Prefixes
// =============================================================================

const PREFIXES = {
  category: 'category',
  kit: 'kit',
  apiToken: 'apitoken',
  tokenCategory: 'tokcat',
  auditLog: 'auditlog',
  gameServer: 'gameserver',
  // Analytics
  kitUsageEvent: 'kitusage',
  kitUsageDailyStats: 'kitdaily',
  kitUsageHourlyStats: 'kithourly',
  kitGlobalStats: 'kitglobal',
  serverWipe: 'wipe',
  serverIdentifier: 'serverid',
  identifierHash: 'id',
  // UI Categories (stored in JSON, not database)
  uiCategory: 'uicat',
  uiSubcategory: 'uisub',
} as const

export type IdType = keyof typeof PREFIXES

// =============================================================================
// Core Functions
// =============================================================================

/**
 * Generates a prefixed ID for the given entity type
 * @param type - The type of entity to generate an ID for
 * @returns A prefixed UUID (e.g., "category_550e8400-e29b-41d4-a716-446655440000")
 *
 * @example
 * const categoryId = generateId('category')  // "category_550e8400-..."
 * const kitId = generateId('kit')            // "kit_550e8400-..."
 */
export function generateId(type: IdType): string {
  return `${PREFIXES[type]}_${randomUUID()}`
}

/**
 * Validates that a string is a valid prefixed ID of the given type
 * @param id - The ID to validate
 * @param type - The expected entity type
 * @returns True if the ID is valid for the given type
 *
 * @example
 * isValidPrefixedId('category_550e8400-...', 'category')  // true
 * isValidPrefixedId('kit_550e8400-...', 'category')       // false
 * isValidPrefixedId('invalid', 'category')                // false
 */
export function isValidPrefixedId(id: string, type: IdType): boolean {
  const expectedPrefix = PREFIXES[type]
  if (!id.startsWith(`${expectedPrefix}_`)) return false

  // Validate UUID portion (36 chars: 8-4-4-4-12 with hyphens)
  const uuidPart = id.slice(expectedPrefix.length + 1)
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
 * Gets the prefix for a given entity type
 * @param type - The entity type
 * @returns The prefix string
 */
export function getPrefix(type: IdType): string {
  return PREFIXES[type]
}

/**
 * Extracts the entity type from a prefixed ID
 * @param prefixedId - A prefixed ID
 * @returns The entity type, or null if not recognized
 *
 * @example
 * getIdType('category_550e8400-...')  // 'category'
 * getIdType('kit_550e8400-...')       // 'kit'
 * getIdType('unknown_123')            // null
 */
export function getIdType(prefixedId: string): IdType | null {
  const underscoreIndex = prefixedId.indexOf('_')
  if (underscoreIndex === -1) return null

  const prefix = prefixedId.slice(0, underscoreIndex)
  const entry = Object.entries(PREFIXES).find(([, p]) => p === prefix)
  return entry ? (entry[0] as IdType) : null
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
export function validatePrefixedId(type: IdType) {
  return (idValue: string) => isValidPrefixedId(idValue, type)
}

// =============================================================================
// Helper Object
// =============================================================================

/**
 * Helper object for generating IDs — provides autocomplete for all entity types
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
  category: () => generateId('category'),
  kit: () => generateId('kit'),
  apiToken: () => generateId('apiToken'),
  tokenCategory: () => generateId('tokenCategory'),
  auditLog: () => generateId('auditLog'),
  gameServer: () => generateId('gameServer'),
  // Analytics
  kitUsageEvent: () => generateId('kitUsageEvent'),
  kitUsageDailyStats: () => generateId('kitUsageDailyStats'),
  kitUsageHourlyStats: () => generateId('kitUsageHourlyStats'),
  kitGlobalStats: () => generateId('kitGlobalStats'),
  serverWipe: () => generateId('serverWipe'),
  serverIdentifier: () => generateId('serverIdentifier'),
  identifierHash: () => generateId('identifierHash'),
  // UI Categories (stored in JSON, not database)
  uiCategory: () => generateId('uiCategory'),
  uiSubcategory: () => generateId('uiSubcategory'),
} as const

/**
 * All available prefixes — useful for documentation or debugging
 */
export const ID_PREFIXES = PREFIXES
