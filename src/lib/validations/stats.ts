/**
 * Stats Configuration & Validation
 *
 * MODULAR CONFIG-DRIVEN STATS SYSTEM
 * To add a new stat: add one entry to STAT_COLUMNS below.
 * Everything else (validation, event mapping, queries, display) derives from it.
 */

import { z } from 'zod'

// =============================================================================
// Stat Column Configuration — THE SINGLE SOURCE OF TRUTH
// =============================================================================

export interface StatColumnConfig {
  /** ClickHouse column name (e.g. 'kills') */
  column: string
  /** Plugin event name that maps to this column (e.g. 'kill'). null = computed */
  event: string | null
  /** ClickHouse column type */
  dbType: 'UInt64' | 'Float64' | 'String'
  /** Default value for ClickHouse DDL */
  dbDefault: string
  /** Display label for UI */
  label: string
  /** Whether this column is sortable in leaderboards */
  sortable: boolean
  /** Whether to SUM in clan aggregation (false = skip) */
  aggregatable: boolean
  /** Points multiplier for composite score (0 = not included) */
  pointsMultiplier: number
  /** Display format: 'number' | 'decimal' | 'time' | 'json' */
  format: 'number' | 'decimal' | 'time' | 'json'
}

/**
 * Add new stats here. Each entry drives:
 * - ClickHouse schema columns
 * - Zod event validation (event field enum)
 * - Event-to-column mapping
 * - Aggregation logic in ingestion
 * - Sort whitelist for queries
 * - Clan SUM query generation
 * - UI column definitions
 * - Points formula
 */
export const STAT_COLUMNS: StatColumnConfig[] = [
  { column: 'kills',            event: 'kill',                   dbType: 'UInt64',  dbDefault: '0',  label: 'Kills',           sortable: true,  aggregatable: true,  pointsMultiplier: 1, format: 'number' },
  { column: 'deaths',           event: 'death',                  dbType: 'UInt64',  dbDefault: '0',  label: 'Deaths',          sortable: true,  aggregatable: true,  pointsMultiplier: 0, format: 'number' },
  { column: 'kdr',              event: null,                     dbType: 'Float64', dbDefault: '0',  label: 'KDR',             sortable: true,  aggregatable: false, pointsMultiplier: 0, format: 'decimal' },
  { column: 'playtime',         event: 'playtime',               dbType: 'UInt64',  dbDefault: '0',  label: 'Playtime',        sortable: true,  aggregatable: true,  pointsMultiplier: 0, format: 'time' },
  { column: 'tcs_destroyed',    event: 'toolcupboarddestroyed',  dbType: 'UInt64',  dbDefault: '0',  label: 'TCs Destroyed',   sortable: true,  aggregatable: true,  pointsMultiplier: 5, format: 'number' },
  { column: 'c4_thrown',        event: 'c4thrown',               dbType: 'UInt64',  dbDefault: '0',  label: 'C4 Thrown',       sortable: true,  aggregatable: true,  pointsMultiplier: 3, format: 'number' },
  { column: 'rockets_launched', event: 'rocketlaunched',         dbType: 'UInt64',  dbDefault: '0',  label: 'Rockets Launched', sortable: true, aggregatable: true,  pointsMultiplier: 3, format: 'number' },
  { column: 'c4_crafted',       event: 'c4crafted',              dbType: 'UInt64',  dbDefault: '0',  label: 'C4 Crafted',      sortable: true,  aggregatable: true,  pointsMultiplier: 0, format: 'number' },
  { column: 'rockets_crafted',  event: 'rocketcrafted',          dbType: 'UInt64',  dbDefault: '0',  label: 'Rockets Crafted', sortable: true,  aggregatable: true,  pointsMultiplier: 0, format: 'number' },
  { column: 'container_points', event: 'containerpoints',        dbType: 'UInt64',  dbDefault: '0',  label: 'Container Pts',   sortable: true,  aggregatable: true,  pointsMultiplier: 1, format: 'number' },
  { column: 'points',           event: null,                     dbType: 'UInt64',  dbDefault: '0',  label: 'Points',          sortable: true,  aggregatable: true,  pointsMultiplier: 0, format: 'number' },
  { column: 'weapon_kills',     event: null,                     dbType: 'String',  dbDefault: '{}', label: 'Weapon Kills',    sortable: false, aggregatable: false, pointsMultiplier: 0, format: 'json' },
]

// =============================================================================
// Derived constants (auto-generated from STAT_COLUMNS)
// =============================================================================

/** Columns that map to a plugin event (for ingestion) */
export const EVENT_COLUMNS = STAT_COLUMNS.filter(c => c.event !== null) as (StatColumnConfig & { event: string })[]

/** Map from plugin event name to ClickHouse column */
export const EVENT_TO_COLUMN: Record<string, string> = Object.fromEntries(
  EVENT_COLUMNS.map(c => [c.event, c.column])
)

/** Valid plugin event names */
export const VALID_EVENTS = EVENT_COLUMNS.map(c => c.event) as [string, ...string[]]

/** Sortable column names for player queries */
export const VALID_SORT_FIELDS = STAT_COLUMNS
  .filter(c => c.sortable)
  .map(c => c.column) as [string, ...string[]]

/** Sortable column names for clan queries (includes member_count) */
export const VALID_CLAN_SORT_FIELDS = [...VALID_SORT_FIELDS, 'member_count'] as [string, ...string[]]

/** Columns that can be summed in aggregation (UInt64 numeric stats) */
export const AGGREGATABLE_COLUMNS = STAT_COLUMNS.filter(c => c.aggregatable)

