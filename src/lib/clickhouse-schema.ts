/**
 * ClickHouse Schema Management
 *
 * This file defines and automatically ensures ClickHouse tables exist with the correct schema.
 * Run this on application startup or manually to sync schema.
 */

import { clickhouse } from './clickhouse'

/**
 * Server Population Stats Table
 * Stores real-time server population data collected every 60 seconds
 */
const SERVER_POPULATION_STATS_SCHEMA = `
CREATE TABLE IF NOT EXISTS server_population_stats (
    -- Identifiers
    server_id String,
    server_name String,
    server_ip String,
    server_port UInt16,

    -- Category Information
    category_id UInt32,
    category String,

    -- Population Data
    players UInt16,
    max_players UInt16,

    -- Wipe Information (reserved for future use)
    last_wipe Nullable(DateTime),
    next_wipe Nullable(DateTime),
    days_since_wipe Nullable(UInt16),

    -- Timestamp
    timestamp DateTime DEFAULT now()
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (server_id, timestamp)
TTL timestamp + INTERVAL 90 DAY
SETTINGS index_granularity = 8192
`

/**
 * Event Completions Table
 * Stores KOTH/Maze event completion data with winners and participants
 */
const EVENT_COMPLETIONS_SCHEMA = `
CREATE TABLE IF NOT EXISTS event_completions (
    server_id String,
    event_type Enum8('koth' = 1, 'maze' = 2),
    winner_steam_id UInt64,
    winner_name String,
    winner_clan_tag Nullable(String),
    winner_kills UInt16,
    is_clan_mode UInt8,
    event_modes Array(String),
    location Nullable(String),
    duration_seconds UInt32,
    participants Array(Tuple(
        steam_id UInt64,
        name String,
        kills UInt16,
        deaths UInt16,
        position UInt16
    )),
    timestamp DateTime64(3) DEFAULT now64(3)
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (server_id, timestamp)
TTL timestamp + INTERVAL 365 DAY
SETTINGS index_granularity = 8192
`

/**
 * Base Raid Events Table
 * Stores raid statistics from IcefuseBases plugin
 */
const BASES_RAID_EVENTS_SCHEMA = `
CREATE TABLE IF NOT EXISTS bases_raid_events (
    server_id String,
    base_id UInt32,
    building_name String,
    base_type String,
    building_grade String,
    raid_duration_seconds UInt32,
    was_completed UInt8,
    total_entities_destroyed UInt16,
    total_containers_destroyed UInt16,
    total_npcs_killed UInt16,
    raider_steam_ids Array(String),
    raider_names Array(String),
    raider_entities_destroyed Array(UInt16),
    raider_containers_destroyed Array(UInt16),
    raider_npcs_killed Array(UInt16),
    timestamp DateTime DEFAULT now()
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (server_id, timestamp)
TTL timestamp + INTERVAL 365 DAY
SETTINGS index_granularity = 8192
`

/**
 * Kit Usage Events Table (Future)
 * Uncomment when ready to migrate kit analytics to ClickHouse
 */
const KIT_USAGE_EVENTS_SCHEMA = `
-- CREATE TABLE IF NOT EXISTS kit_usage_events (
--     event_id String,
--     kit_id Nullable(String),
--     kit_name String,
--     kit_config_id Nullable(String),
--     server_identifier String,
--     wipe_id Nullable(String),
--     steam_id String,
--     player_name Nullable(String),
--     auth_level UInt8,
--     redemption_source Enum8('chat_command' = 1, 'auto_kit' = 2, 'api_call' = 3),
--     was_successful UInt8,
--     failure_reason Nullable(String),
--     cooldown_seconds Nullable(UInt32),
--     item_count Nullable(UInt16),
--     redeemed_at DateTime
-- )
-- ENGINE = MergeTree()
-- PARTITION BY toYYYYMM(redeemed_at)
-- ORDER BY (server_identifier, redeemed_at, steam_id)
-- TTL redeemed_at + INTERVAL 365 DAY
-- SETTINGS index_granularity = 8192
`

