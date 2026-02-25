import { Users } from 'lucide-react'
import type { SectionDef } from '../types'

export const clansSection: SectionDef = {
  id: 'clans',
  label: 'Clans',
  icon: Users,
  endpoints: [
    {
      method: 'GET', path: '/api/admin/clans', title: 'List Clans',
      description: 'Returns all clans with pagination and optional search/filter.',
      auth: 'session',
      params: [
        { name: 'page', in: 'query', type: 'number', required: false, description: 'Page number' },
        { name: 'limit', in: 'query', type: 'number', required: false, description: 'Results per page (max 100)' },
        { name: 'search', in: 'query', type: 'string', required: false, description: 'Search by name or tag' },
      ],
    },
    {
      method: 'POST', path: '/api/admin/clans', title: 'Create Clan',
      description: 'Creates a new clan.',
      auth: 'session',
      bodyExample: '{\n  "tag": "ICE",\n  "name": "Icefuse",\n  "ownerId": "76561198..."\n}',
    },
    {
      method: 'GET', path: '/api/admin/clans/{id}', title: 'Get Clan',
      description: 'Returns full details for a single clan including members and perks.',
      auth: 'session',
      params: [{ name: 'id', in: 'path', type: 'string', required: true, description: 'Clan ID' }],
    },
    {
      method: 'PATCH', path: '/api/admin/clans/{id}', title: 'Update Clan',
      description: 'Updates clan properties.',
      auth: 'session',
      params: [{ name: 'id', in: 'path', type: 'string', required: true, description: 'Clan ID' }],
      bodyExample: '{\n  "name": "Updated Clan Name"\n}',
    },
    {
      method: 'DELETE', path: '/api/admin/clans/{id}', title: 'Disband Clan',
      description: 'Disbands a clan and removes all members.',
      auth: 'session',
      params: [{ name: 'id', in: 'path', type: 'string', required: true, description: 'Clan ID' }],
    },
    {
      method: 'GET', path: '/api/admin/clans/banned-names', title: 'List Banned Names',
      description: 'Returns all banned clan name/tag patterns.',
      auth: 'session',
    },
    {
      method: 'POST', path: '/api/admin/clans/banned-names', title: 'Add Banned Name',
      description: 'Adds a new pattern to the clan name ban list.',
      auth: 'session',
      bodyExample: '{\n  "pattern": "badword",\n  "reason": "Offensive term"\n}',
    },
    {
      method: 'DELETE', path: '/api/admin/clans/banned-names/{id}', title: 'Remove Banned Name',
      description: 'Removes a pattern from the clan name ban list.',
      auth: 'session',
      params: [{ name: 'id', in: 'path', type: 'string', required: true, description: 'Banned name ID' }],
    },
    {
      method: 'POST', path: '/api/admin/clans/banned-names/check', title: 'Check Name',
      description: 'Checks if a given clan tag or name matches any banned pattern.',
      auth: 'session',
      bodyExample: '{\n  "name": "TestClan",\n  "tag": "TST"\n}',
    },
    {
      method: 'GET', path: '/api/admin/clans/perks', title: 'List Perk Definitions',
      description: 'Returns all clan perk definitions available for assignment.',
      auth: 'session',
    },
    {
      method: 'POST', path: '/api/admin/clans/perks', title: 'Create Perk Definition',
      description: 'Creates a new clan perk that can be assigned to clans.',
      auth: 'session',
      bodyExample: '{\n  "name": "VIP Perk",\n  "description": "Access to VIP resources",\n  "maxLevel": 5\n}',
    },
    {
      method: 'PATCH', path: '/api/admin/clans/perks/{id}', title: 'Update Perk Definition',
      description: 'Updates an existing clan perk definition.',
      auth: 'session',
      params: [{ name: 'id', in: 'path', type: 'string', required: true, description: 'Perk definition ID' }],
      bodyExample: '{\n  "name": "Updated Perk"\n}',
    },
    {
      method: 'DELETE', path: '/api/admin/clans/perks/{id}', title: 'Delete Perk Definition',
      description: 'Permanently deletes a clan perk definition.',
      auth: 'session',
      params: [{ name: 'id', in: 'path', type: 'string', required: true, description: 'Perk definition ID' }],
    },
  ],
}
