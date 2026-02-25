import { Hash } from 'lucide-react'
import type { SectionDef } from '../types'

export const identifiersSection: SectionDef = {
  id: 'identifiers',
  label: 'Server Identifiers',
  icon: Hash,
  endpoints: [
    {
      method: 'GET', path: '/api/identifiers', title: 'List Identifiers',
      description: 'Returns all server identifiers.',
      auth: 'bearer', scope: 'servers:read',
    },
    {
      method: 'POST', path: '/api/identifiers', title: 'Create Identifier',
      description: 'Creates a new server identifier for organizing servers.',
      auth: 'bearer', scope: 'servers:write',
      bodyExample: '{\n  "name": "Main Cluster",\n  "description": "Primary server group"\n}',
    },
    {
      method: 'GET', path: '/api/identifiers/{id}', title: 'Get Identifier',
      description: 'Returns a single identifier by its prefixed ID.',
      auth: 'bearer', scope: 'servers:read',
      params: [{ name: 'id', in: 'path', type: 'string', required: true, description: 'Identifier ID (serverid_...)' }],
    },
    {
      method: 'PATCH', path: '/api/identifiers/{id}', title: 'Update Identifier',
      description: "Updates an identifier's name, description, or category assignment.",
      auth: 'bearer', scope: 'servers:write',
      params: [{ name: 'id', in: 'path', type: 'string', required: true, description: 'Identifier ID' }],
      bodyExample: '{\n  "name": "Updated Name"\n}',
    },
    {
      method: 'DELETE', path: '/api/identifiers/{id}', title: 'Delete Identifier',
      description: 'Permanently deletes a server identifier.',
      auth: 'bearer', scope: 'servers:write',
      params: [{ name: 'id', in: 'path', type: 'string', required: true, description: 'Identifier ID' }],
    },
    {
      method: 'POST', path: '/api/identifiers/register', title: 'Auto-Register (Plugin)',
      description: 'Called by the Rust plugin on startup to automatically register or update its server identifier.',
      auth: 'bearer', scope: 'servers:write',
      bodyExample: '{\n  "serverId": "serverid_xxx",\n  "ip": "192.168.1.1",\n  "port": 28015\n}',
    },
    {
      method: 'POST', path: '/api/identifiers/players', title: 'Update Players',
      description: 'Bulk-updates the player list associated with a server identifier.',
      auth: 'bearer', scope: 'servers:write',
      bodyExample: '{\n  "serverId": "serverid_xxx",\n  "players": [{ "steamId": "76561198...", "name": "Player" }]\n}',
    },
    {
      method: 'GET', path: '/api/identifiers/redirect-queue', title: 'Poll Redirect Queue',
      description: 'Fetches pending server redirect commands for a plugin to process.',
      auth: 'bearer', scope: 'servers:read',
      params: [{ name: 'serverId', in: 'query', type: 'string', required: true, description: 'Server identifier ID' }],
    },
    {
      method: 'POST', path: '/api/identifiers/redirect-queue', title: 'Queue Redirect',
      description: 'Adds a player redirect command to the queue.',
      auth: 'bearer', scope: 'servers:write',
      bodyExample: '{\n  "targetServerId": "serverid_yyy",\n  "steamId": "76561198..."\n}',
    },
    {
      method: 'PATCH', path: '/api/identifiers/redirect-queue', title: 'Mark Redirect Processed',
      description: 'Marks a queued redirect as processed by the plugin.',
      auth: 'bearer', scope: 'servers:write',
      bodyExample: '{\n  "id": "redirq_xxx"\n}',
    },
    {
      method: 'DELETE', path: '/api/identifiers/redirect-queue', title: 'Remove from Queue',
      description: 'Removes a redirect command from the queue.',
      auth: 'bearer', scope: 'servers:write',
      bodyExample: '{\n  "id": "redirq_xxx"\n}',
    },
    {
      method: 'GET', path: '/api/identifier-categories', title: 'List Identifier Categories',
      description: 'Returns all server identifier categories.',
      auth: 'bearer', scope: 'servers:read',
    },
    {
      method: 'POST', path: '/api/identifier-categories', title: 'Create Identifier Category',
      description: 'Creates a new category for organizing server identifiers.',
      auth: 'bearer', scope: 'servers:write',
      bodyExample: '{\n  "name": "Production",\n  "description": "Live servers"\n}',
    },
    {
      method: 'PUT', path: '/api/identifier-categories/{id}', title: 'Update Identifier Category',
      description: 'Updates an identifier category.',
      auth: 'bearer', scope: 'servers:write',
      params: [{ name: 'id', in: 'path', type: 'string', required: true, description: 'Category ID' }],
      bodyExample: '{\n  "name": "Staging"\n}',
    },
    {
      method: 'DELETE', path: '/api/identifier-categories/{id}', title: 'Delete Identifier Category',
      description: 'Permanently deletes an identifier category.',
      auth: 'bearer', scope: 'servers:write',
      params: [{ name: 'id', in: 'path', type: 'string', required: true, description: 'Category ID' }],
    },
  ],
}
