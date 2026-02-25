import { Activity } from 'lucide-react'
import type { SectionDef } from '../types'

export const telemetrySection: SectionDef = {
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
}
