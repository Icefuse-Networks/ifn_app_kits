import { z } from 'zod'

const feedbackResponseSchema = z.object({
  question: z.string().min(1).max(200),
  answer: z.string().min(1).max(2000),
})

export const createFeedbackSchema = z.object({
  serverIdentifier: z.string().min(1).max(60),
  steamId: z.string().regex(/^\d{17}$/, 'Steam ID must be 17 digits'),
  playerName: z.string().min(1).max(100),
  category: z.enum(['server_feedback', 'bug_report']),
  responses: z.array(feedbackResponseSchema).min(1).max(10),
})

export const listFeedbackQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(25),
  serverIdentifier: z.string().optional(),
  status: z.enum(['pending', 'accepted', 'denied', 'all']).default('all'),
  category: z.enum(['server_feedback', 'bug_report', 'all']).default('all'),
})

export const reviewFeedbackSchema = z.object({
  id: z.string().min(1).max(60),
  action: z.enum(['accept', 'deny']),
  rewardAmount: z.number().int().min(0).max(1000000).default(1000),
})

export const listRewardsQuerySchema = z.object({
  serverIdentifier: z.string().min(1).max(60),
  status: z.enum(['pending', 'completed', 'failed']).default('pending'),
  limit: z.coerce.number().min(1).max(50).default(20),
})

export const updateRewardSchema = z.object({
  id: z.string().min(1).max(60),
  status: z.enum(['completed', 'failed']),
})

export type CreateFeedbackInput = z.infer<typeof createFeedbackSchema>
export type ReviewFeedbackInput = z.infer<typeof reviewFeedbackSchema>
export type UpdateRewardInput = z.infer<typeof updateRewardSchema>
