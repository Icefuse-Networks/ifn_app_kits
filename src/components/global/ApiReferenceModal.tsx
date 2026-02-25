'use client'

/**
 * API Reference Modal
 *
 * Full interactive documentation for every API endpoint in the system.
 * URLs are built dynamically from window.location.origin.
 * Each endpoint includes a copyable curl example.
 */

import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import {
  X,
  Copy,
  Check,
  ChevronDown,
  Package,
  Server,
  Hash,
  BarChart2,
  Sword,
  Home,
  Key,
  Users,
  Shield,
  Bell,
  ShoppingCart,
  TrendingUp,
  Gift,
  MessageSquare,
  Activity,
  Navigation,
  Globe,
  BookOpen,
  Terminal,
  Lock,
  Unlock,
  Search,
} from 'lucide-react'

// =============================================================================
// Types
// =============================================================================

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
type AuthType = 'bearer' | 'session' | 'none'

interface ApiParam {
  name: string
  in: 'path' | 'query' | 'body'
  type: string
  required: boolean
  description: string
}

interface ApiEndpointDef {
  method: HttpMethod
  path: string
  title: string
  description: string
  auth: AuthType
  scope?: string
  params?: ApiParam[]
  bodyExample?: string
}

interface ApiSectionDef {
  id: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  endpoints: ApiEndpointDef[]
}

// =============================================================================
// Endpoint Data
// =============================================================================

