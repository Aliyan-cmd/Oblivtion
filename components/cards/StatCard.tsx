"use client";

import React from "react";
import { motion } from "framer-motion";

interface StatCardProps {
  value: number | string;
  label: string;
  icon?: React.ReactNode;
}

export const StatCard: React.FC<StatCardProps> = ({ value, label, icon }) => {
  return (
    <motion.div
      whileHover={{ y: -2 }}
      className="flex items-center gap-3 rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-white/[0.02] p-3.5 backdrop-blur-xl shadow-lg shadow-black/20"
    >
      {icon && (
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-neutral-800/20 to-neutral-900/20 border border-white/10 text-neutral-300">
          {icon}
        </div>
      )}
      <div>
        <div className="text-xl font-bold tracking-tight text-white">{value}</div>
        <div className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
          {label}
        </div>
      </div>
    </motion.div>
  );
};
