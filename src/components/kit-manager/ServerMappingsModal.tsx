'use client'

import { useState, useEffect } from 'react'
import { X, Plus, Pencil, Trash2, ChevronDown, Server, AlertCircle } from 'lucide-react'
import { MultiSelect } from '@/components/ui/MultiSelect'

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

interface ServerMappingsModalProps {
  onClose: () => void
  savedConfigs: KitConfig[]
}

export function ServerMappingsModal({ onClose, savedConfigs }: ServerMappingsModalProps) {
  const [mappings, setMappings] = useState<KitMapping[]>([])
  const [servers, setServers] = useState<ServerIdentifier[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Add/Edit mapping state
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [selectedConfig, setSelectedConfig] = useState<string | null>(null)
  const [selectedServers, setSelectedServers] = useState<string[]>([])
  const [configDropdownOpen, setConfigDropdownOpen] = useState(false)

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
      // Filter servers that have IP and port
      if (Array.isArray(data)) {
        setServers(data.filter((s: ServerIdentifier) => s.ip && s.port))
      } else {
        setServers([])
      }
    } catch (err) {
      setError('Failed to load servers')
    }
  }

  const openAddModal = () => {
    setEditingId(null)
    setSelectedConfig(null)
    setSelectedServers([])
    setShowAddModal(true)
  }

  const openEditModal = (mapping: KitMapping) => {
    setEditingId(mapping.id)
    setSelectedConfig(mapping.configId)
    setSelectedServers([mapping.serverIdentifierId])
    setShowAddModal(true)
  }

  const closeAddModal = () => {
    setShowAddModal(false)
    setEditingId(null)
    setSelectedConfig(null)
    setSelectedServers([])
    setConfigDropdownOpen(false)
  }

  const handleSaveMapping = async () => {
    if (!selectedConfig || selectedServers.length === 0) return

    try {
      if (editingId) {
        // Edit mode - update existing mapping
        const res = await fetch('/api/kits/mappings', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editingId,
            configId: selectedConfig,
            minutesAfterWipe: null,
          }),
        })

        if (!res.ok) throw new Error('Failed to update mapping')
        setSuccess('Mapping updated')
      } else {
        // Create mode - create mapping for each selected server
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
      }

      fetchMappings()
      closeAddModal()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save mapping')
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

  const handleToggleLive = async (mapping: KitMapping) => {
    try {
      const res = await fetch('/api/kits/mappings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: mapping.id, isLive: !mapping.isLive }),
      })

      if (!res.ok) throw new Error('Failed to update mapping')

      setSuccess(mapping.isLive ? 'Set to inactive' : 'Set to live')
      fetchMappings()
    } catch {
      setError('Failed to update mapping')
    }
  }

  return (
    <>
      {/* Main Modal */}
      <div
        className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50"
        onClick={onClose}
      >
        <div
          className="bg-zinc-900 rounded-xl border border-white/10 p-6 w-full max-w-4xl max-h-[80vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-bold text-white">Server Mappings</h3>
              <p className="text-sm text-zinc-400 mt-1">
                Assign kit configs to servers
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-1 text-zinc-500 hover:text-white transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Messages */}
          {error && (
            <div className="mb-4 flex items-center gap-2 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}
          {success && (
            <div className="mb-4 flex items-center gap-2 px-3 py-2 bg-green-500/10 border border-green-500/20 rounded-lg text-sm text-green-400">
              <Server className="h-4 w-4 shrink-0" />
              {success}
            </div>
          )}

          {/* Content */}
          <div className="flex-1 overflow-y-auto mb-4">
            {loading ? (
              <div className="text-center py-12">
                <div className="w-8 h-8 border-2 border-purple-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-zinc-500">Loading...</p>
              </div>
            ) : mappings.length === 0 ? (
              <div className="text-center py-12 text-zinc-500">
                <Server className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>No server mappings yet</p>
                <p className="text-xs mt-1">Click "Add Mapping" to get started</p>
              </div>
            ) : (
              <div className="space-y-2">
                {mappings.map((mapping) => (
                  <div
                    key={mapping.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-white truncate">
                          {mapping.serverIdentifier.name}
                        </span>
                        {mapping.isLive && (
                          <span className="px-2 py-0.5 text-xs bg-green-500/20 text-green-400 rounded border border-green-500/30">
                            LIVE
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-zinc-500">
                        {mapping.serverIdentifier.ip && mapping.serverIdentifier.port
                          ? `${mapping.serverIdentifier.ip}:${mapping.serverIdentifier.port}`
                          : mapping.serverIdentifier.hashedId}
                        {' → '}
                        <span className="text-purple-400">{mapping.config.name}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <button
                        onClick={() => handleToggleLive(mapping)}
                        className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                          mapping.isLive
                            ? 'bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30'
                            : 'bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/30'
                        }`}
                      >
                        {mapping.isLive ? 'Deactivate' : 'Activate'}
                      </button>
                      <button
                        onClick={() => openEditModal(mapping)}
                        className="p-2 text-zinc-400 hover:text-white transition-colors"
                        title="Edit"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteMapping(mapping.id)}
                        className="p-2 text-zinc-400 hover:text-red-400 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex gap-3">
            <button
              onClick={openAddModal}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-purple-500 text-white rounded-lg font-medium hover:bg-purple-600 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Add Mapping
            </button>
            <button
              onClick={onClose}
              className="px-6 py-2 bg-white/5 text-white rounded-lg hover:bg-white/10 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      {/* Add/Edit Mapping Modal */}
      {showAddModal && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-[60]"
          onClick={closeAddModal}
        >
          <div
            className="bg-zinc-900 rounded-xl border border-white/10 p-6 w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">
                {editingId ? 'Edit Mapping' : 'Add Server Mapping'}
              </h3>
              <button
                onClick={closeAddModal}
                className="p-1 text-zinc-500 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Kit Config Dropdown */}
              <div>
                <label className="block text-sm text-zinc-400 mb-2">Kit Config *</label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setConfigDropdownOpen(!configDropdownOpen)}
                    className="w-full bg-zinc-800 border border-white/10 rounded-lg px-3 py-3 text-left text-white focus:outline-none flex items-center justify-between"
                  >
                    <span className={selectedConfig ? 'text-white' : 'text-zinc-500'}>
                      {selectedConfig
                        ? savedConfigs.find((c) => c.id === selectedConfig)?.name || 'Unknown'
                        : 'Select a kit config...'}
                    </span>
                    <ChevronDown
                      className={`h-4 w-4 text-zinc-500 transition-transform ${
                        configDropdownOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                  {configDropdownOpen && (
                    <div className="absolute z-50 w-full mt-1 bg-zinc-800 border border-white/10 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                      {savedConfigs.map((config) => (
                        <button
                          key={config.id}
                          type="button"
                          onClick={() => {
                            setSelectedConfig(config.id)
                            setConfigDropdownOpen(false)
                          }}
                          className={`w-full px-3 py-2 text-left text-sm hover:bg-white/10 transition-colors ${
                            selectedConfig === config.id
                              ? 'bg-purple-500/20 text-purple-400'
                              : 'text-white'
                          }`}
                        >
                          {config.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Server Multi-Select */}
              <div>
                <label className="block text-sm text-zinc-400 mb-2">
                  {editingId ? 'Server (locked)' : 'Servers *'}
                </label>
                <MultiSelect
                  value={selectedServers}
                  onChange={setSelectedServers}
                  options={servers.map((server) => ({
                    value: server.id,
                    label: server.name,
                    description: server.ip && server.port ? `${server.ip}:${server.port}` : server.hashedId,
                  }))}
                  placeholder="Select servers..."
                  disabled={!!editingId}
                  searchable={true}
                  showSelectAll={true}
                />
                {!editingId && selectedServers.length > 0 && (
                  <p className="text-xs text-zinc-500 mt-1">
                    Creating {selectedServers.length} mapping{selectedServers.length > 1 ? 's' : ''} for the same kit config
                  </p>
                )}
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={closeAddModal}
                className="flex-1 px-4 py-2 bg-white/5 text-white rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveMapping}
                disabled={!selectedConfig || selectedServers.length === 0}
                className="flex-1 px-4 py-2 bg-purple-500 text-white rounded-lg font-medium disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {editingId ? (
                  <>
                    <Pencil className="h-4 w-4" />
                    Update
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    Add
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
