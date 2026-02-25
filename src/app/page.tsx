import Link from 'next/link'
import {
  Crosshair,
  Users,
  Server,
  Package,
  Shield,
  Trophy,
  Target,
  ArrowRight,
  TrendingUp,
} from 'lucide-react'
import { Header } from '@/components/global/Header'
import { Footer } from '@/components/global/Footer'
import { PageBackground } from '@/components/global/PageBackground'
import { ServerKitBrowser, type PortalServer, type PortalKit } from '@/components/portal/ServerKitBrowser'
import { prisma } from '@/lib/db'
import type { KitsData } from '@/types/kit'

export const revalidate = 300

async function getPortalData() {
  try {
    const [
      serverCount,
      kitStatsCount,
      kitAggregates,
      clanCount,
      topKits,
      kitMappings,
    ] = await Promise.all([
      prisma.serverIdentifier.count(),
      prisma.kitGlobalStats.count(),
      prisma.kitGlobalStats.aggregate({
        _sum: { totalRedemptions: true, uniquePlayers: true },
      }),
      prisma.clan.count(),
      prisma.kitGlobalStats.findMany({
        orderBy: { totalRedemptions: 'desc' },
        take: 5,
        select: { kitName: true, totalRedemptions: true, uniquePlayers: true },
      }),
      prisma.kitMapping.findMany({
        where: { isLive: true, minutesAfterWipe: null },
        include: {
          config: { select: { id: true, name: true, kitData: true } },
          serverIdentifier: {
            select: {
              id: true,
              name: true,
              categoryId: true,
              category: { select: { name: true } },
            },
          },
        },
      }),
    ])

    // Parse kit mappings into server-grouped structure
    const serverMap = new Map<string, PortalServer>()

    for (const mapping of kitMappings) {
      const si = mapping.serverIdentifier
      if (!serverMap.has(si.id)) {
        serverMap.set(si.id, {
          id: si.id,
          name: si.name,
          categoryName: si.category?.name ?? null,
          kits: [],
        })
      }

      try {
        const parsed: KitsData = JSON.parse(mapping.config.kitData)
        const kits = parsed._kits ?? {}
        const server = serverMap.get(si.id)!

        // Track kit names already added to this server to avoid duplicates
        const existingKitNames = new Set(server.kits.map((k) => k.name))

        for (const kit of Object.values(kits)) {
          if (kit.IsHidden) continue
          if (existingKitNames.has(kit.Name)) continue

          server.kits.push({
            name: kit.Name,
            description: kit.Description || '',
            image: kit.KitImage || '',
            color: kit.KitColor || '',
            cooldown: kit.Cooldown ?? 0,
            cost: kit.Cost ?? 0,
            itemCount:
              (kit.MainItems?.length ?? 0) +
              (kit.WearItems?.length ?? 0) +
              (kit.BeltItems?.length ?? 0),
            isAutoKit: kit.IsAutoKit ?? false,
            isStoreKit: kit.IsStoreKit ?? false,
            hasPermission: !!kit.RequiredPermission,
          } satisfies PortalKit)
          existingKitNames.add(kit.Name)
        }
      } catch {
        // Skip configs with invalid JSON
      }
    }

    // Sort kits within each server by order/name
    const servers = Array.from(serverMap.values())
      .filter((s) => s.kits.length > 0)
      .sort((a, b) => a.name.localeCompare(b.name))

    return {
      stats: {
        servers: serverCount,
        kits: kitStatsCount,
        players: kitAggregates._sum?.uniquePlayers ?? 0,
        claims: kitAggregates._sum?.totalRedemptions ?? 0,
        clans: clanCount,
      },
      topKits,
      servers,
    }
  } catch (error) {
    console.error('Failed to fetch portal data:', error)
    return {
      stats: { servers: 0, kits: 0, players: 0, claims: 0, clans: 0 },
      topKits: [],
      servers: [],
    }
  }
}