const SECTIONS: ApiSectionDef[] = [
  {
    id: 'kits',
    label: 'Kits',
    icon: Package,
    endpoints: [
      {
        method: 'GET', path: '/api/kits', title: 'List Kit Configs',
        description: 'Returns all kit configurations. Use ?full=true to include full kitData JSON, ?store=true to include storeData.',
        auth: 'bearer', scope: 'kits:read',
        params: [
          { name: 'full', in: 'query', type: 'boolean', required: false, description: 'Include full kitData JSON' },
          { name: 'store', in: 'query', type: 'boolean', required: false, description: 'Include storeData JSON' },
        ],
      },
      {
        method: 'POST', path: '/api/kits', title: 'Create Kit Config',
        description: 'Creates a new kit configuration with name, description, and kitData JSON blob.',
        auth: 'bearer', scope: 'kits:write',
        bodyExample: '{\n  "name": "5x Server Kits",\n  "description": "Kit config for 5x server",\n  "kitData": "{\\"_kits\\":{},\\"_categories\\":{}}"\n}',
      },
      {
        method: 'GET', path: '/api/kits/{id}', title: 'Get Kit Config',
        description: 'Returns a single kit configuration including full kitData and storeData.',
        auth: 'bearer', scope: 'kits:read',
        params: [{ name: 'id', in: 'path', type: 'string', required: true, description: 'Kit config ID (category_...)' }],
      },
      {
        method: 'PUT', path: '/api/kits/{id}', title: 'Update Kit Config',
        description: 'Replaces the name, description, kitData blob, or storeData blob. All fields are optional — only provided fields are updated.',
        auth: 'bearer', scope: 'kits:write',
        params: [{ name: 'id', in: 'path', type: 'string', required: true, description: 'Kit config ID' }],
        bodyExample: '{\n  "name": "5x Server Kits",\n  "kitData": "{\\"_kits\\":{...}}"\n}',
      },
      {
        method: 'DELETE', path: '/api/kits/{id}', title: 'Delete Kit Config',
        description: 'Permanently deletes a kit configuration and all its associated data.',
        auth: 'bearer', scope: 'kits:write',
        params: [{ name: 'id', in: 'path', type: 'string', required: true, description: 'Kit config ID' }],
      },
      {
        method: 'POST', path: '/api/kits/{id}/clone', title: 'Clone Kit Config',
        description: 'Creates a full copy of a kit configuration with a new name. Copies both kitData and storeData.',
        auth: 'bearer', scope: 'kits:write',
        params: [{ name: 'id', in: 'path', type: 'string', required: true, description: 'Source kit config ID' }],
        bodyExample: '{\n  "name": "5x Server Kits (Copy)",\n  "description": "Cloned from 5x"\n}',
      },
      {
        method: 'PATCH', path: '/api/kits/{id}/kit', title: 'Update Kit in Config',
        description: 'Surgically updates any fields on a single kit within a config. Only provided fields are changed — untouched fields are preserved.',
        auth: 'bearer', scope: 'kits:write',
        params: [{ name: 'id', in: 'path', type: 'string', required: true, description: 'Kit config ID' }],
        bodyExample: '{\n  "kitName": "kit_xxx-yyy-zzz",\n  "updates": {\n    "KitImage": "https://cdn.icefuse.com/products/ranks/vip.webp",\n    "Cooldown": 86400\n  }\n}',
      },
      {
        method: 'POST', path: '/api/kits/{id}/kit', title: 'Add Kit to Config',
        description: 'Adds a new kit entry to an existing config. Returns 409 if a kit with that name already exists.',
        auth: 'bearer', scope: 'kits:write',
        params: [{ name: 'id', in: 'path', type: 'string', required: true, description: 'Kit config ID' }],
        bodyExample: '{\n  "kitName": "kit_new-uuid-here",\n  "kit": {\n    "Name": "VIP Kit",\n    "Description": "For VIP players",\n    "RequiredPermission": "kits.vip",\n    "Cooldown": 86400,\n    "MainItems": [],\n    "WearItems": [],\n    "BeltItems": []\n  }\n}',
      },
      {
        method: 'DELETE', path: '/api/kits/{id}/kit', title: 'Remove Kit from Config',
        description: 'Removes a kit from a configuration by its map key. Returns 404 if the kit is not found.',
        auth: 'bearer', scope: 'kits:write',
        params: [{ name: 'id', in: 'path', type: 'string', required: true, description: 'Kit config ID' }],
        bodyExample: '{\n  "kitName": "kit_xxx-yyy-zzz"\n}',
      },
      {
        method: 'GET', path: '/api/kits/{id}/perks', title: 'Get Kit Perks',
        description: 'Returns the PerksData (categories + uncategorized perks) for a specific kit within the config storeData.',
        auth: 'bearer', scope: 'kits:read',
        params: [
          { name: 'id', in: 'path', type: 'string', required: true, description: 'Kit config ID' },
          { name: 'kitId', in: 'query', type: 'string', required: true, description: 'Kit UUID (e.g. kit_xxx)' },
        ],
      },
      {
        method: 'PUT', path: '/api/kits/{id}/perks', title: 'Set Kit Perks',
        description: 'Replaces all perks for a kit. Creates the perks entry if it does not exist.',
        auth: 'bearer', scope: 'kits:write',
        params: [{ name: 'id', in: 'path', type: 'string', required: true, description: 'Kit config ID' }],
        bodyExample: '{\n  "kitId": "kit_xxx-yyy-zzz",\n  "perks": {\n    "categories": [\n      {\n        "id": "cat1",\n        "name": "Combat",\n        "perks": [{ "id": "p1", "text": "+50% damage" }]\n      }\n    ],\n    "uncategorized": [{ "id": "p2", "text": "Free daily kit" }]\n  }\n}',
      },
      {
        method: 'DELETE', path: '/api/kits/{id}/perks', title: 'Remove Kit Perks',
        description: 'Removes all perks for a specified kit. Returns 404 if no perks exist for that kit.',
        auth: 'bearer', scope: 'kits:write',
        params: [{ name: 'id', in: 'path', type: 'string', required: true, description: 'Kit config ID' }],
        bodyExample: '{\n  "kitId": "kit_xxx-yyy-zzz"\n}',
      },
      {
        method: 'GET', path: '/api/kits/{id}/categories', title: 'List Kit Categories',
        description: 'Lists all in-kit categories (top-level groups), sorted by order, with per-category kit counts and nested groups.',
        auth: 'bearer', scope: 'kits:read',
        params: [{ name: 'id', in: 'path', type: 'string', required: true, description: 'Kit config ID' }],
      },
      {
        method: 'POST', path: '/api/kits/{id}/categories', title: 'Create Kit Category',
        description: 'Adds a new top-level category to the kit config. ID uses the uicat_ prefix.',
        auth: 'bearer', scope: 'kits:write',
        params: [{ name: 'id', in: 'path', type: 'string', required: true, description: 'Kit config ID' }],
        bodyExample: '{\n  "name": "VIP Kits",\n  "order": 0\n}',
      },
      {
        method: 'PATCH', path: '/api/kits/{id}/categories', title: 'Update Kit Category',
        description: 'Renames or reorders a category. Supply the catId and any fields to change.',
        auth: 'bearer', scope: 'kits:write',
        params: [{ name: 'id', in: 'path', type: 'string', required: true, description: 'Kit config ID' }],
        bodyExample: '{\n  "catId": "uicat_xxx-yyy",\n  "name": "Premium Kits",\n  "order": 1\n}',
      },
      {
        method: 'DELETE', path: '/api/kits/{id}/categories', title: 'Delete Kit Category',
        description: 'Deletes a category and clears Category/Subcategory from all kits that belonged to it. Returns the number of affected kits.',
        auth: 'bearer', scope: 'kits:write',
        params: [{ name: 'id', in: 'path', type: 'string', required: true, description: 'Kit config ID' }],
        bodyExample: '{\n  "catId": "uicat_xxx-yyy"\n}',
      },
      {
        method: 'GET', path: '/api/kits/{id}/categories/group', title: 'List Kit Groups',
        description: 'Lists all groups (subcategories) within a specific category, sorted by order, with per-group kit counts.',
        auth: 'bearer', scope: 'kits:read',
        params: [
          { name: 'id', in: 'path', type: 'string', required: true, description: 'Kit config ID' },
          { name: 'catId', in: 'query', type: 'string', required: true, description: 'Category ID (uicat_...)' },
        ],
      },
      {
        method: 'POST', path: '/api/kits/{id}/categories/group', title: 'Create Kit Group',
        description: 'Creates a new group (subcategory) within an existing category. ID uses the uisub_ prefix.',
        auth: 'bearer', scope: 'kits:write',
        params: [{ name: 'id', in: 'path', type: 'string', required: true, description: 'Kit config ID' }],
        bodyExample: '{\n  "catId": "uicat_xxx-yyy",\n  "name": "Tier 1",\n  "order": 0\n}',
      },
      {
        method: 'PATCH', path: '/api/kits/{id}/categories/group', title: 'Update Kit Group',
        description: 'Renames or reorders a group within a category.',
        auth: 'bearer', scope: 'kits:write',
        params: [{ name: 'id', in: 'path', type: 'string', required: true, description: 'Kit config ID' }],
        bodyExample: '{\n  "catId": "uicat_xxx-yyy",\n  "groupId": "uisub_aaa-bbb",\n  "name": "Tier 2"\n}',
      },
      {
        method: 'DELETE', path: '/api/kits/{id}/categories/group', title: 'Delete Kit Group',
        description: 'Deletes a group and clears the Subcategory field from all kits that belonged to it.',
        auth: 'bearer', scope: 'kits:write',
        params: [{ name: 'id', in: 'path', type: 'string', required: true, description: 'Kit config ID' }],
        bodyExample: '{\n  "catId": "uicat_xxx-yyy",\n  "groupId": "uisub_aaa-bbb"\n}',
      },
      {
        method: 'POST', path: '/api/kits/sync', title: 'Plugin Sync',
        description: 'Used by the Rust plugin to fetch the current kit config and report kit redemption events back to the server.',
        auth: 'bearer', scope: 'kits:write',
        bodyExample: '{\n  "serverId": "serverid_xxx",\n  "events": [\n    { "kitName": "VIP Kit", "steamId": "76561198...", "timestamp": 1700000000 }\n  ]\n}',
      },
      {
        method: 'GET', path: '/api/kits/mappings', title: 'List Server Mappings',
        description: 'Returns all game server → kit config mappings.',
        auth: 'bearer', scope: 'kits:read',
      },
      {
        method: 'POST', path: '/api/kits/mappings', title: 'Create Server Mapping',
        description: 'Maps a game server to a kit configuration.',
        auth: 'bearer', scope: 'kits:write',
        bodyExample: '{\n  "gameServerId": 1,\n  "kitConfigId": "category_xxx-yyy"\n}',
      },
      {
        method: 'PATCH', path: '/api/kits/mappings', title: 'Update Server Mapping',
        description: 'Changes the kit configuration a server is mapped to.',
        auth: 'bearer', scope: 'kits:write',
        bodyExample: '{\n  "gameServerId": 1,\n  "kitConfigId": "category_new-yyy"\n}',
      },
      {
        method: 'DELETE', path: '/api/kits/mappings', title: 'Delete Server Mapping',
        description: 'Removes a game server → kit config mapping.',
        auth: 'bearer', scope: 'kits:write',
        bodyExample: '{\n  "gameServerId": 1\n}',
      },
    ],
  },
  {
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
  },
  {
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
        description: 'Updates an identifier\'s name, description, or category assignment.',
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
  },
  {
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
  },
  {
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
        description: 'Replaces a loot configuration\'s data.',
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
  },
  {
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
  },
  {
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
        description: 'Updates a token\'s name, scopes, or category.',
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
  },
  {
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
  },
  {
    id: 'moderation',
    label: 'Moderation',
    icon: Shield,
    endpoints: [
      {
        method: 'GET', path: '/api/admin/moderation/banned-words', title: 'List Banned Words',
        description: 'Returns all banned word patterns used for content moderation.',
        auth: 'session',
      },
      {
        method: 'POST', path: '/api/admin/moderation/banned-words', title: 'Add Banned Word',
        description: 'Adds a new word or pattern to the banned word list.',
        auth: 'session',
        bodyExample: '{\n  "pattern": "badword",\n  "severity": "high"\n}',
      },
      {
        method: 'PATCH', path: '/api/admin/moderation/banned-words/{id}', title: 'Update Banned Word',
        description: 'Updates a banned word pattern.',
        auth: 'session',
        params: [{ name: 'id', in: 'path', type: 'string', required: true, description: 'Banned word ID' }],
        bodyExample: '{\n  "severity": "medium"\n}',
      },
      {
        method: 'DELETE', path: '/api/admin/moderation/banned-words/{id}', title: 'Remove Banned Word',
        description: 'Removes a word pattern from the ban list.',
        auth: 'session',
        params: [{ name: 'id', in: 'path', type: 'string', required: true, description: 'Banned word ID' }],
      },
      {
        method: 'POST', path: '/api/admin/moderation/banned-words/check', title: 'Check Content',
        description: 'Checks whether a string contains any banned words. Returns matching patterns.',
        auth: 'session',
        bodyExample: '{\n  "content": "Text to check for banned content"\n}',
      },
    ],
  },
  {
    id: 'announcements',
    label: 'Announcements',
    icon: Bell,
    endpoints: [
      {
        method: 'GET', path: '/api/announcements', title: 'List Announcements',
        description: 'Returns all announcements.',
        auth: 'bearer', scope: 'kits:read',
      },
      {
        method: 'POST', path: '/api/announcements', title: 'Create Announcement',
        description: 'Creates a new announcement.',
        auth: 'bearer', scope: 'kits:write',
        bodyExample: '{\n  "title": "Server Update",\n  "content": "We have updated...",\n  "serverId": "serverid_xxx"\n}',
      },
      {
        method: 'PATCH', path: '/api/announcements', title: 'Update Announcement',
        description: 'Updates an existing announcement.',
        auth: 'bearer', scope: 'kits:write',
        bodyExample: '{\n  "id": "ann_xxx",\n  "title": "Updated Title"\n}',
      },
      {
        method: 'DELETE', path: '/api/announcements', title: 'Delete Announcement',
        description: 'Permanently deletes an announcement.',
        auth: 'bearer', scope: 'kits:write',
        bodyExample: '{\n  "id": "ann_xxx"\n}',
      },
    ],
  },
  {
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
  },
  {
    id: 'stats',
    label: 'Stats',
    icon: TrendingUp,
    endpoints: [
      {
        method: 'GET', path: '/api/stats', title: 'General Stats',
        description: 'Returns general platform statistics — total kits, servers, redemptions.',
        auth: 'bearer', scope: 'analytics:read',
      },
      {
        method: 'GET', path: '/api/stats/player/{steamId}', title: 'Player Stats',
        description: 'Returns kit usage statistics for a specific player by Steam ID.',
        auth: 'bearer', scope: 'analytics:read',
        params: [{ name: 'steamId', in: 'path', type: 'string', required: true, description: 'Player Steam ID (17 digits)' }],
      },
      {
        method: 'GET', path: '/api/stats/events', title: 'Events Stats',
        description: 'Returns event completion statistics.',
        auth: 'bearer', scope: 'analytics:read',
      },
    ],
  },
  {
    id: 'giveaways',
    label: 'Giveaways',
    icon: Gift,
    endpoints: [
      {
        method: 'GET', path: '/api/giveaway', title: 'Get Active Giveaway',
        description: 'Returns the currently active giveaway.',
        auth: 'bearer', scope: 'kits:read',
      },
      {
        method: 'POST', path: '/api/giveaway', title: 'Create Giveaway',
        description: 'Creates a new giveaway.',
        auth: 'bearer', scope: 'kits:write',
        bodyExample: '{\n  "prize": "VIP Package",\n  "endsAt": "2024-02-01T00:00:00Z"\n}',
      },
      {
        method: 'GET', path: '/api/admin/giveaways', title: 'List All Giveaways',
        description: 'Returns all giveaways with full admin data.',
        auth: 'session',
      },
      {
        method: 'GET', path: '/api/admin/giveaways/players', title: 'List Giveaway Players',
        description: 'Returns all player entries for giveaways.',
        auth: 'session',
      },
      {
        method: 'POST', path: '/api/admin/giveaways/players', title: 'Add Giveaway Player',
        description: 'Adds a player to a giveaway entry list.',
        auth: 'session',
        bodyExample: '{\n  "giveawayId": "giveaway_xxx",\n  "steamId": "76561198..."\n}',
      },
    ],
  },
  {
    id: 'feedback',
    label: 'Feedback',
    icon: MessageSquare,
    endpoints: [
      {
        method: 'GET', path: '/api/feedback', title: 'List Feedback',
        description: 'Returns all feedback submissions.',
        auth: 'bearer', scope: 'analytics:read',
      },
      {
        method: 'POST', path: '/api/feedback', title: 'Submit Feedback',
        description: 'Submits a new feedback entry.',
        auth: 'bearer', scope: 'analytics:write',
        bodyExample: '{\n  "steamId": "76561198...",\n  "content": "Great server!",\n  "rating": 5,\n  "serverId": "serverid_xxx"\n}',
      },
      {
        method: 'PATCH', path: '/api/feedback', title: 'Update Feedback',
        description: 'Updates feedback status or moderation flags.',
        auth: 'bearer', scope: 'analytics:write',
        bodyExample: '{\n  "id": "fb_xxx",\n  "status": "approved"\n}',
      },
      {
        method: 'DELETE', path: '/api/feedback', title: 'Delete Feedback',
        description: 'Permanently removes a feedback entry.',
        auth: 'bearer', scope: 'analytics:write',
        bodyExample: '{\n  "id": "fb_xxx"\n}',
      },
      {
        method: 'GET', path: '/api/feedback/rewards', title: 'List Feedback Rewards',
        description: 'Returns all feedback reward records.',
        auth: 'bearer', scope: 'analytics:read',
      },
      {
        method: 'PATCH', path: '/api/feedback/rewards', title: 'Update Reward Status',
        description: 'Marks a feedback reward as issued.',
        auth: 'bearer', scope: 'analytics:write',
        bodyExample: '{\n  "id": "fbrw_xxx",\n  "issued": true\n}',
      },
    ],
  },
  {
    id: 'telemetry',
    label: 'Telemetry',
    icon: Activity,
    endpoints: [
      {
        method: 'POST', path: '/api/telemetry/submit', title: 'Submit Telemetry',
        description: 'Submits telemetry events from plugins — health checks, performance metrics, error reports.',
        auth: 'bearer', scope: 'telemetry:write',
        bodyExample: '{\n  "serverId": "serverid_xxx",\n  "events": [\n    {\n      "type": "health",\n      "timestamp": 1700000000,\n      "data": { "fps": 60, "players": 42 }\n    }\n  ]\n}',
      },
    ],
  },
  {
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
  },
  {
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
  },
]

