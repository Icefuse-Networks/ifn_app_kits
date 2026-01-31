/**
 * Banned Words Seed Script
 *
 * Seeds the database with comprehensive profanity patterns from banned-patterns.ts
 *
 * Usage:
 *   npx tsx scripts/seed-banned-words.ts
 *   npm run db:seed-banned
 *
 * Options:
 *   --context=<context>   Apply patterns to specific context (all, clan_tags, chat, player_names)
 *   --dry-run             Show what would be seeded without actually seeding
 */

import { PrismaClient } from '@prisma/client'
import { randomUUID } from 'crypto'
import { BANNED_PATTERNS, PATTERN_COUNT, getPatternStats } from '../src/lib/banned-patterns'

const prisma = new PrismaClient()

// Parse command line arguments
const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const contextArg = args.find((arg) => arg.startsWith('--context='))
const context = contextArg ? contextArg.split('=')[1] : 'all'

async function main() {
  console.log('\n🔒 Banned Words Seed Script')
  console.log('============================\n')

  // Show pattern statistics
  const stats = getPatternStats()
  console.log(`📊 Pattern Statistics:`)
  console.log(`   Total patterns: ${PATTERN_COUNT}`)
  for (const [category, count] of Object.entries(stats)) {
    console.log(`   - ${category}: ${count}`)
  }
  console.log('')

  if (dryRun) {
    console.log('🧪 DRY RUN MODE - No changes will be made\n')
  }

  console.log(`📁 Context: ${context}`)
  console.log('')

  let created = 0
  let skipped = 0
  const errors: string[] = []

  for (const pattern of BANNED_PATTERNS) {
    const patternContext = context || 'all'

    // Validate regex if applicable
    if (pattern.isRegex) {
      try {
        new RegExp(pattern.pattern)
      } catch {
        errors.push(`Invalid regex: ${pattern.pattern}`)
        continue
      }
    }

    if (dryRun) {
      console.log(`  [DRY] Would create: ${pattern.pattern.substring(0, 40)}... (${pattern.category})`)
      created++
      continue
    }

    try {
      await prisma.bannedWord.upsert({
        where: {
          pattern_context: {
            pattern: pattern.pattern,
            context: patternContext,
          },
        },
        update: {}, // No update if exists
        create: {
          id: `bannedword_${randomUUID()}`,
          pattern: pattern.pattern,
          isRegex: pattern.isRegex,
          context: patternContext,
          severity: pattern.severity,
          category: pattern.category,
          reason: pattern.reason,
          createdBy: 'SYSTEM',
        },
      })
      created++
      process.stdout.write('.')
    } catch (error) {
      if (error instanceof Error && error.message.includes('Unique constraint')) {
        skipped++
        process.stdout.write('s')
      } else {
        errors.push(`Failed: ${pattern.pattern} - ${error}`)
        process.stdout.write('x')
      }
    }
  }

  console.log('\n')

  // Summary
  console.log('📋 Summary:')
  console.log(`   ✅ Created: ${created}`)
  console.log(`   ⏭️  Skipped: ${skipped}`)
  console.log(`   ❌ Errors: ${errors.length}`)

  if (errors.length > 0) {
    console.log('\n⚠️  Errors:')
    errors.slice(0, 10).forEach((e) => console.log(`   - ${e}`))
    if (errors.length > 10) {
      console.log(`   ... and ${errors.length - 10} more errors`)
    }
  }

  console.log('\n✅ Done!\n')
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
