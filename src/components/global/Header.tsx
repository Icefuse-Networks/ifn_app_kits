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
    <header
      className={`${
        sticky
          ? "fixed top-0 left-0 right-0 z-[9999]"
          : "relative z-[100]"
      } flex-shrink-0 border-b border-[var(--border-secondary)]`}
      style={{ background: "rgba(26, 26, 46, 0.95)" }}
    >
      <div className="max-w-[80rem] mx-auto px-6 py-3.5 flex items-center gap-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3 no-underline group">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center overflow-hidden relative transition-opacity duration-[250ms] ease-out"
            style={{
              background: "rgba(255, 255, 255, 0.08)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
            }}
          >
            <Image
              src="/logos/ifn_base_logo.png"
              alt="Icefuse Networks"
              width={28}
              height={28}
              className="object-contain group-hover:opacity-80 transition-opacity"
              priority
            />
          </div>
          <span className="hidden sm:block text-[1.125rem] font-bold text-[var(--text-primary)] uppercase tracking-wide">
            Icefuse Networks
          </span>
        </Link>

        {/* Navigation */}
        <nav className="flex items-center gap-1 ml-4">
          <Link
            href="/leaderboards"
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors rounded-lg hover:bg-[var(--glass-bg)]"
          >
            <Trophy className="w-4 h-4" />
            <span className="hidden sm:inline">Leaderboards</span>
          </Link>
        </nav>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Header Actions */}
        <div className="flex items-center gap-2">
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
