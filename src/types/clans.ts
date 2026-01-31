/**
 * Clans Plugin Type Definitions
 *
 * Types for the Icefuse Clans system including:
 * - Clan management (create, join, leave, disband)
 * - Roles and permissions
 * - Alliances and enemies
 * - Stats and prestige
 * - Perks system
 */

// =============================================================================
// CLAN FLAGS & PERMISSIONS
// =============================================================================

/**
 * Clan flags bitfield (from plugin)
 */
export enum ClanFlags {
  None = 0,
  FriendlyFire = 1 << 0, // 1
  AllyFriendlyFire = 1 << 1, // 2
}

/**
 * Role permissions bitfield (from plugin)
 */
export enum ClanPermissions {
  None = 0,
  CanInvite = 1 << 0, // 1
  CanKick = 1 << 1, // 2
  CanPromote = 1 << 2, // 4
  CanManageAlliances = 1 << 3, // 8
  CanManageApplications = 1 << 4, // 16
  CanEditSettings = 1 << 5, // 32
}

/**
 * Prestige rank names (from plugin)
 */
export type PrestigeRank =
  | 'Unranked'
  | 'Bronze'
  | 'Silver'
  | 'Gold'
  | 'Diamond'
  | 'Obsidian'
  | 'Immortal'

/**
 * Prestige thresholds (prestige points required for each rank)
 */
export const PRESTIGE_THRESHOLDS: Record<PrestigeRank, number> = {
  Unranked: 0,
  Bronze: 10,
  Silver: 30,
  Gold: 75,
  Diamond: 150,
  Obsidian: 300,
  Immortal: 600,
}

/**
 * VIP tier names
 */
export type VipTier = 'Default' | 'Loyal' | 'Legend' | 'Champion' | 'Immortal'

/**
 * VIP tier limits (from plugin)
 */
export const VIP_LIMITS = {
  members: [8, 10, 12, 15, 20] as const, // Default, Loyal, Legend, Champion, Immortal
  roles: [5, 6, 8, 10, 12] as const,
  alliances: [2, 3, 4, 5, 6] as const,
} as const

/**
 * XP/Level formula constants (from plugin)
 */
export const XP_CONSTANTS = {
  BASE_XP: 100,
  FACTOR: 1.8,
  MAX_LEVEL: 50,
} as const

/**
 * Calculate XP needed to reach a level
 */
export function getXPForLevel(level: number): number {
  return Math.floor(XP_CONSTANTS.BASE_XP * Math.pow(level, XP_CONSTANTS.FACTOR))
}

/**
 * Calculate level from total XP
 */
export function getLevelFromXP(totalXP: number): number {
  for (let level = XP_CONSTANTS.MAX_LEVEL; level >= 1; level--) {
    if (totalXP >= getXPForLevel(level)) {
      return level
    }
  }
  return 1
}

/**
 * Get prestige rank from prestige points
 */
export function getPrestigeRank(prestigePoints: number): PrestigeRank {
  if (prestigePoints >= PRESTIGE_THRESHOLDS.Immortal) return 'Immortal'
  if (prestigePoints >= PRESTIGE_THRESHOLDS.Obsidian) return 'Obsidian'
  if (prestigePoints >= PRESTIGE_THRESHOLDS.Diamond) return 'Diamond'
  if (prestigePoints >= PRESTIGE_THRESHOLDS.Gold) return 'Gold'
  if (prestigePoints >= PRESTIGE_THRESHOLDS.Silver) return 'Silver'
  if (prestigePoints >= PRESTIGE_THRESHOLDS.Bronze) return 'Bronze'
  return 'Unranked'
}

// =============================================================================
// CORE CLAN TYPES
// =============================================================================

/**
 * Clan entity
 */
export interface Clan {
  id: string
  tag: string
  description: string | null
  tagColor: string
  ownerId: string
  flags: number
  version: number
  createdAt: Date
  updatedAt: Date
}

/**
 * Clan with relations
 */
export interface ClanWithRelations extends Clan {
  members: ClanMember[]
  roles: ClanRole[]
  stats: ClanWipeStats | null
  prestige: ClanPrestige | null
  _count?: {
    members: number
    invites: number
    applications: number
    alliancesFrom: number
    alliancesTo: number
  }
}

/**
 * Clan member
 */
export interface ClanMember {
  id: string
  clanId: string
  steamId: string
  roleRank: number
  joinedAt: Date
  lastOnline: Date | null
}

/**
 * Clan member with role info
 */
export interface ClanMemberWithRole extends ClanMember {
  role?: ClanRole
  displayName?: string // From Steam/Auth
  avatarUrl?: string // From Steam/Auth
}

/**
 * Clan role
 */
export interface ClanRole {
  id: string
  clanId: string
  rank: number
  name: string
  color: string
  permissions: number
}

/**
 * Clan invite
 */
