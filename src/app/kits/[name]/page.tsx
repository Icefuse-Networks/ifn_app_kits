/**
 * Public Kit Detail Page
 *
 * Displays kit contents and details for public viewing.
 * No authentication required.
 */

'use client'

import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  Package,
  Clock,
  Coins,
  ShoppingCart,
  Zap,
  Lock,
  RefreshCw,
  Shirt,
  Backpack,
} from 'lucide-react'
import { Footer } from '@/components/global/Footer'
import { getItemImageUrl } from '@/lib/rust-items'

// Types
interface KitItem {
  Shortname: string
  Skin: number | string
  Amount: number
  Condition: number
  Contents: KitItem[] | null
}

interface KitData {
  name: string
  description: string
  cooldown: number
  cost: number
  isHidden: boolean
  isAutoKit: boolean
  isStoreKit: boolean
  kitImage: string | null
  requiresPermission: boolean
  mainItems: KitItem[]
  wearItems: KitItem[]
  beltItems: KitItem[]
}

interface KitResponse {
  kit: KitData
  stats: {
    totalItems: number
    mainItems: number
    wearItems: number
    beltItems: number
  }
  config: {
    name: string
  }
}

// Wear slot names
const WEAR_SLOT_NAMES = [
  'Head',
  'Chest',
  'Shirt',
  'Pants',
  'Kilt',
  'Boots',
  'Gloves',
  'Back',
]