/** Columns with points multipliers > 0 (for score computation) */
export const POINTS_COLUMNS = STAT_COLUMNS.filter(c => c.pointsMultiplier > 0)

/** Valid sort columns for ClickHouse queries (whitelist for SQL safety) */
export const ALLOWED_SORT_COLUMNS = new Set(VALID_SORT_FIELDS)
export const ALLOWED_CLAN_SORT_COLUMNS = new Set(VALID_CLAN_SORT_FIELDS)

/** Generate the clan SELECT SUM expressions from config */
export function buildClanSelectColumns(): string {
  const sums = STAT_COLUMNS
    .filter(c => c.aggregatable && c.column !== 'points')
    .map(c => `SUM(${c.column}) as ${c.column}`)
  return [
    'clan',
    ...sums,
    `IF(SUM(deaths) = 0, toFloat64(SUM(kills)), ROUND(toFloat64(SUM(kills)) / SUM(deaths), 2)) as kdr`,
    `SUM(points) as points`,
    `count() as member_count`,
  ].join(',\n        ')
}

/**
 * Compute points from a set of stat values using config multipliers.
 * This is the single formula - change POINTS_COLUMNS to adjust.
 */
export function computePoints(stats: Record<string, number>): number {
  let total = 0
  for (const col of POINTS_COLUMNS) {
    total += (stats[col.column] || 0) * col.pointsMultiplier
  }
  return total
}

/**
 * Create an empty delta object for accumulating events.
 * Keys derived from EVENT_COLUMNS config.
 */
export function createEmptyDelta(): Record<string, number> {
  const delta: Record<string, number> = {}
  for (const col of EVENT_COLUMNS) {
    delta[col.column] = 0
  }
  return delta
}

/**
 * Normalize a ClickHouse row, casting all stat columns to proper JS numbers.
 */
export function normalizeStatRow(row: Record<string, unknown>): Record<string, unknown> {
  const result = { ...row }
  for (const col of STAT_COLUMNS) {
    if (col.format === 'json') continue
    if (col.format === 'decimal') {
      result[col.column] = Number(row[col.column]) || 0
    } else {
      result[col.column] = Number(row[col.column]) || 0
    }
  }
  if (typeof result.playtime === 'number') {
    result.playtimeFormatted = convertPlaytime(result.playtime as number)
  }
  return result
}

/** Format seconds into HH:MM:SS */
export function convertPlaytime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00:00'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

// =============================================================================
// Table & Cache Configuration
// =============================================================================

const STEAM_ID_REGEX = /^\d{17}$/

/** Table name for each timeframe */
export const TIMEFRAME_TABLE: Record<string, string> = {
  wipe: 'rust_player_stats_wipe',
  monthly: 'rust_player_stats_monthly',
  overall: 'rust_player_stats_overall',
}

/** Cache TTL per timeframe (ms) */
export const CACHE_TTL: Record<string, number> = {
  wipe: 30_000,
  monthly: 60_000,
  overall: 300_000,
}

// =============================================================================
// Zod Schemas
// =============================================================================

export const statEventSchema = z.object({
  steamid: z.string().regex(STEAM_ID_REGEX, 'Invalid SteamID64'),
  _event: z.enum(VALID_EVENTS),
  amount: z.coerce.number().int().min(0).max(9999999),
  clan: z.string().max(30).default(''),
  name: z.string().max(100).default('Unknown'),
  weapon: z.string().max(60).optional(),
})

export type StatEvent = z.infer<typeof statEventSchema>

export const statsBatchSchema = z.object({
  events: z.array(z.record(z.unknown())).min(1).max(500),
})

export type StatsBatchInput = z.infer<typeof statsBatchSchema>

export const statsServerParamSchema = z.object({
  server: z.string().min(1).max(60).regex(/^[A-Za-z0-9\-_]+$/, 'Invalid server ID'),
})

export const statsQuerySchema = z.object({
  server_id: z.string().min(1).max(60),
  timeframe: z.enum(['wipe', 'monthly', 'overall']).default('wipe'),
  view: z.enum(['players', 'clans']).default('players'),
  sort: z.enum(VALID_SORT_FIELDS).default('kills'),
  order: z.enum(['asc', 'desc']).default('desc'),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  search: z.string().max(100).optional(),
})

export type StatsQuery = z.infer<typeof statsQuerySchema>

export const publicStatsQuerySchema = z.object({
  server_id: z.string().min(1).max(60),
  timeframe: z.enum(['wipe', 'monthly', 'overall']).default('wipe'),
  view: z.enum(['players', 'clans']).default('players'),
  sort: z.enum(VALID_SORT_FIELDS).default('kills'),
  order: z.enum(['asc', 'desc']).default('desc'),
  limit: z.coerce.number().int().min(1).max(50).default(50),
  offset: z.coerce.number().int().min(0).max(500).default(0),
  search: z.string().max(100).optional(),
})

export type PublicStatsQuery = z.infer<typeof publicStatsQuerySchema>

export const statsWipeSchema = z.object({
  server_id: z.string().min(1).max(60),
  scope: z.enum(['wipe', 'monthly']).default('wipe'),
})

export type StatsWipeParams = z.infer<typeof statsWipeSchema>

export const playerStatsQuerySchema = z.object({
  server_id: z.string().max(60).optional(),
  timeframe: z.enum(['wipe', 'monthly', 'overall']).default('wipe'),
})

export type PlayerStatsQuery = z.infer<typeof playerStatsQuerySchema>

export const steamIdParamSchema = z.string().regex(STEAM_ID_REGEX, 'Invalid SteamID64')
