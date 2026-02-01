"use client";

import { motion } from "framer-motion";
import { Package, Zap, ChevronRight, Activity, TrendingUp, Layers } from 'lucide-react'
import Link from 'next/link'
import { dashboardSections } from '@/config/navigation'

const quickStats = [
  { label: 'Active Kits', value: '24', change: '+3', trend: 'up', icon: Package },
  { label: 'Total Claims', value: '12.4K', change: '+18%', trend: 'up', icon: Activity },
  { label: 'Active Servers', value: '8', change: '0', trend: 'neutral', icon: Layers },
  { label: 'API Calls Today', value: '2.1K', change: '+5%', trend: 'up', icon: TrendingUp },
]

export default function DashboardPage() {
  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
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
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="relative group"
            >
              <div className="p-5 rounded-2xl bg-[var(--glass-bg)] border border-[var(--glass-border)] hover:border-[var(--glass-border-prominent)] transition-all duration-200">
                <div className="flex items-start justify-between mb-3">
                  <div className="p-2 rounded-xl bg-blue-500/10">
                    <stat.icon className="h-5 w-5 text-blue-400" />
                  </div>
                  {stat.trend === 'up' && (
                    <span className="text-xs font-medium text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded-full">
                      {stat.change}
                    </span>
                  )}
                  {stat.trend === 'neutral' && (
                    <span className="text-xs font-medium text-slate-400 bg-slate-400/10 px-2 py-1 rounded-full">
                      {stat.change}
                    </span>
                  )}
                </div>
                <div className="text-2xl font-bold text-[var(--text-primary)] mb-1">{stat.value}</div>
                <div className="text-sm text-[var(--text-muted)]">{stat.label}</div>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="space-y-10">
          {dashboardSections.map((section, sectionIndex) => (
            <motion.div
              key={section.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + sectionIndex * 0.1 }}
            >
              <div className="mb-4">
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">{section.title}</h2>
                <p className="text-sm text-[var(--text-muted)]">{section.description}</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {section.items.map((item, itemIndex) => (
                  <motion.div
                    key={item.href}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.25 + sectionIndex * 0.1 + itemIndex * 0.05 }}
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
                  </motion.div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  )
}
