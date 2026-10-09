"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Compass,
  FileText,
  BookOpen,
  ExternalLink,
  Code2,
  Sliders,
  Sparkles,
  Zap,
  Calendar,
  Layers,
  ArrowRight,
  Download,
  HelpCircle,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

interface NavigationHubSectionProps {
  onSelectPreset: (presetText: string) => void;
  onJumpToSection: (sectionId: string) => void;
}

const PRESET_CHATS = [
  {
    id: "dbms-college",
    title: "DBMS College Group (Hinglish)",
    description: "Multi-turn WhatsApp banter with postponed assignment deadlines and lab room changes.",
    badge: "Sample Preset",
    text: `28/09/2026, 9:02 pm - Aditi: guys DBMS assignment 2 ka deadline Thursday hai, 1 Oct\n29/09/2026, 11:48 am - Rahul: Lab shift ho gaya hai. Ab Room 304 me hoga, 3rd floor Thursday 2pm\n30/09/2026, 9:00 am - Aditi: Update: assignment deadline postpone ho gaya, ab Friday 2 Oct tak hai\n30/09/2026, 4:55 pm - Aditi: DBMS mid-sem paper 12 Oct, 10am\n01/10/2026, 10:16 am - Aditi: kal 2 baje PM tak submit karna hai portal pe`,
  },
  {
    id: "tech-sprint",
    title: "Frontend Sprint Sync",
    description: "Software engineering group chat with code freeze, PR review deadline & deployment window.",
    badge: "Tech Work",
    text: `05/10/2026, 10:00 am - DevLead: Team, code freeze for v2.0 release is tomorrow Wednesday 6 Oct at 6 PM\n05/10/2026, 11:30 am - Priya: UI bug fixes PR submission deadline is 6 Oct 2 PM\n06/10/2026, 09:15 am - DevLead: Staging testing meeting rescheduled to Thursday 7 Oct 11:00 AM\n06/10/2026, 04:00 pm - DevLead: Production release window confirmed for Friday 8 Oct 8:00 PM`,
  },
  {
    id: "hackathon-plan",
    title: "Hackathon 24h Crunch",
    description: "Fast-paced hackathon team chat with pitch deck review, video recording and final submit.",
    badge: "Hackathon",
    text: `09/10/2026, 02:00 pm - Alex: Pitch deck slides finish karna hai today 8 PM tak\n09/10/2026, 08:30 pm - Sam: Video demo recording tomorrow Saturday 10 Oct 9:00 AM in lab\n10/10/2026, 11:00 am - Alex: Final DEV Post submission link deadline Saturday 10 Oct 5 PM strict`,
  },
];

const EXTERNAL_LINKS = [
  {
    title: "WhatsApp Export Guide",
    description: "Official guide on how to export group chats on iOS and Android without media.",
    url: "https://faq.whatsapp.com/1180414079177245/",
    icon: <FileText className="h-4 w-4 text-neutral-300" />,
  },
  {
    title: "Groq Llama 3.3 70B Docs",
    description: "Documentation for ultra-fast LPU inference used for Hinglish entity extraction.",
    url: "https://console.groq.com/docs/models",
    icon: <Zap className="h-4 w-4 text-neutral-400" />,
  },
  {
    title: "RFC 5545 iCalendar Spec",
    description: "Standard internet calendar specification format for .ics file generation.",
    url: "https://datatracker.ietf.org/doc/html/rfc5545",
    icon: <Calendar className="h-4 w-4 text-zinc-400" />,
  },
  {
    title: "Hinglish NLP Benchmark",
    description: "Technical overview of code-mixed Hindi-English temporal resolution algorithms.",
    url: "https://github.com/",
    icon: <Code2 className="h-4 w-4 text-sky-400" />,
  },
];

