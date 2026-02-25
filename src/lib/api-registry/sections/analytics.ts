import { BarChart2 } from 'lucide-react'
import type { SectionDef } from '../types'

export const analyticsSection: SectionDef = {
  id: 'analytics',
  label: 'Analytics',
  icon: BarChart2,
  endpoints: [
    {
      method: 'POST', path: '/api/analytics/query', title: 'Query Analytics',
      description: 'Queries kit usage analytics with configurable filters (server, kit name, date range, granularity).',
      auth: 'bearer', scope: 'analytics:read',
      bodyExample: '{\n  "serverId": "serverid_xxx",\n  "startDate": "2024-01-01",\n  "endDate": "2024-01-31",\n  "granularity": "day"\n}',
    },
    {
      method: 'POST', path: '/api/analytics/submit', title: 'Submit Events (Plugin)',
      description: 'Batch-submits kit usage events from the Rust plugin. Events are queued and processed asynchronously.',
      auth: 'bearer', scope: 'analytics:write',
      bodyExample: '{\n  "serverId": "serverid_xxx",\n  "events": [\n    {\n      "kitName": "VIP Kit",\n      "steamId": "76561198...",\n      "timestamp": 1700000000\n    }\n  ]\n}',
    },
    {
      method: 'POST', path: '/api/analytics/wipe', title: 'Register Wipe',
      description: 'Records a server wipe event. Resets per-wipe analytics counters and creates a new wipe record.',
      auth: 'bearer', scope: 'analytics:write',
      bodyExample: '{\n  "serverId": "serverid_xxx",\n  "wipedAt": "2024-02-01T00:00:00Z"\n}',
    },
    {
      method: 'GET', path: '/api/analytics/kit-popularity', title: 'Kit Popularity',
      description: 'Returns the most-redeemed kits across all servers, ranked by total redemption count.',
      auth: 'bearer', scope: 'analytics:read',
      params: [
        { name: 'serverId', in: 'query', type: 'string', required: false, description: 'Filter by server' },
        { name: 'limit', in: 'query', type: 'number', required: false, description: 'Max results (default 10)' },
      ],
    },
    {
      method: 'GET', path: '/api/analytics/usage-trends', title: 'Usage Trends',
      description: 'Returns kit redemption totals grouped by day or week over a date range.',
      auth: 'bearer', scope: 'analytics:read',
      params: [
        { name: 'serverId', in: 'query', type: 'string', required: false, description: 'Filter by server' },
        { name: 'granularity', in: 'query', type: 'string', required: false, description: '"day" or "week"' },
      ],
    },
    {
      method: 'GET', path: '/api/analytics/heat-map', title: 'Usage Heat Map',
      description: 'Returns a 7-day × 24-hour grid of kit redemption activity for heat map visualization.',
      auth: 'bearer', scope: 'analytics:read',
      params: [{ name: 'serverId', in: 'query', type: 'string', required: false, description: 'Filter by server' }],
    },
    {
      method: 'GET', path: '/api/analytics/server-activity', title: 'Server Activity',
      description: 'Returns activity statistics per server — total redemptions, unique players, active kits.',
      auth: 'bearer', scope: 'analytics:read',
    },
    {
      method: 'GET', path: '/api/analytics/server-stats', title: 'Server Stats',
      description: 'Returns aggregated stats per server for the analytics dashboard.',
      auth: 'bearer', scope: 'analytics:read',
    },
  ],
}
