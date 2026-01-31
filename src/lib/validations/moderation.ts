/**
 * Global Content Moderation Validation Schemas
 *
 * Zod schemas for validating moderation-related API inputs.
 * SECURITY: All inputs validated before processing.
 */

import { z } from 'zod'

// =============================================================================
// CONSTANTS
// =============================================================================

export const MODERATION_CONTEXTS = ['all', 'clan_tags', 'chat', 'player_names'] as const
export const MODERATION_CATEGORIES = [
  'racial',
  'lgbtq',
  'sexual',
  'profanity',
  'hate_symbol',
  'violence',
  'religious',
  'disability',
  'other',
] as const

// =============================================================================
// BANNED WORD SCHEMAS
// =============================================================================

/** Create banned word request */
export const createBannedWordSchema = z.object({
  pattern: z.string().min(1).max(200),
  isRegex: z.boolean().optional().default(false),
  context: z.enum(MODERATION_CONTEXTS).optional().default('all'),
  severity: z.number().int().min(1).max(4).optional().default(3),
  category: z.enum(MODERATION_CATEGORIES),
  reason: z.string().max(200).optional(),
})

/** Update banned word request */
export const updateBannedWordSchema = z.object({
  pattern: z.string().min(1).max(200).optional(),
  isRegex: z.boolean().optional(),
  context: z.enum(MODERATION_CONTEXTS).optional(),
  severity: z.number().int().min(1).max(4).optional(),
  category: z.enum(MODERATION_CATEGORIES).optional(),
  reason: z.string().max(200).optional(),
})

/** Check content request */
export const checkContentSchema = z.object({
  text: z.string().min(1).max(500),
  context: z.enum(MODERATION_CONTEXTS).optional().default('all'),
})

/** Bulk seed request */
export const bulkSeedSchema = z.object({
  context: z.enum(MODERATION_CONTEXTS).optional(),
  categories: z.array(z.enum(MODERATION_CATEGORIES)).optional(),
})

// =============================================================================
// QUERY SCHEMAS
// =============================================================================

/** Banned words list query params */
export const bannedWordsQuerySchema = z.object({
  search: z.string().max(100).optional(),
  context: z.enum(MODERATION_CONTEXTS).optional(),
  category: z.enum(MODERATION_CATEGORIES).optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
})

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type ModerationContext = (typeof MODERATION_CONTEXTS)[number]
export type ModerationCategory = (typeof MODERATION_CATEGORIES)[number]
export type CreateBannedWordInput = z.infer<typeof createBannedWordSchema>
export type UpdateBannedWordInput = z.infer<typeof updateBannedWordSchema>
export type CheckContentInput = z.infer<typeof checkContentSchema>
export type BannedWordsQueryInput = z.infer<typeof bannedWordsQuerySchema>
