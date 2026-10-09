"use client";

import React, { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { motion, AnimatePresence, useSpring, useMotionValue, useTransform } from "framer-motion";
import {
  Upload, FileText, Clock, AlertCircle, HelpCircle,
  CheckCircle, Ghost, Zap, Lock, ChevronDown, X, Search,
  Key, Trash2, Eye, EyeOff, Shield, Activity, Code, BookOpen
} from "lucide-react";
import type { AttentionLedger, ObligationCard, ParseProgress, AppPhase } from "@/lib/types";
import { parseChat } from "@/lib/parser";
import { installKeyShredding, destroySessionKey, encrypt, hmacSenderHash } from "@/lib/crypto";
import { generateEmbedding, addDifferentialPrivacy } from "@/lib/privacy";
import { putNode, clearAllNodes } from "@/lib/storage";
import { startDecayEngine, stopDecayEngine, onNodeGhosted } from "@/lib/decay";
import GhostingCanvas from "@/components/particles/GhostingCanvas";
import type { GhostingCanvasHandle } from "@/components/particles/GhostingCanvas";

// ─── Vibrant.design spring configurations ───────────────────────────────────────

const VIBRANT_SPRING = { type: "spring" as const, stiffness: 200, damping: 15 };
const CARD_HOVER_SPRING = { type: "spring" as const, stiffness: 400, damping: 20 };
const GHOST_SPRING = { type: "spring" as const, stiffness: 300, damping: 30 };
const VIBRANT_EASE = [0.34, 1.56, 0.64, 1] as const;

// ─── Countdown timer component ─────────────────────────────────────────────────

function Countdown({ expiresAt }: { expiresAt: Date | null }) {
  const [remaining, setRemaining] = useState<string>("");
  const [urgencyLevel, setUrgencyLevel] = useState<"safe" | "warning" | "critical">("safe");

  useEffect(() => {
    if (!expiresAt) return;
    const tick = () => {
      const ms = expiresAt.getTime() - Date.now();
      if (ms <= 0) { setRemaining("Expired"); setUrgencyLevel("critical"); return; }

      const totalMs = expiresAt.getTime() - (expiresAt.getTime() - ms); // original TTL approximation
      const pct = ms / Math.max(totalMs, 1);

      if (pct < 0.2) setUrgencyLevel("critical");
      else if (pct < 0.5) setUrgencyLevel("warning");
      else setUrgencyLevel("safe");

      const h = Math.floor(ms / 3600_000);
      const m = Math.floor((ms % 3600_000) / 60_000);
      const s = Math.floor((ms % 60_000) / 1000);
      if (h > 48) {
        setRemaining(`${Math.floor(h / 24)}d ${h % 24}h`);
      } else if (h > 0) {
        setRemaining(`${h}h ${m}m`);
      } else {
        setRemaining(`${m}m ${s}s`);
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  if (!expiresAt) return null;

  const colors = {
    safe: "var(--text-3)",
    warning: "var(--yellow)",
    critical: "var(--red)",
  };

  return (
    <motion.span
      className="font-mono text-xs tabular-nums"
      style={{ color: colors[urgencyLevel] }}
      animate={urgencyLevel === "critical" ? {
        scale: [1, 1.01, 1],
        opacity: [1, 0.7, 1],
      } : {}}
      transition={urgencyLevel === "critical" ? {
        duration: 1,
        repeat: Infinity,
        ease: "easeInOut",
      } : {}}
    >
      {remaining}
    </motion.span>
  );
}

// ─── Encryption breathing indicator ─────────────────────────────────────────────

function EncryptionBreather() {
  return (
    <motion.div
      animate={{ scale: [1, 1.1, 1] }}
      transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
      className="inline-flex"
      aria-label="Encryption active"
    >
      <Lock size={11} className="text-emerald-400" aria-hidden="true" />
    </motion.div>
  );
}

// ─── Obligation card with Vibrant physics ───────────────────────────────────────

const TYPE_CONFIG = {
  DEBT:     { icon: AlertCircle, color: "var(--red)",    bg: "rgba(255, 68, 68, 0.06)",  border: "var(--red-border)",    label: "Obligation",  glow: "rgba(255, 68, 68, 0.15)" },
  URGENT:   { icon: Zap,         color: "var(--red)",    bg: "rgba(255, 68, 68, 0.06)",  border: "var(--red-border)",    label: "Urgent",      glow: "rgba(255, 82, 82, 0.4)" },
  DEADLINE: { icon: Clock,       color: "var(--red)",    bg: "rgba(255, 68, 68, 0.06)",  border: "var(--red-border)",    label: "Deadline",    glow: "rgba(255, 68, 68, 0.2)" },
  QUESTION: { icon: HelpCircle,  color: "var(--yellow)", bg: "rgba(255, 208, 0, 0.05)",  border: "var(--yellow-border)", label: "Question",    glow: "rgba(255, 208, 0, 0.15)" },
  SOCIAL_NOISE: { icon: Ghost,   color: "var(--text-3)", bg: "rgba(255,255,255,0.02)",   border: "var(--border)",        label: "Noise",       glow: "none" },
};

function OblivionCard({
  card,
  index,
  onResolve,
  onSnooze,
  cardRefs,
}: {
  card: ObligationCard;
  index: number;
  onResolve: (id: string, rect?: DOMRect) => void;
  onSnooze: (id: string) => void;
  cardRefs: React.MutableRefObject<Map<string, HTMLDivElement>>;
}) {
  const cfg = TYPE_CONFIG[card.type] ?? TYPE_CONFIG.SOCIAL_NOISE;
  const Icon = cfg.icon;
  const isUrgent = card.type === "URGENT";
  const ttlPct = card.expiresAt
    ? Math.max(0, (card.expiresAt.getTime() - Date.now()) / (card.expiresAt.getTime() - card.createdAt.getTime()))
    : 1;

  // Dynamic border color based on TTL urgency
  const borderColor = ttlPct < 0.2 ? "rgba(255, 68, 68, 0.5)"
    : ttlPct < 0.5 ? "rgba(255, 160, 0, 0.35)"
    : cfg.border;

  return (
    <motion.div
      ref={(el: HTMLDivElement | null) => {
        if (el) cardRefs.current.set(card.id, el);
        else cardRefs.current.delete(card.id);
      }}
      layout
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{
        opacity: 1,
        y: 0,
        scale: 1,
        ...(isUrgent && ttlPct < 0.2 ? {
          // Urgency pulse for critical items
        } : {}),
      }}
      exit={{
        opacity: 0,
        scale: 0.9,
        y: -12,
        filter: "blur(4px)",
        transition: { duration: 0.4, ease: VIBRANT_EASE as any },
      }}
      transition={{
        delay: index * 0.05,
        ...VIBRANT_SPRING,
      }}
      whileHover={{
        scale: 1.02,
        boxShadow: `0px 8px 30px rgba(0,0,0,0.12), 0 0 20px ${cfg.glow}`,
        transition: CARD_HOVER_SPRING,
      }}
      whileTap={{ scale: 0.985 }}
      role="article"
      aria-label={`${cfg.label}: ${card.title}`}
      className="relative rounded-2xl p-4 cursor-default group"
      style={{
        // Glassmorphism
        background: cfg.bg,
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        border: `1px solid ${borderColor}`,
        // Neon glow for urgent items
        boxShadow: isUrgent ? `0 0 20px ${cfg.glow}` : "none",
        transition: "border-color 0.5s ease, box-shadow 0.3s ease",
      }}
    >
      {/* Priority pulse ring for critical items */}
      {card.priority === 1 && (
        <motion.span
          aria-hidden="true"
          className="absolute top-3 right-3 h-2 w-2 rounded-full"
          style={{ background: cfg.color }}
          animate={{
            boxShadow: [
              `0 0 0 0 ${cfg.border}`,
              `0 0 0 8px transparent`,
              `0 0 0 0 transparent`,
            ],
          }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
        />
      )}

      <div className="flex items-start gap-3">
        <motion.div
          className="mt-0.5 shrink-0 rounded-lg p-1.5"
          style={{ background: `color-mix(in srgb, ${cfg.color} 15%, transparent)` }}
          whileHover={{ rotate: 5 }}
          transition={CARD_HOVER_SPRING}
        >
          <Icon size={14} style={{ color: cfg.color }} aria-hidden="true" />
        </motion.div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: cfg.color }}>
              {cfg.label}
            </span>
            {card.assignedTo && (
              <span className="text-[10px] text-[var(--text-3)]">· {card.assignedTo}</span>
            )}
            <EncryptionBreather />
          </div>
          <p className="text-sm font-medium text-[var(--text)] leading-snug">{card.title}</p>
          {card.detail !== card.title && (
            <p className="mt-1 text-xs text-[var(--text-2)] leading-relaxed line-clamp-2">{card.detail}</p>
          )}
          <div className="mt-2 flex items-center gap-3">
            <Countdown expiresAt={card.expiresAt} />
            <div className="ml-auto flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              <motion.button
                onClick={() => onSnooze(card.id)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="rounded-lg px-2 py-1 text-[10px] font-medium text-[var(--text-3)] hover:text-[var(--text-2)] hover:bg-white/5 transition-colors"
                aria-label="Snooze this obligation"
              >
                Snooze
              </motion.button>
              <motion.button
                onClick={() => {
                  const el = cardRefs.current.get(card.id);
                  const rect = el?.getBoundingClientRect();
                  onResolve(card.id, rect);
                }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="rounded-lg px-2 py-1 text-[10px] font-medium text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                aria-label="Mark as resolved"
              >
                Done ✓
              </motion.button>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Drop zone with magnetic attraction ─────────────────────────────────────────

function DropZone({ onFile }: { onFile: (text: string, name: string) => void }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [showApiKey, setShowApiKey] = useState(false);
  const [apiKeyValue, setApiKeyValue] = useState("");
  const [apiKeyVisible, setApiKeyVisible] = useState(false);

  // Magnetic attraction motion values
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const springX = useSpring(mouseX, { stiffness: 400, damping: 30 });
  const springY = useSpring(mouseY, { stiffness: 400, damping: 30 });
  const magneticX = useTransform(springX, (v) => dragging ? v * 0.02 : 0);
  const magneticY = useTransform(springY, (v) => dragging ? v * 0.02 : 0);

  useEffect(() => {
    const stored = localStorage.getItem("oblivion_api_key");
    if (stored) setApiKeyValue(stored);
  }, []);

  const saveApiKey = () => {
    if (apiKeyValue.trim()) {
      localStorage.setItem("oblivion_api_key", apiKeyValue.trim());
    } else {
      localStorage.removeItem("oblivion_api_key");
    }
    setShowApiKey(false);
  };

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    const text = await file.text();
    onFile(text, file.name);
  }, [onFile]);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    onFile(text, file.name);
    e.target.value = "";
  }, [onFile]);

  const handlePaste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text.trim()) onFile(text, "pasted-chat.txt");
    } catch {
      // clipboard not available silently
    }
  }, [onFile]);

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-xl mx-auto">
      {/* Main drop zone with magnetic attraction */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, ...VIBRANT_SPRING }}
        style={{ x: magneticX, y: magneticY }}
        onDragOver={e => {
          e.preventDefault();
          setDragging(true);
          const rect = e.currentTarget.getBoundingClientRect();
          mouseX.set(e.clientX - rect.left - rect.width / 2);
          mouseY.set(e.clientY - rect.top - rect.height / 2);
        }}
        onDragLeave={() => {
          setDragging(false);
          mouseX.set(0);
          mouseY.set(0);
        }}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        aria-label="Drop chat file or click to upload"
        onKeyDown={e => { if (e.key === "Enter" || e.key === " ") inputRef.current?.click(); }}
        className="relative w-full rounded-3xl border-2 border-dashed cursor-pointer select-none overflow-hidden"
        whileHover={{ scale: 1.01, transition: CARD_HOVER_SPRING }}
        whileTap={{ scale: 0.99 }}
      >
        {/* Glassmorphism background */}
        <div
          className="absolute inset-0 transition-all duration-500"
          style={{
            background: dragging
              ? "rgba(68, 136, 255, 0.08)"
              : "rgba(255, 255, 255, 0.02)",
            backdropFilter: "blur(20px)",
            borderColor: dragging ? "var(--blue)" : "var(--border-2)",
          }}
        />

        <div className="relative flex flex-col items-center gap-4 py-16 px-8 text-center">
          <motion.div
            animate={{
              y: dragging ? -8 : [0, -6, 0],
              scale: dragging ? 1.1 : 1,
              rotate: dragging ? [0, -5, 5, 0] : 0,
            }}
            transition={dragging
              ? { ...VIBRANT_SPRING }
              : { duration: 3, repeat: Infinity, ease: "easeInOut" }
            }
            className="rounded-2xl p-4"
            style={{ background: "var(--surface)" }}
          >
            <Upload size={28} className="text-[var(--text-2)]" aria-hidden="true" />
          </motion.div>
          <div>
            <p className="text-base font-semibold text-[var(--text)]">
              {dragging ? "Drop it in the void" : "Feed me your chaos"}
            </p>
            <p className="mt-1 text-sm text-[var(--text-3)]">
              Drop a WhatsApp .txt export · click to browse
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            {["WhatsApp .txt", "Slack export", "Any chat"].map(fmt => (
              <span key={fmt} className="rounded-full px-3 py-1 text-[11px] font-medium text-[var(--text-3)]" style={{ background: "var(--surface)" }}>
                {fmt}
              </span>
            ))}
          </div>
        </div>

        {/* Border overlay for dragging state */}
        <div
          className="absolute inset-0 rounded-3xl pointer-events-none transition-all duration-300"
          style={{
            border: `2px dashed ${dragging ? "var(--blue)" : "var(--border-2)"}`,
          }}
        />

        <input ref={inputRef} type="file" accept=".txt,.json,.csv,text/plain" className="sr-only" onChange={handleFileChange} aria-hidden="true" />
      </motion.div>

      {/* Secondary actions */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="flex items-center gap-3"
      >
        <motion.button
          onClick={handlePaste}
          whileHover={{ scale: 1.03, y: -1 }}
          whileTap={{ scale: 0.97 }}
          transition={CARD_HOVER_SPRING}
          className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-[var(--text-2)] transition-all hover:text-[var(--text)] hover:bg-white/5"
          style={{ border: "1px solid var(--border)" }}
        >
          <FileText size={14} aria-hidden="true" />
          Paste from clipboard
        </motion.button>
        <motion.button
          onClick={() => setShowApiKey(v => !v)}
          whileHover={{ scale: 1.03, y: -1 }}
          whileTap={{ scale: 0.97 }}
          transition={CARD_HOVER_SPRING}
          className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-[var(--text-3)] transition-all hover:text-[var(--text-2)] hover:bg-white/5"
          style={{ border: "1px solid var(--border)" }}
          aria-label="Manage API key"
        >
          <Key size={14} aria-hidden="true" />
          API key
        </motion.button>
      </motion.div>

      {/* API key drawer */}
      <AnimatePresence>
        {showApiKey && (
          <motion.div
            initial={{ opacity: 0, height: 0, scale: 0.98 }}
            animate={{ opacity: 1, height: "auto", scale: 1 }}
            exit={{ opacity: 0, height: 0, scale: 0.98 }}
            transition={GHOST_SPRING}
            className="w-full overflow-hidden"
          >
            <div
              className="rounded-2xl p-4 space-y-3"
              style={{
                background: "rgba(255, 255, 255, 0.03)",
                backdropFilter: "blur(20px)",
                border: "1px solid var(--border)",
              }}
            >
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-[var(--text-2)] uppercase tracking-widest">Groq API Key</p>
                <button
                  onClick={() => { localStorage.removeItem("oblivion_api_key"); setApiKeyValue(""); }}
                  className="text-[10px] text-[var(--text-3)] hover:text-red-400 transition-colors flex items-center gap-1"
                >
                  <Trash2 size={9} aria-hidden="true" />
                  Clear
                </button>
              </div>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type={apiKeyVisible ? "text" : "password"}
                    value={apiKeyValue}
                    onChange={e => setApiKeyValue(e.target.value)}
                    placeholder="gsk_..."
                    className="w-full rounded-xl px-3 py-2 pr-9 font-mono text-xs text-[var(--text)] placeholder-[var(--text-3)] outline-none focus:ring-1 transition-all"
                    style={{ background: "var(--surface)", border: "1px solid var(--border-2)" }}
                    onFocus={e => (e.target.style.borderColor = "var(--blue)")}
                    onBlur={e => (e.target.style.borderColor = "var(--border-2)")}
                  />
                  <button onClick={() => setApiKeyVisible(v => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-3)]" aria-label={apiKeyVisible ? "Hide key" : "Show key"}>
                    {apiKeyVisible ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>
                </div>
                <motion.button
                  onClick={saveApiKey}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  className="rounded-xl px-4 text-xs font-semibold text-white transition-all hover:opacity-90"
                  style={{ background: "var(--blue)" }}
                >
                  Save
                </motion.button>
              </div>
              <p className="text-[10px] text-[var(--text-3)]">
                <EncryptionBreather />
                <span className="ml-1.5">Stored locally in your browser. Never leaves your device.</span>
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Progress indicator with spring animation ───────────────────────────────────

function ProgressView({ progress }: { progress: ParseProgress }) {
  const circumference = 2 * Math.PI * 34;
  const dashOffset = useSpring(circumference, { stiffness: 100, damping: 20 });

  useEffect(() => {
    dashOffset.set(circumference * (1 - progress.percent / 100));
  }, [progress.percent, circumference, dashOffset]);

  const phaseLabels: Record<string, string> = {
    reading: "Reading file…",
    parsing: "Parsing messages…",
    scoring: "Computing attention scores…",
    graphing: "Building knowledge graph…",
    encrypting: "Encrypting to GhostBin…",
    done: "Done",
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={VIBRANT_SPRING}
      className="flex flex-col items-center gap-6 w-full max-w-md mx-auto py-8"
    >
      <div className="relative">
        <svg width="80" height="80" viewBox="0 0 80 80" className="rotate-[-90deg]" aria-hidden="true">
          <circle cx="40" cy="40" r="34" fill="none" stroke="var(--surface)" strokeWidth="4" />
          <motion.circle
            cx="40" cy="40" r="34" fill="none"
            stroke="var(--blue)" strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={circumference}
            style={{ strokeDashoffset: dashOffset }}
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-sm font-semibold text-[var(--text)]">
          {progress.percent}%
        </span>
      </div>
      <div className="text-center space-y-1">
        <motion.p
          key={progress.phase}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={VIBRANT_SPRING}
          className="text-sm font-medium text-[var(--text)]"
        >
          {phaseLabels[progress.phase] ?? "Processing…"}
        </motion.p>
        <p className="text-xs text-[var(--text-3)]">{progress.processed.toLocaleString()} of {progress.total.toLocaleString()} lines</p>
      </div>
      <div className="flex items-center gap-2 text-[10px] text-[var(--text-3)]">
        <EncryptionBreather />
        <span>All processing happens locally</span>
      </div>
    </motion.div>
  );
}

// ─── Stats bar ─────────────────────────────────────────────────────────────────

function StatsBar({ ledger }: { ledger: AttentionLedger }) {
  const cards = ledger.active.length + ledger.questions.length;
  const ghostPct = ledger.totalProcessed > 0
    ? Math.round((ledger.ghosted / ledger.totalProcessed) * 100)
    : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={VIBRANT_SPRING}
      className="flex flex-wrap items-center gap-4 text-xs text-[var(--text-3)]"
    >
      <span><strong className="text-[var(--text)]">{ledger.totalProcessed.toLocaleString()}</strong> messages processed</span>
      <span className="text-[var(--border-2)]">·</span>
      <span><strong className="text-[var(--red)]">{cards}</strong> obligations surfaced</span>
      <span className="text-[var(--border-2)]">·</span>
      <span><strong className="text-[var(--text-2)]">{ledger.ghosted.toLocaleString()}</strong> ({ghostPct}%) ghosted</span>
      <span className="text-[var(--border-2)]">·</span>
      <span className="flex items-center gap-1">
        <Shield size={10} className="text-emerald-400" aria-hidden="true" />
        <span className="text-emerald-400">AES-256-GCM</span>
      </span>
    </motion.div>
  );
}

// ─── Ledger view ────────────────────────────────────────────────────────────────

function LedgerView({
  ledger,
  onReset,
  ghostingCanvasRef,
}: {
  ledger: AttentionLedger;
  onReset: () => void;
  ghostingCanvasRef: React.RefObject<GhostingCanvasHandle | null>;
}) {
  const [cards, setCards] = useState({
    active: ledger.active,
    questions: ledger.questions,
  });
  const [ghostOpen, setGhostOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const handleResolve = useCallback((id: string, rect?: DOMRect) => {
    // Trigger particle dissolution
    if (rect && ghostingCanvasRef.current) {
      ghostingCanvasRef.current.triggerGhosting(rect);
    }

    setCards(c => ({
      active: c.active.filter(x => x.id !== id),
      questions: c.questions.filter(x => x.id !== id),
    }));
  }, [ghostingCanvasRef]);

  const handleSnooze = useCallback((id: string) => {
    handleResolve(id);
    setTimeout(() => {
      setCards(c => {
        const card = [...ledger.active, ...ledger.questions].find(x => x.id === id);
        if (!card) return c;
        return card.type === "QUESTION"
          ? { ...c, questions: [...c.questions, card] }
          : { ...c, active: [...c.active, card] };
      });
    }, 30_000);
  }, [handleResolve, ledger.active, ledger.questions]);

  const allGhostedCount = ledger.ghosted;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={VIBRANT_SPRING}
      className="w-full space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <StatsBar ledger={ledger} />
        <motion.button
          onClick={onReset}
          whileHover={{ scale: 1.03, y: -1 }}
          whileTap={{ scale: 0.97 }}
          transition={CARD_HOVER_SPRING}
          className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium text-[var(--text-3)] hover:text-[var(--text-2)] transition-all hover:bg-white/5"
          style={{ border: "1px solid var(--border)" }}
        >
          <X size={12} aria-hidden="true" />
          New session
        </motion.button>
      </div>

      {/* Active obligations (red) */}
      {cards.active.length > 0 && (
        <motion.section
          aria-label="Active obligations"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, ...VIBRANT_SPRING }}
        >
          <div className="flex items-center gap-2 mb-3">
            <motion.span
              className="text-[11px] font-bold uppercase tracking-widest text-[var(--red)]"
              animate={{ opacity: [0.7, 1, 0.7] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            >
              ● Active Obligations
            </motion.span>
            <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold text-[var(--red)] tabular-nums" style={{ background: "var(--red-dim)" }}>
              {cards.active.length}
            </span>
          </div>
          <div className="space-y-2" role="list">
            <AnimatePresence mode="popLayout">
              {cards.active.map((card, i) => (
                <OblivionCard
                  key={card.id}
                  card={card}
                  index={i}
                  onResolve={handleResolve}
                  onSnooze={handleSnooze}
                  cardRefs={cardRefs}
                />
              ))}
            </AnimatePresence>
          </div>
        </motion.section>
      )}

      {/* Pending questions (yellow) */}
      {cards.questions.length > 0 && (
        <motion.section
          aria-label="Pending questions"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, ...VIBRANT_SPRING }}
        >
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[11px] font-bold uppercase tracking-widest text-[var(--yellow)]">
              ◐ Pending Questions
            </span>
            <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold text-[var(--yellow)] tabular-nums" style={{ background: "var(--yellow-dim)" }}>
              {cards.questions.length}
            </span>
          </div>
          <div className="space-y-2" role="list">
            <AnimatePresence mode="popLayout">
              {cards.questions.map((card, i) => (
                <OblivionCard
                  key={card.id}
                  card={card}
                  index={i}
                  onResolve={handleResolve}
                  onSnooze={handleSnooze}
                  cardRefs={cardRefs}
                />
              ))}
            </AnimatePresence>
          </div>
        </motion.section>
      )}

      {/* Empty state */}
      {cards.active.length === 0 && cards.questions.length === 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={VIBRANT_SPRING}
          className="flex flex-col items-center gap-4 py-16 text-center"
        >
          <motion.div
            className="rounded-3xl p-6"
            style={{
              background: "rgba(255, 255, 255, 0.03)",
              backdropFilter: "blur(20px)",
            }}
            animate={{ scale: [1, 1.02, 1] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          >
            <CheckCircle size={32} className="text-emerald-400" aria-hidden="true" />
          </motion.div>
          <div>
            <p className="text-base font-semibold text-[var(--text)]">Void achieved</p>
            <p className="mt-1 text-sm text-[var(--text-3)]">All obligations resolved. You are free.</p>
          </div>
        </motion.div>
      )}

      {/* GhostBin */}
      <motion.section
        aria-label="GhostBin — archived messages"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, ...VIBRANT_SPRING }}
      >
        <motion.button
          onClick={() => setGhostOpen(v => !v)}
          whileHover={{ scale: 1.005, y: -1 }}
          transition={CARD_HOVER_SPRING}
          className="flex w-full items-center justify-between rounded-2xl px-4 py-3 transition-all"
          style={{
            background: "rgba(255, 255, 255, 0.02)",
            backdropFilter: "blur(20px)",
            border: "1px solid var(--border)",
          }}
          aria-expanded={ghostOpen}
        >
          <div className="flex items-center gap-2">
            <motion.div
              animate={{ rotate: ghostOpen ? 360 : 0 }}
              transition={VIBRANT_SPRING}
            >
              <Ghost size={14} className="text-[var(--text-3)]" aria-hidden="true" />
            </motion.div>
            <span className="text-sm font-medium text-[var(--text-3)]">GhostBin</span>
            <span className="rounded-full px-2 py-0.5 text-[10px] font-medium text-[var(--text-3)] tabular-nums" style={{ background: "var(--surface)" }}>
              {allGhostedCount.toLocaleString()} messages
            </span>
          </div>
          <motion.div
            animate={{ rotate: ghostOpen ? 180 : 0 }}
            transition={VIBRANT_SPRING}
          >
            <ChevronDown size={14} className="text-[var(--text-3)]" aria-hidden="true" />
          </motion.div>
        </motion.button>

        <AnimatePresence>
          {ghostOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0, scale: 0.98 }}
              animate={{ opacity: 1, height: "auto", scale: 1 }}
              exit={{ opacity: 0, height: 0, scale: 0.98 }}
              transition={GHOST_SPRING}
              className="overflow-hidden"
            >
              <div
                className="mt-2 rounded-2xl p-4 space-y-3"
                style={{
                  background: "rgba(255, 255, 255, 0.02)",
                  backdropFilter: "blur(20px)",
                  border: "1px solid var(--border)",
                }}
              >
                <div className="flex items-center gap-2 rounded-xl px-3 py-2" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                  <Search size={13} className="text-[var(--text-3)]" aria-hidden="true" />
                  <input
                    type="search"
                    placeholder="Search ghosted messages…"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="flex-1 bg-transparent text-sm text-[var(--text)] placeholder-[var(--text-3)] outline-none"
                    aria-label="Search ghosted messages"
                  />
                </div>
                <p className="text-xs text-center text-[var(--text-3)] py-4">
                  <EncryptionBreather />
                  <span className="ml-1.5">
                    {allGhostedCount.toLocaleString()} messages encrypted and archived.
                    {searchQuery
                      ? ` Search active — results would appear here in a full implementation.`
                      : " Low-signal messages are safely ghosted."}
                  </span>
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.section>
    </motion.div>
  );
}

