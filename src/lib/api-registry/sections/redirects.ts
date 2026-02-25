import { Navigation } from 'lucide-react'
import type { SectionDef } from '../types'

export const redirectsSection: SectionDef = {
  id: 'redirects',
  label: 'Redirects',
  icon: Navigation,
  endpoints: [
    {
      method: 'GET', path: '/api/redirect/config', title: 'Get Redirect Config',
      description: 'Returns the current redirect configuration for a server.',
      auth: 'bearer', scope: 'servers:read',
      params: [{ name: 'serverId', in: 'query', type: 'string', required: true, description: 'Server identifier ID' }],
    },
    {
      method: 'GET', path: '/api/redirect/analytics', title: 'Redirect Analytics',
      description: 'Returns redirect event statistics and success rates.',
      auth: 'bearer', scope: 'analytics:read',
    },
    {
      method: 'GET', path: '/api/redirect/wipe-schedules', title: 'List Wipe Schedules',
      description: 'Returns all configured wipe schedules.',
      auth: 'bearer', scope: 'servers:read',
    },
    {
      method: 'POST', path: '/api/redirect/wipe-schedules', title: 'Create Wipe Schedule',
      description: 'Creates a new automated wipe schedule.',
      auth: 'bearer', scope: 'servers:write',
      bodyExample: '{\n  "serverId": "serverid_xxx",\n  "cron": "0 0 * * 4",\n  "label": "Thursday Wipe"\n}',
    },
    {
      method: 'DELETE', path: '/api/redirect/wipe-schedules', title: 'Delete Wipe Schedule',
      description: 'Removes a wipe schedule.',
      auth: 'bearer', scope: 'servers:write',
      bodyExample: '{\n  "id": "wipesched_xxx"\n}',
    },
    {
      method: 'GET', path: '/api/redirect/wipe-schedules/next', title: 'Next Scheduled Wipe',
      description: 'Returns the next upcoming wipe for a server based on its schedule.',
      auth: 'bearer', scope: 'servers:read',
      params: [{ name: 'serverId', in: 'query', type: 'string', required: true, description: 'Server identifier ID' }],
    },
  ],
}
