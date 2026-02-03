"use client";

import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';

interface SidebarContextType {
  isCompact: boolean;
  setCompact: (compact: boolean) => void;
  toggleCompact: () => void;
  pageRequestsCompact: boolean;
  setPageRequestsCompact: (compact: boolean) => void;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [userCompact, setUserCompact] = useState(false);
  const [pageRequestsCompact, setPageRequestsCompact] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('sidebar-compact');
    if (stored === 'true') setUserCompact(true);
    setHydrated(true);
  }, []);

  const setCompact = useCallback((compact: boolean) => {
    setUserCompact(compact);
    localStorage.setItem('sidebar-compact', String(compact));
  }, []);

  const toggleCompact = useCallback(() => {
    setUserCompact(prev => {
      const next = !prev;
      localStorage.setItem('sidebar-compact', String(next));
      return next;
    });
  }, []);

  const setPageCompact = useCallback((compact: boolean) => {
    setPageRequestsCompact(compact);
  }, []);

  const isCompact = pageRequestsCompact || (hydrated && userCompact);

  return (
    <SidebarContext.Provider value={{ isCompact, setCompact, toggleCompact, pageRequestsCompact, setPageRequestsCompact: setPageCompact }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (!context) throw new Error('useSidebar must be used within SidebarProvider');
  return context;
}

export function useSidebarCompact(requestCompact: boolean) {
  const { setPageRequestsCompact } = useSidebar();
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    setPageRequestsCompact(requestCompact);
    return () => {
      mounted.current = false;
      setPageRequestsCompact(false);
    };
  }, [requestCompact, setPageRequestsCompact]);
}
