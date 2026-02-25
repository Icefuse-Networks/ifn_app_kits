'use client'

import { useState, useEffect } from 'react'
import { Plus, Trash2, Server, AlertCircle, ChevronDown, ChevronRight, ArrowLeft } from 'lucide-react'
import { MultiSelect } from '@/components/ui/MultiSelect'
import { GlassContainer } from '@/components/global/GlassContainer'

interface KitMapping {
  id: number
  configId: string
  serverIdentifierId: string
  isLive: boolean
  minutesAfterWipe: number | null
  config: { id: string; name: string }
  serverIdentifier: { id: string; name: string; hashedId: string; ip: string | null; port: number | null }
}

interface ServerIdentifier {
  id: string
  name: string
  hashedId: string
  ip: string | null
  port: number | null
}

interface KitConfig {
  id: string
  name: string
}

interface ServerMappingsTabProps {
  savedConfigs: KitConfig[]
  onBack: () => void
}

export function ServerMappingsTab({ savedConfigs, onBack }: ServerMappingsTabProps) {
  const [mappings, setMappings] = useState<KitMapping[]>([])
  const [servers, setServers] = useState<ServerIdentifier[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Expanded kit configs (accordion)
  const [expandedConfigs, setExpandedConfigs] = useState<Set<string>>(new Set())

  // Add mapping state
  const [selectedConfig, setSelectedConfig] = useState<string | null>(null)
  const [selectedServers, setSelectedServers] = useState<string[]>([])

  useEffect(() => {
    fetchMappings()
    fetchServers()
  }, [])

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [success])

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000)
      return () => clearTimeout(timer)
    }
  }, [error])

  const fetchMappings = async () => {
    try {
      const res = await fetch('/api/kits/mappings')
      if (!res.ok) throw new Error('Failed to fetch mappings')
      const data = await res.json()
      setMappings(data)
    } catch (err) {
      setError('Failed to load mappings')
    } finally {
      setLoading(false)
    }
  }

  const fetchServers = async () => {
    try {
      const res = await fetch('/api/identifiers', { credentials: 'include' })
      if (!res.ok) throw new Error('Failed to fetch servers')
      const data = await res.json()
      if (Array.isArray(data)) {
        setServers(data.filter((s: ServerIdentifier) => s.ip && s.port))
      } else {
        setServers([])
      }
    } catch (err) {
      setError('Failed to load servers')
    }
  }

  const toggleConfig = (configId: string) => {
    const newExpanded = new Set(expandedConfigs)
    if (newExpanded.has(configId)) {
      newExpanded.delete(configId)
    } else {
      newExpanded.add(configId)
    }
    setExpandedConfigs(newExpanded)
  }

  const handleAddMappings = async () => {
    if (!selectedConfig || selectedServers.length === 0) return

    try {
      const results = await Promise.all(
        selectedServers.map((serverId) =>
          fetch('/api/kits/mappings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              configId: selectedConfig,
              serverIdentifierId: serverId,
              minutesAfterWipe: null,
              isLive: false,
            }),
          })
        )
      )

      const failed = results.filter((r) => !r.ok)
      if (failed.length > 0) {
        throw new Error(`Failed to create ${failed.length} mapping(s)`)
      }

      setSuccess(
        selectedServers.length === 1
          ? 'Mapping created'
          : `${selectedServers.length} mappings created`
      )

      fetchMappings()
      setSelectedConfig(null)
      setSelectedServers([])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save mappings')
    }
  }

  const handleDeleteMapping = async (id: number) => {
    if (!confirm('Remove this server assignment?')) return

    try {
      const res = await fetch('/api/kits/mappings', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })

      if (!res.ok) throw new Error('Failed to delete mapping')

      setSuccess('Mapping removed')
      fetchMappings()
    } catch {
      setError('Failed to delete mapping')
    }
  }


  // Group mappings by kit config
  const mappingsByConfig = mappings.reduce((acc, mapping) => {
    if (!acc[mapping.configId]) {
      acc[mapping.configId] = []
    }
    acc[mapping.configId].push(mapping)
    return acc
  }, {} as Record<string, KitMapping[]>)

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[var(--accent-primary)] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-[var(--text-muted)] text-sm">Loading mappings...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header with Back Button */}
      <div className="p-4 border-b border-white/10 flex items-center gap-3">
        <button
          onClick={onBack}
          className="p-2 rounded-lg transition-colors hover:bg-white/10"
          title="Back to kits"
        >
          <ArrowLeft className="w-4 h-4 text-[var(--text-muted)]" />
        </button>
        <div>
          <h2 className="text-lg font-bold text-white">Server Mappings</h2>
          <p className="text-xs text-[var(--text-muted)]">Assign kit configs to servers</p>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="mx-4 mt-4 flex items-center gap-2 px-3 py-2 bg-[var(--status-error)]/10 border border-[var(--status-error)]/20 rounded-lg text-sm text-[var(--status-error)]">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}
      {success && (
        <div className="mx-4 mt-4 flex items-center gap-2 px-3 py-2 bg-[var(--status-success)]/10 border border-[var(--status-success)]/20 rounded-lg text-sm text-[var(--status-success)]">
          <Server className="h-4 w-4 shrink-0" />
          {success}
        </div>
      )}

      {/* Add New Mapping Section */}
      <div className="p-4 border-b border-white/10">
        <div className="grid grid-cols-2 gap-3">
          {/* Kit Config Dropdown */}
          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1.5">Kit Config</label>
            <select
              value={selectedConfig || ''}
              onChange={(e) => setSelectedConfig(e.target.value || null)}
              className="w-full px-3 py-2 rounded-lg text-sm text-white bg-[var(--bg-secondary)] border border-white/10 focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
            >
              <option value="">Select kit config...</option>
              {savedConfigs.map((config) => (
                <option key={config.id} value={config.id}>
                  {config.name}
                </option>
              ))}
            </select>
          </div>

          {/* Server Multi-Select */}
          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1.5">Servers</label>
            <MultiSelect
              value={selectedServers}
              onChange={setSelectedServers}
              options={servers.map((server) => ({
                value: server.id,
                label: server.name,
                description: server.ip && server.port ? `${server.ip}:${server.port}` : server.hashedId,
              }))}
              placeholder="Select servers..."
              searchable={true}
              showSelectAll={true}
            />
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between">
          {selectedConfig && selectedServers.length > 0 && (
            <p className="text-xs text-[var(--text-muted)]">
              Creating {selectedServers.length} mapping{selectedServers.length > 1 ? 's' : ''} for{' '}
              {savedConfigs.find((c) => c.id === selectedConfig)?.name}
            </p>
          )}
          <button
            onClick={handleAddMappings}
            disabled={!selectedConfig || selectedServers.length === 0}
            className="ml-auto flex items-center gap-2 px-4 py-2 bg-[var(--accent-primary)] text-white rounded-lg text-sm font-medium hover:bg-[var(--accent-primary-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="w-4 h-4" />
            Add Mappings
          </button>
        </div>
      </div>

      {/* Mappings List (Grouped by Kit Config) */}
      <div className="flex-1 overflow-y-auto p-4">
        {savedConfigs.length === 0 ? (
          <div className="text-center py-12 text-[var(--text-muted)]">
            <Server className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>No kit configs available</p>
            <p className="text-xs mt-1">Create a kit config first</p>
          </div>
        ) : savedConfigs.map((config) => {
          const configMappings = mappingsByConfig[config.id] || []
          const isExpanded = expandedConfigs.has(config.id)

          return (
            <GlassContainer
              key={config.id}
              variant="default"
              radius="sm"
              features={{ hoverGlow: false }}
              className="mb-3"
            >
              {/* Config Header */}
              <button
                onClick={() => toggleConfig(config.id)}
                className="w-full flex items-center justify-between p-3 hover:bg-white/5 transition-colors"
              >
                <div className="flex items-center gap-2">
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />
                  )}
                  <span className="text-sm font-medium text-white">{config.name}</span>
                  <span className="px-2 py-0.5 text-xs bg-[var(--accent-primary)]/20 text-[var(--accent-primary)] rounded">
                    {configMappings.length} {configMappings.length === 1 ? 'server' : 'servers'}
                  </span>
                </div>
              </button>

              {/* Mappings for this config */}
              {isExpanded && (
                <div className="border-t border-white/10">
                  {configMappings.length === 0 ? (
                    <div className="p-4 text-center text-sm text-[var(--text-muted)]">
                      No servers mapped yet
                    </div>
                  ) : (
                    <div className="divide-y divide-white/10">
                      {configMappings.map((mapping) => (
                        <div
                          key={mapping.id}
                          className="flex items-center justify-between p-3 hover:bg-white/5 transition-colors"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-medium text-white truncate">
                                {mapping.serverIdentifier.name}
                              </span>
                            </div>
                            <div className="text-xs text-[var(--text-muted)]">
                              {mapping.serverIdentifier.ip && mapping.serverIdentifier.port
                                ? `${mapping.serverIdentifier.ip}:${mapping.serverIdentifier.port}`
                                : mapping.serverIdentifier.hashedId}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 ml-4">
                            <button
                              onClick={() => handleDeleteMapping(mapping.id)}
                              className="p-2 text-[var(--text-muted)] hover:text-[var(--status-error)] transition-colors"
                              title="Delete mapping"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </GlassContainer>
          )
        })}
      </div>
    </div>
  )
}
