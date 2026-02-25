import { ShoppingCart } from 'lucide-react'
import type { SectionDef } from '../types'

export const shopSection: SectionDef = {
  id: 'shop',
  label: 'Shop & Purchases',
  icon: ShoppingCart,
  endpoints: [
    {
      method: 'GET', path: '/api/shop-purchases', title: 'List Purchases',
      description: 'Returns shop purchase records.',
      auth: 'bearer', scope: 'analytics:read',
      params: [
        { name: 'page', in: 'query', type: 'number', required: false, description: 'Page number' },
        { name: 'limit', in: 'query', type: 'number', required: false, description: 'Per page (max 100)' },
      ],
    },
    {
      method: 'POST', path: '/api/shop-purchases', title: 'Record Purchase',
      description: 'Records a new shop purchase event.',
      auth: 'bearer', scope: 'analytics:write',
      bodyExample: '{\n  "steamId": "76561198...",\n  "item": "VIP Package",\n  "amount": 19.99\n}',
    },
    {
      method: 'GET', path: '/api/shop-purchases/analytics', title: 'Purchase Analytics',
      description: 'Returns aggregated purchase analytics — totals, trends, top items.',
      auth: 'bearer', scope: 'analytics:read',
      params: [
        { name: 'startDate', in: 'query', type: 'string', required: false, description: 'Start date (ISO)' },
        { name: 'endDate', in: 'query', type: 'string', required: false, description: 'End date (ISO)' },
      ],
    },
  ],
}
