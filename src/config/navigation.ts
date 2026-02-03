import {
  Package, Settings, BarChart2, Shield, Key, HardDrive,
  MessageSquare, Box, ShoppingCart, ArrowRightLeft, TrendingUp,
  Gift, LucideIcon
} from 'lucide-react'

export interface NavItem {
  href: string
  icon: LucideIcon
  label: string
  desc: string
  gradient: string
}

export interface NavSection {
  title: string
  description: string
  items: NavItem[]
}

export const dashboardSections: NavSection[] = [
  {
    title: 'Plugin Management',
    description: 'Configure kits, clans, and analyze usage',
    items: [
      { href: '/dashboard/kits', icon: Package, label: 'Kits', desc: 'Create and manage kit configurations', gradient: 'from-blue-500 to-indigo-600' },
      { href: '/dashboard/clans', icon: Shield, label: 'Clans', desc: 'Clan perks, settings and banned names', gradient: 'from-amber-500 to-orange-500' },
      { href: '/dashboard/lootmanager', icon: Box, label: 'Loot Manager', desc: 'Configure loot tables and drop rates', gradient: 'from-yellow-500 to-orange-500' },
      { href: '/dashboard/redirection', icon: ArrowRightLeft, label: 'Redirection', desc: 'AFK redirect settings and logs', gradient: 'from-orange-500 to-red-500' },
      { href: '/dashboard/giveaways', icon: Gift, label: 'Giveaways', desc: 'Manage giveaway players and select winners', gradient: 'from-pink-500 to-purple-600' },
    ]
  },
  {
    title: 'Server Management',
    description: 'Monitor servers and manage announcements',
    items: [
      { href: '/dashboard/servers', icon: HardDrive, label: 'Servers', desc: 'Monitor and manage game servers', gradient: 'from-violet-500 to-purple-600' },
      { href: '/dashboard/announcements', icon: MessageSquare, label: 'Announcements', desc: 'Manage server announcements', gradient: 'from-pink-500 to-rose-500' },
    ]
  },
  {
    title: 'Analytics',
    description: 'View server and player analytics',
    items: [
      { href: '/dashboard/player-analytics', icon: BarChart2, label: 'Player Analytics', desc: 'Server population and usage stats', gradient: 'from-emerald-500 to-teal-500' },
      { href: '/dashboard/shop-purchases', icon: ShoppingCart, label: 'Shop Analytics', desc: 'Shop purchase analytics and insights', gradient: 'from-green-500 to-emerald-500' },
      { href: '/dashboard/server-stats', icon: TrendingUp, label: 'Global Stats', desc: 'Global Rust server analytics', gradient: 'from-purple-500 to-pink-500' },
    ]
  },
  {
    title: 'Developer Tools',
    description: 'API access and configuration',
    items: [
      { href: '/dashboard/tokens', icon: Key, label: 'API Tokens', desc: 'Generate and manage API access keys', gradient: 'from-rose-500 to-pink-600' },
      { href: '/dashboard/settings', icon: Settings, label: 'Settings', desc: 'General app configuration', gradient: 'from-slate-500 to-slate-600' },
    ]
  },
]
