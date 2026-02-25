"use client";

import { Package, Zap, ChevronRight, Activity, TrendingUp, Layers } from 'lucide-react'
import Link from 'next/link'
import { dashboardSections } from '@/config/navigation'
import { StatCard } from '@/components/ui/Card'

const quickStats = [
  { label: 'Active Kits', value: '24', change: '+3', changeType: 'positive' as const, icon: Package },
  { label: 'Total Claims', value: '12.4K', change: '+18%', changeType: 'positive' as const, icon: Activity },
  { label: 'Active Servers', value: '8', change: '0', changeType: 'neutral' as const, icon: Layers },
  { label: 'API Calls Today', value: '2.1K', change: '+5%', changeType: 'positive' as const, icon: TrendingUp },
]

export default function DashboardPage() {
  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <div className="anim-fade-slide-up">
        <div className="mb-10">
          <div className="flex items-center gap-4 mb-2">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-blue-500/20 to-indigo-500/20 border border-blue-500/20">
              <Zap className="h-7 w-7 text-blue-400" />
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
              <StatCard
                icon={<stat.icon className="h-5 w-5" />}
                label={stat.label}
                value={stat.value}
                change={stat.change}
                changeType={stat.changeType}
              />
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
                    <Link
                      href={item.href}
                      className="group flex flex-col p-5 rounded-2xl bg-[var(--glass-bg)] border border-[var(--glass-border)] hover:border-[var(--glass-border-prominent)] hover:bg-[var(--glass-bg-prominent)] transition-all duration-200 h-full"
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
