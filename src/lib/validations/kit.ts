/**
 * Kit Validation Schemas
 *
 * Zod schemas for validating kit-related API inputs.
 * SECURITY: All inputs are validated before processing.
 */

import { z } from 'zod'
import type { ApiScope } from '@/types/api'
import { API_SCOPES } from '@/types/api'
import { validatePrefixedId } from '@/lib/id'

// =============================================================================
// Kit Item Schemas
// =============================================================================

/**
 * Kit item validation (recursive for nested contents)
 */
const kitItemSchemaBase = z.object({
  Shortname: z.string().min(1).max(100),
  Skin: z.union([z.number(), z.string()]),
  Amount: z.number().int().min(1).max(1000000),
  Condition: z.number().min(0).max(1),
  MaxCondition: z.number().min(0).max(1),
  Ammo: z.number().int().min(0),
  Ammotype: z.string().nullable(),
  Position: z.number().int().min(-1),
  Frequency: z.number().int().min(0),
  BlueprintShortname: z.string().nullable(),
})

// Recursive type for Contents
type KitItemInput = z.infer<typeof kitItemSchemaBase> & {
  Contents: KitItemInput[] | null
}

export const kitItemSchema: z.ZodType<KitItemInput> = kitItemSchemaBase.extend({
  Contents: z.lazy(() => z.array(kitItemSchema).nullable()),
})

// =============================================================================
// Category Schemas
// =============================================================================

/**
 * Subcategory validation
 */
export const kitSubcategorySchema = z.object({
  name: z.string().min(1).max(50),
  order: z.number().int().min(0).default(0),
})

/**
 * Category validation
 */
export const kitCategorySchema = z.object({
  name: z.string().min(1).max(50),
  order: z.number().int().min(0).default(0),
  subcategories: z.record(z.string(), kitSubcategorySchema).default({}),
})

// =============================================================================
// Kit Schemas
// =============================================================================

/**
 * Individual kit validation
 */
export const kitSchema = z.object({
  Name: z.string().min(1).max(100),
  Description: z.string().max(500).default(''),
  RequiredPermission: z.string().max(200).default(''),
  MaximumUses: z.number().int().min(-1).default(-1),
  RequiredAuth: z.number().int().min(0).default(0),
  Cooldown: z.number().min(0).default(0),
  Cost: z.number().min(0).default(0),
  IsHidden: z.boolean().default(false),
  HideWithoutPermission: z.boolean().default(false),
  IsAutoKit: z.boolean().default(false),
  CopyPasteFile: z.string().max(200).default(''),
  KitImage: z.string().max(500).default(''),
  Order: z.number().int().min(0).default(0),
  Category: z.string().max(50).optional(),
  Subcategory: z.string().max(50).optional(),
  MainItems: z.array(kitItemSchema).max(24).default([]),
  WearItems: z.array(kitItemSchema).max(8).default([]),
  BeltItems: z.array(kitItemSchema).max(6).default([]),
  uuid: z.string().uuid().optional(),
})

/**
 * Full kit data validation (stored in kitData field)
 */
export const kitsDataSchema = z.object({
  _comment: z.string().optional(),
  _kits: z.record(z.string(), kitSchema),
  _categories: z.record(z.string(), kitCategorySchema).optional(),
  'AutoKits Priority': z.array(z.string()).optional(),
  'Post wipe cooldowns (kit name | seconds)': z.record(z.string(), z.number()).optional(),
})

// =============================================================================
// Kit Config Schemas
// =============================================================================

/**
 * Create kit config validation
 */
export const createKitConfigSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .max(100, 'Name must be 100 characters or less')
    .trim(),
  description: z.string().max(500).nullable().optional(),
  kitData: z.union([
    z.string().min(2), // JSON string
    kitsDataSchema,    // Already parsed object
  ]),
  storeData: z.string().nullable().optional(),
})

/**
 * Update kit config validation
 */
export const updateKitConfigSchema = z.object({
  name: z.string().min(1).max(100).trim().optional(),
  description: z.string().max(500).nullable().optional(),
  kitData: z.union([z.string().min(2), kitsDataSchema]).optional(),
  storeData: z.string().nullable().optional(),
})

/**
 * Kit config ID parameter validation (category ID)
 * Validates prefixed UUID format: category_xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
 */
export const kitConfigIdSchema = z.object({
  id: z.string().refine(validatePrefixedId('category'), {
    message: 'Invalid category ID format',
  }),
})

/**
 * Kit ID parameter validation
 * Validates prefixed UUID format: kit_xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
 */
export const kitIdSchema = z.object({
  id: z.string().refine(validatePrefixedId('kit'), {
    message: 'Invalid kit ID format',
  }),
})

// =============================================================================
// Game Server Schemas
// =============================================================================

/**
 * Create game server validation
 */
export const createGameServerSchema = z.object({
  categoryID: z.number().int().min(0),
  name: z.string().min(1, 'Name is required').max(255).trim(),
  ip: z.string().min(1, 'IP is required').max(45),
  port: z.number().int().min(1).max(65535),
  imageUrl: z.string().url('Invalid image URL').max(191),
  iconUrl: z.string().url('Invalid icon URL').max(191),
  wipeConfig: z.string().nullable().optional(),
  botToken: z.string().max(255).nullable().optional(),
  kitConfigId: z
    .string()
    .refine(validatePrefixedId('category'), {
      message: 'Invalid category ID format',
    })
    .nullable()
    .optional(),
})

