import { MessageSquare } from 'lucide-react'
import type { SectionDef } from '../types'

export const feedbackSection: SectionDef = {
  id: 'feedback',
  label: 'Feedback',
  icon: MessageSquare,
  endpoints: [
    {
      method: 'GET', path: '/api/feedback', title: 'List Feedback',
      description: 'Returns all feedback submissions.',
      auth: 'bearer', scope: 'analytics:read',
    },
    {
      method: 'POST', path: '/api/feedback', title: 'Submit Feedback',
      description: 'Submits a new feedback entry.',
      auth: 'bearer', scope: 'analytics:write',
      bodyExample: '{\n  "steamId": "76561198...",\n  "content": "Great server!",\n  "rating": 5,\n  "serverId": "serverid_xxx"\n}',
    },
    {
      method: 'PATCH', path: '/api/feedback', title: 'Update Feedback',
      description: 'Updates feedback status or moderation flags.',
      auth: 'bearer', scope: 'analytics:write',
      bodyExample: '{\n  "id": "fb_xxx",\n  "status": "approved"\n}',
    },
    {
      method: 'DELETE', path: '/api/feedback', title: 'Delete Feedback',
      description: 'Permanently removes a feedback entry.',
      auth: 'bearer', scope: 'analytics:write',
      bodyExample: '{\n  "id": "fb_xxx"\n}',
    },
    {
      method: 'GET', path: '/api/feedback/rewards', title: 'List Feedback Rewards',
      description: 'Returns all feedback reward records.',
      auth: 'bearer', scope: 'analytics:read',
    },
    {
      method: 'PATCH', path: '/api/feedback/rewards', title: 'Update Reward Status',
      description: 'Marks a feedback reward as issued.',
      auth: 'bearer', scope: 'analytics:write',
      bodyExample: '{\n  "id": "fbrw_xxx",\n  "issued": true\n}',
    },
  ],
}