/**
 * Rust Player Stats - Wipe (cleared on server wipe)
 * Uses ReplacingMergeTree to deduplicate by (server_id, steamid), keeping latest updated_at
 */
const RUST_PLAYER_STATS_WIPE_SCHEMA = `
CREATE TABLE IF NOT EXISTS rust_player_stats_wipe (
    server_id String,
    steamid String,
    name String DEFAULT '',
    avatar String DEFAULT '',
    clan String DEFAULT '',
    kills UInt64 DEFAULT 0,
    deaths UInt64 DEFAULT 0,
    kdr Float64 DEFAULT 0,
    playtime UInt64 DEFAULT 0,
    tcs_destroyed UInt64 DEFAULT 0,
    c4_thrown UInt64 DEFAULT 0,
    rockets_launched UInt64 DEFAULT 0,
    c4_crafted UInt64 DEFAULT 0,
    rockets_crafted UInt64 DEFAULT 0,
    container_points UInt64 DEFAULT 0,
    weapon_kills String DEFAULT '{}',
    points UInt64 DEFAULT 0,
    updated_at DateTime DEFAULT now()
)
ENGINE = ReplacingMergeTree(updated_at)
ORDER BY (server_id, steamid)
PARTITION BY server_id
SETTINGS index_granularity = 8192
`

/**
 * Rust Player Stats - Monthly (auto-TTL 90 days)
 */
const RUST_PLAYER_STATS_MONTHLY_SCHEMA = `
CREATE TABLE IF NOT EXISTS rust_player_stats_monthly (
    server_id String,
    steamid String,
    name String DEFAULT '',
    avatar String DEFAULT '',
    clan String DEFAULT '',
    kills UInt64 DEFAULT 0,
    deaths UInt64 DEFAULT 0,
    kdr Float64 DEFAULT 0,
    playtime UInt64 DEFAULT 0,
    tcs_destroyed UInt64 DEFAULT 0,
    c4_thrown UInt64 DEFAULT 0,
    rockets_launched UInt64 DEFAULT 0,
    c4_crafted UInt64 DEFAULT 0,
    rockets_crafted UInt64 DEFAULT 0,
    container_points UInt64 DEFAULT 0,
    weapon_kills String DEFAULT '{}',
    points UInt64 DEFAULT 0,
    updated_at DateTime DEFAULT now()
)
ENGINE = ReplacingMergeTree(updated_at)
ORDER BY (server_id, steamid)
PARTITION BY toYYYYMM(updated_at)
TTL updated_at + INTERVAL 90 DAY
SETTINGS index_granularity = 8192
`

/**
 * Rust Player Stats - Overall (lifetime, no TTL)
 */
const RUST_PLAYER_STATS_OVERALL_SCHEMA = `
CREATE TABLE IF NOT EXISTS rust_player_stats_overall (
    server_id String,
    steamid String,
    name String DEFAULT '',
    avatar String DEFAULT '',
    clan String DEFAULT '',
    kills UInt64 DEFAULT 0,
    deaths UInt64 DEFAULT 0,
    kdr Float64 DEFAULT 0,
    playtime UInt64 DEFAULT 0,
    tcs_destroyed UInt64 DEFAULT 0,
    c4_thrown UInt64 DEFAULT 0,
    rockets_launched UInt64 DEFAULT 0,
    c4_crafted UInt64 DEFAULT 0,
    rockets_crafted UInt64 DEFAULT 0,
    container_points UInt64 DEFAULT 0,
    weapon_kills String DEFAULT '{}',
    points UInt64 DEFAULT 0,
    updated_at DateTime DEFAULT now()
)
ENGINE = ReplacingMergeTree(updated_at)
ORDER BY (server_id, steamid)
PARTITION BY toYYYYMM(updated_at)
SETTINGS index_granularity = 8192
`

