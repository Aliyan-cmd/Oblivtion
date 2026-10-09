"use client";

import React, { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Download,
  Copy,
  Check,
  AlertTriangle,
  Calendar,
  FileCode,
  Activity,
  ChevronDown,
  Sparkles,
  Layers,
  HelpCircle,
  Inbox,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatCard } from "@/components/cards/StatCard";
import { EventCardView } from "@/components/cards/EventCardView";
import type { AnalyzePayload, EventCard } from "@/lib/serialize";
import type { ProgressState } from "@/hooks/useChatAnalyzer";

interface ResultsSectionProps {
  loading: boolean;
  progress: ProgressState | null;
  error: string | null;
  result: AnalyzePayload | null;
}

function downloadFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export const ResultsSection: React.FC<ResultsSectionProps> = ({
  loading,
  progress,
  error,
  result,
}) => {
  const [copied, setCopied] = useState(false);
  const [showMarkdown, setShowMarkdown] = useState(false);
  const [showTrace, setShowTrace] = useState(false);

  const handleCopyMarkdown = useCallback(async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Clipboard copy failed", err);
    }
  }, [result]);

  const pct =
    progress && progress.totalWindows > 0
      ? Math.round((progress.window / progress.totalWindows) * 100)
      : 0;

  return (
    <section id="analysis-results" className="min-w-0">
      {/* Empty State when no action taken yet */}
      {!loading && !result && !error && (
        <Card glow className="flex flex-col items-center justify-center p-10 text-center min-h-[460px]">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-neutral-800/20 to-neutral-900/20 border border-neutral-500/30 text-neutral-300 mb-4">
            <Inbox className="h-8 w-8 text-neutral-300" />
          </div>
          <h3 className="text-xl font-bold text-white tracking-tight">
            Ready to Analyze
          </h3>
          <p className="mt-2 max-w-md text-sm text-neutral-400 leading-relaxed">
            Paste a WhatsApp chat in the left input panel, or load a preset, then hit{" "}
            <span className="font-semibold text-white">Summarize Chat</span>.
          </p>

          <div className="mt-8 grid w-full max-w-lg grid-cols-3 gap-3 text-left">
            {[
              { num: "01", label: "Parse", desc: "Sliding window parser" },
              { num: "02", label: "Extract", desc: "LLM entity extraction" },
              { num: "03", label: "Resolve", desc: "Translates 'kal' to date" },
            ].map((step) => (
              <div
                key={step.num}
                className="rounded-xl border border-white/10 bg-white/[0.03] p-3.5 backdrop-blur-md"
              >
                <div className="text-xs font-mono font-bold text-neutral-400">
                  {step.num}
                </div>
                <div className="mt-1 text-sm font-semibold text-white">
                  {step.label}
                </div>
                <div className="mt-0.5 text-[11px] text-neutral-500">
                  {step.desc}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Loading Progress Feedback */}
      {loading && (
        <Card glow className="p-6">
          <div className="mb-3 flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-neutral-300 animate-ping" />
              <span className="font-semibold text-neutral-200">
                {progress?.phase === "parse"
                  ? "Parsing group chat messages..."
                  : progress && progress.totalWindows > 0
                  ? `Processing window ${progress.window}/${progress.totalWindows}`
                  : "Connecting to Groq engine..."}
              </span>
            </div>
            <span className="font-mono text-xs font-bold text-neutral-300">
              {pct}%
            </span>
          </div>

          <div className="h-2.5 overflow-hidden rounded-full bg-neutral-950 p-0.5 border border-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-neutral-500 via-zinc-500 to-neutral-300 transition-all duration-500 shadow-lg shadow-neutral-500/50"
              style={{ width: `${Math.max(pct, 8)}%` }}
            />
          </div>

          {/* Skeleton Loaders */}
          <div className="mt-6 space-y-3">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-20 animate-pulse rounded-2xl bg-white/[0.04] border border-white/5"
                style={{ animationDelay: `${i * 150}ms` }}
              />
            ))}
          </div>
        </Card>
      )}

      {/* Error Display */}
      {error && (
        <div className="rounded-2xl border border-neutral-500/30 bg-neutral-950/30 p-5 backdrop-blur-xl">
          <div className="flex items-start gap-3.5">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-neutral-500/20 text-neutral-300">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-neutral-200">
                Analysis Exception
              </h3>
              <p className="mt-1 text-xs text-neutral-200/80 leading-relaxed">
                {error}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Results View */}
      {result && !loading && (
        <div className="space-y-6">
          {/* Stats Bar & Export Actions */}
          <Card glow className="p-5 border-neutral-200/20">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard
                value={result.stats.messages}
                label="Messages"
                icon={<FileCode className="h-5 w-5" />}
              />
              <StatCard
                value={result.stats.windows}
                label="Windows"
                icon={<Layers className="h-5 w-5" />}
              />
              <StatCard
                value={result.stats.items}
                label="Events Found"
                icon={<Sparkles className="h-5 w-5" />}
              />
              <StatCard
                value={result.stats.icsEvents}
                label="In Calendar"
                icon={<Calendar className="h-5 w-5" />}
              />
            </div>

            {/* Export Toolbar */}
            <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-white/10 pt-4">
              <Button
                variant="primary"
                size="sm"
                icon={<Download className="h-4 w-4" />}
                onClick={() =>
                  downloadFile(
                    "tldr-deadlines.ics",
                    result.ics,
                    "text/calendar;charset=utf-8"
                  )
                }
              >
                Download .ics Calendar
              </Button>
              <Button
                variant="secondary"
                size="sm"
                icon={<Download className="h-4 w-4" />}
                onClick={() =>
                  downloadFile(
                    "tldr-summary.md",
                    result.markdown,
                    "text/markdown;charset=utf-8"
                  )
                }
              >
                Download Markdown
              </Button>
              <Button
                variant="outline"
                size="sm"
                icon={
                  copied ? (
                    <Check className="h-4 w-4 text-neutral-300" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )
                }
                onClick={handleCopyMarkdown}
              >
                {copied ? "Copied!" : "Copy Markdown"}
              </Button>
            </div>
          </Card>

          {/* Resolved Deadlines & Events */}
          {result.dated.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-300 flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Resolved Deadlines &amp; Events ({result.dated.length})
                </h3>
              </div>
              <div className="space-y-3">
                {result.dated.map((item) => (
                  <div key={item.id}>
                    {item.whenLabel && (
                      <div className="mb-1.5 mt-1 text-xs font-bold uppercase tracking-wider text-neutral-300">
                        📅 {item.whenLabel}
                      </div>
                    )}
                    <EventCardView item={item} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Undated / Ambiguous Items */}
          {result.undated.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-2">
                  <HelpCircle className="h-4 w-4" />
                  Ambiguous Dates — Review Manually ({result.undated.length})
                </h3>
              </div>
              <div className="space-y-3">
                {result.undated.map((item) => (
                  <div key={item.id}>
                    <EventCardView item={item} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Cancelled Items */}
          {result.cancelled.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                Cancelled Events ({result.cancelled.length})
              </h3>
              {result.cancelled.map((c) => (
                <div
                  key={c.id}
                  className="rounded-xl border border-white/5 bg-black/30 px-4 py-2.5 text-xs text-neutral-500 line-through"
                >
                  {c.title}
                </div>
              ))}
            </div>
          )}

          {/* Drawers: Raw Markdown & Processing Trace */}
          <div className="space-y-3 pt-2">
            <Card className="p-4">
              <button
                type="button"
                onClick={() => setShowMarkdown((v) => !v)}
                className="flex w-full items-center justify-between text-xs font-semibold text-neutral-300 hover:text-white"
              >
                <span className="flex items-center gap-2">
                  <FileCode className="h-4 w-4 text-neutral-400" />
                  View Generated Raw Markdown
                </span>
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${
                    showMarkdown ? "rotate-180" : ""
                  }`}
                />
              </button>
              {showMarkdown && (
                <pre className="mt-3 max-h-80 overflow-x-auto whitespace-pre-wrap rounded-xl bg-neutral-950 p-4 font-mono text-xs text-neutral-300 border border-white/10">
                  {result.markdown}
                </pre>
              )}
            </Card>

            <Card className="p-4">
              <button
                type="button"
                onClick={() => setShowTrace((v) => !v)}
                className="flex w-full items-center justify-between text-xs font-semibold text-neutral-300 hover:text-white"
              >
                <span className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-neutral-300" />
                  View Processing Trace ({result.trace.length} windows)
                </span>
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${
                    showTrace ? "rotate-180" : ""
                  }`}
                />
              </button>
              {showTrace && (
                <div className="mt-3 space-y-2">
                  {result.trace.map((t) => (
                    <div
                      key={t.window}
                      className="rounded-xl border border-white/5 bg-neutral-950/80 p-3"
                    >
                      <div className="text-xs text-neutral-400 font-medium">
                        Window #{t.window} · Messages #{t.from}–#{t.to} · Extracted:{" "}
                        <span className="text-neutral-400 font-bold">
                          {t.itemCount} items
                        </span>
                      </div>
                      {t.items.length > 0 && (
                        <pre className="mt-2 max-h-36 overflow-auto whitespace-pre-wrap rounded-lg bg-black/50 p-2.5 font-mono text-[11px] text-neutral-400">
                          {JSON.stringify(t.items, null, 2)}
                        </pre>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </div>
      )}
    </section>
  );
};