/**
 * Update game server validation (all fields optional)
 */
export const updateGameServerSchema = createGameServerSchema.partial()

/**
 * Game server ID parameter validation
 */
export const gameServerIdSchema = z.object({
  id: z.coerce.number().int().min(1, 'Invalid server ID'),
})

// =============================================================================
// API Token Schemas
// =============================================================================

/**
 * API scope validation
 */
export const apiScopeSchema = z.enum(API_SCOPES as [ApiScope, ...ApiScope[]])

/**
 * Create API token validation
 */
export const createApiTokenSchema = z.object({
  name: z
    .string()
    .min(1, 'Token name is required')
    .max(100, 'Token name must be 100 characters or less')
    .trim(),
  scopes: z
    .array(apiScopeSchema)
    .min(1, 'At least one scope is required')
    .max(10),
  categoryId: z.string().max(60).nullable().optional(),
  expiresAt: z
    .string()
    .datetime()
    .optional()
    .transform((val) => (val ? new Date(val) : null)),
})

/**
 * Update API token validation
 */
export const updateApiTokenSchema = z.object({
  name: z
    .string()
    .min(1, 'Token name is required')
    .max(100, 'Token name must be 100 characters or less')
    .trim()
    .optional(),
  scopes: z
    .array(apiScopeSchema)
    .min(1, 'At least one scope is required')
    .max(10)
    .optional(),
  categoryId: z.string().max(60).nullable().optional(),
})

/**
 * Token ID parameter validation
 * Validates cuid format (25+ alphanumeric chars starting with 'c')
 */
export const tokenIdSchema = z.object({
  id: z.string()
    .min(25, 'Invalid token ID')
    .max(30, 'Invalid token ID')
    .regex(/^c[a-z0-9]{20,}$/i, 'Invalid token ID format'),
})

/**
 * Token category validation
 */
export const createTokenCategorySchema = z.object({
  name: z
    .string()
    .min(1, 'Category name is required')
    .max(100, 'Category name must be 100 characters or less')
    .trim(),
  description: z.string().max(255).nullable().optional(),
  color: z.string().max(20).nullable().optional(),
})

export const updateTokenCategorySchema = createTokenCategorySchema.partial()

export const tokenCategoryIdSchema = z.object({
  id: z.string().refine(validatePrefixedId('tokenCategory'), {
    message: 'Invalid token category ID format',
  }),
})

// =============================================================================
// Server Identifier Schemas
// =============================================================================

/**
 * Create server identifier validation
 */
export const createServerIdentifierSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .max(100, 'Name must be 100 characters or less')
    .trim(),
  description: z.string().max(255).nullable().optional(),
})

/**
 * Server identifier ID parameter validation
 */
export const serverIdentifierIdSchema = z.object({
  id: z.string().refine(validatePrefixedId('serverIdentifier'), {
    message: 'Invalid server identifier ID format',
  }),
})

// =============================================================================
// Query Parameter Schemas
// =============================================================================

/**
 * Pagination query parameters
 */
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
})

/**
 * List kits query parameters
 */
export const listKitsQuerySchema = z.object({
  full: z
    .string()
    .nullish()
    .transform((val) => val === 'true'),
  store: z
    .string()
    .nullish()
    .transform((val) => val === 'true'),
})

/**
 * Plugin kit config query parameter
 * Used by Rust plugin to request a specific kit configuration
 * Supports both name-based (legacy) and ID-based (new) lookups
 *
 * @example
 * GET /api/servers/kits?config=5x%20Server%20Kits  // Legacy: by name
 * GET /api/servers/kits?id=category_550e8400-...   // New: by ID
 */
export const pluginConfigQuerySchema = z
  .object({
    config: z.string().min(1).max(100).trim().optional(), // Name-based (legacy)
    id: z.string().optional(), // ID-based (new)
  })
  .refine(
    (data) => data.config || data.id,
    { message: 'Either config (name) or id must be provided' }
  )
  .optional() // Entire object optional for "list all" mode

// =============================================================================
// Type Exports
// =============================================================================

/**
 * Clone kit config validation
 */
export const cloneKitConfigSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .max(100, 'Name must be 100 characters or less')
    .trim(),
  description: z.string().max(500).nullable().optional(),
})

export type CreateKitConfigInput = z.infer<typeof createKitConfigSchema>
export type UpdateKitConfigInput = z.infer<typeof updateKitConfigSchema>
export type CloneKitConfigInput = z.infer<typeof cloneKitConfigSchema>
export type CreateGameServerInput = z.infer<typeof createGameServerSchema>
export type UpdateGameServerInput = z.infer<typeof updateGameServerSchema>
export type CreateApiTokenInput = z.infer<typeof createApiTokenSchema>
export type UpdateApiTokenInput = z.infer<typeof updateApiTokenSchema>
export type CreateTokenCategoryInput = z.infer<typeof createTokenCategorySchema>
export type UpdateTokenCategoryInput = z.infer<typeof updateTokenCategorySchema>
export type CreateServerIdentifierInput = z.infer<typeof createServerIdentifierSchema>
