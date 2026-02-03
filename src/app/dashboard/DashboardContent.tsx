"use client";

import { ReactNode } from 'react';
import { useSidebar } from '@/contexts/SidebarContext';

export default function DashboardContent({ children }: { children: ReactNode }) {
  const { isCompact } = useSidebar();

  return (
    <main className={`pt-20 min-h-screen transition-all duration-300 ${isCompact ? 'pl-16' : 'pl-56'}`}>
      {children}
    </main>
  );
}