// =============================================================================
// Curl Generator
// =============================================================================

function buildCurl(endpoint: ApiEndpointDef, baseUrl: string): string {
  const url = `${baseUrl}${endpoint.path}`
  const hasBody = endpoint.bodyExample && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(endpoint.method)
  const needsAuth = endpoint.auth !== 'none'

  const lines: string[] = [`curl -X ${endpoint.method} "${url}"`]

  if (needsAuth && endpoint.auth === 'bearer') {
    lines.push('  -H "Authorization: Bearer YOUR_TOKEN"')
  }
  if (needsAuth && endpoint.auth === 'session') {
    lines.push('  -H "Cookie: next-auth.session-token=YOUR_SESSION"')
  }
  if (hasBody) {
    lines.push('  -H "Content-Type: application/json"')
    lines.push(`  -d '${endpoint.bodyExample}'`)
  }

  return lines.join(' \\\n')
}

// =============================================================================
// Method Badge
// =============================================================================

const METHOD_STYLES: Record<HttpMethod, { bg: string; text: string }> = {
  GET:    { bg: 'rgba(0,212,255,0.12)',  text: 'var(--accent-primary)' },
  POST:   { bg: 'rgba(0,200,100,0.12)', text: 'var(--status-success)' },
  PUT:    { bg: 'rgba(250,180,0,0.12)', text: '#f59e0b' },
  PATCH:  { bg: 'rgba(250,120,0,0.12)', text: '#f97316' },
  DELETE: { bg: 'rgba(255,50,50,0.12)', text: 'var(--status-error)' },
}

