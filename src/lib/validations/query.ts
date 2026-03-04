/**
 * Query Parameter Validation Schemas
 *
 * Zod schemas for pagination and common query parameters.
 */

import { z } from 'zod'

// =============================================================================
// Pagination
// =============================================================================

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
})

// =============================================================================
// Kit Query Parameters
// =============================================================================

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
 */
export const pluginConfigQuerySchema = z
  .object({
    config: z.string().min(1).max(100).trim().optional(),
    id: z.string().optional(),
  })
  .refine(
    (data) => data.config || data.id,
    { message: 'Either config (name) or id must be provided' }
  )
  .optional()
