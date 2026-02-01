"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home } from 'lucide-react';
import { dashboardSections } from '@/config/navigation';

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

        {dashboardSections.map((section) => (
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