export const NavigationHubSection: React.FC<NavigationHubSectionProps> = ({
  onSelectPreset,
  onJumpToSection,
}) => {
  const [activeTab, setActiveTab] = useState<"quickjump" | "presets" | "links" | "architecture">("quickjump");

  return (
    <section id="navigation-hub" className="my-10">
      <Card glow className="border-neutral-500/20 bg-neutral-900/80">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-neutral-800/20 to-neutral-900/20 border border-neutral-500/30 text-neutral-300">
              <Compass className="h-6 w-6 text-neutral-300 animate-spin-slow" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight">
                Navigation &amp; Resources Portal
              </h2>
              <p className="text-xs text-neutral-400">
                Centralized jump links, preset datasets, documentation, and MNC architectural specs
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex flex-wrap gap-1.5 rounded-xl border border-white/10 bg-neutral-950/60 p-1 backdrop-blur-md">
            {[
              { id: "quickjump", label: "Quick Jump", icon: <Zap className="h-3.5 w-3.5" /> },
              { id: "presets", label: "Presets", icon: <BookOpen className="h-3.5 w-3.5" /> },
              { id: "links", label: "External Docs & Links", icon: <ExternalLink className="h-3.5 w-3.5" /> },
              { id: "architecture", label: "Architecture", icon: <Layers className="h-3.5 w-3.5" /> },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                  activeTab === tab.id
                    ? "bg-gradient-to-r from-neutral-500 to-neutral-200 text-white shadow-md"
                    : "text-neutral-400 hover:text-white hover:bg-white/5"
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content Panels */}
        <div className="mt-6">
          <AnimatePresence mode="wait">
            {/* Quick Jump Tab */}
            {activeTab === "quickjump" && (
              <motion.div
                key="quickjump"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
              >
                {[
                  {
                    id: "chat-analyzer-input",
                    title: "Chat Analyzer Input",
                    desc: "Paste chat export, upload files, select LLM model",
                    icon: <FileText className="h-5 w-5 text-neutral-400" />,
                    badge: "Primary Tool",
                  },
                  {
                    id: "analysis-results",
                    title: "Analysis Results",
                    desc: "View extracted event cards, .ics calendar, markdown trace",
                    icon: <Calendar className="h-5 w-5 text-neutral-300" />,
                    badge: "Output View",
                  },
                  {
                    id: "preset-templates",
                    title: "Sample Datasets",
                    desc: "Load pre-configured Hinglish college & work group chats",
                    icon: <BookOpen className="h-5 w-5 text-zinc-400" />,
                    badge: "Presets",
                  },
                  {
                    id: "api-settings",
                    title: "Groq API Settings",
                    desc: "Configure custom Groq API keys and privacy redaction options",
                    icon: <Sliders className="h-5 w-5 text-sky-400" />,
                    badge: "Config",
                  },
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => onJumpToSection(item.id)}
                    className="group text-left rounded-xl border border-white/10 bg-white/[0.03] p-4 transition-all duration-200 hover:border-neutral-500/40 hover:bg-white/[0.06] hover:shadow-lg focus:outline-none"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/5">
                        {item.icon}
                      </div>
                      <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-semibold text-neutral-400 group-hover:text-white">
                        {item.badge}
                      </span>
                    </div>
                    <h3 className="mt-3 text-sm font-semibold text-white group-hover:text-neutral-300">
                      {item.title}
                    </h3>
                    <p className="mt-1 text-xs text-neutral-400 leading-relaxed">
                      {item.desc}
                    </p>
                    <div className="mt-3 flex items-center text-xs font-semibold text-neutral-400 group-hover:translate-x-1 transition-transform">
                      Jump to section <ArrowRight className="ml-1 h-3.5 w-3.5" />
                    </div>
                  </button>
                ))}
              </motion.div>
            )}

            {/* Presets Tab */}
            {activeTab === "presets" && (
              <motion.div
                key="presets"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="grid gap-4 md:grid-cols-3"
              >
                {PRESET_CHATS.map((preset) => (
                  <div
                    key={preset.id}
                    className="flex flex-col justify-between rounded-xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-md"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="rounded-full bg-neutral-200/20 px-2.5 py-0.5 text-[10px] font-semibold text-neutral-400 border border-neutral-200/30">
                          {preset.badge}
                        </span>
                      </div>
                      <h3 className="mt-3 text-base font-semibold text-white">
                        {preset.title}
                      </h3>
                      <p className="mt-1 text-xs text-neutral-400 leading-relaxed">
                        {preset.description}
                      </p>
                      <pre className="mt-3 max-h-24 overflow-hidden text-ellipsis rounded-lg bg-black/40 p-2 font-mono text-[10px] text-neutral-400 leading-normal border border-white/5">
                        {preset.text}
                      </pre>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-4 w-full"
                      onClick={() => {
                        onSelectPreset(preset.text);
                        onJumpToSection("chat-analyzer-input");
                      }}
                    >
                      Load into Analyzer
                    </Button>
                  </div>
                ))}
              </motion.div>
            )}

            {/* Links Tab */}
            {activeTab === "links" && (
              <motion.div
                key="links"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="grid gap-4 sm:grid-cols-2"
              >
                {EXTERNAL_LINKS.map((link) => (
                  <a
                    key={link.title}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-start gap-3.5 rounded-xl border border-white/10 bg-white/[0.03] p-4 transition-all hover:border-neutral-200/40 hover:bg-white/[0.06]"
                  >
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-white/5 group-hover:scale-105 transition-transform">
                      {link.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-white group-hover:text-neutral-400">
                          {link.title}
                        </h3>
                        <ExternalLink className="h-3.5 w-3.5 text-neutral-500 group-hover:text-white transition-colors" />
                      </div>
                      <p className="mt-1 text-xs text-neutral-400 leading-relaxed">
                        {link.description}
                      </p>
                    </div>
                  </a>
                ))}
              </motion.div>
            )}

            {/* Architecture Tab */}
            {activeTab === "architecture" && (
              <motion.div
                key="architecture"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="space-y-4"
              >
                <div className="grid gap-3 sm:grid-cols-4">
                  {[
                    { step: "01", title: "Parse & Windowing", desc: "Regex WhatsApp timestamp parsing into structured sliding message windows." },
                    { step: "02", title: "LLM Extraction", desc: "Groq Llama 3.3 70B structured JSON event & deadline classification." },
                    { step: "03", title: "Temporal Resolver", desc: "Maps 'kal', 'Thursday', '2 baje' into exact UTC/Local JavaScript Date objects." },
                    { step: "04", title: "iCal & Markdown", desc: "Generates standard RFC 5545 .ics calendar files and formatted markdown reports." },
                  ].map((s) => (
                    <div key={s.step} className="rounded-xl border border-white/10 bg-white/[0.02] p-3.5">
                      <div className="text-xs font-mono font-bold text-neutral-400">{s.step}</div>
                      <div className="mt-1 text-sm font-semibold text-white">{s.title}</div>
                      <div className="mt-1 text-xs text-neutral-400">{s.desc}</div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </Card>
    </section>
  );
};
