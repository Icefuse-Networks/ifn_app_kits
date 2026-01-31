/**
 * Clans Service
 *
 * Core business logic for clan management.
 * Handles CRUD operations, membership, and validation.
 */

import { prisma } from '@/lib/db'
import { id } from '@/lib/id'
import { logger } from '@/lib/logger'
import type { Prisma } from '@prisma/client'
import type {
  CreateClanInput,
  AdminUpdateClanInput,
  AddMemberInput,
  CreateRoleInput,
  UpdateRoleInput,
  ClanListQueryInput,
} from '@/lib/validations/clans'

// =============================================================================
// TYPES
// =============================================================================

export interface ClanWithDetails {
  id: string
  tag: string
  description: string | null
  tagColor: string
  ownerId: string
  flags: number
  version: number
  createdAt: Date
  updatedAt: Date
  _count: {
    members: number
    invites: number
    applications: number
  }
  stats: {
    totalXP: number
    pvpKills: number
  } | null
  prestige: {
    prestigePoints: number
  } | null
}

// =============================================================================
// CLAN CRUD
// =============================================================================

/**
 * List clans with pagination and filtering
 */
export async function listClans(query: ClanListQueryInput) {
  const { search, sortBy, sortOrder, page, limit } = query
  const skip = (page - 1) * limit

  const where: Prisma.ClanWhereInput = search
    ? {
        OR: [
          { tag: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ],
      }
    : {}

  // PERF: Parallel queries for data and count
  const [clans, total] = await Promise.all([
    prisma.clan.findMany({
      where,
      select: {
        id: true,
        tag: true,
        description: true,
        tagColor: true,
        ownerId: true,
        flags: true,
        version: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            members: true,
            invites: true,
            applications: true,
          },
        },
        stats: {
          select: {
            totalXP: true,
            pvpKills: true,
          },
        },
        prestige: {
          select: {
            prestigePoints: true,
          },
        },
      },
      orderBy:
        sortBy === 'memberCount'
          ? { members: { _count: sortOrder } }
          : sortBy === 'level'
            ? { stats: { totalXP: sortOrder } }
            : { [sortBy]: sortOrder },
      skip,
      take: limit,
    }),
    prisma.clan.count({ where }),
  ])

  return {
    data: clans,
    total,
    page,
    limit,
    hasMore: skip + clans.length < total,
  }
}

/**
 * Get clan by tag
 */
export async function getClanByTag(tag: string) {
  return prisma.clan.findUnique({
    where: { tag },
    include: {
      members: {
        orderBy: { roleRank: 'asc' },
      },
      roles: {
        orderBy: { rank: 'asc' },
      },
      stats: true,
      prestige: true,
      alliancesFrom: {
        where: { status: 'accepted' },
        include: {
          toClan: {
            select: { id: true, tag: true, tagColor: true },
          },
        },
      },
      alliancesTo: {
        where: { status: 'accepted' },
        include: {
          fromClan: {
            select: { id: true, tag: true, tagColor: true },
          },
        },
      },
      enemiesFrom: {
        include: {
          toClan: {
            select: { id: true, tag: true, tagColor: true },
          },
        },
      },
      enemiesTo: {
        include: {
          fromClan: {
            select: { id: true, tag: true, tagColor: true },
          },
        },
      },
      perks: {
        include: {
          perk: true,
        },
      },
      _count: {
        select: {
          members: true,
          invites: true,
          applications: true,
        },
      },
    },
  })
}

/**
 * Get clan by ID
 */
export async function getClanById(clanId: string) {
  return prisma.clan.findUnique({
    where: { id: clanId },
    include: {
      members: true,
      roles: true,
      stats: true,
      prestige: true,
      _count: {
        select: { members: true },
      },
    },
  })
}

/**
 * Create a new clan
 */