export interface ClanInvite {
  id: string
  clanId: string
  targetSteamId: string
  invitedBy: string
  expiresAt: Date
  createdAt: Date
}

/**
 * Clan application
 */
export interface ClanApplication {
  id: string
  clanId: string
  applicantSteamId: string
  message: string | null
  appliedAt: Date
}

/**
 * Alliance status
 */
export type AllianceStatus = 'pending' | 'accepted'

/**
 * Clan alliance
 */
export interface ClanAlliance {
  id: string
  fromClanId: string
  toClanId: string
  status: AllianceStatus
  createdAt: Date
  acceptedAt: Date | null
}

/**
 * Alliance with clan info
 */
export interface ClanAllianceWithClan extends ClanAlliance {
  fromClan: Pick<Clan, 'id' | 'tag' | 'tagColor'>
  toClan: Pick<Clan, 'id' | 'tag' | 'tagColor'>
}

/**
 * Clan enemy
 */
export interface ClanEnemy {
  id: string
  fromClanId: string
  toClanId: string
  reason: string | null
  declaredAt: Date
}

/**
 * Enemy with clan info
 */
export interface ClanEnemyWithClan extends ClanEnemy {
  fromClan: Pick<Clan, 'id' | 'tag' | 'tagColor'>
  toClan: Pick<Clan, 'id' | 'tag' | 'tagColor'>
}

// =============================================================================
// STATS & PRESTIGE
// =============================================================================

/**
 * Clan wipe stats (reset each wipe)
 */
export interface ClanWipeStats {
  id: string
  clanId: string
  totalXP: number
  pvpKills: number
  pvpDeaths: number
  headshotKills: number
  raidsCompleted: number
  npcKills: number
  heliKills: number
  bradleyKills: number
  resourcesGathered: bigint
  createdAt: Date
  updatedAt: Date
}

/**
 * Clan prestige (persists across wipes)
 */
export interface ClanPrestige {
  id: string
  clanId: string
  prestigePoints: number
  globalScore: number
  wipesSurvived: number
  bestWipeLevel: number
  bestWipeRank: number
  wipeWins: number
  createdAt: Date
  updatedAt: Date
}

/**
 * Computed clan level info
 */
export interface ClanLevelInfo {
  level: number
  currentXP: number
  xpForNextLevel: number
  xpProgress: number // 0-1 progress to next level
}

// =============================================================================
// PERKS SYSTEM
// =============================================================================

/**
 * Perk effect types
 */
export type PerkEffectType = 'bonus_percent' | 'flat_bonus' | 'unlock'

/**
 * Perk categories
 */
export type PerkCategory =
  | 'capacity'
  | 'resources'
  | 'crafting'
  | 'combat'
  | 'economy'
  | 'social'

/**
 * Perk definition (admin-created)
 */
