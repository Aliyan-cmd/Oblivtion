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
    <section className="relative py-12 bg-gradient-to-b from-gray-50 to-gray-100 text-gray-900">
      <div className="grid gap-8 lg:grid-cols-12 lg:items-center">
        {/* Left Column Text Content */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="lg:col-span-7"
        >
          {/* Badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-gray-300 bg-gray-100 px-3.5 py-1.5">
            <Sparkles className="h-4 w-4 text-gray-600 animate-pulse" />
            <span className="text-xs font-semibold text-gray-700">
              Powered by Groq LLMs &amp; Hinglish Intelligence
            </span>
          </div>

          {/* Main Title */}
          <h1 className="mt-5 text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl leading-[1.15] text-gray-900">
            Your group chat, <span className="bg-gradient-to-r from-gray-500 via-gray-600 to-gray-700 bg-clip-text text-transparent">
              minus the chaos.
            </span>
          </h1>

          <p className="mt-4 text-base sm:text-lg text-gray-600 leading-relaxed">
            Paste a WhatsApp export containing informal Hinglish updates ("kal lab 2 baje postpone hua").
            <span className="font-semibold text-gray-800"> Obliivon</span> automatically extracts deadlines, resolves relative timestamps ("kal" → 2 Oct), deduplicates updates into single event cards, and generates standard <span className="text-gray-500 font-mono text-xs">.ics</span> calendar downloads.
          </p>

          {/* Quick Feature Pills */}
          <div className="mt-6 flex flex-wrap gap-4 text-xs font-medium text-gray-500">
            <div className="flex items-center gap-1.5">
              <CheckCircle className="h-4 w-4 text-gray-600" />
              <span>Hinglish &amp; Slang Aware</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Zap className="h-4 w-4 text-gray-600" />
              <span>Windowed Streamed Extraction</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Shield className="h-4 w-4 text-gray-600" />
              <span>Zero Data Persistence</span>
            </div>
          </div>

          {/* Call to Actions */}
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Button
              variant="primary"
              size="lg"
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
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
              Explore Resources Hub
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
