import { Gift } from 'lucide-react'
import type { SectionDef } from '../types'

export const giveawaysSection: SectionDef = {
  id: 'giveaways',
  label: 'Giveaways',
  icon: Gift,
  endpoints: [
    {
      method: 'GET', path: '/api/giveaway', title: 'Get Active Giveaway',
      description: 'Returns the currently active giveaway.',
      auth: 'bearer', scope: 'kits:read',
    },
    {
      method: 'POST', path: '/api/giveaway', title: 'Create Giveaway',
      description: 'Creates a new giveaway.',
      auth: 'bearer', scope: 'kits:write',
      bodyExample: '{\n  "prize": "VIP Package",\n  "endsAt": "2024-02-01T00:00:00Z"\n}',
    },
    {
      method: 'GET', path: '/api/admin/giveaways', title: 'List All Giveaways',
      description: 'Returns all giveaways with full admin data.',
      auth: 'session',
    },
    {
      method: 'GET', path: '/api/admin/giveaways/players', title: 'List Giveaway Players',
      description: 'Returns all player entries for giveaways.',
      auth: 'session',
    },
    {
      method: 'POST', path: '/api/admin/giveaways/players', title: 'Add Giveaway Player',
      description: 'Adds a player to a giveaway entry list.',
      auth: 'session',
      bodyExample: '{\n  "giveawayId": "giveaway_xxx",\n  "steamId": "76561198..."\n}',
    },
  ],
}
