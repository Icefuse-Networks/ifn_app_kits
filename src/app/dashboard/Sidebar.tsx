"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, ChevronLeft, ChevronRight } from 'lucide-react';
import { dashboardSections } from '@/config/navigation';
import { useSidebar } from '@/contexts/SidebarContext';

export default function Sidebar() {
  const pathname = usePathname();
  const { isCompact, toggleCompact, pageRequestsCompact } = useSidebar();

  return (
    <aside
      className={`fixed left-0 top-20 h-[calc(100vh-5rem)] bg-[var(--glass-bg)] backdrop-blur-xl border-r border-[var(--glass-border)] overflow-y-auto overflow-x-hidden z-40 transition-all duration-300 ${
        isCompact ? 'w-16' : 'w-56'
      }`}
    >
      <nav className={`p-2 space-y-4 ${isCompact ? 'px-2' : 'p-3'}`}>
        <div className="flex items-center justify-between mb-2">
          {!isCompact && (
            <span className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider px-2">Menu</span>
          )}
          {!pageRequestsCompact && (
            <button
              onClick={toggleCompact}
              className={`p-1.5 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--glass-bg-prominent)] transition-colors ${isCompact ? 'mx-auto' : ''}`}
              title={isCompact ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {isCompact ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </button>
          )}
        </div>

        <Link
          href="/dashboard"
          className={`flex items-center gap-3 rounded-lg transition-all group ${
            isCompact ? 'justify-center p-2.5' : 'px-3 py-2.5'
          } ${
            pathname === '/dashboard'
              ? 'bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]'
              : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--glass-bg-prominent)]'
          }`}
          title="Dashboard"
        >
          <Home className={`h-4 w-4 flex-shrink-0 ${pathname === '/dashboard' ? '' : 'group-hover:text-[var(--accent-primary)]'}`} />
          {!isCompact && <span className="text-sm font-medium">Dashboard</span>}
        </Link>

        {dashboardSections.map((section) => (
          <div key={section.title} className="space-y-1">
            {!isCompact && (
              <h3 className="px-2 mb-2 text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                {section.title}
              </h3>
            )}
            {isCompact && <div className="border-t border-[var(--glass-border)] my-2" />}
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 rounded-lg transition-all group relative ${
                      isCompact ? 'justify-center p-2.5' : 'px-3 py-2'
                    } ${
                      isActive
                        ? 'bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]'
                        : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--glass-bg-prominent)]'
                    }`}
                    title={isCompact ? item.label : item.desc}
                  >
                    {isActive && !isCompact && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-[var(--accent-primary)] rounded-r" />
                    )}
                    <item.icon className={`h-4 w-4 flex-shrink-0 ${isActive ? '' : 'group-hover:text-[var(--accent-primary)]'}`} />
                    {!isCompact && <span className="text-sm font-medium truncate">{item.label}</span>}
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
