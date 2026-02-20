import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { authenticateWithScope, requireSession } from '@/services/api-auth'
import { auditCreate, auditUpdate } from '@/services/audit'
import { id } from '@/lib/id'
import { logger } from '@/lib/logger'
import {
  createFeedbackSchema,
  listFeedbackQuerySchema,
  reviewFeedbackSchema,
} from '@/lib/validations/feedback'

export async function POST(request: NextRequest) {
  const authResult = await authenticateWithScope(request, 'feedback:write')
  if (!authResult.success) {
    return NextResponse.json(
      { success: false, error: { code: 'AUTH_ERROR', message: authResult.error } },
      { status: authResult.status }
    )
  }

  try {
    const body = await request.json()
    const parsed = createFeedbackSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Validation failed', details: parsed.error.flatten() } },
        { status: 400 }
      )
    }

    const { serverIdentifier, steamId, playerName, category, responses } = parsed.data

    const server = await prisma.serverIdentifier.findFirst({
      where: { hashedId: serverIdentifier },
      select: { id: true },
    })

    if (!server) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Server not found' } },
        { status: 404 }
      )
    }

    const feedbackId = id.feedback()
    const feedback = await prisma.feedback.create({
      data: {
        id: feedbackId,
        serverIdentifier,
        steamId,
        playerName,
        category,
        responses,
        status: 'pending',
      },
    })

    await auditCreate('feedback', feedbackId, authResult.context, {
      serverIdentifier,
      steamId,
      playerName,
      category,
    }, request)

    logger.admin.info('Feedback submitted', {
      id: feedbackId,
      serverIdentifier,
      steamId,
      category,
    })

    return NextResponse.json({ success: true, data: { id: feedback.id } }, { status: 201 })
  } catch (error) {
    logger.admin.error('Failed to submit feedback', error as Error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to submit feedback' } },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  const authResult = await authenticateWithScope(request, 'feedback:read')
  if (!authResult.success) {
    return NextResponse.json(
      { success: false, error: { code: 'AUTH_ERROR', message: authResult.error } },
      { status: authResult.status }
    )
  }

  // Auto-cleanup: delete denied feedback older than 30 days (fire and forget)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  prisma.feedback.deleteMany({
    where: {
      status: 'denied',
      reviewedAt: { lt: thirtyDaysAgo },
    },
  }).then((result) => {
    if (result.count > 0) {
      logger.admin.info('Auto-cleaned denied feedback', { deleted: result.count })
    }
  }).catch(() => {})

  try {
    const { searchParams } = new URL(request.url)
    const parsed = listFeedbackQuerySchema.safeParse({
      page: searchParams.get('page') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
      serverIdentifier: searchParams.get('serverIdentifier') ?? undefined,
      status: searchParams.get('status') ?? undefined,
      category: searchParams.get('category') ?? undefined,
    })

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid query parameters', details: parsed.error.flatten() } },
        { status: 400 }
      )
    }

    const { page, limit, serverIdentifier, status, category } = parsed.data

    const where: Record<string, unknown> = {}
    if (serverIdentifier) where.serverIdentifier = serverIdentifier
    if (status && status !== 'all') where.status = status
    if (category && category !== 'all') where.category = category

    const [feedbackList, total] = await Promise.all([
      prisma.feedback.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { reward: { select: { id: true, status: true, amount: true, processedAt: true } } },
      }),
      prisma.feedback.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      data: feedbackList,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    })
  } catch (error) {
    logger.admin.error('Failed to list feedback', error as Error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to list feedback' } },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  const authResult = await requireSession(request)
  if (!authResult.success) {
    return NextResponse.json(
      { success: false, error: { code: 'AUTH_ERROR', message: authResult.error } },
      { status: authResult.status }
    )
  }

  try {
    const body = await request.json()
    const parsed = reviewFeedbackSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Validation failed', details: parsed.error.flatten() } },
        { status: 400 }
      )
    }

    const { id: feedbackId, action, rewardAmount } = parsed.data

    const existing = await prisma.feedback.findUnique({
      where: { id: feedbackId },
      select: { id: true, status: true, serverIdentifier: true, steamId: true, playerName: true },
    })

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Feedback not found' } },
        { status: 404 }
      )
    }

    if (existing.status !== 'pending') {
      return NextResponse.json(
        { success: false, error: { code: 'CONFLICT', message: 'Feedback already reviewed' } },
        { status: 409 }
      )
    }

    const now = new Date()

    if (action === 'accept') {
      const rewardId = id.feedbackReward()

      await prisma.$transaction([
        prisma.feedback.update({
          where: { id: feedbackId },
          data: {
            status: 'accepted',
            rewardAmount,
            reviewedBy: authResult.context.actorId,
            reviewedAt: now,
          },
        }),
        prisma.feedbackReward.create({
          data: {
            id: rewardId,
            feedbackId,
            serverIdentifier: existing.serverIdentifier,
            steamId: existing.steamId,
            playerName: existing.playerName,
            amount: rewardAmount,
            status: 'pending',
          },
        }),
      ])

      await auditUpdate('feedback', feedbackId, authResult.context,
        { status: 'pending' },
        { status: 'accepted', rewardAmount, rewardId },
        request
      )

      logger.admin.info('Feedback accepted', {
        feedbackId,
        rewardId,
        rewardAmount,
        actor: authResult.context.actorId,
      })

      return NextResponse.json({ success: true, data: { id: feedbackId, status: 'accepted', rewardId } })
    } else {
      await prisma.feedback.update({
        where: { id: feedbackId },
        data: {
          status: 'denied',
          reviewedBy: authResult.context.actorId,
          reviewedAt: now,
        },
      })

      await auditUpdate('feedback', feedbackId, authResult.context,
        { status: 'pending' },
        { status: 'denied' },
        request
      )

      logger.admin.info('Feedback denied', {
        feedbackId,
        actor: authResult.context.actorId,
      })

      return NextResponse.json({ success: true, data: { id: feedbackId, status: 'denied' } })
    }
  } catch (error) {
    logger.admin.error('Failed to review feedback', error as Error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to review feedback' } },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  const authResult = await requireSession(request)
  if (!authResult.success) {
    return NextResponse.json(
      { success: false, error: { code: 'AUTH_ERROR', message: authResult.error } },
      { status: authResult.status }
    )
  }

  try {
    const { searchParams } = new URL(request.url)
    const feedbackId = searchParams.get('id')

    if (!feedbackId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Feedback ID is required' } },
        { status: 400 }
      )
    }

    const existing = await prisma.feedback.findUnique({
      where: { id: feedbackId },
      select: { id: true, status: true, steamId: true, playerName: true },
    })

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Feedback not found' } },
        { status: 404 }
      )
    }

    // Delete associated rewards first if any
    await prisma.feedbackReward.deleteMany({
      where: { feedbackId },
    })

    // Delete the feedback
    await prisma.feedback.delete({
      where: { id: feedbackId },
    })

    logger.admin.info('Feedback deleted', {
      feedbackId,
      actor: authResult.context.actorId,
    })

    return NextResponse.json({ success: true, data: { id: feedbackId } })
  } catch (error) {
    logger.admin.error('Failed to delete feedback', error as Error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete feedback' } },
      { status: 500 }
    )
  }
}
