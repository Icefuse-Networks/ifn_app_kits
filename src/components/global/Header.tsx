"use client";

import Link from "next/link";
import Image from "next/image";
import { Trophy } from "lucide-react";
import { UserProfileCard } from "./UserProfileCard";

interface HeaderProps {
  /** When false, header stays in normal document flow (not fixed/sticky) */
  sticky?: boolean;
}

export function Header({ sticky = true }: HeaderProps) {
  return (
    <header className={sticky ? "portal-header" : "portal-header-static"}>
      <div className="portal-header-inner">
        {/* Logo */}
        <Link href="/" className="portal-logo group">
          <div className="portal-logo-ring">
            <Image
              src="/logos/ifn_base_logo.png"
              alt="Icefuse Networks"
              width={28}
              height={28}
              className="object-contain"
              priority
            />
          </div>
          <span className="portal-logo-text hidden sm:block uppercase tracking-wide">
            Icefuse Networks
          </span>
        </Link>

        {/* Navigation */}
        <nav className="flex items-center gap-4 ml-8">
          <Link
            href="/leaderboards"
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--accent-primary)] transition-colors rounded-[var(--radius-md)] hover:bg-[var(--glass-bg-subtle)]"
          >
            <Trophy className="w-4 h-4" />
            <span className="hidden sm:inline">Leaderboards</span>
          </Link>
        </nav>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Header Actions */}
        <div className="portal-header-actions">
          <UserProfileCard
            showHeader
            showHeaderEmail
            signOutRedirect="/"
          />
        </div>
      </div>
    </header>
  );
}
