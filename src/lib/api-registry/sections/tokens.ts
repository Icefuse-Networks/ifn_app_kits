import { Key } from 'lucide-react'
import type { SectionDef } from '../types'

export const tokensSection: SectionDef = {
  id: 'tokens',
  label: 'API Tokens',
  icon: Key,
  endpoints: [
    {
      method: 'GET', path: '/api/tokens', title: 'List Tokens',
      description: 'Returns all API tokens. Token hashes are never returned — only prefix and metadata.',
      auth: 'session',
    },
    {
      method: 'POST', path: '/api/tokens', title: 'Create Token',
      description: 'Creates a new API token. The full token value is only returned once in the response.',
      auth: 'session',
      bodyExample: '{\n  "name": "Rust Plugin",\n  "scopes": ["kits:read", "kits:write"],\n  "categoryId": "tokcat_xxx",\n  "expiresAt": "2025-01-01T00:00:00Z"\n}',
    },
    {
      method: 'GET', path: '/api/tokens/{id}', title: 'Get Token',
      description: 'Returns metadata for a single API token.',
      auth: 'session',
      params: [{ name: 'id', in: 'path', type: 'string', required: true, description: 'Token ID (apitoken_...)' }],
    },
    {
      method: 'PUT', path: '/api/tokens/{id}', title: 'Update Token',
      description: "Updates a token's name, scopes, or category.",
      auth: 'session',
      params: [{ name: 'id', in: 'path', type: 'string', required: true, description: 'Token ID' }],
      bodyExample: '{\n  "name": "Updated Name",\n  "scopes": ["kits:read"]\n}',
    },
    {
      method: 'DELETE', path: '/api/tokens/{id}', title: 'Revoke Token',
      description: 'Revokes a token immediately. All subsequent requests using this token will be rejected.',
      auth: 'session',
      params: [{ name: 'id', in: 'path', type: 'string', required: true, description: 'Token ID' }],
    },
    {
      method: 'GET', path: '/api/token-categories', title: 'List Token Categories',
      description: 'Returns all token organization categories.',
      auth: 'session',
    },
    {
      method: 'POST', path: '/api/token-categories', title: 'Create Token Category',
      description: 'Creates a new category for organizing API tokens.',
      auth: 'session',
      bodyExample: '{\n  "name": "Kits Plugin",\n  "description": "Tokens for kit management",\n  "color": "#3b82f6"\n}',
    },
  ],
}
