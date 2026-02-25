import { Server } from 'lucide-react'
import type { SectionDef } from '../types'

export const serversSection: SectionDef = {
  id: 'servers',
  label: 'Game Servers',
  icon: Server,
  endpoints: [
    {
      method: 'GET', path: '/api/servers', title: 'List Game Servers',
      description: 'Returns all registered game servers.',
      auth: 'bearer', scope: 'servers:read',
    },
    {
      method: 'POST', path: '/api/servers', title: 'Create Game Server',
      description: 'Registers a new game server.',
      auth: 'bearer', scope: 'servers:write',
      bodyExample: '{\n  "categoryID": 1,\n  "name": "5x Server",\n  "ip": "192.168.1.1",\n  "port": 28015,\n  "imageUrl": "https://...",\n  "iconUrl": "https://..."\n}',
    },
    {
      method: 'GET', path: '/api/servers/{id}', title: 'Get Game Server',
      description: 'Returns a single game server by ID.',
      auth: 'bearer', scope: 'servers:read',
      params: [{ name: 'id', in: 'path', type: 'number', required: true, description: 'Server ID' }],
    },
    {
      method: 'PUT', path: '/api/servers/{id}', title: 'Update Game Server',
      description: 'Updates game server properties. All fields are optional.',
      auth: 'bearer', scope: 'servers:write',
      params: [{ name: 'id', in: 'path', type: 'number', required: true, description: 'Server ID' }],
      bodyExample: '{\n  "name": "Updated Name",\n  "kitConfigId": "category_xxx"\n}',
    },
    {
      method: 'DELETE', path: '/api/servers/{id}', title: 'Delete Game Server',
      description: 'Permanently deletes a game server.',
      auth: 'bearer', scope: 'servers:write',
      params: [{ name: 'id', in: 'path', type: 'number', required: true, description: 'Server ID' }],
    },
    {
      method: 'GET', path: '/api/servers/kits', title: 'Plugin: Get Server Kits',
      description: 'Used by the Rust plugin to fetch its assigned kit configuration. Lookup by config ID or config name.',
      auth: 'bearer', scope: 'kits:read',
      params: [
        { name: 'id', in: 'query', type: 'string', required: false, description: 'Kit config ID' },
        { name: 'config', in: 'query', type: 'string', required: false, description: 'Kit config name (legacy)' },
      ],
    },
    {
      method: 'POST', path: '/api/server/players/{serverId}', title: 'Update Server Players',
      description: 'Updates the current online player list for a server.',
      auth: 'bearer', scope: 'servers:write',
      params: [{ name: 'serverId', in: 'path', type: 'string', required: true, description: 'Server identifier' }],
      bodyExample: '{\n  "players": [\n    { "steamId": "76561198...", "name": "PlayerName" }\n  ]\n}',
    },
  ],
}
