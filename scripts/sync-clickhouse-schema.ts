#!/usr/bin/env tsx
/**
 * Sync ClickHouse Schema
 *
 * Usage:
 *   npm run sync:clickhouse
 *   or
 *   tsx scripts/sync-clickhouse-schema.ts
 */

import { config } from 'dotenv'
config({ path: '.env.local' })
config({ path: '.env' })

async function main() {
  const { syncClickHouseSchema } = await import('../src/lib/clickhouse-schema')
  await syncClickHouseSchema()
  console.log('✅ Schema sync complete!')
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Schema sync failed:', error)
    process.exit(1)
  })
