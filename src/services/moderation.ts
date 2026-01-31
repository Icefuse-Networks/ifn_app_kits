/**
 * Global Content Moderation Service
 *
 * Provides content filtering for all plugins including:
 * - Clan tag validation
 * - Chat message filtering
 * - Player name validation
 * - Any other text content moderation
 *
 * Supports:
 * - Exact match patterns
 * - Regex patterns with leetspeak detection
 * - Context-specific filtering (all, clan_tags, chat, player_names)
 * - Severity levels (1=mild, 2=moderate, 3=strong, 4=extreme)
 * - Categories (racial, lgbtq, sexual, profanity, hate_symbol, violence, etc.)
 */

import { prisma } from '@/lib/db'
import { id } from '@/lib/id'
import { logger } from '@/lib/logger'

// =============================================================================
// TYPES
// =============================================================================

export type ModerationContext = 'all' | 'clan_tags' | 'chat' | 'player_names'

export type ModerationCategory =
  | 'racial'
  | 'lgbtq'
  | 'sexual'
  | 'profanity'
  | 'hate_symbol'
  | 'violence'
  | 'religious'
  | 'disability'
  | 'other'

export interface BannedWordInput {
  pattern: string
  isRegex: boolean
  context?: ModerationContext
  severity?: number
  category: ModerationCategory
  reason?: string
}

export interface ModerationResult {
  isBlocked: boolean
  matchedPattern?: string
  category?: string
  severity?: number
  reason?: string
}

// =============================================================================
// CORE FUNCTIONS
// =============================================================================

/**
 * Check if text contains banned content for a specific context
 * @param text - The text to check
 * @param context - The context to check against (default: 'all')
 * @returns ModerationResult with match details if blocked
 */
export async function checkContent(
  text: string,
  context: ModerationContext = 'all'
): Promise<ModerationResult> {
  // PERF: Select only needed fields
  const bannedWords = await prisma.bannedWord.findMany({
    where: {
      OR: [{ context: 'all' }, { context }],
    },
    select: {
      pattern: true,
      isRegex: true,
      category: true,
      severity: true,
      reason: true,
    },
    orderBy: { severity: 'desc' }, // Check most severe first
  })

  const normalizedText = text.toLowerCase()

  for (const banned of bannedWords) {
    if (banned.isRegex) {
      try {
        const regex = new RegExp(banned.pattern, 'i')
        if (regex.test(text)) {
          return {
            isBlocked: true,
            matchedPattern: banned.pattern,
            category: banned.category,
            severity: banned.severity,
            reason: banned.reason ?? undefined,
          }
        }
      } catch {
        // Invalid regex, skip
        continue
      }
    } else {
      // Exact match (case-insensitive)
      if (banned.pattern.toLowerCase() === normalizedText) {
        return {
          isBlocked: true,
          matchedPattern: banned.pattern,
          category: banned.category,
          severity: banned.severity,
          reason: banned.reason ?? undefined,
        }
      }
      // Also check if pattern is contained in text (for non-regex)
      if (normalizedText.includes(banned.pattern.toLowerCase())) {
        return {
          isBlocked: true,
          matchedPattern: banned.pattern,
          category: banned.category,
          severity: banned.severity,
          reason: banned.reason ?? undefined,
        }
      }
    }
  }

  return { isBlocked: false }
}

/**
 * Check if a clan tag is banned
 * Convenience wrapper for checkContent with clan_tags context
 */
export async function isTagBanned(tag: string): Promise<boolean> {
  const result = await checkContent(tag, 'clan_tags')
  return result.isBlocked
}

/**
 * Check if chat message contains banned content
 * Convenience wrapper for checkContent with chat context
 */
export async function isChatBlocked(message: string): Promise<ModerationResult> {
  return checkContent(message, 'chat')
}

/**
 * Check if player name is banned
 * Convenience wrapper for checkContent with player_names context
 */
export async function isPlayerNameBanned(name: string): Promise<boolean> {
  const result = await checkContent(name, 'player_names')
  return result.isBlocked
}

// =============================================================================
// CRUD OPERATIONS
// =============================================================================

/**
 * List all banned words with optional filtering
 */
