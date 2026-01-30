/**
 * Analytics Validation Schemas
 *
 * Zod schemas for kit usage analytics API endpoints.
 */

import { z } from 'zod'

// =============================================================================
// Enums
// =============================================================================

export const redemptionSourceSchema = z.enum(['chat_command', 'auto_kit', 'api_call'])
export type RedemptionSource = z.infer<typeof redemptionSourceSchema>

// =============================================================================
// Write Schemas
// =============================================================================

/**
 * Single kit usage event
 */
export const kitUsageEventSchema = z.object({
  eventId: z
    .string()
    .min(10)
    .max(64)
    .regex(/^[a-zA-Z0-9_-]+$/, 'Event ID must be alphanumeric with underscores/hyphens'),
  kitId: z.string().max(60).optional(),
  kitName: z.string().min(1).max(100).trim(),
  kitConfigId: z.string().max(60).optional(),
  serverIdentifier: z.string().min(1).max(100),
  wipeId: z.string().max(60).optional(),
  steamId: z.string().regex(/^[0-9]{17}$/, 'Invalid Steam ID format'),
  playerName: z.string().max(100).optional(),
  authLevel: z.number().int().min(0).max(3).default(0),
  redemptionSource: redemptionSourceSchema,
  wasSuccessful: z.boolean().default(true),
  failureReason: z.string().max(100).optional(),
  cooldownSeconds: z.number().int().min(0).optional(),
  itemCount: z.number().int().min(0).optional(),
  redeemedAt: z.string().datetime().transform((v) => new Date(v)),
})

export type KitUsageEventInput = z.input<typeof kitUsageEventSchema>
export type KitUsageEvent = z.output<typeof kitUsageEventSchema>

/**
 * Batch kit usage events (max 100)
 */
export const kitUsageBatchSchema = z.object({
  events: z.array(kitUsageEventSchema).min(1).max(100),
})

export type KitUsageBatchInput = z.input<typeof kitUsageBatchSchema>

/**
 * Server wipe registration
 */
export const serverWipeSchema = z.object({
  gameServerId: z.number().int().min(1),
  wipeNumber: z.number().int().min(1),
  wipedAt: z.string().datetime().transform((v) => new Date(v)),
  mapSeed: z.string().max(20).optional(),
  mapSize: z.number().int().min(1000).max(8000).optional(),
})

export type ServerWipeInput = z.input<typeof serverWipeSchema>
export type ServerWipe = z.output<typeof serverWipeSchema>

// =============================================================================
// Read Schemas (Query Parameters)
// =============================================================================

/**
 * Time-bounded kit popularity query
 */
export const kitPopularityQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
  kitConfigId: z.string().max(60).optional(),
  serverId: z.coerce.number().int().min(1).optional(),
  wipeId: z.string().max(60).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

export type KitPopularityQuery = z.infer<typeof kitPopularityQuerySchema>

/**
 * Global (all-time) popularity query
 */
export const globalPopularityQuerySchema = z.object({
  kitConfigId: z.string().max(60).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

export type GlobalPopularityQuery = z.infer<typeof globalPopularityQuerySchema>

/**
 * Per-wipe analytics query
 */
export const wipeAnalyticsQuerySchema = z.object({
  wipeId: z.string().max(60).optional(),
  serverId: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

export type WipeAnalyticsQuery = z.infer<typeof wipeAnalyticsQuerySchema>

/**
 * Heat map query (time-of-day patterns)
 */
export const heatMapQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(90).default(30),
  kitConfigId: z.string().max(60).optional(),
  serverId: z.coerce.number().int().min(1).optional(),
})

export type HeatMapQuery = z.infer<typeof heatMapQuerySchema>

/**
 * Usage trends query
 */
export const usageTrendsQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
  granularity: z.enum(['daily', 'weekly', 'monthly']).default('daily'),
  kitName: z.string().max(100).optional(),
  kitConfigId: z.string().max(60).optional(),
  serverId: z.coerce.number().int().min(1).optional(),
  wipeId: z.string().max(60).optional(),
})

export type UsageTrendsQuery = z.infer<typeof usageTrendsQuerySchema>

/**
 * Server stats query
 */
export const serverStatsQuerySchema = z.object({
  serverId: z.coerce.number().int().min(1),
  days: z.coerce.number().int().min(1).max(365).default(30),
})

export type ServerStatsQuery = z.infer<typeof serverStatsQuerySchema>

/**
 * Wipes list query
 */
export const wipesQuerySchema = z.object({
  serverId: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

export type WipesQuery = z.infer<typeof wipesQuerySchema>

/**
 * Cross-server popularity query
 */
export const crossServerQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

export type CrossServerQuery = z.infer<typeof crossServerQuerySchema>

/**
 * Server activity query
 */
export const serverActivityQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
})

export type ServerActivityQuery = z.infer<typeof serverActivityQuerySchema>

/**
 * Player migration query
 */
export const playerMigrationQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

export type PlayerMigrationQuery = z.infer<typeof playerMigrationQuerySchema>

/**
 * Wipe progression query
 */
export const wipeProgressionQuerySchema = z.object({
  wipeId: z.string().max(60).optional(),
  serverId: z.coerce.number().int().min(1).optional(),
})

export type WipeProgressionQuery = z.infer<typeof wipeProgressionQuerySchema>

/**
 * Wipe peak hours query
 */
export const wipePeakHoursQuerySchema = z.object({
  wipeId: z.string().max(60).optional(),
  serverId: z.coerce.number().int().min(1).optional(),
})

export type WipePeakHoursQuery = z.infer<typeof wipePeakHoursQuerySchema>

/**
 * Wipe comparison query
 */
export const wipeComparisonQuerySchema = z.object({
  serverId: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(10).default(5),
})

export type WipeComparisonQuery = z.infer<typeof wipeComparisonQuerySchema>

/**
 * Cooldown stats query
 */
export const cooldownStatsQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
  kitConfigId: z.string().max(60).optional(),
  serverId: z.coerce.number().int().min(1).optional(),
})

export type CooldownStatsQuery = z.infer<typeof cooldownStatsQuerySchema>

/**
 * Kit overlap query
 */
export const kitOverlapQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
  kitConfigId: z.string().max(60).optional(),
  serverId: z.coerce.number().int().min(1).optional(),
})

export type KitOverlapQuery = z.infer<typeof kitOverlapQuerySchema>
