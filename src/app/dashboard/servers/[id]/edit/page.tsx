'use client'

import { useState, useEffect, use, useCallback } from 'react'
import { ArrowLeft, Save, Server, Globe, Bot, Calendar, Plus, Trash2, Copy, Check } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Dropdown } from '@/components/global/Dropdown'
import { GlassContainer } from '@/components/global/GlassContainer'

interface IdentifierCategory {
  id: string
  name: string
  description: string | null
}

interface ServerIdentifier {
  id: string
  name: string
  hashedId: string
  description: string | null
  ip: string | null
  port: number | null
  connectEndpoint: string | null
  categoryId: string | null
  botToken: string | null
  region: string | null
  timezone: string | null
  teamLimit: string | null
  imageUrl: string | null
  iconUrl: string | null
  category: { id: string; name: string } | null
  createdAt: string
  updatedAt: string
}

interface WipeSchedule {
  id: string
  serverIdentifierId: string
  dayOfWeek: number
  hour: number
  minute: number
  wipeType: string
  createdAt: string
}

const DAYS_OF_WEEK = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

function getTzAbbrev(tz: string): string {
  try {
    return new Date().toLocaleString('en-US', { timeZone: tz, timeZoneName: 'short' }).split(' ').pop() || tz
  } catch { return tz }
}

function convertToEst(hour: number, minute: number, dow: number, fromTz: string): { hour: number; minute: number; dow: number } {
  // Create a date in the source timezone, then read it in EST
  const base = new Date()
  // Set to next occurrence of this dow
  const diff = (dow - base.getDay() + 7) % 7
  base.setDate(base.getDate() + diff)
  // Create a date string in the source TZ
  const dateStr = base.toISOString().split('T')[0]
  const srcDate = new Date(`${dateStr}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`)
  // Get offset difference
  const srcOffset = getTimezoneOffset(fromTz, srcDate)
  const estOffset = getTimezoneOffset('America/New_York', srcDate)
  const diffMs = estOffset - srcOffset
  const result = new Date(srcDate.getTime() + diffMs)
  return { hour: result.getHours(), minute: result.getMinutes(), dow: result.getDay() }
}

function getTimezoneOffset(tz: string, date: Date): number {
  const utcStr = date.toLocaleString('en-US', { timeZone: 'UTC' })
  const tzStr = date.toLocaleString('en-US', { timeZone: tz })
  return new Date(utcStr).getTime() - new Date(tzStr).getTime()
}