export async function createClan(input: CreateClanInput) {
  const { tag, description, tagColor, ownerId } = input

  // Check if tag is banned
  const isBanned = await isTagBanned(tag)
  if (isBanned) {
    throw new Error('This clan tag is not allowed')
  }

  // Check if tag already exists
  const existing = await prisma.clan.findUnique({
    where: { tag },
    select: { id: true },
  })
  if (existing) {
    throw new Error('A clan with this tag already exists')
  }

  // Check if owner is already in a clan
  const existingMembership = await prisma.clanMember.findFirst({
    where: { steamId: ownerId },
    select: { id: true },
  })
  if (existingMembership) {
    throw new Error('Player is already in a clan')
  }

  // Create clan with owner as first member using transaction
  // SECURITY: Atomic operation
  const result = await prisma.$transaction(async (tx) => {
    const clan = await tx.clan.create({
      data: {
        id: id.clan(),
        tag,
        description: description || null,
        tagColor: tagColor || '5AF3F3',
        ownerId,
        flags: 0,
        version: 0,
      },
    })

    // Create owner as member with rank 0 (owner)
    await tx.clanMember.create({
      data: {
        id: id.clanMember(),
        clanId: clan.id,
        steamId: ownerId,
        roleRank: 0,
      },
    })

    // Create default roles
    const defaultRoles = [
      { rank: 0, name: 'Owner', color: 'FFD700', permissions: 63 },
      { rank: 1, name: 'Officer', color: '00FF00', permissions: 31 },
      { rank: 2, name: 'Member', color: '888888', permissions: 0 },
    ]

    for (const role of defaultRoles) {
      await tx.clanRole.create({
        data: {
          id: id.clanRole(),
          clanId: clan.id,
          ...role,
        },
      })
    }

    // Create empty stats
    await tx.clanWipeStats.create({
      data: {
        id: id.clanWipeStats(),
        clanId: clan.id,
      },
    })

    // Create empty prestige
    await tx.clanPrestige.create({
      data: {
        id: id.clanPrestige(),
        clanId: clan.id,
      },
    })

    return clan
  })

  logger.admin.info('Clan created', { clanId: result.id, tag, ownerId })
  return result
}

/**
 * Update a clan
 */
export async function updateClan(clanId: string, input: AdminUpdateClanInput) {
  // Check if new tag is banned (if changing tag)
  if (input.tag) {
    const isBanned = await isTagBanned(input.tag)
    if (isBanned) {
      throw new Error('This clan tag is not allowed')
    }

    // Check if new tag already exists
    const existing = await prisma.clan.findFirst({
      where: {
        tag: input.tag,
        NOT: { id: clanId },
      },
      select: { id: true },
    })
    if (existing) {
      throw new Error('A clan with this tag already exists')
    }
  }

  // SECURITY: Atomic operation with version increment
  const clan = await prisma.clan.update({
    where: { id: clanId },
    data: {
      ...input,
      version: { increment: 1 },
    },
  })

  logger.admin.info('Clan updated', { clanId, changes: Object.keys(input) })
  return clan
}

/**
 * Delete/disband a clan
 */
export async function deleteClan(clanId: string) {
  // Cascade deletes will handle members, roles, etc.
  await prisma.clan.delete({
    where: { id: clanId },
  })

  logger.admin.info('Clan disbanded', { clanId })
}

// =============================================================================
// MEMBER MANAGEMENT
// =============================================================================

/**
 * Add a member to a clan
 */
export async function addMember(clanId: string, input: AddMemberInput) {
  const { steamId, roleRank } = input

  // Check if player is already in a clan
  const existingMembership = await prisma.clanMember.findFirst({
    where: { steamId },
    select: { id: true, clan: { select: { tag: true } } },
  })
  if (existingMembership) {
    throw new Error(`Player is already in clan [${existingMembership.clan.tag}]`)
  }

  // SECURITY: Atomic operation with version increment
  const [member] = await prisma.$transaction([
    prisma.clanMember.create({
      data: {
        id: id.clanMember(),
        clanId,
        steamId,
        roleRank,
      },
    }),
    prisma.clan.update({
      where: { id: clanId },
      data: { version: { increment: 1 } },
    }),
  ])

  logger.admin.info('Member added to clan', { clanId, steamId, roleRank })
  return member
}

