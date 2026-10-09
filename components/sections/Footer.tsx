"use client";

import React from "react";
import { Zap, Heart, Shield } from "lucide-react";

export const Footer: React.FC = () => {
  return (
    <footer className="mt-16 border-t border-white/10 bg-neutral-950/60 py-8 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 text-center sm:flex-row sm:text-left">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-neutral-500/20 text-neutral-400">
            <Zap className="h-4 w-4" />
          </div>
          <span className="text-sm font-bold text-white">Obliivon v2.0 Enterprise</span>
          <span className="text-xs text-neutral-500">| DEV Hacktoberfest Weekend Challenge</span>
        </div>

        <div className="flex items-center gap-6 text-xs text-neutral-400">
          <span className="flex items-center gap-1">
            <Shield className="h-3.5 w-3.5 text-neutral-300" />
            Groq LPU Powered
          </span>
          <span className="flex items-center gap-1">
            <Heart className="h-3.5 w-3.5 text-neutral-400" />
            Hinglish NLP
          </span>
        </div>
      </div>
    </footer>
  );
};
