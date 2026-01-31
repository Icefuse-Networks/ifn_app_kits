/**
 * Clans Plugin Validation Schemas
 *
 * Zod schemas for validating clan-related API inputs.
 * SECURITY: All inputs validated before processing.
 */

import { z } from 'zod'

// =============================================================================
// SHARED PATTERNS
// =============================================================================

/** Steam ID: 17-digit string */
const steamIdSchema = z.string().regex(/^\d{17}$/, 'Invalid Steam ID format')

/** Clan tag: 2-10 characters, alphanumeric and some special chars */
const clanTagSchema = z
  .string()
  .min(2, 'Tag must be at least 2 characters')
  .max(10, 'Tag must be at most 10 characters')
  .regex(/^[a-zA-Z0-9_\-]+$/, 'Tag can only contain letters, numbers, underscores, and hyphens')

/** Hex color: 6 characters */
const hexColorSchema = z.string().regex(/^[0-9A-Fa-f]{6}$/, 'Invalid hex color format')

// =============================================================================
// CLAN SCHEMAS
// =============================================================================

/** Create clan request */
export const createClanSchema = z.object({
  tag: clanTagSchema,
  description: z.string().max(200, 'Description must be at most 200 characters').optional(),
  tagColor: hexColorSchema.optional().default('5AF3F3'),
  ownerId: steamIdSchema,
})

/** Update clan request */
export const updateClanSchema = z.object({
  description: z.string().max(200).optional(),
  tagColor: hexColorSchema.optional(),
  flags: z.number().int().min(0).max(255).optional(),
})

/** Admin update clan (can change more fields) */
export const adminUpdateClanSchema = z.object({
  tag: clanTagSchema.optional(),
  description: z.string().max(200).optional(),
  tagColor: hexColorSchema.optional(),
  flags: z.number().int().min(0).max(255).optional(),
  ownerId: steamIdSchema.optional(),
})

/** Transfer ownership request */
export const transferOwnershipSchema = z.object({
  newOwnerId: steamIdSchema,
})

// =============================================================================
// MEMBER SCHEMAS
// =============================================================================

/** Add member request */
export const addMemberSchema = z.object({
  steamId: steamIdSchema,
  roleRank: z.number().int().min(1).max(100).optional().default(2),
})

/** Update member role request */
export const updateMemberRoleSchema = z.object({
  roleRank: z.number().int().min(1).max(100),
})

// =============================================================================
// ROLE SCHEMAS
// =============================================================================

/** Create role request */
export const createRoleSchema = z.object({
  rank: z.number().int().min(1).max(100),
  name: z.string().min(1).max(20, 'Role name must be at most 20 characters'),
  color: hexColorSchema.optional().default('888888'),
  permissions: z.number().int().min(0).max(63).optional().default(0),
})

/** Update role request */
export const updateRoleSchema = z.object({
  name: z.string().min(1).max(20).optional(),
  color: hexColorSchema.optional(),
  permissions: z.number().int().min(0).max(63).optional(),
})

// =============================================================================
// INVITE & APPLICATION SCHEMAS
// =============================================================================

/** Send invite request */
export const sendInviteSchema = z.object({
  targetSteamId: steamIdSchema,
  expiresInHours: z.number().int().min(1).max(168).optional().default(24), // 1 hour to 7 days
})

/** Apply to clan request */
export const applyToClanSchema = z.object({
  message: z.string().max(200, 'Message must be at most 200 characters').optional(),
})

// =============================================================================
// ALLIANCE & ENEMY SCHEMAS
// =============================================================================

/** Alliance request */
export const allianceRequestSchema = z.object({
  targetClanTag: clanTagSchema,
})

/** Declare enemy request */
export const declareEnemySchema = z.object({
  targetClanTag: clanTagSchema,
  reason: z.string().max(200, 'Reason must be at most 200 characters').optional(),
})

// =============================================================================
// PERK DEFINITION SCHEMAS
// =============================================================================