/**
 * Remove a member from a clan
 */
export async function removeMember(clanId: string, steamId: string) {
  // Check if member is the owner
  const clan = await prisma.clan.findUnique({
    where: { id: clanId },
    select: { ownerId: true },
  })

  if (clan?.ownerId === steamId) {
    throw new Error('Cannot remove the clan owner. Transfer ownership first.')
  }

  // SECURITY: Atomic operation with version increment
  await prisma.$transaction([
    prisma.clanMember.delete({
      where: {
        clanId_steamId: { clanId, steamId },
      },
    }),
    prisma.clan.update({
      where: { id: clanId },
      data: { version: { increment: 1 } },
    }),
  ])

  logger.admin.info('Member removed from clan', { clanId, steamId })
}

/**
 * Transfer clan ownership
 */
export async function transferOwnership(clanId: string, newOwnerId: string) {
  // Verify new owner is a member
  const newOwnerMember = await prisma.clanMember.findUnique({
    where: { clanId_steamId: { clanId, steamId: newOwnerId } },
  })

  if (!newOwnerMember) {
    throw new Error('New owner must be a member of the clan')
  }

  // Get current owner
  const clan = await prisma.clan.findUnique({
    where: { id: clanId },
    select: { ownerId: true },
  })

  if (!clan) {
    throw new Error('Clan not found')
  }

  // SECURITY: Atomic operation
  await prisma.$transaction([
    // Update clan owner
    prisma.clan.update({
      where: { id: clanId },
      data: {
        ownerId: newOwnerId,
        version: { increment: 1 },
      },
    }),
    // Demote old owner to officer (rank 1)
    prisma.clanMember.update({
      where: { clanId_steamId: { clanId, steamId: clan.ownerId } },
      data: { roleRank: 1 },
    }),
    // Promote new owner to owner (rank 0)
    prisma.clanMember.update({
      where: { clanId_steamId: { clanId, steamId: newOwnerId } },
      data: { roleRank: 0 },
    }),
  ])

  logger.admin.info('Clan ownership transferred', {
    clanId,
    oldOwner: clan.ownerId,
    newOwner: newOwnerId,
  })
}

// =============================================================================
// ROLE MANAGEMENT
// =============================================================================

/**
 * Create a clan role
 */
export async function createRole(clanId: string, input: CreateRoleInput) {
  // Check if rank already exists
  const existing = await prisma.clanRole.findUnique({
    where: { clanId_rank: { clanId, rank: input.rank } },
  })

  if (existing) {
    throw new Error(`A role with rank ${input.rank} already exists`)
  }

  const role = await prisma.clanRole.create({
    data: {
      id: id.clanRole(),
      clanId,
      ...input,
    },
  })

  logger.admin.info('Clan role created', { clanId, roleId: role.id, rank: input.rank })
  return role
}

/**
 * Update a clan role
 */
export async function updateRole(clanId: string, rank: number, input: UpdateRoleInput) {
  const role = await prisma.clanRole.update({
    where: { clanId_rank: { clanId, rank } },
    data: input,
  })

  logger.admin.info('Clan role updated', { clanId, rank, changes: Object.keys(input) })
  return role
}

/**
 * Delete a clan role
 */
export async function deleteRole(clanId: string, rank: number) {
  // Don't allow deleting owner role (rank 0)
  if (rank === 0) {
    throw new Error('Cannot delete the owner role')
  }

  // Move members with this role to default member role (rank 2)
  await prisma.$transaction([
    prisma.clanMember.updateMany({
      where: { clanId, roleRank: rank },
      data: { roleRank: 2 },
    }),
    prisma.clanRole.delete({
      where: { clanId_rank: { clanId, rank } },
    }),
  ])

  logger.admin.info('Clan role deleted', { clanId, rank })
}