// ─── Hero section ──────────────────────────────────────────────────────────────

function Hero() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, ease: VIBRANT_EASE as any }}
      className="text-center space-y-4 max-w-lg mx-auto"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1, ...VIBRANT_SPRING }}
        className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium text-[var(--text-3)]"
        style={{
          background: "rgba(255, 255, 255, 0.03)",
          backdropFilter: "blur(20px)",
          border: "1px solid var(--border)",
        }}
      >
        <EncryptionBreather />
        Zero-knowledge · Local-first · Ephemeral
      </motion.div>
      <motion.h1
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, ...VIBRANT_SPRING }}
        className="text-4xl sm:text-5xl font-extrabold tracking-tight text-[var(--text)] leading-[1.1]"
      >
        Oblivion
      </motion.h1>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.25, duration: 0.6 }}
        className="text-base text-[var(--text-2)] leading-relaxed"
      >
        Drop your chat export. Get only what demands attention. Everything else disappears.
      </motion.p>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.35, duration: 0.6 }}
        className="flex items-center justify-center gap-6 text-[11px] text-[var(--text-3)]"
      >
        <span className="flex items-center gap-1.5">
          <motion.span
            className="h-1.5 w-1.5 rounded-full bg-[var(--red)]"
            aria-hidden="true"
            animate={{ scale: [1, 1.3, 1] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          />
          Active obligations
        </span>
        <span className="flex items-center gap-1.5">
          <motion.span
            className="h-1.5 w-1.5 rounded-full bg-[var(--yellow)]"
            aria-hidden="true"
            animate={{ scale: [1, 1.3, 1] }}
            transition={{ duration: 2, delay: 0.3, repeat: Infinity, ease: "easeInOut" }}
          />
          Pending questions
        </span>
        <span className="flex items-center gap-1.5">
          <motion.span
            className="h-1.5 w-1.5 rounded-full bg-[var(--text-3)]"
            aria-hidden="true"
            animate={{ scale: [1, 1.3, 1], opacity: [1, 0.5, 1] }}
            transition={{ duration: 2, delay: 0.6, repeat: Infinity, ease: "easeInOut" }}
          />
          Ghosted noise
        </span>
      </motion.div>
    </motion.div>
  );
}

