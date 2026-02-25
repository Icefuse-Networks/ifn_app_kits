"use client";

import { LucideIcon } from "lucide-react";

interface ChartCardProps {
  title: string;
  icon: LucideIcon;
  children: React.ReactNode;
  className?: string;
  delay?: number;
  iconColor?: string;
}

export function ChartCard({
  title,
  icon: Icon,
  children,
  className = "",
  delay = 0,
  iconColor = "text-purple-400",
}: ChartCardProps) {
  return (
    <div
      className={`anim-fade-slide-up rounded-xl p-6 bg-white/[0.02] border border-white/5 ${className}`}
      style={{ animationDelay: `${delay * 1000}ms` }}
    >
      <div className="flex items-center gap-2 mb-4">
        <Icon className={`h-5 w-5 ${iconColor}`} />
        <h3 className="text-lg font-semibold text-white">{title}</h3>
      </div>
      {children}
    </div>
  );
}