function formatTime12(h: number, m: number): string {
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`
}
const WIPE_TYPES = [
  { value: "regular", label: "Regular" },
  { value: "bp", label: "BP Wipe" }
]

const REGIONS = [
  { value: "US", label: "US" },
  { value: "EU", label: "EU" },
]

const TIMEZONES = [
  { value: "America/New_York", label: "EST/EDT (New York)" },
  { value: "America/Chicago", label: "CST/CDT (Chicago)" },
  { value: "America/Denver", label: "MST/MDT (Denver)" },
  { value: "America/Los_Angeles", label: "PST/PDT (Los Angeles)" },
  { value: "Europe/London", label: "GMT/BST (London)" },
  { value: "Europe/Paris", label: "CET/CEST (Paris)" },
  { value: "Europe/Berlin", label: "CET/CEST (Berlin)" },
]

const TEAM_LIMITS = [
  { value: "2", label: "2" },
  { value: "3", label: "3" },
  { value: "4", label: "4" },
  { value: "5", label: "5" },
  { value: "6", label: "6" },
  { value: "8", label: "8" },
  { value: "Unlimited", label: "Unlimited" },
]

export default function ServerEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: serverId } = use(params)
  const router = useRouter()

  const [server, setServer] = useState<ServerIdentifier | null>(null)
  const [categories, setCategories] = useState<IdentifierCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)

  // Form state
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [botToken, setBotToken] = useState('')
  const [region, setRegion] = useState<string | null>(null)
  const [timezone, setTimezone] = useState<string | null>(null)
  const [teamLimit, setTeamLimit] = useState<string | null>(null)
  const [imageUrl, setImageUrl] = useState('')
  const [iconUrl, setIconUrl] = useState('')

  // Wipe schedule state
  const [wipeSchedules, setWipeSchedules] = useState<WipeSchedule[]>([])
  const [newSchedule, setNewSchedule] = useState({ dayOfWeek: 4, hour: 14, minute: 0, wipeType: "regular" })
  const [addingSchedule, setAddingSchedule] = useState(false)

  const fetchServer = useCallback(async () => {
    try {
      const res = await fetch(`/api/identifiers/${serverId}`, { credentials: 'include' })
      if (!res.ok) throw new Error('Failed to fetch')
      const data = await res.json()
      setServer(data)
    } catch (err) {
      console.error('Failed to fetch server:', err)
    } finally {
      setLoading(false)
    }
  }, [serverId])

  const fetchWipeSchedules = useCallback(async () => {
    try {
      const res = await fetch(`/api/servers/wipe-schedules?serverId=${serverId}`, { credentials: 'include' })
      const data = await res.json()
      if (data.success) setWipeSchedules(data.data)
    } catch (err) {
      console.error('Failed to fetch wipe schedules:', err)
    }
  }, [serverId])

  useEffect(() => {
    fetchServer()
    fetchWipeSchedules()
    fetch('/api/identifier-categories', { credentials: 'include' })
      .then(r => r.json())
      .then(setCategories)
      .catch(() => {})
  }, [fetchServer, fetchWipeSchedules])

  // Populate form when server loads
  useEffect(() => {
    if (server) {
      setName(server.name)
      setDescription(server.description || '')
      setCategoryId(server.categoryId)
      setBotToken(server.botToken || '')
      setRegion(server.region)
      setTimezone(server.timezone)
      setTeamLimit(server.teamLimit)
      setImageUrl(server.imageUrl || '')
      setIconUrl(server.iconUrl || '')
    }
  }, [server])

  function copyToClipboard(text: string, key: string) {
    navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  async function handleSave() {
    if (!server) return
    setSaving(true)
    try {
      const res = await fetch(`/api/identifiers/${server.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim() || undefined,
          description: description.trim() || null,
          categoryId,
          botToken: botToken.trim() || null,
          region,
          timezone,
          teamLimit,
          imageUrl: imageUrl.trim() || null,
          iconUrl: iconUrl.trim() || null,
        }),
      })
      if (res.ok) {
        router.push(`/dashboard/servers/${serverId}`)
      }
    } catch (err) {
      console.error('Failed to save:', err)
    } finally {
      setSaving(false)
    }
  }

  async function addWipeSchedule() {
    if (!server) return
    setAddingSchedule(true)
    try {
      const res = await fetch('/api/servers/wipe-schedules', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serverIdentifierId: server.id,
          ...newSchedule
        })
      })
      const data = await res.json()
      if (data.success) {
        setWipeSchedules(prev => [...prev, data.data])
      }
    } catch (err) {
      console.error('Failed to add schedule:', err)
    } finally {
      setAddingSchedule(false)
    }
  }

  async function deleteWipeSchedule(scheduleId: string) {
    try {
      const res = await fetch('/api/servers/wipe-schedules', {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: scheduleId })
      })
      if (res.ok) {
        setWipeSchedules(prev => prev.filter(s => s.id !== scheduleId))
      }
    } catch (err) {
      console.error('Failed to delete schedule:', err)
    }
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-10 h-10 rounded-lg animate-pulse" style={{ background: 'var(--glass-bg)' }} />
          <div className="h-8 w-48 rounded-lg animate-pulse" style={{ background: 'var(--glass-bg)' }} />
        </div>
        <div className="space-y-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-48 rounded-xl animate-pulse" style={{ background: 'var(--glass-bg)' }} />
          ))}
        </div>
      </div>
    )
  }

  if (!server) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center">
        <p className="text-[var(--text-muted)]">Server not found</p>
        <Link href="/dashboard/servers" className="text-[var(--accent-primary)] text-sm mt-2 inline-block">
          Back to servers
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Link
          href={`/dashboard/servers/${serverId}`}
          className="p-2 rounded-lg transition-colors hover:bg-[var(--bg-card-hover)]"
          style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}
        >
          <ArrowLeft className="w-5 h-5 text-[var(--text-secondary)]" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Edit Server</h1>
          <p className="text-sm text-[var(--text-secondary)]">{server.name}</p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Server Identity */}
        <GlassContainer variant="static" padding="lg" radius="md">
          <h2 className="text-lg font-semibold text-white mb-1 flex items-center gap-2">
            <Server className="h-5 w-5 text-[var(--accent-primary)]" />
            Server Identity
          </h2>
          <p className="text-sm text-[var(--text-muted)] mb-4">Basic server identification</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">Name</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full px-4 py-3 rounded-xl text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)]"
                style={{ background: 'var(--bg-input)', border: '1px solid var(--glass-border)' }}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">Description</label>
              <input
                type="text"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Optional"
                className="w-full px-4 py-3 rounded-xl text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)]"
                style={{ background: 'var(--bg-input)', border: '1px solid var(--glass-border)' }}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">Category</label>
              <Dropdown
                value={categoryId}
                onChange={value => setCategoryId(value)}
                options={categories.map(cat => ({ value: cat.id, label: cat.name }))}
                emptyOption="No category"
                clearable
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">Server ID</label>
              <div className="flex items-center gap-2">
                <code className="flex-1 px-3 py-2.5 rounded-xl text-xs font-mono truncate" style={{ background: 'var(--bg-input)', color: 'var(--accent-primary)', border: '1px solid var(--glass-border)' }}>
                  {server.hashedId}
                </code>
                <button
                  onClick={() => copyToClipboard(server.hashedId, 'hashedId')}
                  className="p-2.5 rounded-xl hover:bg-[var(--bg-card-hover)]"
                  style={{ border: '1px solid var(--glass-border)' }}
                >
                  {copied === 'hashedId' ? <Check className="w-4 h-4 text-[var(--status-success)]" /> : <Copy className="w-4 h-4 text-[var(--text-muted)]" />}
                </button>
              </div>
            </div>
          </div>
        </GlassContainer>

        {/* Network (read-only) */}
        <GlassContainer variant="static" padding="lg" radius="md">
          <h2 className="text-lg font-semibold text-white mb-1 flex items-center gap-2">
            <Globe className="h-5 w-5 text-[var(--status-success)]" />
            Network
          </h2>
          <p className="text-sm text-[var(--text-muted)] mb-4">Set automatically by the game plugin</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">IP Address</label>
              <div className="px-4 py-3 rounded-xl text-sm font-mono" style={{ background: 'var(--bg-input)', border: '1px solid var(--glass-border)', color: 'var(--text-muted)' }}>
                {server.ip || 'Not set'}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">Port</label>
              <div className="px-4 py-3 rounded-xl text-sm font-mono" style={{ background: 'var(--bg-input)', border: '1px solid var(--glass-border)', color: 'var(--text-muted)' }}>
                {server.port || 'Not set'}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">Connect Endpoint</label>
              <div className="px-4 py-3 rounded-xl text-sm font-mono truncate" style={{ background: 'var(--bg-input)', border: '1px solid var(--glass-border)', color: 'var(--text-muted)' }}>
                {server.connectEndpoint || 'Not set'}
              </div>
            </div>
          </div>
        </GlassContainer>

        {/* Bot Configuration */}
        <GlassContainer variant="static" padding="lg" radius="md">
          <h2 className="text-lg font-semibold text-white mb-1 flex items-center gap-2">
            <Bot className="h-5 w-5 text-[var(--status-warning)]" />
            Bot Configuration
          </h2>
          <p className="text-sm text-[var(--text-muted)] mb-4">Discord bot and game server settings</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">Region</label>
              <Dropdown
                value={region}
                onChange={value => setRegion(value)}
                options={REGIONS}
                emptyOption="Not set"
                clearable
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">Timezone</label>
              <Dropdown
                value={timezone}
                onChange={value => setTimezone(value)}
                options={TIMEZONES}
                emptyOption="Not set"
                clearable
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">Team Limit</label>
              <Dropdown
                value={teamLimit}
                onChange={value => setTeamLimit(value)}
                options={TEAM_LIMITS}
                emptyOption="Not set"
                clearable
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">Discord Bot Token</label>
              <input
                type="text"
                value={botToken}
                onChange={e => setBotToken(e.target.value)}
                placeholder="Optional — Discord bot token for this server"
                className="w-full px-4 py-3 rounded-xl text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)] font-mono text-xs"
                style={{ background: 'var(--bg-input)', border: '1px solid var(--glass-border)' }}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">Image URL</label>
              <input
                type="text"
                value={imageUrl}
                onChange={e => setImageUrl(e.target.value)}
                placeholder="Server banner image URL"
                className="w-full px-4 py-3 rounded-xl text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)]"
                style={{ background: 'var(--bg-input)', border: '1px solid var(--glass-border)' }}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">Icon URL</label>
              <input
                type="text"
                value={iconUrl}
                onChange={e => setIconUrl(e.target.value)}
                placeholder="Server icon / bot avatar URL"
                className="w-full px-4 py-3 rounded-xl text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)]"
                style={{ background: 'var(--bg-input)', border: '1px solid var(--glass-border)' }}
              />
            </div>
          </div>
        </GlassContainer>

        {/* Wipe Schedule */}
        <GlassContainer variant="static" padding="lg" radius="md">
          <h2 className="text-lg font-semibold text-white mb-1 flex items-center gap-2">
            <Calendar className="h-5 w-5 text-[var(--status-info)]" />
            Wipe Schedule {timezone ? `(${getTzAbbrev(timezone)})` : ''}
          </h2>
          <p className="text-sm text-[var(--text-muted)] mb-4">Times are in the server&apos;s timezone{timezone && timezone !== 'America/New_York' ? ' — EST shown in parentheses' : ''}</p>

          {wipeSchedules.length === 0 ? (
            <p className="text-xs text-[var(--text-muted)] mb-4">No wipe schedules configured</p>
          ) : (
            <div className="space-y-2 mb-4">
              {wipeSchedules.map((schedule) => (
                <div key={schedule.id} className="flex items-center justify-between p-3 rounded-xl" style={{ background: 'var(--bg-input)', border: '1px solid var(--glass-border)' }}>
                  <div className="flex items-center gap-3">
                    <span
                      className="px-2 py-0.5 rounded text-xs font-medium"
                      style={{
                        background: schedule.wipeType === "bp" ? 'rgba(168, 85, 247, 0.2)' : 'rgba(59, 130, 246, 0.2)',
                        color: schedule.wipeType === "bp" ? 'rgb(192, 132, 252)' : 'rgb(96, 165, 250)',
                      }}
                    >
                      {WIPE_TYPES.find(t => t.value === schedule.wipeType)?.label || schedule.wipeType}
                    </span>
                    <span className="text-sm text-[var(--text-primary)]">
                      {DAYS_OF_WEEK[schedule.dayOfWeek]} at {formatTime12(schedule.hour, schedule.minute)} {timezone ? getTzAbbrev(timezone) : ''}
                      {timezone && timezone !== 'America/New_York' && (() => {
                        const est = convertToEst(schedule.hour, schedule.minute, schedule.dayOfWeek, timezone)
                        return <span className="text-[var(--text-muted)]"> ({formatTime12(est.hour, est.minute)} EST)</span>
                      })()}
                    </span>
                  </div>
                  <button
                    onClick={() => deleteWipeSchedule(schedule.id)}
                    className="p-1.5 rounded-lg hover:bg-[var(--status-error)]/10 transition-colors"
                  >
                    <Trash2 className="w-4 h-4 text-[var(--text-muted)] hover:text-[var(--status-error)]" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-2">
            <Dropdown
              value={String(newSchedule.dayOfWeek)}
              onChange={(value) => setNewSchedule({ ...newSchedule, dayOfWeek: parseInt(value ?? '0') })}
              options={DAYS_OF_WEEK.map((day, i) => ({ value: String(i), label: day }))}
            />
            <div className="flex items-center gap-1">
              <input
                type="number"
                min={0}
                max={23}
                value={newSchedule.hour}
                onChange={(e) => setNewSchedule({ ...newSchedule, hour: parseInt(e.target.value) || 0 })}
                className="w-14 px-2 py-2.5 rounded-lg text-xs text-center text-[var(--text-primary)]"
                style={{ background: 'var(--bg-input)', border: '1px solid var(--glass-border)' }}
              />
              <span className="text-[var(--text-muted)]">:</span>
              <input
                type="number"
                min={0}
                max={59}
                value={newSchedule.minute}
                onChange={(e) => setNewSchedule({ ...newSchedule, minute: parseInt(e.target.value) || 0 })}
                className="w-14 px-2 py-2.5 rounded-lg text-xs text-center text-[var(--text-primary)]"
                style={{ background: 'var(--bg-input)', border: '1px solid var(--glass-border)' }}
              />
            </div>
            <Dropdown
              value={newSchedule.wipeType}
              onChange={(value) => setNewSchedule({ ...newSchedule, wipeType: value ?? '' })}
              options={WIPE_TYPES.map((t) => ({ value: t.value, label: t.label }))}
            />
            <button
              onClick={addWipeSchedule}
              disabled={addingSchedule}
              className="flex items-center gap-1 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
              style={{ background: 'var(--accent-primary)', color: 'white' }}
            >
              <Plus className="w-3 h-3" />
              {addingSchedule ? 'Adding...' : 'Add'}
            </button>
          </div>
        </GlassContainer>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <button
            onClick={() => router.push(`/dashboard/servers/${serverId}`)}
            className="px-5 py-2.5 rounded-xl text-sm font-medium transition-colors"
            style={{ background: 'var(--bg-input)', color: 'var(--text-secondary)', border: '1px solid var(--glass-border)' }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
            style={{ background: 'var(--accent-primary)', color: 'white' }}
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}
