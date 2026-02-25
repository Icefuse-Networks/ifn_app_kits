import { Sword } from 'lucide-react'
import type { SectionDef } from '../types'

export const lootmanagerSection: SectionDef = {
  id: 'lootmanager',
  label: 'Loot Manager',
  icon: Sword,
  endpoints: [
    {
      method: 'GET', path: '/api/lootmanager', title: 'List Loot Configs',
      description: 'Returns all loot manager configurations.',
      auth: 'bearer', scope: 'kits:read',
    },
    {
      method: 'POST', path: '/api/lootmanager', title: 'Create Loot Config',
      description: 'Creates a new loot configuration.',
      auth: 'bearer', scope: 'kits:write',
      bodyExample: '{\n  "name": "Default Loot",\n  "data": "{}"\n}',
    },
    {
      method: 'GET', path: '/api/lootmanager/{id}', title: 'Get Loot Config',
      description: 'Returns a single loot configuration.',
      auth: 'bearer', scope: 'kits:read',
      params: [{ name: 'id', in: 'path', type: 'string', required: true, description: 'Loot config ID' }],
    },
    {
      method: 'PUT', path: '/api/lootmanager/{id}', title: 'Update Loot Config',
      description: "Replaces a loot configuration's data.",
      auth: 'bearer', scope: 'kits:write',
      params: [{ name: 'id', in: 'path', type: 'string', required: true, description: 'Loot config ID' }],
      bodyExample: '{\n  "name": "Updated Loot",\n  "data": "{...}"\n}',
    },
    {
      method: 'DELETE', path: '/api/lootmanager/{id}', title: 'Delete Loot Config',
      description: 'Permanently deletes a loot configuration.',
      auth: 'bearer', scope: 'kits:write',
      params: [{ name: 'id', in: 'path', type: 'string', required: true, description: 'Loot config ID' }],
    },
    {
      method: 'POST', path: '/api/lootmanager/{id}/publish', title: 'Publish Version',
      description: 'Publishes the current loot config as a new versioned release.',
      auth: 'bearer', scope: 'kits:write',
      params: [{ name: 'id', in: 'path', type: 'string', required: true, description: 'Loot config ID' }],
    },
    {
      method: 'GET', path: '/api/lootmanager/{id}/versions', title: 'List Versions',
      description: 'Returns the version history for a loot configuration.',
      auth: 'bearer', scope: 'kits:read',
      params: [{ name: 'id', in: 'path', type: 'string', required: true, description: 'Loot config ID' }],
    },
    {
      method: 'GET', path: '/api/lootmanager/download', title: 'Plugin Download',
      description: 'Used by the Rust plugin to download the live published loot config for its assigned mapping.',
      auth: 'bearer', scope: 'kits:read',
      params: [{ name: 'serverId', in: 'query', type: 'string', required: true, description: 'Server identifier ID' }],
    },
    {
      method: 'GET', path: '/api/lootmanager/mappings', title: 'List Mappings',
      description: 'Returns all server → loot config mappings.',
      auth: 'bearer', scope: 'kits:read',
    },
    {
      method: 'POST', path: '/api/lootmanager/mappings', title: 'Create Mapping',
      description: 'Maps a server to a loot configuration.',
      auth: 'bearer', scope: 'kits:write',
      bodyExample: '{\n  "serverId": "serverid_xxx",\n  "lootConfigId": "lootcfg_xxx"\n}',
    },
    {
      method: 'DELETE', path: '/api/lootmanager/mappings', title: 'Delete Mapping',
      description: 'Removes a server → loot config mapping.',
      auth: 'bearer', scope: 'kits:write',
      bodyExample: '{\n  "serverId": "serverid_xxx"\n}',
    },
  ],
}
