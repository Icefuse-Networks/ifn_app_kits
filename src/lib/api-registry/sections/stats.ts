import { TrendingUp } from 'lucide-react'
import type { SectionDef } from '../types'

export const statsSection: SectionDef = {
  id: 'stats',
  label: 'Stats',
  icon: TrendingUp,
  endpoints: [
    {
      method: 'GET', path: '/api/stats', title: 'General Stats',
      description: 'Returns general platform statistics — total kits, servers, redemptions.',
      auth: 'bearer', scope: 'analytics:read',
    },
    {
      method: 'GET', path: '/api/stats/player/{steamId}', title: 'Player Stats',
      description: 'Returns kit usage statistics for a specific player by Steam ID.',
      auth: 'bearer', scope: 'analytics:read',
      params: [{ name: 'steamId', in: 'path', type: 'string', required: true, description: 'Player Steam ID (17 digits)' }],
    },
    {
      method: 'GET', path: '/api/stats/events', title: 'Events Stats',
      description: 'Returns event completion statistics.',
      auth: 'bearer', scope: 'analytics:read',
    },
  ],
}
