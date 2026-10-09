"use client";

import React from "react";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { Sparkles, ArrowRight, Zap, CheckCircle, Shield } from "lucide-react";
import { Button } from "@/components/ui/Button";

// Dynamic import of SplineVisual with ssr: false for 3D canvas rendering safety
const SplineVisual = dynamic(
  () => import("@/components/3d/SplineVisual").then((m) => ({ default: m.SplineVisual })),
  { ssr: false, loading: () => (
    <div className="flex h-72 w-full items-center justify-center rounded-2xl border border-white/10 bg-gradient-to-br from-neutral-950/40 via-zinc-950/20 to-neutral-900/30">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-neutral-400" />
    </div>
  )}
);

interface HeroSectionProps {
  onStartAnalyzing: () => void;
  onExploreHub: () => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({
  onStartAnalyzing,
  onExploreHub,
}) => {
  return (
    <section className="relative py-8 md:py-12">
      <div className="grid gap-8 lg:grid-cols-12 lg:items-center">
        {/* Left Column Text Content */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="lg:col-span-7"
        >
          {/* Badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-neutral-500/30 bg-gradient-to-r from-neutral-500/10 via-zinc-500/10 to-neutral-200/10 px-3.5 py-1.5 backdrop-blur-md">
            <Sparkles className="h-4 w-4 text-neutral-300 animate-pulse" />
            <span className="text-xs font-semibold text-neutral-200">
              Powered by Groq LLMs &amp; Hinglish Intelligence
            </span>
          </div>

          {/* Main Title */}
          <h1 className="mt-5 text-4xl font-extrabold tracking-tight text-white sm:text-5xl lg:text-6xl leading-[1.15]">
            Your group chat,{" "}
            <span className="bg-gradient-to-r from-neutral-400 via-zinc-400 to-neutral-300 bg-clip-text text-transparent">
              minus the chaos.
            </span>
          </h1>

          <p className="mt-4 text-base sm:text-lg text-neutral-300 leading-relaxed">
            Paste a WhatsApp export containing informal Hinglish updates (&quot;kal lab 2 baje postpone hua&quot;).
            <span className="font-semibold text-white"> Obliivon</span> automatically extracts deadlines, resolves relative timestamps (&quot;kal&quot; &rarr; 2 Oct), deduplicates updates into single event cards, and generates standard <span className="text-neutral-400 font-mono text-xs">.ics</span> calendar downloads.
          </p>

          {/* Quick Feature Pills */}
          <div className="mt-6 flex flex-wrap gap-4 text-xs font-medium text-neutral-400">
            <div className="flex items-center gap-1.5">
              <CheckCircle className="h-4 w-4 text-neutral-300" />
              <span>Hinglish &amp; Slang Aware</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Zap className="h-4 w-4 text-neutral-400" />
              <span>Windowed Streamed Extraction</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Shield className="h-4 w-4 text-zinc-400" />
              <span>Zero Data Persistence</span>
            </div>
          </div>

          {/* Call to Actions */}
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Button
              variant="primary"
              size="lg"
              icon={<ArrowRight className="h-4 w-4" />}
              onClick={onStartAnalyzing}
            >
              Analyze Group Chat
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={onExploreHub}
            >
              Explore Navigation &amp; Resources Hub
            </Button>
          </div>
        </motion.div>

        {/* Right Column 3D Spline Interactive Scene */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="lg:col-span-5"
        >
          <SplineVisual className="shadow-2xl shadow-neutral-500/10" />
        </motion.div>
      </div>
    </section>
  );
};
