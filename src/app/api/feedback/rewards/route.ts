import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { authenticateWithScope } from '@/services/api-auth'
import { auditUpdate } from '@/services/audit'
import { logger } from '@/lib/logger'
import {
  listRewardsQuerySchema,
  updateRewardSchema,
} from '@/lib/validations/feedback'

export async function GET(request: NextRequest) {
  const authResult = await authenticateWithScope(request, 'feedback:read')
  if (!authResult.success) {
    return NextResponse.json(
      { success: false, error: { code: 'AUTH_ERROR', message: authResult.error } },
      { status: authResult.status }
    )
  }

  try {
    const { searchParams } = new URL(request.url)
    const parsed = listRewardsQuerySchema.safeParse({
      serverIdentifier: searchParams.get('serverIdentifier') ?? undefined,
      status: searchParams.get('status') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
    })

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid query parameters', details: parsed.error.flatten() } },
        { status: 400 }
      )
    }

    const { serverIdentifier, status, limit } = parsed.data

    const rewards = await prisma.feedbackReward.findMany({
      where: { serverIdentifier, status },
      orderBy: { createdAt: 'asc' },
      take: limit,
    })

    return NextResponse.json({ success: true, data: rewards })
  } catch (error) {
    logger.admin.error('Failed to list feedback rewards', error as Error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to list rewards' } },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  return handleRewardUpdate(request)
}

export async function PATCH(request: NextRequest) {
  return handleRewardUpdate(request)
}

async function handleRewardUpdate(request: NextRequest) {
  const authResult = await authenticateWithScope(request, 'feedback:write')
  if (!authResult.success) {
    return NextResponse.json(
      { success: false, error: { code: 'AUTH_ERROR', message: authResult.error } },
      { status: authResult.status }
    )
  }

  try {
    const body = await request.json()
    const parsed = updateRewardSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Validation failed', details: parsed.error.flatten() } },
        { status: 400 }
      )
    }

    const { id: rewardId, status } = parsed.data

    const result = await prisma.feedbackReward.updateMany({
      where: { id: rewardId, status: 'pending' },
      data: { status, processedAt: new Date() },
    })

    if (result.count === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Reward not found or already processed' } },
        { status: 404 }
      )
    }

    await auditUpdate('feedback_reward', rewardId, authResult.context,
      { status: 'pending' },
      { status },
      request
    )

    logger.admin.info('Feedback reward updated', {
      rewardId,
      status,
      actor: authResult.context.actorId,
    })

    return NextResponse.json({ success: true, data: { id: rewardId, status } })
  } catch (error) {
    logger.admin.error('Failed to update feedback reward', error as Error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update reward' } },
      { status: 500 }
    )
  }
}
