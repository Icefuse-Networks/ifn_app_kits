/**
 * CUID Migration Script
 *
 * Migrates existing data from auto-increment IDs to prefixed UUIDs.
 *
 * Run with: npx tsx prisma/migrate-to-cuid.ts
 *
 * This script:
 * 1. Alters the database column types from INT to VARCHAR
 * 2. Updates all existing data with new prefixed UUIDs
 * 3. Updates foreign key references
 */

import { PrismaClient } from '@prisma/client'
import { randomUUID } from 'crypto'

const prisma = new PrismaClient()

function generateCategoryId(): string {
  return `category_${randomUUID()}`
}

function generateKitId(): string {
  return `kit_${randomUUID()}`
}

interface OldKitConfig {
  id: number
  kit_data: string
}

interface KitsData {
  _comment?: string
  _kits: Record<string, unknown>
  'AutoKits Priority'?: string[]
  'Post wipe cooldowns (kit name | seconds)'?: Record<string, number>
}

async function main() {
  console.log('Starting CUID migration...\n')

  // 1. Get all existing kit configs using raw SQL
  const configs = await prisma.$queryRaw<OldKitConfig[]>`
    SELECT id, kit_data FROM kit_config
  `

  console.log(`Found ${configs.length} kit configs to migrate\n`)

  if (configs.length === 0) {
    console.log('No configs to migrate.')
    console.log('Proceeding with schema changes anyway...\n')
  }

  // Prepare all migrations first
  const migrations: Array<{
    oldId: number
    newId: string
    newKitData: string
  }> = []

  for (const config of configs) {
    const oldId = config.id
    const newId = generateCategoryId()

    console.log(`Preparing config ${oldId} -> ${newId}`)

    // Parse and migrate kit IDs within kitData
    let kitData: KitsData
    try {
      kitData = JSON.parse(config.kit_data)
    } catch {
      console.error(`  ERROR: Failed to parse kitData for config ${oldId}`)
      continue
    }

    if (kitData._kits) {
      const oldKits = kitData._kits
      const newKits: Record<string, unknown> = {}
      let kitCount = 0

      for (const [oldKitId, kit] of Object.entries(oldKits)) {
        const newKitId = generateKitId()
        newKits[newKitId] = kit
        kitCount++
        console.log(`  Kit: ${oldKitId} -> ${newKitId}`)
      }

      kitData._kits = newKits
      console.log(`  Prepared ${kitCount} kits`)
    }

    migrations.push({
      oldId,
      newId,
      newKitData: JSON.stringify(kitData),
    })
  }

  console.log('\n' + '='.repeat(60))
  console.log('Step 1: Drop foreign key constraint')
  console.log('='.repeat(60))

  try {
    await prisma.$executeRaw`
      ALTER TABLE game_server DROP CONSTRAINT IF EXISTS game_server_kit_config_id_fkey
    `
    console.log('  Dropped foreign key constraint')
  } catch (error) {
    console.log('  No foreign key constraint to drop (or already dropped)')
  }

  console.log('\n' + '='.repeat(60))
  console.log('Step 2: Alter kit_config.id column type')
  console.log('='.repeat(60))

  try {
    // Add a temporary column for the new ID
    await prisma.$executeRaw`
      ALTER TABLE kit_config ADD COLUMN IF NOT EXISTS new_id VARCHAR(60)
    `
    console.log('  Added temporary new_id column')

    // Update the new_id column with migrated values
    for (const migration of migrations) {
      await prisma.$executeRaw`
        UPDATE kit_config
        SET new_id = ${migration.newId}, kit_data = ${migration.newKitData}
        WHERE id = ${migration.oldId}
      `
      console.log(`  Updated config ${migration.oldId} -> ${migration.newId}`)
    }

    // Drop the old id column and rename new_id
    await prisma.$executeRaw`
      ALTER TABLE kit_config DROP CONSTRAINT IF EXISTS kit_config_pkey
    `
    console.log('  Dropped old primary key')

    await prisma.$executeRaw`
      ALTER TABLE kit_config DROP COLUMN id
    `
    console.log('  Dropped old id column')

    await prisma.$executeRaw`
      ALTER TABLE kit_config RENAME COLUMN new_id TO id
    `
    console.log('  Renamed new_id to id')

    await prisma.$executeRaw`
      ALTER TABLE kit_config ADD PRIMARY KEY (id)
    `
    console.log('  Added new primary key')

  } catch (error) {
    console.error('  ERROR altering kit_config:', error)
    throw error
  }

  console.log('\n' + '='.repeat(60))
  console.log('Step 3: Alter game_server.kit_config_id column type')
  console.log('='.repeat(60))

  try {
    // Add temp column
    await prisma.$executeRaw`
      ALTER TABLE game_server ADD COLUMN IF NOT EXISTS new_kit_config_id VARCHAR(60)
    `
    console.log('  Added temporary new_kit_config_id column')

    // Update with new IDs
    for (const migration of migrations) {
      await prisma.$executeRaw`
        UPDATE game_server
        SET new_kit_config_id = ${migration.newId}
        WHERE kit_config_id = ${migration.oldId}
      `
    }
    console.log('  Updated game_server references')

    // Swap columns
    await prisma.$executeRaw`
      ALTER TABLE game_server DROP COLUMN IF EXISTS kit_config_id
    `
    console.log('  Dropped old kit_config_id column')

    await prisma.$executeRaw`
      ALTER TABLE game_server RENAME COLUMN new_kit_config_id TO kit_config_id
    `
    console.log('  Renamed new_kit_config_id to kit_config_id')

  } catch (error) {
    console.error('  ERROR altering game_server:', error)
    throw error
  }

  console.log('\n' + '='.repeat(60))
  console.log('Step 4: Re-add foreign key constraint')
  console.log('='.repeat(60))

  try {
    await prisma.$executeRaw`
      ALTER TABLE game_server
      ADD CONSTRAINT game_server_kit_config_id_fkey
      FOREIGN KEY (kit_config_id) REFERENCES kit_config(id)
    `
    console.log('  Added foreign key constraint')
  } catch (error) {
    console.log('  Warning: Could not add FK constraint:', error)
  }

  console.log('\n' + '='.repeat(60))
  console.log('Step 5: Add indexes')
  console.log('='.repeat(60))

  try {
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS idx_kit_config_name ON kit_config(name)
    `
    console.log('  Added index on kit_config.name')

    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS idx_kit_config_updated_at ON kit_config(updated_at)
    `
    console.log('  Added index on kit_config.updated_at')

    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS idx_game_server_kit_config_id ON game_server(kit_config_id)
    `
    console.log('  Added index on game_server.kit_config_id')

  } catch (error) {
    console.log('  Warning: Index creation issue:', error)
  }

  console.log('\n' + '='.repeat(60))
  console.log('MIGRATION COMPLETE!')
  console.log('='.repeat(60))
  console.log('\nID Mappings (old -> new):')
  for (const m of migrations) {
    console.log(`  ${m.oldId} -> ${m.newId}`)
  }
  console.log('\nNext steps:')
  console.log('1. Regenerate Prisma client: npx prisma generate')
  console.log('2. Verify data: npx prisma studio')
  console.log('3. Update plugin configs to use new category IDs')
  console.log('4. Test the application')
}

main()
  .catch((error) => {
    console.error('Migration failed:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
