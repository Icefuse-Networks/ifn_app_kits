"use client";

import React from 'react'
import { Package, Zap, ChevronRight, Activity, TrendingUp, Layers } from 'lucide-react'
import Link from 'next/link'
import { dashboardSections } from '@/config/navigation'
import { GlassContainer } from '@/components/global/GlassContainer'

const quickStats: Array<{ label: string; value: string; change: string; changeType: 'positive' | 'negative' | 'neutral'; icon: React.ComponentType<{ className?: string }> }> = [
  { label: 'Active Kits', value: '24', change: '+3', changeType: 'positive', icon: Package },
  { label: 'Total Claims', value: '12.4K', change: '+18%', changeType: 'positive', icon: Activity },
  { label: 'Active Servers', value: '8', change: '0', changeType: 'neutral', icon: Layers },
  { label: 'API Calls Today', value: '2.1K', change: '+5%', changeType: 'positive', icon: TrendingUp },
]

export default function DashboardPage() {
  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <div className="anim-fade-slide-up">
        <div className="mb-10">
          <div className="flex items-center gap-4 mb-2">
            <div className="p-3 rounded-2xl bg-[var(--accent-primary)]/20 border border-[var(--accent-primary)]/20">
              <Zap className="h-7 w-7 text-[var(--accent-primary)]" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-[var(--text-primary)]">Dashboard</h1>
              <p className="text-[var(--text-muted)]">Rust plugin management for Icefuse servers</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
          {quickStats.map((stat, i) => (
            <div
              key={stat.label}
              className="anim-stagger-item"
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <GlassContainer variant="static" padding="md" radius="md">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <p className="text-xs text-[var(--text-muted)] uppercase tracking-wide mb-1">
                      {stat.label}
                    </p>
                    <p className="text-2xl font-bold text-[var(--text-primary)]">{stat.value}</p>
                    {stat.change && (
                      <p className={`text-xs mt-1 ${
                        stat.changeType === 'positive' ? 'text-[var(--status-success)]' :
                        stat.changeType === 'negative' ? 'text-[var(--status-error)]' :
                        'text-[var(--text-muted)]'
                      }`}>{stat.change}</p>
                    )}
                  </div>
                  <div className="p-3 rounded-lg shrink-0 bg-[var(--accent-primary)]/15 text-[var(--accent-primary)]">
                    <stat.icon className="h-5 w-5" />
                  </div>
                </div>
              </GlassContainer>
            </div>
          ))}
        </div>

        <div className="space-y-10">
          {dashboardSections.map((section, sectionIndex) => (
            <div
              key={section.title}
              className="anim-stagger-item"
              style={{ animationDelay: `${200 + sectionIndex * 100}ms` }}
            >
              <div className="mb-4">
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">{section.title}</h2>
                <p className="text-sm text-[var(--text-muted)]">{section.description}</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {section.items.map((item, itemIndex) => (
                  <div
                    key={item.href}
                    className="anim-stagger-item"
                    style={{ animationDelay: `${250 + sectionIndex * 100 + itemIndex * 50}ms` }}
                  >
                    <Link href={item.href} className="group h-full">
                      <GlassContainer
                        variant="default"
                        padding="lg"
                        radius="lg"
                        interactive
                        features={{ hoverGlow: true, hoverLift: false }}
                        className="flex flex-col h-full"
                      >
                        <div className="flex items-start justify-between mb-4">
                          <div className={`p-3 rounded-xl bg-gradient-to-br ${item.gradient}`}>
                            <item.icon className="h-5 w-5 text-white" />
                          </div>
                          <ChevronRight className="h-5 w-5 text-[var(--text-muted)] group-hover:text-[var(--accent-primary)] group-hover:translate-x-1 transition-all" />
                        </div>
                        <h3 className="text-base font-semibold text-[var(--text-primary)] group-hover:text-[var(--accent-primary)] transition-colors mb-1">
                          {item.label}
                        </h3>
                        <p className="text-sm text-[var(--text-muted)] leading-relaxed">
                          {item.desc}
                        </p>
                      </GlassContainer>
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