const RUST_PLAYER_STATS_COLUMNS: Array<{ name: string; type: string }> = [
  { name: 'server_id', type: 'String' },
  { name: 'steamid', type: 'String' },
  { name: 'name', type: 'String' },
  { name: 'avatar', type: 'String' },
  { name: 'clan', type: 'String' },
  { name: 'kills', type: 'UInt64' },
  { name: 'deaths', type: 'UInt64' },
  { name: 'kdr', type: 'Float64' },
  { name: 'playtime', type: 'UInt64' },
  { name: 'tcs_destroyed', type: 'UInt64' },
  { name: 'c4_thrown', type: 'UInt64' },
  { name: 'rockets_launched', type: 'UInt64' },
  { name: 'c4_crafted', type: 'UInt64' },
  { name: 'rockets_crafted', type: 'UInt64' },
  { name: 'container_points', type: 'UInt64' },
  { name: 'weapon_kills', type: 'String' },
  { name: 'points', type: 'UInt64' },
  { name: 'updated_at', type: 'DateTime' },
]

/**
 * All table schemas to be created/checked
 */
const SCHEMAS = [
  { name: 'server_population_stats', schema: SERVER_POPULATION_STATS_SCHEMA },
  { name: 'event_completions', schema: EVENT_COMPLETIONS_SCHEMA },
  { name: 'bases_raid_events', schema: BASES_RAID_EVENTS_SCHEMA },
  // { name: 'kit_usage_events', schema: KIT_USAGE_EVENTS_SCHEMA },
  { name: 'rust_player_stats_wipe', schema: RUST_PLAYER_STATS_WIPE_SCHEMA },
  { name: 'rust_player_stats_monthly', schema: RUST_PLAYER_STATS_MONTHLY_SCHEMA },
  { name: 'rust_player_stats_overall', schema: RUST_PLAYER_STATS_OVERALL_SCHEMA },
]

/**
 * Column definitions for each table
 * Used to check if columns exist and add them if missing
 */
const COLUMN_DEFINITIONS: Record<string, Array<{ name: string; type: string }>> = {
  server_population_stats: [
    { name: 'server_id', type: 'String' },
    { name: 'server_name', type: 'String' },
    { name: 'server_ip', type: 'String' },
    { name: 'server_port', type: 'UInt16' },
    { name: 'category_id', type: 'UInt32' },
    { name: 'category', type: 'String' },
    { name: 'players', type: 'UInt16' },
    { name: 'max_players', type: 'UInt16' },
    { name: 'last_wipe', type: 'Nullable(DateTime)' },
    { name: 'next_wipe', type: 'Nullable(DateTime)' },
    { name: 'days_since_wipe', type: 'Nullable(UInt16)' },
    { name: 'timestamp', type: 'DateTime' },
  ],
  event_completions: [
    { name: 'server_id', type: 'String' },
    { name: 'event_type', type: "Enum8('koth' = 1, 'maze' = 2)" },
    { name: 'winner_steam_id', type: 'UInt64' },
    { name: 'winner_name', type: 'String' },
    { name: 'winner_clan_tag', type: 'Nullable(String)' },
    { name: 'winner_kills', type: 'UInt16' },
    { name: 'is_clan_mode', type: 'UInt8' },
    { name: 'event_modes', type: 'Array(String)' },
    { name: 'location', type: 'Nullable(String)' },
    { name: 'duration_seconds', type: 'UInt32' },
    { name: 'participants', type: 'Array(Tuple(steam_id UInt64, name String, kills UInt16, deaths UInt16, position UInt16))' },
    { name: 'timestamp', type: 'DateTime64(3)' },
  ],
  bases_raid_events: [
    { name: 'server_id', type: 'String' },
    { name: 'base_id', type: 'UInt32' },
    { name: 'building_name', type: 'String' },
    { name: 'base_type', type: 'String' },
    { name: 'building_grade', type: 'String' },
    { name: 'raid_duration_seconds', type: 'UInt32' },
    { name: 'was_completed', type: 'UInt8' },
    { name: 'total_entities_destroyed', type: 'UInt16' },
    { name: 'total_containers_destroyed', type: 'UInt16' },
    { name: 'total_npcs_killed', type: 'UInt16' },
    { name: 'raider_steam_ids', type: 'Array(String)' },
    { name: 'raider_names', type: 'Array(String)' },
    { name: 'raider_entities_destroyed', type: 'Array(UInt16)' },
    { name: 'raider_containers_destroyed', type: 'Array(UInt16)' },
    { name: 'raider_npcs_killed', type: 'Array(UInt16)' },
    { name: 'timestamp', type: 'DateTime' },
  ],
  rust_player_stats_wipe: RUST_PLAYER_STATS_COLUMNS,
  rust_player_stats_monthly: RUST_PLAYER_STATS_COLUMNS,
  rust_player_stats_overall: RUST_PLAYER_STATS_COLUMNS,
}