export interface ClanPerkDefinition {
  id: string
  key: string
  name: string
  description: string | null
  category: string
  levelRequired: number
  prestigeRequired: number
  effectType: string
  effectValue: number
  sortOrder: number
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

/**
 * Clan's unlocked perk
 */
export interface ClanPerk {
  id: string
  clanId: string
  perkId: string
  unlockedAt: Date
}

/**
 * Clan perk with definition
 */
export interface ClanPerkWithDefinition extends ClanPerk {
  perk: ClanPerkDefinition
}

// =============================================================================
// BANNED NAMES
// =============================================================================

/**
 * Banned clan name pattern
 */
export interface BannedClanName {
  id: string
  pattern: string
  isRegex: boolean
  reason: string | null
  createdBy: string
  createdAt: Date
}

// =============================================================================
// CLAN EVENTS (for sync idempotency)
// =============================================================================

/**
 * Clan event types
 */
export type ClanEventType =
  | 'clan_create'
  | 'clan_disband'
  | 'clan_update'
  | 'member_join'
  | 'member_leave'
  | 'member_kick'
  | 'role_create'
  | 'role_update'
  | 'role_delete'
  | 'alliance_request'
  | 'alliance_accept'
  | 'alliance_break'
  | 'enemy_declare'
  | 'enemy_remove'
  | 'stats_update'
  | 'perk_unlock'

/**
 * Clan event (for plugin sync)
 */
export interface ClanEvent {
  id: string
  eventId: string
  eventType: string
  clanId: string | null
  actorSteamId: string
  targetSteamId: string | null
  serverIdentifier: string
  metadata: unknown
  processedAt: Date
}

// =============================================================================
// API REQUEST/RESPONSE TYPES
// =============================================================================

/**
 * Create clan request
 */
export interface CreateClanRequest {
  tag: string
  description?: string
  tagColor?: string
}

/**
 * Update clan request
 */
export interface UpdateClanRequest {
  description?: string
  tagColor?: string
  flags?: number
}

/**
 * Create role request
 */
export interface CreateRoleRequest {
  rank: number
  name: string
  color?: string
  permissions?: number
}

/**
 * Update role request
 */
export interface UpdateRoleRequest {
  name?: string
  color?: string
  permissions?: number
}

/**
 * Invite request
 */
export interface InviteRequest {
  targetSteamId: string
}

/**
 * Application request
 */
export interface ApplicationRequest {
  message?: string
}

/**
 * Alliance request
 */
export interface AllianceRequest {
  targetClanTag: string
}

/**
 * Enemy declaration request
 */
export interface EnemyRequest {
  targetClanTag: string
  reason?: string
}

/**
 * Create perk definition request (admin)
 */
export interface CreatePerkDefinitionRequest {
  key: string
  name: string
  description?: string
  category: string
  levelRequired?: number
  prestigeRequired?: number
  effectType: string
  effectValue: number
  sortOrder?: number
  isActive?: boolean
}

/**
 * Update perk definition request (admin)
 */
export interface UpdatePerkDefinitionRequest {
  name?: string
  description?: string
  category?: string
  levelRequired?: number
  prestigeRequired?: number
  effectType?: string
  effectValue?: number
  sortOrder?: number
  isActive?: boolean
}

/**
 * Create banned name request (admin)
 */
export interface CreateBannedNameRequest {
  pattern: string
  isRegex?: boolean
  reason?: string
}

/**
 * Update banned name request (admin)
 */
export interface UpdateBannedNameRequest {
  pattern?: string
  isRegex?: boolean
  reason?: string
}

/**
 * Clan list filters
 */
export interface ClanListFilters {
  search?: string
  sortBy?: 'tag' | 'createdAt' | 'memberCount' | 'level' | 'prestigeRank'
  sortOrder?: 'asc' | 'desc'
  minMembers?: number
  maxMembers?: number
  minLevel?: number
  page?: number
  limit?: number
}

/**
 * Leaderboard entry
 */
export interface ClanLeaderboardEntry {
  rank: number
  clan: Pick<Clan, 'id' | 'tag' | 'tagColor'>
  memberCount: number
  level: number
  prestigeRank: PrestigeRank
  stats: Pick<ClanWipeStats, 'totalXP' | 'pvpKills' | 'raidsCompleted'> | null
}

/**
 * Leaderboard sort options
 */
export type LeaderboardSortBy =
  | 'level'
  | 'prestigePoints'
  | 'pvpKills'
  | 'raidsCompleted'
  | 'memberCount'
  | 'resourcesGathered'

// =============================================================================
// PLUGIN SYNC TYPES
// =============================================================================

/**
 * Plugin sync payload (all clan data for a server)
 */
export interface ClanSyncPayload {
  clans: ClanWithRelations[]
  timestamp: Date
  version: number
}

/**
 * Plugin event payload
 */
export interface PluginEventPayload {
  eventId: string
  eventType: ClanEventType
  clanId?: string
  actorSteamId: string
  targetSteamId?: string
  serverIdentifier: string
  metadata?: unknown
  timestamp: Date
}

/**
 * Plugin stats update payload
 */
export interface PluginStatsUpdatePayload {
  clanId: string
  serverIdentifier: string
  stats: Partial<{
    pvpKills: number
    pvpDeaths: number
    headshotKills: number
    raidsCompleted: number
    npcKills: number
    heliKills: number
    bradleyKills: number
    resourcesGathered: number
  }>
  xpGained: number
  timestamp: Date
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Check if a role has a specific permission
 */
export function hasPermission(
  rolePermissions: number,
  permission: ClanPermissions
): boolean {
  return (rolePermissions & permission) === permission
}

/**
 * Check if a clan has a specific flag
 */
export function hasFlag(clanFlags: number, flag: ClanFlags): boolean {
  return (clanFlags & flag) === flag
}

/**
 * Get VIP tier limits for a tier index
 */
export function getVipLimits(tierIndex: number): {
  members: number
  roles: number
  alliances: number
} {
  const clampedIndex = Math.max(0, Math.min(4, tierIndex))
  return {
    members: VIP_LIMITS.members[clampedIndex],
    roles: VIP_LIMITS.roles[clampedIndex],
    alliances: VIP_LIMITS.alliances[clampedIndex],
  }
}

/**
 * Calculate clan level info from stats
 */
export function calculateLevelInfo(stats: ClanWipeStats | null): ClanLevelInfo {
  const totalXP = stats?.totalXP ?? 0
  const level = getLevelFromXP(totalXP)
  const xpForCurrentLevel = getXPForLevel(level)
  const xpForNextLevel = getXPForLevel(level + 1)
  const xpIntoLevel = totalXP - xpForCurrentLevel
  const xpNeeded = xpForNextLevel - xpForCurrentLevel
  const xpProgress = xpNeeded > 0 ? xpIntoLevel / xpNeeded : 1

  return {
    level,
    currentXP: totalXP,
    xpForNextLevel,
    xpProgress: Math.min(1, Math.max(0, xpProgress)),
  }
}
