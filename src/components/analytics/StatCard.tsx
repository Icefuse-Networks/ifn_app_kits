"use client";

import { LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  iconColor?: string;
  iconBgColor?: string;
  subtitle?: string;
  delay?: number;
}

export function StatCard({
  label,
  value,
  icon: Icon,
  iconColor = "text-purple-400",
  iconBgColor = "bg-purple-500/20",
  subtitle,
  delay = 0,
}: StatCardProps) {
  return (
    <div
      className="anim-fade-slide-up rounded-xl p-6 transition-all duration-300 hover:scale-[1.02] bg-white/[0.02] border border-white/5"
      style={{ animationDelay: `${delay * 1000}ms` }}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-zinc-500 text-sm font-medium mb-1">{label}</p>
          <p className="text-2xl font-bold text-white mb-1">
            {typeof value === "number" ? value.toLocaleString() : value}
          </p>
          {subtitle && <p className="text-xs text-purple-400">{subtitle}</p>}
        </div>
        {Icon && (
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${iconBgColor}`}>
            <Icon className={`h-6 w-6 ${iconColor}`} />
          </div>
        )}
      </div>
    </div>
  );
}
