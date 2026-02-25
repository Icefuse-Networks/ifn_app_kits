import { Bell } from 'lucide-react'
import type { SectionDef } from '../types'

export const announcementsSection: SectionDef = {
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
}
