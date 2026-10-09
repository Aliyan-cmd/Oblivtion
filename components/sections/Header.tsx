"use client";

import React from "react";
import { Zap, ShieldCheck, Key } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface HeaderProps {
  showKey: boolean;
  setShowKey: (fn: (v: boolean) => boolean) => void;
  hasCustomKey: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  showKey,
  setShowKey,
  hasCustomKey,
}) => {
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-neutral-950/80 backdrop-blur-2xl transition-all">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        {/* Brand Logo */}
        <div className="flex items-center gap-3">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-neutral-500 via-zinc-500 to-neutral-300 p-0.5 shadow-lg shadow-neutral-500/30">
            <div className="flex h-full w-full items-center justify-center rounded-[10px] bg-neutral-950">
              <Zap className="h-5 w-5 text-neutral-300 animate-pulse" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-extrabold tracking-tight text-white">
                Obliivon
              </span>
              <span className="rounded-full bg-neutral-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-neutral-300 border border-neutral-500/30">
                v2.0 enterprise
              </span>
            </div>
            <p className="text-[11px] font-medium text-neutral-400 hidden sm:block">
              Hinglish Group Chat Deadline Resolver
            </p>
          </div>
        </div>

        {/* Action Controls & Engine Status (NO top navigation hyperlinks) */}
        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-2 text-xs font-medium text-neutral-400 md:flex">
            <span className="flex items-center gap-1.5 rounded-full border border-neutral-200/30 bg-neutral-200/10 px-3 py-1 text-neutral-400">
              <ShieldCheck className="h-3.5 w-3.5" />
              Groq Llama 3.3 Engine
            </span>
          </div>

          <Button
            variant={hasCustomKey ? "primary" : "outline"}
            size="sm"
            icon={<Key className="h-3.5 w-3.5" />}
            onClick={() => setShowKey((v) => !v)}
          >
            {hasCustomKey ? "Groq Key Active" : "API Key"}
          </Button>
        </div>
      </div>
    </header>
  );
};
