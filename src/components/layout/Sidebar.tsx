"use client";
import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  BarChart3,
  Server,
  Package,
  MessageSquare,
  Users,
  Menu,
  X,
  ChevronRight,
  ChevronLeft,
} from "lucide-react";

const sidebarItems = [
  { id: "dashboard", href: "/admin", icon: Home, label: "Dashboard" },
  { id: "analytics", href: "/admin/analytics", icon: BarChart3, label: "Analytics" },
  { id: "servers", href: "/admin/servers", icon: Server, label: "Servers" },
  { id: "lootmanager", href: "/admin/lootmanager", icon: Package, label: "Loot Manager" },
  { id: "announcements", href: "/admin/announcements", icon: MessageSquare, label: "Announcements" },
  { id: "users", href: "/admin/users", icon: Users, label: "Users" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
      if (window.innerWidth >= 768) setIsMobileMenuOpen(false);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = isMobileMenuOpen ? "hidden" : "unset";
    return () => { document.body.style.overflow = "unset"; };
  }, [isMobileMenuOpen]);

  const isActive = (href: string) => {
    if (href === "/admin") return pathname === "/admin";
    return pathname.startsWith(href);
  };

  const LogoSection = () => (
    <div className={`flex items-center ${collapsed ? "justify-center" : "gap-3"} mb-2`}>
      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
        <span className="text-white font-bold text-sm">IF</span>
      </div>
      {!collapsed && (
        <div>
          <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-500">
            ADMIN
          </h1>
          <div className="text-[10px] text-zinc-500 font-medium tracking-widest uppercase">
            Dashboard
          </div>
        </div>
      )}
    </div>
  );

  const NavigationItems = ({ onItemClick, isCollapsed = false }: { onItemClick?: () => void; isCollapsed?: boolean }) => (
    <div className="space-y-1">
      {sidebarItems.map((item) => {
        const active = isActive(item.href);
        return (
          <Link
            key={item.id}
            href={item.href}
            onClick={onItemClick}
            title={isCollapsed ? item.label : undefined}
            className={`group flex items-center ${isCollapsed ? "justify-center" : "gap-3"} ${isCollapsed ? "px-2" : "px-3"} py-2.5 rounded-lg transition-all duration-200 ${
              active
                ? "bg-gradient-to-r from-purple-500/20 to-pink-500/10 text-white border-l-2 border-purple-500"
                : "text-zinc-500 hover:text-white hover:bg-white/5"
            }`}
          >
            <item.icon className={`h-[18px] w-[18px] flex-shrink-0 transition-colors ${active ? "text-purple-400" : "text-zinc-600 group-hover:text-purple-400"}`} />
            {!isCollapsed && (
              <>
                <span className="text-sm font-medium flex-1 truncate">{item.label}</span>
                {active && <ChevronRight className="h-4 w-4 text-purple-400" />}
              </>
            )}
          </Link>
        );
      })}
    </div>
  );

  if (isMobile) {
    return (
      <>
        <div className="fixed top-0 left-0 right-0 z-50 px-4 py-3 backdrop-blur-xl bg-zinc-900/90 border-b border-white/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 rounded bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                <span className="text-white font-bold text-xs">IF</span>
              </div>
              <h1 className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-500">
                ADMIN
              </h1>
            </div>
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 rounded-lg text-zinc-500 hover:text-white hover:bg-white/5 transition-colors"
            >
              {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        <AnimatePresence>
          {isMobileMenuOpen && (
            <>
              <motion.div
                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsMobileMenuOpen(false)}
              />
              <motion.div
                className="fixed top-0 left-0 h-full w-80 max-w-[85vw] z-50 flex flex-col bg-gradient-to-b from-zinc-900 to-zinc-950 border-r border-white/5"
                initial={{ x: -320, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -320, opacity: 0 }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
              >
                <div className="p-6 border-b border-white/5">
                  <LogoSection />
                </div>
                <nav className="flex-1 p-4 overflow-y-auto">
                  <NavigationItems onItemClick={() => setIsMobileMenuOpen(false)} />
                </nav>
              </motion.div>
            </>
          )}
        </AnimatePresence>
        <div className="h-16" />
      </>
    );
  }

  return (
    <div className={`${collapsed ? "w-16" : "w-64"} flex flex-col h-screen sticky top-0 transition-all duration-200 bg-gradient-to-b from-zinc-900/95 to-zinc-950/95 border-r border-white/5`}>
      <div className={`${collapsed ? "p-3" : "p-6"} border-b border-white/5 flex items-center justify-between`}>
        <LogoSection />
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1.5 rounded text-zinc-600 hover:text-white hover:bg-white/5 transition-colors"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>
      <nav className={`flex-1 ${collapsed ? "p-2" : "p-4"} overflow-y-auto`}>
        <NavigationItems isCollapsed={collapsed} />
      </nav>
    </div>
  );
}