function formatNumber(num: number): string {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`
  return num.toLocaleString()
}

const STAT_ITEMS = [
  { key: 'players', label: 'Players Tracked', icon: Users },
  { key: 'servers', label: 'Servers', icon: Server },
  { key: 'kits', label: 'Kits Available', icon: Package },
  { key: 'clans', label: 'Clans', icon: Shield },
] as const

const FEATURES = [
  {
    href: '/leaderboards',
    icon: Trophy,
    title: 'Leaderboards',
    description:
      'Kit popularity rankings, server activity metrics, top players, and activity heatmaps across all servers.',
  },
  {
    href: '/stats',
    icon: Target,
    title: 'Player Stats',
    description:
      'Kill and death leaderboards, playtime tracking, and clan rankings with per-server filtering.',
  },
  {
    href: '#kits',
    icon: Package,
    title: 'Kit Browser',
    description:
      'Browse all available kits across every server — view items, cooldowns, costs, and permissions.',
  },
  {
    href: '/stats?view=clans',
    icon: Shield,
    title: 'Clans',
    description:
      'Clan prestige rankings, member stats, alliances, and cross-wipe progression tracking.',
  },
] as const

export default async function Home() {
  const { stats, topKits, servers } = await getPortalData()

  return (
    <PageBackground className="portal-root">
      <Header />

      <main className="pt-20">
        {/* Hero Section */}
        <section className="portal-band portal-band--hero">
          <div className="portal-band-inner text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-[var(--accent-primary-bg)] mb-6">
              <Crosshair className="w-10 h-10 text-[var(--accent-primary)]" />
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4">
              Your Rust Command Center
            </h1>
            <p className="text-lg text-[var(--text-secondary)] max-w-2xl mx-auto">
              Track your stats, climb the leaderboards, browse server kits, and
              manage your clan — all in one place.
            </p>
          </div>
        </section>

        {/* Live Stats Bar */}
        <section className="portal-band">
          <div className="portal-band-inner">
            <div className="portal-value-grid">
              {STAT_ITEMS.map((item, i) => {
                const Icon = item.icon
                const value = stats[item.key]
                return (
                  <div
                    key={item.key}
                    className="portal-value-card anim-stagger-item"
                    style={{ animationDelay: `${i * 50}ms` }}
                  >
                    <div className="w-12 h-12 rounded-xl bg-[var(--accent-primary-bg)] flex items-center justify-center mb-3">
                      <Icon className="w-6 h-6 text-[var(--accent-primary)]" />
                    </div>
                    <div className="text-2xl font-bold text-white mb-1">
                      {formatNumber(value)}
                    </div>
                    <div className="text-sm text-[var(--text-muted)]">
                      {item.label}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        {/* Feature Showcase */}
        <section className="portal-band">
          <div className="portal-band-inner">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {FEATURES.map((feature) => {
                const Icon = feature.icon
                const isAnchor = feature.href.startsWith('#')
                const inner = (
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-[var(--accent-primary-bg)] flex items-center justify-center flex-shrink-0">
                      <Icon className="w-6 h-6 text-[var(--accent-primary)]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-lg font-semibold text-[var(--text-primary)]">
                          {feature.title}
                        </h3>
                        <ArrowRight className="w-4 h-4 text-[var(--text-muted)]" />
                      </div>
                      <p className="text-sm text-[var(--text-muted)] leading-relaxed">
                        {feature.description}
                      </p>
                    </div>
                  </div>
                )

                const cardClass =
                  'block p-6 rounded-[var(--radius-lg)] transition-all duration-200 hover:scale-[1.01]'

                const cardStyle = {
                  background: 'var(--glass-bg)',
                  border: '1px solid var(--glass-border)',
                }

                return isAnchor ? (
                  <a
                    key={feature.title}
                    href={feature.href}
                    className={cardClass}
                    style={cardStyle}
                  >
                    {inner}
                  </a>
                ) : (
                  <Link
                    key={feature.title}
                    href={feature.href}
                    className={cardClass}
                    style={cardStyle}
                  >
                    {inner}
                  </Link>
                )
              })}
            </div>
          </div>
        </section>

        {/* Server Kit Browser */}
        {servers.length > 0 && (
          <section id="kits" className="portal-band">
            <div className="portal-band-inner">
              <div className="flex items-center gap-3 mb-6">
                <Package className="w-6 h-6 text-[var(--accent-primary)]" />
                <h2 className="text-2xl font-bold text-[var(--text-primary)]">
                  Kits by Server
                </h2>
              </div>
              <ServerKitBrowser servers={servers} />
            </div>
          </section>
        )}

        {/* Top Kits Teaser */}
        {topKits.length > 0 && (
          <section className="portal-band">
            <div className="portal-band-inner">
              <div
                className="p-6 rounded-[var(--radius-lg)]"
                style={{
                  background: 'var(--glass-bg)',
                  border: '1px solid var(--glass-border)',
                }}
              >
                <div className="flex items-center gap-2 mb-5">
                  <TrendingUp className="w-5 h-5 text-[var(--accent-primary)]" />
                  <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                    Most Popular Kits
                  </h2>
                  <span className="text-xs text-[var(--text-muted)] ml-auto">
                    All-time
                  </span>
                </div>

                <div className="space-y-2">
                  {topKits.map((kit, index) => (
                    <Link
                      key={kit.kitName}
                      href={`/kits/${encodeURIComponent(kit.kitName)}`}
                      className="flex items-center gap-4 p-3 rounded-[var(--radius-md)] bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)] transition-colors"
                    >
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                          index === 0
                            ? 'bg-[var(--status-warning)]/20 text-[var(--status-warning)]'
                            : index === 1
                            ? 'bg-[var(--text-muted)]/20 text-[var(--text-secondary)]'
                            : index === 2
                            ? 'bg-[var(--status-warning)]/20 text-[var(--status-warning)]'
                            : 'bg-[var(--bg-input)] text-[var(--text-muted)]'
                        }`}
                      >
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-[var(--text-primary)]">
                          {kit.kitName}
                        </div>
                        <div className="text-xs text-[var(--text-muted)]">
                          {kit.uniquePlayers.toLocaleString()} players
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-[var(--accent-primary)]">
                          {formatNumber(kit.totalRedemptions)}
                        </div>
                        <div className="text-xs text-[var(--text-muted)]">
                          claims
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>

                <div className="mt-4 text-center">
                  <Link
                    href="/leaderboards"
                    className="inline-flex items-center gap-2 text-sm font-medium text-[var(--accent-primary)] hover:underline"
                  >
                    View Full Leaderboards
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            </div>
          </section>
        )}
      </main>

      <Footer />
    </PageBackground>
  )
}
