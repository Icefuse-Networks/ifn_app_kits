"use client";

import { motion } from "framer-motion";
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
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className={`rounded-xl p-6 bg-white/[0.02] border border-white/5 ${className}`}
    >
      <div className="flex items-center gap-2 mb-4">
        <Icon className={`h-5 w-5 ${iconColor}`} />
        <h3 className="text-lg font-semibold text-white">{title}</h3>
      </div>
      {children}
    </motion.div>
  );
}
