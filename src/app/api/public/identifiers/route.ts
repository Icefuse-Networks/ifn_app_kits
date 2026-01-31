/**
 * Public Server Identifiers API
 *
 * GET /api/public/identifiers - List server identifiers for public dropdown
 *
 * No authentication required - this is a public endpoint.
 * Only returns minimal data needed for selection (id, name, category).
 */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'

/**
 * GET /api/public/identifiers
 *
 * Returns list of server identifiers with their categories for public dropdown.
 */
export async function GET() {
  try {
    // Try to fetch with categoryId (new schema)
    let identifiers: { id: string; name: string; categoryId: string | null }[]
    let categories: { id: string; name: string }[] = []

    try {
      // PERF: Parallel fetch if category schema exists
      const [ids, cats] = await Promise.all([
        prisma.serverIdentifier.findMany({
          select: {
            id: true,
            name: true,
            categoryId: true,
          },
          orderBy: { name: 'asc' },
        }),
        prisma.serverIdentifierCategory.findMany({
          select: {
            id: true,
            name: true,
          },
          orderBy: { name: 'asc' },
        }),
      ])
      identifiers = ids
      categories = cats
    } catch {
      // Category schema may not exist yet - fetch identifiers without categoryId
      const ids = await prisma.serverIdentifier.findMany({
        select: {
          id: true,
          name: true,
        },
        orderBy: { name: 'asc' },
      })
      identifiers = ids.map((i) => ({ ...i, categoryId: null }))
    }

    return NextResponse.json({
      identifiers,
      categories,
    })
  } catch (error) {
    logger.analytics.error('Failed to fetch public identifiers', error as Error)
    return NextResponse.json(
      { error: 'Failed to fetch identifiers' },
      { status: 500 }
    )
  }
}
