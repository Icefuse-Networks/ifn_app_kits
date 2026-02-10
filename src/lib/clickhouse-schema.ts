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
 * All table schemas to be created/checked
 */
const SCHEMAS = [
  { name: 'server_population_stats', schema: SERVER_POPULATION_STATS_SCHEMA },
  { name: 'event_completions', schema: EVENT_COMPLETIONS_SCHEMA },
  // Add more tables here as needed
  // { name: 'kit_usage_events', schema: KIT_USAGE_EVENTS_SCHEMA },
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