function formatCooldown(seconds: number): string {
  if (seconds <= 0) return 'No cooldown'
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`
  return `${Math.floor(seconds / 86400)}d`
}

function ItemSlot({ item, label }: { item: KitItem | null; label?: string }) {
  if (!item) {
    return (
      <div
        className="aspect-square rounded-[var(--radius-md)] flex items-center justify-center"
        style={{
          background: 'var(--bg-input)',
          border: '1px solid var(--glass-border)',
        }}
      >
        {label && (
          <span className="text-[10px] text-[var(--text-muted)]">{label}</span>
        )}
      </div>
    )
  }

  const hasContents = item.Contents && item.Contents.length > 0

  return (
    <div
      className="aspect-square rounded-[var(--radius-md)] relative group overflow-hidden"
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--glass-border)',
      }}
      title={`${item.Shortname}${item.Amount > 1 ? ` x${item.Amount}` : ''}`}
    >
      {/* Item image */}
      <img
        src={getItemImageUrl(item.Shortname)}
        alt={item.Shortname}
        className="absolute inset-1 object-contain"
        onError={(e) => {
          e.currentTarget.style.display = 'none'
        }}
      />

      {/* Amount badge */}
      {item.Amount > 1 && (
        <div className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-[var(--bg-root)]/80 text-[var(--text-primary)]">
          x{item.Amount}
        </div>
      )}

      {/* Contents indicator */}
      {hasContents && (
        <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[var(--accent-primary)]" />
      )}

      {/* Condition bar */}
      {item.Condition < 1 && (
        <div
          className="absolute bottom-0 left-0 right-0 h-1"
          style={{ background: 'var(--bg-input)' }}
        >
          <div
            className="h-full"
            style={{
              width: `${item.Condition * 100}%`,
              background:
                item.Condition > 0.5
                  ? 'var(--status-success)'
                  : item.Condition > 0.25
                  ? 'var(--status-warning)'
                  : 'var(--status-error)',
            }}
          />
        </div>
      )}

      {/* Hover tooltip with contents */}
      {hasContents && (
        <div className="absolute inset-0 bg-[var(--bg-root)]/95 opacity-0 group-hover:opacity-100 transition-opacity p-1 overflow-auto">
          <div className="text-[9px] text-[var(--text-secondary)] font-medium mb-1">
            Contains:
          </div>
          <div className="grid grid-cols-3 gap-0.5">
            {item.Contents!.slice(0, 6).map((content, i) => (
              <div
                key={i}
                className="aspect-square rounded-sm overflow-hidden"
                style={{ background: 'var(--bg-card)' }}
              >
                <img
                  src={getItemImageUrl(content.Shortname)}
                  alt={content.Shortname}
                  className="w-full h-full object-contain"
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function KitDetailPage({
  params,
}: {
  params: Promise<{ name: string }>
}) {
  const { name } = use(params)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [kitData, setKitData] = useState<KitResponse | null>(null)

  useEffect(() => {
    async function fetchKit() {
      setLoading(true)
      setError(null)

      try {
        const response = await fetch(`/api/public/kits/${encodeURIComponent(name)}`)

        if (!response.ok) {
          if (response.status === 404) {
            throw new Error('Kit not found')
          }
          throw new Error('Failed to fetch kit data')
        }

        const data = await response.json()
        setKitData(data)
      } catch (err) {
        console.error('Failed to fetch kit:', err)
        setError(err instanceof Error ? err.message : 'Failed to load kit')
      } finally {
        setLoading(false)
      }
    }

    fetchKit()
  }, [name])

  return (
    <div className="min-h-screen bg-[var(--bg-root)] flex flex-col">
      {/* Header */}
      <header
        className="border-b"
        style={{
          background: 'var(--glass-bg)',
          borderColor: 'var(--glass-border)',
        }}
      >
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link
            href="/"
            className="text-xl font-bold text-[var(--text-primary)] hover:text-[var(--accent-primary)] transition-colors"
          >
            Icefuse Kit Manager
          </Link>
          <nav className="flex items-center gap-4">
            <Link
              href="/leaderboards"
              className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            >
              Leaderboards
            </Link>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-4xl mx-auto px-4 py-8 w-full">
        {/* Back link */}
        <Link
          href="/leaderboards"
          className="inline-flex items-center gap-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Leaderboards
        </Link>

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="w-8 h-8 text-[var(--accent-primary)] animate-spin" />
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div
            className="p-6 rounded-[var(--radius-lg)] text-center"
            style={{
              background: 'var(--glass-bg)',
              border: '1px solid var(--glass-border)',
            }}
          >
            <Package className="w-12 h-12 mx-auto mb-4 text-[var(--text-muted)]" />
            <h1 className="text-xl font-bold text-[var(--text-primary)] mb-2">
              {error}
            </h1>
            <p className="text-[var(--text-secondary)]">
              The kit you&apos;re looking for may have been removed or doesn&apos;t exist.
            </p>
          </div>
        )}

        {/* Kit Content */}
        {kitData && !loading && (
          <div className="space-y-6">
            {/* Kit Header */}
            <div
              className="p-6 rounded-[var(--radius-lg)]"
              style={{
                background: 'var(--glass-bg)',
                border: '1px solid var(--glass-border)',
              }}
            >
              <div className="flex items-start gap-4">
                {/* Kit image or icon */}
                <div
                  className="w-20 h-20 rounded-[var(--radius-md)] flex items-center justify-center flex-shrink-0"
                  style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--glass-border)',
                  }}
                >
                  {kitData.kit.kitImage ? (
                    <img
                      src={kitData.kit.kitImage}
                      alt={kitData.kit.name}
                      className="w-full h-full object-cover rounded-[var(--radius-md)]"
                    />
                  ) : (
                    <Package className="w-10 h-10 text-[var(--accent-primary)]" />
                  )}
                </div>

                {/* Kit info */}
                <div className="flex-1 min-w-0">
                  <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">
                    {kitData.kit.name}
                  </h1>

                  {kitData.kit.description && (
                    <p className="text-[var(--text-secondary)] mb-4">
                      {kitData.kit.description}
                    </p>
                  )}

                  {/* Badges */}
                  <div className="flex flex-wrap gap-2">
                    {kitData.kit.isStoreKit && (
                      <span
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                        style={{
                          background: 'rgba(var(--status-success-rgb), 0.15)',
                          color: 'var(--status-success)',
                          border: '1px solid var(--status-success)',
                        }}
                      >
                        <ShoppingCart className="w-3 h-3" />
                        Store Kit
                      </span>
                    )}

                    {kitData.kit.isAutoKit && (
                      <span
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                        style={{
                          background: 'rgba(var(--status-info-rgb), 0.15)',
                          color: 'var(--status-info)',
                          border: '1px solid var(--status-info)',
                        }}
                      >
                        <Zap className="w-3 h-3" />
                        Auto Kit
                      </span>
                    )}

                    {kitData.kit.requiresPermission && (
                      <span
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                        style={{
                          background: 'rgba(var(--status-warning-rgb), 0.15)',
                          color: 'var(--status-warning)',
                          border: '1px solid var(--status-warning)',
                        }}
                      >
                        <Lock className="w-3 h-3" />
                        Requires Permission
                      </span>
                    )}

                    {kitData.kit.cooldown > 0 && (
                      <span
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                        style={{
                          background: 'var(--glass-bg)',
                          color: 'var(--text-secondary)',
                          border: '1px solid var(--glass-border)',
                        }}
                      >
                        <Clock className="w-3 h-3" />
                        {formatCooldown(kitData.kit.cooldown)} cooldown
                      </span>
                    )}

                    {kitData.kit.cost > 0 && (
                      <span
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                        style={{
                          background: 'var(--glass-bg)',
                          color: 'var(--text-secondary)',
                          border: '1px solid var(--glass-border)',
                        }}
                      >
                        <Coins className="w-3 h-3" />
                        {kitData.kit.cost.toLocaleString()} cost
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Item Stats */}
            <div className="grid grid-cols-3 gap-4">
              <div
                className="p-4 rounded-[var(--radius-md)] text-center"
                style={{
                  background: 'var(--glass-bg)',
                  border: '1px solid var(--glass-border)',
                }}
              >
                <div className="text-2xl font-bold text-[var(--accent-primary)]">
                  {kitData.stats.mainItems}
                </div>
                <div className="text-xs text-[var(--text-muted)]">Main Items</div>
              </div>
              <div
                className="p-4 rounded-[var(--radius-md)] text-center"
                style={{
                  background: 'var(--glass-bg)',
                  border: '1px solid var(--glass-border)',
                }}
              >
                <div className="text-2xl font-bold text-[var(--status-info)]">
                  {kitData.stats.wearItems}
                </div>
                <div className="text-xs text-[var(--text-muted)]">Wear Items</div>
              </div>
              <div
                className="p-4 rounded-[var(--radius-md)] text-center"
                style={{
                  background: 'var(--glass-bg)',
                  border: '1px solid var(--glass-border)',
                }}
              >
                <div className="text-2xl font-bold text-[var(--status-success)]">
                  {kitData.stats.beltItems}
                </div>
                <div className="text-xs text-[var(--text-muted)]">Belt Items</div>
              </div>
            </div>

            {/* Wear Items */}
            {kitData.stats.wearItems > 0 && (
              <div
                className="p-6 rounded-[var(--radius-lg)]"
                style={{
                  background: 'var(--glass-bg)',
                  border: '1px solid var(--glass-border)',
                }}
              >
                <div className="flex items-center gap-2 mb-4">
                  <Shirt className="w-5 h-5 text-[var(--status-info)]" />
                  <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                    Clothing & Armor
                  </h2>
                </div>
                <div className="grid grid-cols-8 gap-2">
                  {WEAR_SLOT_NAMES.map((slotName, index) => {
                    const item = kitData.kit.wearItems.find(
                      (i) => i.Shortname && index === kitData.kit.wearItems.indexOf(i)
                    ) || kitData.kit.wearItems[index] || null
                    return (
                      <ItemSlot
                        key={slotName}
                        item={item}
                        label={slotName}
                      />
                    )
                  })}
                </div>
              </div>
            )}

            {/* Belt Items */}
            {kitData.stats.beltItems > 0 && (
              <div
                className="p-6 rounded-[var(--radius-lg)]"
                style={{
                  background: 'var(--glass-bg)',
                  border: '1px solid var(--glass-border)',
                }}
              >
                <div className="flex items-center gap-2 mb-4">
                  <Package className="w-5 h-5 text-[var(--status-success)]" />
                  <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                    Hotbar
                  </h2>
                </div>
                <div className="grid grid-cols-6 gap-2">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <ItemSlot
                      key={index}
                      item={kitData.kit.beltItems[index] || null}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Main Inventory */}
            {kitData.stats.mainItems > 0 && (
              <div
                className="p-6 rounded-[var(--radius-lg)]"
                style={{
                  background: 'var(--glass-bg)',
                  border: '1px solid var(--glass-border)',
                }}
              >
                <div className="flex items-center gap-2 mb-4">
                  <Backpack className="w-5 h-5 text-[var(--accent-primary)]" />
                  <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                    Main Inventory
                  </h2>
                </div>
                <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-12 gap-2">
                  {kitData.kit.mainItems.map((item, index) => (
                    <ItemSlot key={index} item={item} />
                  ))}
                </div>
              </div>
            )}

            {/* Empty Kit */}
            {kitData.stats.totalItems === 0 && (
              <div
                className="p-6 rounded-[var(--radius-lg)] text-center"
                style={{
                  background: 'var(--glass-bg)',
                  border: '1px solid var(--glass-border)',
                }}
              >
                <Package className="w-12 h-12 mx-auto mb-4 text-[var(--text-muted)]" />
                <p className="text-[var(--text-secondary)]">
                  This kit has no items configured.
                </p>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <Footer />
    </div>
  )
}
