'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Package,
  ChevronDown,
  ChevronRight,
  Server,
  Clock,
  Coins,
  Layers,
  Shield,
  ShoppingCart,
  Zap,
} from 'lucide-react'

// Serializable kit shape passed from the server component
export interface PortalKit {
  name: string
  description: string
  image: string
  color: string
  cooldown: number
  cost: number
  itemCount: number
  isAutoKit: boolean
  isStoreKit: boolean
  hasPermission: boolean
}

export interface PortalServer {
  id: string
  name: string
  categoryName: string | null
  kits: PortalKit[]
}

function formatCooldown(seconds: number): string {
  if (seconds <= 0) return 'None'
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`
  return `${Math.floor(seconds / 86400)}d`
}

function KitCard({ kit }: { kit: PortalKit }) {
  return (
    <Link
      href={`/kits/${encodeURIComponent(kit.name)}`}
      className="group block rounded-[var(--radius-lg)] p-4 transition-all duration-200 hover:scale-[1.02]"
      style={{
        background: 'var(--glass-bg)',
        border: '1px solid var(--glass-border)',
      }}
    >
      {/* Kit Image / Icon */}
      <div className="flex items-start gap-3 mb-3">
        <div
          className="w-12 h-12 rounded-[var(--radius-md)] flex items-center justify-center flex-shrink-0"
          style={{
            background: kit.color
              ? `#${kit.color}20`
              : 'var(--accent-primary-bg)',
          }}
        >
          {kit.image ? (
            <img
              src={kit.image}
              alt={kit.name}
              className="w-8 h-8 object-contain"
            />
          ) : (
            <Package
              className="w-6 h-6"
              style={{
                color: kit.color
                  ? `#${kit.color}`
                  : 'var(--accent-primary)',
              }}
            />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-[var(--text-primary)] truncate group-hover:text-[var(--accent-primary)] transition-colors">
            {kit.name}
          </h4>
          {kit.description && (
            <p className="text-xs text-[var(--text-muted)] line-clamp-2 mt-0.5">
              {kit.description}
            </p>
          )}
        </div>
      </div>

      {/* Stats Row */}
      <div className="flex items-center gap-3 text-xs text-[var(--text-secondary)]">
        <span className="flex items-center gap-1">
          <Clock className="w-3 h-3 text-[var(--text-muted)]" />
          {formatCooldown(kit.cooldown)}
        </span>
        {kit.cost > 0 && (
          <span className="flex items-center gap-1">
            <Coins className="w-3 h-3 text-[var(--text-muted)]" />
            {kit.cost.toLocaleString()}
          </span>
        )}
        <span className="flex items-center gap-1">
          <Layers className="w-3 h-3 text-[var(--text-muted)]" />
          {kit.itemCount} items
        </span>
      </div>

      {/* Badges */}
      {(kit.isAutoKit || kit.isStoreKit || kit.hasPermission) && (
        <div className="flex flex-wrap gap-1.5 mt-2.5">
          {kit.isAutoKit && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-[var(--status-info)]/15 text-[var(--status-info)]">
              <Zap className="w-2.5 h-2.5" /> Auto
            </span>
          )}
          {kit.isStoreKit && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-[var(--status-success)]/15 text-[var(--status-success)]">
              <ShoppingCart className="w-2.5 h-2.5" /> Store
            </span>
          )}
          {kit.hasPermission && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-[var(--status-warning)]/15 text-[var(--status-warning)]">
              <Shield className="w-2.5 h-2.5" /> VIP
            </span>
          )}
        </div>
      )}
    </Link>
  )
}

export function ServerKitBrowser({ servers }: { servers: PortalServer[] }) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  if (servers.length === 0) return null

  const toggleServer = (id: string) => {
    setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  return (
    <div className="space-y-4">
      {servers.map((server) => {
        const isCollapsed = collapsed[server.id] ?? false

        return (
          <div
            key={server.id}
            className="rounded-[var(--radius-lg)] overflow-hidden"
            style={{
              background: 'var(--glass-bg-subtle)',
              border: '1px solid var(--glass-border)',
            }}
          >
            {/* Server Header */}
            <button
              onClick={() => toggleServer(server.id)}
              className="w-full flex items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-[var(--bg-card-hover)]"
            >
              <Server className="w-5 h-5 text-[var(--accent-primary)] flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="font-semibold text-[var(--text-primary)]">
                  {server.name}
                </span>
                {server.categoryName && (
                  <span className="ml-2 text-xs text-[var(--text-muted)]">
                    {server.categoryName}
                  </span>
                )}
              </div>
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-[var(--accent-primary)]/15 text-[var(--accent-primary)]">
                {server.kits.length} kit{server.kits.length !== 1 ? 's' : ''}
              </span>
              {isCollapsed ? (
                <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />
              ) : (
                <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />
              )}
            </button>

            {/* Kit Grid */}
            {!isCollapsed && (
              <div className="px-5 pb-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {server.kits.map((kit) => (
                    <KitCard key={kit.name} kit={kit} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
