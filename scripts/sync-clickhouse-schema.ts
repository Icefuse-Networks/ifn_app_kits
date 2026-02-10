#!/usr/bin/env tsx
/**
 * Sync ClickHouse Schema
 *
 * Usage:
 *   npm run sync:clickhouse
 *   or
 *   tsx scripts/sync-clickhouse-schema.ts
 */

import { syncClickHouseSchema } from '../src/lib/clickhouse-schema'

syncClickHouseSchema()
  .then(() => {
    console.log('✅ Schema sync complete!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ Schema sync failed:', error)
    process.exit(1)
  })