export async function listBannedWords(options?: {
  context?: ModerationContext
  category?: ModerationCategory
  search?: string
  limit?: number
  offset?: number
}) {
  const { context, category, search, limit = 100, offset = 0 } = options ?? {}

  const where = {
    ...(context && { context }),
    ...(category && { category }),
    ...(search && {
      OR: [
        { pattern: { contains: search, mode: 'insensitive' as const } },
        { reason: { contains: search, mode: 'insensitive' as const } },
      ],
    }),
  }

  // PERF: Parallel queries
  const [words, total] = await Promise.all([
    prisma.bannedWord.findMany({
      where,
      orderBy: [{ severity: 'desc' }, { category: 'asc' }, { createdAt: 'desc' }],
      take: limit,
      skip: offset,
    }),
    prisma.bannedWord.count({ where }),
  ])

  return { data: words, total, limit, offset }
}

/**
 * Get a single banned word by ID
 */
export async function getBannedWord(bannedWordId: string) {
  return prisma.bannedWord.findUnique({
    where: { id: bannedWordId },
  })
}

/**
 * Create a new banned word pattern
 */
export async function createBannedWord(input: BannedWordInput, createdBy: string) {
  const { pattern, isRegex, context = 'all', severity = 3, category, reason } = input

  // Validate regex if applicable
  if (isRegex) {
    try {
      new RegExp(pattern)
    } catch {
      throw new Error('Invalid regex pattern')
    }
  }

  // Check for duplicates
  const existing = await prisma.bannedWord.findUnique({
    where: { pattern_context: { pattern, context } },
  })
  if (existing) {
    throw new Error(`Pattern already exists for context: ${context}`)
  }

  const bannedWord = await prisma.bannedWord.create({
    data: {
      id: id.bannedWord(),
      pattern,
      isRegex,
      context,
      severity,
      category,
      reason: reason ?? null,
      createdBy,
    },
  })

  logger.admin.info('Banned word created', { pattern, context, category, createdBy })
  return bannedWord
}

/**
 * Update a banned word pattern
 */
export async function updateBannedWord(
  bannedWordId: string,
  input: Partial<BannedWordInput>
) {
  // Validate regex if changing to regex or updating pattern
  if (input.isRegex && input.pattern) {
    try {
      new RegExp(input.pattern)
    } catch {
      throw new Error('Invalid regex pattern')
    }
  }

  const bannedWord = await prisma.bannedWord.update({
    where: { id: bannedWordId },
    data: {
      pattern: input.pattern,
      isRegex: input.isRegex,
      context: input.context,
      severity: input.severity,
      category: input.category,
      reason: input.reason,
    },
  })

  logger.admin.info('Banned word updated', { bannedWordId })
  return bannedWord
}

/**
 * Delete a banned word pattern
 */
export async function deleteBannedWord(bannedWordId: string) {
  await prisma.bannedWord.delete({
    where: { id: bannedWordId },
  })

  logger.admin.info('Banned word deleted', { bannedWordId })
}

/**
 * Bulk create banned words (for seeding)
 */
export async function bulkCreateBannedWords(
  words: BannedWordInput[],
  createdBy: string
): Promise<{ created: number; skipped: number; errors: string[] }> {
  let created = 0
  let skipped = 0
  const errors: string[] = []

  for (const word of words) {
    try {
      // Validate regex if applicable
      if (word.isRegex) {
        try {
          new RegExp(word.pattern)
        } catch {
          errors.push(`Invalid regex: ${word.pattern}`)
          continue
        }
      }

      await prisma.bannedWord.upsert({
        where: {
          pattern_context: {
            pattern: word.pattern,
            context: word.context ?? 'all',
          },
        },
        update: {}, // No update if exists
        create: {
          id: id.bannedWord(),
          pattern: word.pattern,
          isRegex: word.isRegex,
          context: word.context ?? 'all',
          severity: word.severity ?? 3,
          category: word.category,
          reason: word.reason ?? null,
          createdBy,
        },
      })
      created++
    } catch (error) {
      if (error instanceof Error && error.message.includes('Unique constraint')) {
        skipped++
      } else {
        errors.push(`Failed: ${word.pattern} - ${error}`)
      }
    }
  }

  logger.admin.info('Bulk banned words created', { created, skipped, errors: errors.length })
  return { created, skipped, errors }
}

/**
 * Get category statistics
 */
export async function getCategoryStats() {
  const stats = await prisma.bannedWord.groupBy({
    by: ['category'],
    _count: { id: true },
  })

  return stats.map((s) => ({
    category: s.category,
    count: s._count.id,
  }))
}

/**
 * Get context statistics
 */
export async function getContextStats() {
  const stats = await prisma.bannedWord.groupBy({
    by: ['context'],
    _count: { id: true },
  })

  return stats.map((s) => ({
    context: s.context,
    count: s._count.id,
  }))
}
