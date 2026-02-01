"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Package, Settings, BarChart2, Shield, Key, Tag, HardDrive, MessageSquare, Box, ShoppingCart, Home, ArrowRightLeft, LucideIcon } from 'lucide-react';

interface NavItem {
  href: string;
  icon: LucideIcon;
  label: string;
  desc: string;
  gradient: string;
}

interface Section {
  title: string;
  description: string;
  items: NavItem[];
}

const sections: Section[] = [
  {
    title: 'Plugin Management',
    description: 'Configure kits, clans, and analyze usage',
    items: [
      { href: '/dashboard/kits', icon: Package, label: 'Kits', desc: 'Create and manage kit configurations', gradient: 'from-blue-500 to-indigo-600' },
      { href: '/dashboard/clans', icon: Shield, label: 'Clans', desc: 'Clan perks, settings and banned names', gradient: 'from-amber-500 to-orange-500' },
      { href: '/dashboard/lootmanager', icon: Box, label: 'Loot Manager', desc: 'Configure loot tables and drop rates', gradient: 'from-yellow-500 to-orange-500' },
    ]
  },
  {
    title: 'Server Management',
    description: 'Monitor servers and manage announcements',
    items: [
      { href: '/dashboard/servers', icon: HardDrive, label: 'Servers', desc: 'Monitor and manage game servers', gradient: 'from-violet-500 to-purple-600' },
      { href: '/dashboard/redirection', icon: ArrowRightLeft, label: 'Redirection', desc: 'AFK redirect settings and logs', gradient: 'from-orange-500 to-red-500' },
      { href: '/dashboard/analytics', icon: BarChart2, label: 'Analytics', desc: 'Server population and usage stats', gradient: 'from-emerald-500 to-teal-500' },
      { href: '/dashboard/shop-purchases', icon: ShoppingCart, label: 'Shop Analytics', desc: 'Shop purchase analytics and insights', gradient: 'from-green-500 to-emerald-500' },
      { href: '/dashboard/announcements', icon: MessageSquare, label: 'Announcements', desc: 'Manage server announcements', gradient: 'from-pink-500 to-rose-500' },
    ]
  },
  {
    title: 'Developer Tools',
    description: 'API access and configuration',
    items: [
      { href: '/dashboard/tokens', icon: Key, label: 'API Tokens', desc: 'Generate and manage API access keys', gradient: 'from-rose-500 to-pink-600' },
      { href: '/dashboard/identifiers', icon: Tag, label: 'Identifiers', desc: 'Server analytics identifiers', gradient: 'from-cyan-500 to-blue-500' },
      { href: '/dashboard/settings', icon: Settings, label: 'Settings', desc: 'General app configuration', gradient: 'from-slate-500 to-slate-600' },
    ]
  },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-20 h-[calc(100vh-5rem)] w-56 bg-[var(--glass-bg)] border-r border-[var(--glass-border)] overflow-y-auto z-40">
      <nav className="p-3 space-y-6">
        <Link
          href="/dashboard"
          className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${
            pathname === '/dashboard'
              ? 'bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]'
              : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--glass-bg-prominent)]'
          }`}
        >
          <Home className="h-4 w-4" />
          <span className="text-sm font-medium">Dashboard</span>
        </Link>

        {sections.map((section) => (
          <div key={section.title}>
            <h3 className="px-3 mb-2 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
              {section.title}
            </h3>
            <div className="space-y-1">
              {section.items.map((item) => {
                const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all group ${
                      isActive
                        ? 'bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]'
                        : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--glass-bg-prominent)]'
                    }`}
                    title={item.desc}
                  >
                    <item.icon className={`h-4 w-4 ${isActive ? '' : 'group-hover:text-[var(--accent-primary)]'}`} />
                    <span className="text-sm font-medium truncate">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}
