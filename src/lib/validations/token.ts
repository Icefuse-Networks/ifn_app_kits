/**
 * API Token Validation Schemas
 *
 * Zod schemas for API tokens and token categories.
 */

import { z } from 'zod'
import type { ApiScope } from '@/types/api'
import { API_SCOPES } from '@/types/api'
import { validatePrefixedId } from '@/lib/id'

// =============================================================================
// API Token Schemas
// =============================================================================

export const apiScopeSchema = z.enum(API_SCOPES as [ApiScope, ...ApiScope[]])

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

export const tokenIdSchema = z.object({
  id: z.string()
    .min(25, 'Invalid token ID')
    .max(30, 'Invalid token ID')
    .regex(/^c[a-z0-9]{20,}$/i, 'Invalid token ID format'),
})

// =============================================================================
// Token Category Schemas
// =============================================================================

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
// Type Exports
// =============================================================================

export type CreateApiTokenInput = z.infer<typeof createApiTokenSchema>
export type UpdateApiTokenInput = z.infer<typeof updateApiTokenSchema>
export type CreateTokenCategoryInput = z.infer<typeof createTokenCategorySchema>
export type UpdateTokenCategoryInput = z.infer<typeof updateTokenCategorySchema>
