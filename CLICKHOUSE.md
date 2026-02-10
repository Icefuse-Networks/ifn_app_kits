# ClickHouse Schema Management

## Overview

ClickHouse schema is managed via TypeScript in [src/lib/clickhouse-schema.ts](src/lib/clickhouse-schema.ts).

The schema automatically:
- ✅ Creates tables if they don't exist
- ✅ Adds missing columns to existing tables
- ✅ Prevents duplicate column errors
- ✅ Can be run on every deployment safely

## Usage

### Sync Schema (Recommended)

Run this to ensure your ClickHouse database has all tables and columns:

```bash
npm run clickhouse:sync
```

This is safe to run multiple times - it only creates missing tables/columns.

### Auto-sync on Startup (Optional)

Add to your Next.js startup (e.g., in a layout or middleware):

```typescript
import { syncClickHouseSchema } from '@/lib/clickhouse-schema'

// On server startup
syncClickHouseSchema().catch(console.error)
```

## Schema Definition

All tables are defined in [src/lib/clickhouse-schema.ts](src/lib/clickhouse-schema.ts):

```typescript
const SCHEMAS = [
  { name: 'server_population_stats', schema: SERVER_POPULATION_STATS_SCHEMA },
  // Add more tables here
]
```

### Adding a New Table

1. Define the schema constant:
```typescript
const MY_NEW_TABLE_SCHEMA = `
CREATE TABLE IF NOT EXISTS my_table (
    id String,
    name String,
    count UInt32,
    timestamp DateTime DEFAULT now()
)
ENGINE = MergeTree()
ORDER BY (id, timestamp)
`
```

2. Add to SCHEMAS array:
```typescript
const SCHEMAS = [
  { name: 'server_population_stats', schema: SERVER_POPULATION_STATS_SCHEMA },
  { name: 'my_table', schema: MY_NEW_TABLE_SCHEMA },
]
```

3. Add column definitions (for auto-detection):
```typescript
const COLUMN_DEFINITIONS = {
  server_population_stats: [...],
  my_table: [
    { name: 'id', type: 'String' },
    { name: 'name', type: 'String' },
    { name: 'count', type: 'UInt32' },
    { name: 'timestamp', type: 'DateTime' },
  ],
}
```

4. Run sync:
```bash
npm run clickhouse:sync
```

### Adding a Column to Existing Table

1. Update the schema constant in [src/lib/clickhouse-schema.ts](src/lib/clickhouse-schema.ts)
2. Add to COLUMN_DEFINITIONS
3. Run `npm run clickhouse:sync`

The script will automatically detect the missing column and add it.

## Current Tables

### server_population_stats

Stores real-time server population data (updated every 60 seconds).

| Column | Type | Description |
|--------|------|-------------|
| server_id | String | Unique server identifier (hashed) |
| server_name | String | Current server name |
| server_ip | String | Server IP address |
| server_port | UInt16 | Server port |
| category_id | UInt32 | Category ID |
| category | String | Category name (5x, 10x, etc) |
| players | UInt16 | Current player count |
| max_players | UInt16 | Max capacity |
| timestamp | DateTime | When recorded |

**Retention:** 90 days (auto-deleted)
**Partitioned by:** Month

## Connecting to ClickHouse

```typescript
import { clickhouse } from '@/lib/clickhouse'

// Query
const result = await clickhouse.query({
  query: 'SELECT * FROM server_population_stats LIMIT 10',
  format: 'JSONEachRow',
})
const data = await result.json()

// Insert
await clickhouse.insert({
  table: 'server_population_stats',
  values: [{ server_id: 'abc', players: 50, ... }],
  format: 'JSONEachRow',
})
```

## Development Commands

```bash
# Sync schema
npm run clickhouse:sync

# View tables (via clickhouse-client)
clickhouse-client --query "SHOW TABLES"

# Describe a table
clickhouse-client --query "DESCRIBE TABLE server_population_stats"

# Check table size
clickhouse-client --query "
  SELECT
    formatReadableSize(sum(bytes)) as size,
    sum(rows) as rows
  FROM system.parts
  WHERE table = 'server_population_stats' AND active
"
```
