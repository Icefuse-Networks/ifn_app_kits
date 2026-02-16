export interface GenericLootItem {
  shortname: string
  minAmount: number
  maxAmount: number
  spawnChance: number
  [key: string]: unknown
}

export interface ExtraFieldDef {
  key: string
  label: string
  type: 'number' | 'checkbox'
  default: number | boolean
  min?: number
  max?: number
  step?: number
}

export interface SavedConfig {
  id: number
  name: string
  description: string | null
  currentVersion: number
  publishedVersion: number | null
  createdAt: string
  updatedAt: string
}

export interface ServerIdentifierRecord {
  id: string
  name: string
  hashedId: string
  ip: string | null
  port: number | null
}

export interface MappingRecord {
  id: number
  configId: number
  serverIdentifierId: string
  isLive: boolean
  minutesAfterWipe: number | null
  config: { id: number; name: string; currentVersion: number; publishedVersion: number | null }
  serverIdentifier: ServerIdentifierRecord
}

export interface ConfigVersion {
  id: number
  version: number
  createdAt: string
}