function MethodBadge({ method }: { method: HttpMethod }) {
  const s = METHOD_STYLES[method]
  return (
    <span
      className="shrink-0 inline-flex items-center justify-center w-16 h-6 rounded text-xs font-bold font-mono tracking-wide"
      style={{ background: s.bg, color: s.text }}
    >
      {method}
    </span>
  )
}

// =============================================================================
// Auth Badge
// =============================================================================

function AuthBadge({ auth, scope }: { auth: AuthType; scope?: string }) {
  if (auth === 'none') {
    return (
      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full"
        style={{ background: 'rgba(0,200,100,0.1)', color: 'var(--status-success)', border: '1px solid rgba(0,200,100,0.2)' }}>
        <Unlock className="w-3 h-3" />
        Public
      </span>
    )
  }
  if (auth === 'session') {
    return (
      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full"
        style={{ background: 'rgba(250,180,0,0.1)', color: '#f59e0b', border: '1px solid rgba(250,180,0,0.2)' }}>
        <Lock className="w-3 h-3" />
        Admin Session
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-mono"
      style={{ background: 'rgba(0,212,255,0.1)', color: 'var(--accent-primary)', border: '1px solid rgba(0,212,255,0.2)' }}>
      <Key className="w-3 h-3 shrink-0" />
      {scope ?? 'bearer'}
    </span>
  )
}

// =============================================================================
// Copy Button
// =============================================================================

function CopyButton({ text, size = 'sm' }: { text: string; size?: 'sm' | 'xs' }) {
  const [copied, setCopied] = useState(false)

  const copy = useCallback(async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }, [text])

  const iconSize = size === 'xs' ? 'w-3 h-3' : 'w-3.5 h-3.5'
  return (
    <button
      onClick={copy}
      className="shrink-0 flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors"
      style={{
        color: copied ? 'var(--status-success)' : 'var(--text-muted)',
        background: 'var(--glass-bg)',
        border: '1px solid var(--glass-border)',
      }}
    >
      {copied ? <Check className={iconSize} /> : <Copy className={iconSize} />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  )
}

// =============================================================================
// Endpoint Card
// =============================================================================

function EndpointCard({ endpoint, baseUrl }: { endpoint: ApiEndpointDef; baseUrl: string }) {
  const [expanded, setExpanded] = useState(false)
  const fullUrl = `${baseUrl}${endpoint.path}`
  const curl = buildCurl(endpoint, baseUrl)

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ border: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.02)' }}
    >
      {/* Header row — always visible */}
      <div className="flex items-start gap-3 px-4 py-3">
        <MethodBadge method={endpoint.method} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm text-[var(--text-primary)]">{endpoint.title}</span>
            <AuthBadge auth={endpoint.auth} scope={endpoint.scope} />
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <code className="text-xs text-[var(--text-secondary)] font-mono truncate flex-1">{fullUrl}</code>
            <CopyButton text={fullUrl} size="xs" />
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-1 leading-relaxed">{endpoint.description}</p>
        </div>
        <button
          onClick={() => setExpanded((v) => !v)}
          className="shrink-0 p-1.5 rounded-lg transition-colors hover:bg-[var(--bg-card-hover)]"
          title={expanded ? 'Collapse' : 'Expand'}
        >
          <ChevronDown
            className={`w-4 h-4 text-[var(--text-muted)] transition-transform duration-150 ${expanded ? '' : '-rotate-90'}`}
          />
        </button>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div style={{ borderTop: '1px solid var(--glass-border)' }}>
          {/* Parameters */}
          {endpoint.params && endpoint.params.length > 0 && (
            <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--glass-border)' }}>
              <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-2">
                Parameters
              </p>
              <div className="space-y-1.5">
                {endpoint.params.map((p) => (
                  <div key={p.name} className="flex items-start gap-2 text-xs">
                    <code className="font-mono text-[var(--accent-primary)] shrink-0 w-28">{p.name}</code>
                    <span
                      className="px-1.5 py-0.5 rounded text-[10px] shrink-0"
                      style={{ background: 'var(--glass-bg)', color: 'var(--text-muted)', border: '1px solid var(--glass-border)' }}
                    >
                      {p.in}
                    </span>
                    <span
                      className="px-1.5 py-0.5 rounded text-[10px] shrink-0"
                      style={{ background: 'var(--glass-bg)', color: '#f59e0b', border: '1px solid rgba(250,180,0,0.2)' }}
                    >
                      {p.type}
                    </span>
                    {p.required && (
                      <span className="text-[10px] text-[var(--status-error)] shrink-0">required</span>
                    )}
                    <span className="text-[var(--text-muted)] leading-relaxed">{p.description}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Curl example */}
          <div className="px-4 py-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Terminal className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide">
                  Example
                </p>
              </div>
              <CopyButton text={curl} />
            </div>
            <pre
              className="text-xs font-mono rounded-lg p-3 overflow-x-auto leading-relaxed"
              style={{
                background: 'rgba(0,0,0,0.4)',
                color: 'var(--text-secondary)',
                border: '1px solid var(--glass-border)',
              }}
            >
              {curl}
            </pre>
          </div>
        </div>
      )}
    </div>
  )
}

