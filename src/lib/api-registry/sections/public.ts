import { Globe } from 'lucide-react'
import type { SectionDef } from '../types'

export const publicSection: SectionDef = {
  id: 'public',
  label: 'Public API',
  icon: Globe,
  endpoints: [
    {
      method: 'GET', path: '/api/public/kits', title: 'Store Kits',
      description: 'Returns all store kits for display in the PayNow store. No authentication required.',
      auth: 'none',
    },
    {
      method: 'GET', path: '/api/public/kits/{name}', title: 'Store Kit by Name',
      description: 'Returns a specific store kit with full item details. No authentication required.',
      auth: 'none',
      params: [{ name: 'name', in: 'path', type: 'string', required: true, description: 'Kit name (URL-encoded)' }],
    },
    {
      method: 'GET', path: '/api/public/identifiers', title: 'Public Server List',
      description: 'Returns the list of servers for public display (e.g. server selector dropdowns). No auth required.',
      auth: 'none',
    },
    {
      method: 'GET', path: '/api/public/leaderboards', title: 'Leaderboards',
      description: 'Returns public leaderboard data — top kits, top players, activity heat map. No auth required.',
      auth: 'none',
    },
    {
      method: 'GET', path: '/api/public/stats', title: 'Public Stats',
      description: 'Returns public platform stats — player counts and clan counts per server. No auth required.',
      auth: 'none',
    },
  ],
}
