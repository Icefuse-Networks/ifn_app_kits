/**
 * Server Validation Schemas
 *
 * Zod schemas for game servers, server identifiers, and their categories.
 */

import { z } from 'zod'
import { validatePrefixedId } from '@/lib/id'

// =============================================================================
// Game Server Schemas
// =============================================================================

export const createGameServerSchema = z.object({
  categoryID: z.number().int().min(0),
  name: z.string().min(1, 'Name is required').max(255).trim(),
  ip: z.string().min(1, 'IP is required').max(45),
  port: z.number().int().min(1).max(65535),
  imageUrl: z.string().url('Invalid image URL').max(191),
  iconUrl: z.string().url('Invalid icon URL').max(191),
  wipeConfig: z.string().max(10_000).nullable().optional(),
  botToken: z.string().max(255).nullable().optional(),
  kitConfigId: z
    .string()
    .refine(validatePrefixedId('category'), {
      message: 'Invalid category ID format',
    })
    .nullable()
    .optional(),
})

export const updateGameServerSchema = createGameServerSchema.partial()

export const gameServerIdSchema = z.object({
  id: z.coerce.number().int().min(1, 'Invalid server ID'),
})

// =============================================================================
// Server Identifier Schemas
// =============================================================================

export const createServerIdentifierSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .max(100, 'Name must be 100 characters or less')
    .trim(),
  description: z.string().max(255).nullable().optional(),
})

export const serverIdentifierIdSchema = z.object({
  id: z.string().refine(validatePrefixedId('serverIdentifier'), {
    message: 'Invalid server identifier ID format',
  }),
})

export const updateServerIdentifierSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .max(100, 'Name must be 100 characters or less')
    .trim()
    .optional(),
  description: z.string().max(255).nullable().optional(),
  categoryId: z.string().max(60).nullable().optional(),
  botToken: z.string().max(255).nullable().optional(),
  region: z.string().max(10).nullable().optional(),
  timezone: z.string().max(40).nullable().optional(),
  teamLimit: z.string().max(20).nullable().optional(),
  imageUrl: z.string().url().max(500).nullable().optional(),
  iconUrl: z.string().url().max(500).nullable().optional(),
})

// =============================================================================
// Server Identifier Category Schemas
// =============================================================================

export const createServerIdentifierCategorySchema = z.object({
  name: z
    .string()
    .min(1, 'Category name is required')
    .max(100, 'Category name must be 100 characters or less')
    .trim(),
  description: z.string().max(255).nullable().optional(),
})

export const updateServerIdentifierCategorySchema = createServerIdentifierCategorySchema.partial()

export const serverIdentifierCategoryIdSchema = z.object({
  id: z.string().refine(validatePrefixedId('serverIdentifierCategory'), {
    message: 'Invalid server identifier category ID format',
  }),
})

// =============================================================================
// Type Exports
// =============================================================================

export type CreateGameServerInput = z.infer<typeof createGameServerSchema>
export type UpdateGameServerInput = z.infer<typeof updateGameServerSchema>
export type CreateServerIdentifierInput = z.infer<typeof createServerIdentifierSchema>
export type UpdateServerIdentifierInput = z.infer<typeof updateServerIdentifierSchema>
export type CreateServerIdentifierCategoryInput = z.infer<typeof createServerIdentifierCategorySchema>
export type UpdateServerIdentifierCategoryInput = z.infer<typeof updateServerIdentifierCategorySchema>