/**
 * Check if a table exists
 */
async function tableExists(tableName: string): Promise<boolean> {
  try {
    const result = await clickhouse.query({
      query: `EXISTS TABLE ${tableName}`,
      format: 'JSONEachRow',
    })
    const data = await result.json<{ result: number }>()
    return data[0]?.result === 1
  } catch (error) {
    console.error(`Error checking if table ${tableName} exists:`, error)
    return false
  }
}

/**
 * Get existing columns for a table
 */
async function getTableColumns(tableName: string): Promise<string[]> {
  try {
    const result = await clickhouse.query({
      query: `DESCRIBE TABLE ${tableName}`,
      format: 'JSONEachRow',
    })
    const data = await result.json<{ name: string }>()
    return data.map((col) => col.name)
  } catch (error) {
    console.error(`Error getting columns for table ${tableName}:`, error)
    return []
  }
}

/**
 * Add a missing column to a table
 */
async function addColumn(tableName: string, columnName: string, columnType: string): Promise<void> {
  try {
    await clickhouse.query({
      query: `ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnType}`,
      format: 'JSONEachRow',
    })
    console.log(`✅ Added column ${columnName} to ${tableName}`)
  } catch (error: any) {
    // Ignore if column already exists (ClickHouse error code 44)
    if (!error?.message?.includes('Code: 44')) {
      console.error(`Error adding column ${columnName} to ${tableName}:`, error)
    }
  }
}

/**
 * Ensure a table exists with all required columns
 */
async function ensureTable(tableName: string, schema: string): Promise<void> {
  try {
    // Create table if it doesn't exist
    await clickhouse.query({
      query: schema,
      format: 'JSONEachRow',
    })

    const exists = await tableExists(tableName)
    if (!exists) {
      console.log(`✅ Created table: ${tableName}`)
      return
    }

    // Check for missing columns
    const existingColumns = await getTableColumns(tableName)
    const requiredColumns = COLUMN_DEFINITIONS[tableName] || []

    for (const col of requiredColumns) {
      if (!existingColumns.includes(col.name)) {
        console.log(`⚠️  Column ${col.name} missing from ${tableName}, adding...`)
        await addColumn(tableName, col.name, col.type)
      }
    }
  } catch (error) {
    console.error(`Error ensuring table ${tableName}:`, error)
  }
}

/**
 * Initialize/sync all ClickHouse schemas
 * Call this on application startup or run manually
 */
export async function syncClickHouseSchema(): Promise<void> {
  console.log('🔄 Syncing ClickHouse schema...')

  for (const { name, schema } of SCHEMAS) {
    await ensureTable(name, schema)
  }

  console.log('✅ ClickHouse schema sync complete')
}

/**
 * Drop all tables (DANGEROUS - use only in development)
 */
export async function dropAllTables(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Cannot drop tables in production!')
  }

  console.log('⚠️  Dropping all tables...')

  for (const { name } of SCHEMAS) {
    try {
      await clickhouse.query({
        query: `DROP TABLE IF EXISTS ${name}`,
        format: 'JSONEachRow',
      })
      console.log(`🗑️  Dropped table: ${name}`)
    } catch (error) {
      console.error(`Error dropping table ${name}:`, error)
    }
  }
}

// Auto-run schema sync if this file is executed directly
if (require.main === module) {
  syncClickHouseSchema()
    .then(() => {
      console.log('Done!')
      process.exit(0)
    })
    .catch((error) => {
      console.error('Failed to sync schema:', error)
      process.exit(1)
    })
}