// =============================================================================
// BANNED NAMES
// =============================================================================

/**
 * Check if a clan tag is banned
 * Uses the global moderation service with clan_tags context
 */
export { isTagBanned } from '@/services/moderation'

/**
 * List all banned names
 */
export async function listBannedNames() {
  return prisma.bannedClanName.findMany({
    orderBy: { createdAt: 'desc' },
  })
}

/**
 * Create a banned name pattern
 */
export async function createBannedName(
  pattern: string,
  isRegex: boolean,
  reason: string | null,
  createdBy: string
) {
  // Validate regex if applicable
  if (isRegex) {
    try {
      new RegExp(pattern)
    } catch {
      throw new Error('Invalid regex pattern')
    }
  }

  const bannedName = await prisma.bannedClanName.create({
    data: {
      id: id.bannedClanName(),
      pattern,
      isRegex,
      reason,
      createdBy,
    },
  })

  logger.admin.info('Banned name created', { pattern, isRegex, createdBy })
  return bannedName
}

/**
 * Delete a banned name pattern
 */
export async function deleteBannedName(bannedNameId: string) {
  await prisma.bannedClanName.delete({
    where: { id: bannedNameId },
  })

  logger.admin.info('Banned name deleted', { bannedNameId })
}

// =============================================================================
// STATS (Atomic updates for race condition safety)
// =============================================================================

/**
 * Atomically increment clan stats
 * SECURITY: Uses atomic increments to prevent race conditions
 */
export async function incrementStats(
  clanId: string,
  stats: {
    pvpKills?: number
    pvpDeaths?: number
    headshotKills?: number
    raidsCompleted?: number
    npcKills?: number
    heliKills?: number
    bradleyKills?: number
    resourcesGathered?: number
  },
  xpGained: number
) {
  await prisma.clanWipeStats.update({
    where: { clanId },
    data: {
      totalXP: { increment: xpGained },
      pvpKills: stats.pvpKills ? { increment: stats.pvpKills } : undefined,
      pvpDeaths: stats.pvpDeaths ? { increment: stats.pvpDeaths } : undefined,
      headshotKills: stats.headshotKills ? { increment: stats.headshotKills } : undefined,
      raidsCompleted: stats.raidsCompleted ? { increment: stats.raidsCompleted } : undefined,
      npcKills: stats.npcKills ? { increment: stats.npcKills } : undefined,
      heliKills: stats.heliKills ? { increment: stats.heliKills } : undefined,
      bradleyKills: stats.bradleyKills ? { increment: stats.bradleyKills } : undefined,
      resourcesGathered: stats.resourcesGathered
        ? { increment: stats.resourcesGathered }
        : undefined,
    },
  })
}

// =============================================================================
// PLAYER LOOKUPS
// =============================================================================

/**
 * Get player's current clan
 */
export async function getPlayerClan(steamId: string) {
  const membership = await prisma.clanMember.findFirst({
    where: { steamId },
    include: {
      clan: {
        include: {
          roles: true,
          stats: true,
          prestige: true,
          _count: { select: { members: true } },
        },
      },
    },
  })

  return membership
}

/**
 * Get player's pending invites
 */
export async function getPlayerInvites(steamId: string) {
  return prisma.clanInvite.findMany({
    where: {
      targetSteamId: steamId,
      expiresAt: { gt: new Date() },
    },
    include: {
      clan: {
        select: {
          id: true,
          tag: true,
          tagColor: true,
          description: true,
          _count: { select: { members: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  })
}

/**
 * Get player's pending applications
 */
export async function getPlayerApplications(steamId: string) {
  return prisma.clanApplication.findMany({
    where: { applicantSteamId: steamId },
    include: {
      clan: {
        select: {
          id: true,
          tag: true,
          tagColor: true,
          description: true,
          _count: { select: { members: true } },
        },
      },
    },
    orderBy: { appliedAt: 'desc' },
  })
}
