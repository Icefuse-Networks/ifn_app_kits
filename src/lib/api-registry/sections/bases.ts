import { Home } from 'lucide-react'
import type { SectionDef } from '../types'

export const basesSection: SectionDef = {
  id: 'bases',
  label: 'Bases',
  icon: Home,
  endpoints: [
    {
      method: 'GET', path: '/api/bases', title: 'List Base Configs',
      description: 'Returns all base configurations.',
      auth: 'bearer', scope: 'kits:read',
    },
    {
      method: 'POST', path: '/api/bases', title: 'Create Base Config',
      description: 'Creates a new base configuration.',
      auth: 'bearer', scope: 'kits:write',
      bodyExample: '{\n  "name": "Starter Base",\n  "data": "{}"\n}',
    },
    {
      method: 'GET', path: '/api/bases/{id}', title: 'Get Base Config',
      description: 'Returns a single base configuration.',
      auth: 'bearer', scope: 'kits:read',
      params: [{ name: 'id', in: 'path', type: 'string', required: true, description: 'Base config ID' }],
    },
    {
      method: 'PUT', path: '/api/bases/{id}', title: 'Update Base Config',
      description: 'Updates a base configuration.',
      auth: 'bearer', scope: 'kits:write',
      params: [{ name: 'id', in: 'path', type: 'string', required: true, description: 'Base config ID' }],
      bodyExample: '{\n  "name": "Updated Base"\n}',
    },
    {
      method: 'DELETE', path: '/api/bases/{id}', title: 'Delete Base Config',
      description: 'Permanently deletes a base configuration.',
      auth: 'bearer', scope: 'kits:write',
      params: [{ name: 'id', in: 'path', type: 'string', required: true, description: 'Base config ID' }],
    },
    {
      method: 'POST', path: '/api/bases/{id}/publish', title: 'Publish Version',
      description: 'Publishes the current base config as a versioned release.',
      auth: 'bearer', scope: 'kits:write',
      params: [{ name: 'id', in: 'path', type: 'string', required: true, description: 'Base config ID' }],
    },
    {
      method: 'GET', path: '/api/bases/{id}/versions', title: 'List Versions',
      description: 'Returns the version history for a base configuration.',
      auth: 'bearer', scope: 'kits:read',
      params: [{ name: 'id', in: 'path', type: 'string', required: true, description: 'Base config ID' }],
    },
    {
      method: 'GET', path: '/api/bases/download', title: 'Plugin Download',
      description: 'Used by the plugin to download the live published base config.',
      auth: 'bearer', scope: 'kits:read',
      params: [{ name: 'serverId', in: 'query', type: 'string', required: true, description: 'Server identifier ID' }],
    },
    {
      method: 'GET', path: '/api/bases/files', title: 'List Base Files',
      description: 'Returns available base file assets.',
      auth: 'bearer', scope: 'kits:read',
    },
    {
      method: 'GET', path: '/api/bases/stats', title: 'Base Statistics',
      description: 'Returns usage and deployment statistics for base configurations.',
      auth: 'bearer', scope: 'analytics:read',
    },
    {
      method: 'GET', path: '/api/bases/mappings', title: 'List Mappings',
      description: 'Returns all server → base config mappings.',
      auth: 'bearer', scope: 'kits:read',
    },
    {
      method: 'POST', path: '/api/bases/mappings', title: 'Create Mapping',
      description: 'Maps a server to a base configuration.',
      auth: 'bearer', scope: 'kits:write',
      bodyExample: '{\n  "serverId": "serverid_xxx",\n  "baseConfigId": "basecfg_xxx"\n}',
    },
    {
      method: 'DELETE', path: '/api/bases/mappings', title: 'Delete Mapping',
      description: 'Removes a server → base config mapping.',
      auth: 'bearer', scope: 'kits:write',
      bodyExample: '{\n  "serverId": "serverid_xxx"\n}',
    },
  ],
}