/** Create perk definition request */
export const createPerkDefinitionSchema = z.object({
  key: z
    .string()
    .min(1)
    .max(50)
    .regex(/^[a-z0-9_]+$/, 'Key must be lowercase alphanumeric with underscores'),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  category: z.string().min(1).max(50),
  levelRequired: z.number().int().min(1).max(50).optional().default(1),
  prestigeRequired: z.number().int().min(0).max(6).optional().default(0),
  effectType: z.enum(['bonus_percent', 'flat_bonus', 'unlock']),
  effectValue: z.number(),
  sortOrder: z.number().int().min(0).optional().default(0),
  isActive: z.boolean().optional().default(true),
})

/** Update perk definition request */
export const updatePerkDefinitionSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  category: z.string().min(1).max(50).optional(),
  levelRequired: z.number().int().min(1).max(50).optional(),
  prestigeRequired: z.number().int().min(0).max(6).optional(),
  effectType: z.enum(['bonus_percent', 'flat_bonus', 'unlock']).optional(),
  effectValue: z.number().optional(),
  sortOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
})

/** Grant perk to clan request */
export const grantPerkSchema = z.object({
  perkId: z.string().min(1),
})

// =============================================================================
// BANNED NAME SCHEMAS
// =============================================================================

/** Create banned name request */
export const createBannedNameSchema = z.object({
  pattern: z.string().min(1).max(50),
  isRegex: z.boolean().optional().default(false),
  reason: z.string().max(200).optional(),
})

/** Update banned name request */
export const updateBannedNameSchema = z.object({
  pattern: z.string().min(1).max(50).optional(),
  isRegex: z.boolean().optional(),
  reason: z.string().max(200).optional(),
})

// =============================================================================
// QUERY SCHEMAS
// =============================================================================

/** Clan list query params */
export const clanListQuerySchema = z.object({
  search: z.string().max(100).optional(),
  sortBy: z.enum(['tag', 'createdAt', 'memberCount', 'level']).optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
})

/** Leaderboard query params */
export const leaderboardQuerySchema = z.object({
  sortBy: z
    .enum(['level', 'prestigePoints', 'pvpKills', 'raidsCompleted', 'memberCount'])
    .optional()
    .default('level'),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
})

// =============================================================================
// PLUGIN SYNC SCHEMAS
// =============================================================================

/** Plugin event payload */
export const pluginEventSchema = z.object({
  eventId: z.string().min(1).max(64),
  eventType: z.string().min(1).max(50),
  clanId: z.string().optional(),
  actorSteamId: steamIdSchema,
  targetSteamId: steamIdSchema.optional(),
  serverIdentifier: z.string().min(1).max(100),
  metadata: z.unknown().optional(),
  timestamp: z.coerce.date(),
})

/** Plugin stats update payload */
export const pluginStatsUpdateSchema = z.object({
  clanId: z.string().min(1),
  serverIdentifier: z.string().min(1).max(100),
  stats: z.object({
    pvpKills: z.number().int().min(0).optional(),
    pvpDeaths: z.number().int().min(0).optional(),
    headshotKills: z.number().int().min(0).optional(),
    raidsCompleted: z.number().int().min(0).optional(),
    npcKills: z.number().int().min(0).optional(),
    heliKills: z.number().int().min(0).optional(),
    bradleyKills: z.number().int().min(0).optional(),
    resourcesGathered: z.number().int().min(0).optional(),
  }),
  xpGained: z.number().int().min(0),
  timestamp: z.coerce.date(),
})

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type CreateClanInput = z.infer<typeof createClanSchema>
export type UpdateClanInput = z.infer<typeof updateClanSchema>
export type AdminUpdateClanInput = z.infer<typeof adminUpdateClanSchema>
export type AddMemberInput = z.infer<typeof addMemberSchema>
export type CreateRoleInput = z.infer<typeof createRoleSchema>
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>
export type CreatePerkDefinitionInput = z.infer<typeof createPerkDefinitionSchema>
export type UpdatePerkDefinitionInput = z.infer<typeof updatePerkDefinitionSchema>
export type CreateBannedNameInput = z.infer<typeof createBannedNameSchema>
export type UpdateBannedNameInput = z.infer<typeof updateBannedNameSchema>
export type ClanListQueryInput = z.infer<typeof clanListQuerySchema>
export type PluginEventInput = z.infer<typeof pluginEventSchema>
export type PluginStatsUpdateInput = z.infer<typeof pluginStatsUpdateSchema>