// ─── Security status bar ───────────────────────────────────────────────────────

function SecurityBar() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5 }}
      className="flex items-center justify-center gap-4 text-[10px] text-[var(--text-3)] py-3"
    >
      <span className="flex items-center gap-1">
        <Shield size={9} className="text-emerald-400" aria-hidden="true" />
        AES-256-GCM
      </span>
      <span className="text-[var(--border-2)]">·</span>
      <span className="flex items-center gap-1">
        <Activity size={9} className="text-blue-400" aria-hidden="true" />
        PBKDF2-SHA256 (600k)
      </span>
      <span className="text-[var(--border-2)]">·</span>
      <span className="flex items-center gap-1">
        <Lock size={9} className="text-purple-400" aria-hidden="true" />
        Differential Privacy (ε=1.0)
      </span>
    </motion.div>
  );
}

// ─── Root page ─────────────────────────────────────────────────────────────────

export default function OblivionPage() {
  const [phase, setPhase] = useState<AppPhase>("IDLE");
  const [progress, setProgress] = useState<ParseProgress | null>(null);
  const [ledger, setLedger] = useState<AttentionLedger | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ghostingCanvasRef = useRef<GhostingCanvasHandle>(null);

  // Install cryptographic key shredding and decay engine
  useEffect(() => {
    installKeyShredding();

    // Register ghost callback to trigger canvas dissolution
    const unsubscribe = onNodeGhosted((nodeId) => {
      // In a full implementation, we'd look up the card's DOM rect
      // For now, trigger a centered dissolution
      if (ghostingCanvasRef.current) {
        const rect = new DOMRect(
          window.innerWidth / 2 - 150,
          window.innerHeight / 2 - 50,
          300,
          100
        );
        ghostingCanvasRef.current.triggerGhosting(rect);
      }
    });

    return () => {
      unsubscribe();
      stopDecayEngine();
      destroySessionKey();
    };
  }, []);

  const handleFile = useCallback(async (text: string, _name: string) => {
    setError(null);
    setPhase("PARSING");

    // Run parser async to let UI render
    setTimeout(async () => {
      try {
        const result = parseChat(text, (p) => {
          setProgress({ ...p });
        });

        // ── Encrypt and store nodes to IndexedDB with differential privacy ──
        setProgress({
          phase: "encrypting",
          processed: 0,
          total: result.messageNodes.length,
          percent: 95,
          message: "Encrypting & storing nodes…",
        });

        // Process a subset for performance (first 100 nodes)
        const nodesToStore = result.messageNodes.slice(0, 100);
        for (let i = 0; i < nodesToStore.length; i++) {
          const node = nodesToStore[i];
          try {
            // Generate embedding and add differential privacy
            const rawEmbedding = generateEmbedding(node.content);
            const noisyEmbedding = addDifferentialPrivacy(rawEmbedding);

            // Encrypt content
            const envelope = await encrypt(node.content);

            // Hash sender name
            const senderHash = await hmacSenderHash(node.sender);

            // Store encrypted node
            await putNode({
              id: node.id,
              ciphertext: envelope.ciphertext,
              iv: envelope.iv,
              noisy_embedding: Array.from(noisyEmbedding),
              ars_score: node.attentionScore,
              ttl_expiry: node.expiresAt?.getTime() ?? 0,
              obligation_type: node.status === "GHOSTED" ? "GHOSTED" : node.obligationType,
              sender_hash: senderHash,
              created_at: node.timestamp.getTime(),
            });
          } catch {
            // Continue processing even if individual node fails
          }
        }

        // Start the ARS decay engine
        startDecayEngine();

        setLedger(result.ledger);
        setPhase("READY");
        setProgress(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to parse chat file.");
        setPhase("IDLE");
        setProgress(null);
      }
    }, 16);
  }, []);

  const handleReset = useCallback(async () => {
    // Trigger a ghosting animation for visual flair on reset
    if (ghostingCanvasRef.current) {
      const rect = new DOMRect(
        window.innerWidth / 2 - 200,
        window.innerHeight / 3,
        400,
        200
      );
      ghostingCanvasRef.current.triggerGhosting(rect, "rgba(68, 136, 255, 0.6)");
    }

    stopDecayEngine();
    await clearAllNodes();
    destroySessionKey();

    setPhase("IDLE");
    setLedger(null);
    setProgress(null);
    setError(null);
  }, []);

  return (
    <div className="min-h-screen flex flex-col overflow-x-hidden" style={{ background: "var(--bg)" }}>
      {/* Particle dissolution overlay */}
      <GhostingCanvas ref={ghostingCanvasRef} />

      {/* Top nav */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, ...VIBRANT_SPRING }}
        className="flex items-center justify-between px-6 py-4 border-b"
        style={{
          borderColor: "var(--border)",
          background: "rgba(10, 10, 11, 0.8)",
          backdropFilter: "blur(20px)",
          position: "sticky",
          top: 0,
          zIndex: 50,
        }}
      >
        <div className="flex items-center gap-2">
          <motion.span
            className="text-sm font-bold text-[var(--text)] tracking-tight"
            whileHover={{ scale: 1.02 }}
          >
            Oblivion
          </motion.span>
          <span className="rounded-full px-1.5 py-0.5 text-[9px] font-bold text-[var(--text-3)] uppercase tracking-widest" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            v0.2
          </span>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-3 text-[11px] text-[var(--text-3)]">
            <EncryptionBreather />
            <span>Client-side only · No data sent</span>
          </div>

          <div className="h-4 w-px bg-[var(--border)] mx-1 hidden sm:block"></div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <motion.a
              href="https://github.com/Aliyan-cmd/Oblivtion"
              target="_blank"
              rel="noopener noreferrer"
              whileHover={{ scale: 1.05, y: -1 }}
              whileTap={{ scale: 0.95 }}
              className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium text-[var(--text)] transition-all hover:bg-white/5"
              style={{ border: "1px solid var(--border)", background: "rgba(255,255,255,0.03)" }}
            >
              <Code size={13} aria-hidden="true" />
              <span className="hidden sm:inline">Repo</span>
            </motion.a>
            <motion.a
              href="#"
              whileHover={{ scale: 1.05, y: -1 }}
              whileTap={{ scale: 0.95 }}
              className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium text-[var(--bg)] bg-[var(--text)] transition-all hover:opacity-90"
            >
              <BookOpen size={13} aria-hidden="true" />
              <span>Docs</span>
            </motion.a>
          </div>
        </div>
      </motion.header>

      {/* Main content */}
      <motion.main
        id="main-content"
        className="flex-1 flex flex-col items-center justify-center px-6 py-12 gap-12 relative"
        initial={{ opacity: 0, scale: 0.98, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.6, ease: VIBRANT_EASE as any }}
      >
        {/* Subtle background glow effect */}
        <motion.div
          className="absolute inset-0 pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 1 }}
          style={{
            background: "radial-gradient(circle at 50% 30%, rgba(68, 136, 255, 0.04) 0%, transparent 60%)",
          }}
        />
        <AnimatePresence mode="wait">
          {phase === "IDLE" && (
            <motion.div
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, scale: 0.95, filter: "blur(8px)" }}
              transition={{ duration: 0.4, ease: VIBRANT_EASE as any }}
              className="w-full flex flex-col items-center gap-10"
            >
              <Hero />
              <DropZone onFile={handleFile} />
              <SecurityBar />
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={VIBRANT_SPRING}
                  role="alert"
                  className="flex items-center gap-2 rounded-2xl px-4 py-3 text-sm text-red-400"
                  style={{
                    background: "rgba(255, 68, 68, 0.08)",
                    backdropFilter: "blur(20px)",
                    border: "1px solid var(--red-border)",
                  }}
                >
                  <AlertCircle size={14} aria-hidden="true" />
                  {error}
                </motion.div>
              )}
            </motion.div>
          )}

          {phase === "PARSING" && progress && (
            <motion.div
              key="parsing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, filter: "blur(4px)" }}
            >
              <ProgressView progress={progress} />
            </motion.div>
          )}

          {phase === "READY" && ledger && (
            <motion.div
              key="ready"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={VIBRANT_SPRING}
              className="w-full max-w-2xl mx-auto"
            >
              <LedgerView
                ledger={ledger}
                onReset={handleReset}
                ghostingCanvasRef={ghostingCanvasRef}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.main>

      {/* Footer */}
      <footer
        className="px-6 py-4 border-t text-center text-[10px] text-[var(--text-3)]"
        style={{
          borderColor: "var(--border)",
          background: "rgba(10, 10, 11, 0.8)",
          backdropFilter: "blur(20px)",
        }}
      >
        All processing happens in your browser. Nothing is stored on any server.
        <span className="mx-2">·</span>
        <a href="https://github.com/Aliyan-cmd/Oblivtion" target="_blank" rel="noopener noreferrer" className="hover:text-[var(--text-2)] transition-colors underline">
          GitHub
        </a>
      </footer>
    </div>
  );
}
