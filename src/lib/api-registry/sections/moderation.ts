import { Shield } from 'lucide-react'
import type { SectionDef } from '../types'

export const moderationSection: SectionDef = {
  id: 'moderation',
  label: 'Moderation',
  icon: Shield,
  endpoints: [
    {
      method: 'GET', path: '/api/admin/moderation/banned-words', title: 'List Banned Words',
      description: 'Returns all banned word patterns used for content moderation.',
      auth: 'session',
    },
    {
      method: 'POST', path: '/api/admin/moderation/banned-words', title: 'Add Banned Word',
      description: 'Adds a new word or pattern to the banned word list.',
      auth: 'session',
      bodyExample: '{\n  "pattern": "badword",\n  "severity": "high"\n}',
    },
    {
      method: 'PATCH', path: '/api/admin/moderation/banned-words/{id}', title: 'Update Banned Word',
      description: 'Updates a banned word pattern.',
      auth: 'session',
      params: [{ name: 'id', in: 'path', type: 'string', required: true, description: 'Banned word ID' }],
      bodyExample: '{\n  "severity": "medium"\n}',
    },
    {
      method: 'DELETE', path: '/api/admin/moderation/banned-words/{id}', title: 'Remove Banned Word',
      description: 'Removes a word pattern from the ban list.',
      auth: 'session',
      params: [{ name: 'id', in: 'path', type: 'string', required: true, description: 'Banned word ID' }],
    },
    {
      method: 'POST', path: '/api/admin/moderation/banned-words/check', title: 'Check Content',
      description: 'Checks whether a string contains any banned words. Returns matching patterns.',
      auth: 'session',
      bodyExample: '{\n  "content": "Text to check for banned content"\n}',
    },
  ],
}