// =============================================================================
// Main Modal
// =============================================================================

export function ApiReferenceModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [activeSection, setActiveSection] = useState(SECTIONS[0].id)
  const [baseUrl, setBaseUrl] = useState('https://your-domain.com')
  const [searchQuery, setSearchQuery] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({})

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setBaseUrl(window.location.origin)
    }
  }, [])

  // Filter sections/endpoints by search query
  const filteredSections = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return SECTIONS
    return SECTIONS
      .map((section) => ({
        ...section,
        endpoints: section.endpoints.filter(
          (ep) =>
            ep.title.toLowerCase().includes(q) ||
            ep.path.toLowerCase().includes(q) ||
            ep.description.toLowerCase().includes(q) ||
            ep.method.toLowerCase().includes(q) ||
            (ep.scope && ep.scope.toLowerCase().includes(q))
        ),
      }))
      .filter((section) => section.endpoints.length > 0)
  }, [searchQuery])

  // Reset active section when filtered list changes and current section disappears
  useEffect(() => {
    if (filteredSections.length > 0 && !filteredSections.find((s) => s.id === activeSection)) {
      setActiveSection(filteredSections[0].id)
    }
  }, [filteredSections, activeSection])

  // Focus search on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => searchRef.current?.focus(), 50)
    } else {
      setSearchQuery('')
    }
  }, [isOpen])

  // Escape to close
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  // Prevent body scroll
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  // Scroll to section
  const scrollToSection = useCallback((sectionId: string) => {
    setActiveSection(sectionId)
    const el = sectionRefs.current[sectionId]
    if (el && contentRef.current) {
      contentRef.current.scrollTo({ top: el.offsetTop - 16, behavior: 'smooth' })
    }
  }, [])

  if (!isOpen) return null

  const totalEndpoints = SECTIONS.reduce((n, s) => n + s.endpoints.length, 0)
  const filteredEndpointCount = filteredSections.reduce((n, s) => n + s.endpoints.length, 0)
  const isSearching = searchQuery.trim().length > 0

  const modal = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.8)' }}
      onClick={onClose}
    >
      <div
        className="relative w-full rounded-2xl overflow-hidden flex flex-col"
        style={{
          maxWidth: '1200px',
          height: 'calc(100vh - 2rem)',
          background: 'linear-gradient(to bottom right, #0a0a0f 0%, #1a1a2e 50%, #0f1419 100%)',
          border: '1px solid var(--glass-border)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="shrink-0"
          style={{ borderBottom: '1px solid var(--glass-border)' }}
        >
          {/* Title row */}
          <div className="flex items-center justify-between gap-4 px-6 pt-4 pb-3">
            <div className="flex items-center gap-3">
              <BookOpen className="w-5 h-5 text-[var(--accent-primary)]" />
              <div>
                <h2 className="text-lg font-bold text-[var(--text-primary)]">API Reference</h2>
                <p className="text-xs text-[var(--text-muted)]">
                  {isSearching
                    ? <>{filteredEndpointCount} of {totalEndpoints} endpoints match</>
                    : <>{SECTIONS.length} sections · {totalEndpoints} endpoints · Base URL:{' '}
                        <span className="font-mono text-[var(--accent-primary)]">{baseUrl}</span>
                      </>
                  }
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg transition-colors hover:bg-[var(--bg-card-hover)]"
            >
              <X className="w-5 h-5 text-[var(--text-muted)]" />
            </button>
          </div>

          {/* Search row */}
          <div className="px-6 pb-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)] pointer-events-none" />
              <input
                ref={searchRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search endpoints by name, path, or description..."
                className="w-full pl-9 pr-9 py-2 rounded-lg text-sm transition-colors"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid var(--glass-border)',
                  color: 'var(--text-primary)',
                  outline: 'none',
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--accent-primary)' }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--glass-border)' }}
              />
              {isSearching && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded transition-colors hover:bg-[var(--bg-card-hover)]"
                >
                  <X className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Body — sidebar + content */}
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Sidebar */}
          <nav
            className="w-52 shrink-0 overflow-y-auto py-3"
            style={{ borderRight: '1px solid var(--glass-border)' }}
          >
            {filteredSections.length === 0 ? (
              <p className="px-4 py-3 text-xs text-[var(--text-muted)]">No results</p>
            ) : (
              filteredSections.map((section) => {
                const Icon = section.icon
                const isActive = activeSection === section.id
                return (
                  <button
                    key={section.id}
                    onClick={() => scrollToSection(section.id)}
                    className="w-full flex items-center gap-2.5 px-4 py-2 text-sm transition-colors text-left"
                    style={{
                      color: isActive ? 'var(--accent-primary)' : 'var(--text-secondary)',
                      background: isActive ? 'rgba(0,212,255,0.06)' : 'transparent',
                      borderLeft: isActive ? '2px solid var(--accent-primary)' : '2px solid transparent',
                    }}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{section.label}</span>
                    <span className="ml-auto text-xs text-[var(--text-muted)] shrink-0">
                      {section.endpoints.length}
                    </span>
                  </button>
                )
              })
            )}
          </nav>

          {/* Endpoint list */}
          <div ref={contentRef} className="flex-1 overflow-y-auto px-6 py-4 space-y-10">
            {filteredSections.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
                <Search className="w-10 h-10 text-[var(--text-muted)]" />
                <p className="text-sm font-medium text-[var(--text-secondary)]">No endpoints found</p>
                <p className="text-xs text-[var(--text-muted)]">
                  No results for &ldquo;{searchQuery}&rdquo; — try a different search term
                </p>
                <button
                  onClick={() => setSearchQuery('')}
                  className="text-xs text-[var(--accent-primary)] hover:underline mt-1"
                >
                  Clear search
                </button>
              </div>
            ) : (
              filteredSections.map((section) => {
                const Icon = section.icon
                return (
                  <div
                    key={section.id}
                    ref={(el) => { sectionRefs.current[section.id] = el }}
                  >
                    <div className="flex items-center gap-3 mb-4">
                      <Icon className="w-5 h-5 text-[var(--accent-primary)]" />
                      <h3 className="text-base font-bold text-[var(--text-primary)]">{section.label}</h3>
                      <span className="text-xs text-[var(--text-muted)]">{section.endpoints.length} endpoints</span>
                    </div>
                    <div className="space-y-2">
                      {section.endpoints.map((ep, i) => (
                        <EndpointCard key={i} endpoint={ep} baseUrl={baseUrl} />
                      ))}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
    </div>
  )

  if (typeof window === 'undefined') return null
  return createPortal(modal, document.body)
}
