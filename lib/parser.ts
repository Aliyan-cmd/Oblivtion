// ─── Chat Parser (WhatsApp, Slack, Discord, generic CSV) ─────────────────────
// Designed to run in a Web Worker — no DOM access, no imports from React.

import type { RawMessage, ObligationType, MessageNode, PersonNode, ObligationCard, AttentionLedger, ParseProgress } from "./types"

// ─── Format regexes ────────────────────────────────────────────────────────────

// WhatsApp: [DD/MM/YY, HH:MM:SS] Sender: Message
//           or  DD/MM/YYYY, HH:MM - Sender: Message
const WA_BRACKET  = /^\[(\d{1,2}\/\d{1,2}\/\d{2,4}),\s*(\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AP]M)?)\]\s*([^:]+):\s*(.+)$/i
const WA_DASH     = /^(\d{1,2}\/\d{1,2}\/\d{2,4}),\s*(\d{1,2}:\d{2}(?:\s*[AP]M)?)\s*-\s*([^:]+):\s*(.+)$/i

// Generic numbered format used by existing sample: [N] Sender: Message
const NUMBERED    = /^\[(\d+)\]\s+([^:]+):\s*(.+)$/

// ─── Parse a single line ───────────────────────────────────────────────────────

function parseLine(line: string, index: number): RawMessage | null {
  line = line.trim()
  if (!line) return null

  // Try WhatsApp bracket format
  let m = WA_BRACKET.exec(line)
  if (m) {
    const [, date, time, sender, content] = m
    return {
      id: `msg_${index}`,
      sender: sender.trim(),
      timestamp: new Date(`${date} ${time}`),
      content: content.trim(),
      rawLine: line,
    }
  }

  // Try WhatsApp dash format
  m = WA_DASH.exec(line)
  if (m) {
    const [, date, time, sender, content] = m
    return {
      id: `msg_${index}`,
      sender: sender.trim(),
      timestamp: new Date(`${date} ${time}`),
      content: content.trim(),
      rawLine: line,
    }
  }

  // Try numbered format (existing sample)
  const nm = NUMBERED.exec(line)
  if (nm) {
    const [, num, sender, content] = nm
    return {
      id: `msg_${num}`,
      sender: sender.trim(),
      timestamp: new Date(Date.now() - (1000 - parseInt(num)) * 60_000), // synthetic timestamps
      content: content.trim(),
      rawLine: line,
    }
  }

  return null
}

// ─── Obligation classifier ─────────────────────────────────────────────────────

const DEBT_PATTERNS = [
  /\b(will|gonna|going to|i'll|we'll|karna hai|kar deta|submit kar|send kar|bhej)\b/i,
  /\b(promise|commitment|aaj|kal|done by|by [a-z]+day)\b/i,
]
const QUESTION_PATTERNS = [
  /\?/,
  /\b(kya|kyun|kab|kaise|who|what|when|where|how|anyone|confirm|bata)\b/i,
]
const DEADLINE_PATTERNS = [
  /\b(\d{1,2}(?:st|nd|rd|th)?\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
  /\b(\d{1,2}[:\/]\d{2}|\d+\s*(am|pm|baje))\b/i,
  /\b(deadline|due|submit|last date|cutoff|expire)\b/i,
]
const URGENT_PATTERNS = [
  /\b(urgent|asap|immediately|abhi|jaldi|right now|sos|emergency)\b/i,
  /!!+/,
]
const NOISE_PATTERNS = [
  /^(ok|okay|haha|lol|lmao|thanks|thx|👍|🙏|nice|cool|great|wow|😂|❤️|😊|k$|yes|no|yep|nope|sure|hmm|oof|bruh|😭|🔥|💀)\s*[!.]?$/i,
  /^(good morning|gm|good night|gn|good evening)\s*[!.]?$/i,
]

function classifyObligation(content: string): ObligationType {
  if (NOISE_PATTERNS.some(p => p.test(content.trim()))) return "SOCIAL_NOISE"
  if (URGENT_PATTERNS.some(p => p.test(content))) return "URGENT"
  if (DEADLINE_PATTERNS.some(p => p.test(content))) return "DEADLINE"
  if (QUESTION_PATTERNS.some(p => p.test(content))) return "QUESTION"
  if (DEBT_PATTERNS.some(p => p.test(content))) return "DEBT"
  return "SOCIAL_NOISE"
}

// ─── Extract TTL from obligation type ─────────────────────────────────────────

function getTTL(type: ObligationType, timestamp: Date): { ttlMs: number; expiresAt: Date | null } {
  const now = Date.now()
  switch (type) {
    case "SOCIAL_NOISE": return { ttlMs: 0, expiresAt: timestamp }
    case "QUESTION":     return { ttlMs: 24 * 3600_000, expiresAt: new Date(now + 24 * 3600_000) }
    case "DEBT":         return { ttlMs: 72 * 3600_000, expiresAt: new Date(now + 72 * 3600_000) }
    case "URGENT":       return { ttlMs: 4 * 3600_000,  expiresAt: new Date(now + 4 * 3600_000) }
    case "DEADLINE":     return { ttlMs: 7 * 24 * 3600_000, expiresAt: new Date(now + 7 * 24 * 3600_000) }
    default:             return { ttlMs: 0, expiresAt: null }
  }
}

// ─── Attention resonance score ─────────────────────────────────────────────────
// Score = (senderFrequency × recency) + (mentions × 2) + replyDepth
// Higher = more attention-worthy

function computeAttentionScore(msg: RawMessage, senderFreq: Map<string, number>, totalMessages: number): number {
  const freq = (senderFreq.get(msg.sender) ?? 1) / totalMessages
  const ageMs = Date.now() - msg.timestamp.getTime()
  const recency = Math.max(0, 1 - ageMs / (7 * 24 * 3600_000)) // decays over 7 days
  const mentions = (msg.content.match(/@\w+/g) ?? []).length
  const hasQuestion = QUESTION_PATTERNS.some(p => p.test(msg.content)) ? 1 : 0
  return (freq * recency) + (mentions * 2) + hasQuestion
}

// ─── Extract obligation card from message ─────────────────────────────────────

function extractTitle(content: string): string {
  // First sentence, max 80 chars
  const sentence = content.split(/[.!?\n]/)[0] ?? content
  return sentence.length > 80 ? sentence.slice(0, 77) + "…" : sentence
}

// ─── Main parse function ───────────────────────────────────────────────────────

export interface ParseResult {
  ledger: AttentionLedger
  messageNodes: MessageNode[]
  personNodes: PersonNode[]
}

export function parseChat(
  text: string,
  onProgress: (p: ParseProgress) => void
): ParseResult {
  const lines = text.split(/\r?\n/)
  const total = lines.length

  onProgress({ phase: "parsing", processed: 0, total, percent: 0, message: "Parsing messages…" })

  // ── Phase 1: Parse raw messages ───────────────────────────────────────────
  const rawMessages: RawMessage[] = []
  for (let i = 0; i < lines.length; i++) {
    const msg = parseLine(lines[i], i)
    if (msg) rawMessages.push(msg)
    if (i % 500 === 0) {
      onProgress({ phase: "parsing", processed: i, total, percent: Math.round(i / total * 30), message: "Parsing messages…" })
    }
  }

  onProgress({ phase: "scoring", processed: rawMessages.length, total: rawMessages.length, percent: 30, message: "Computing attention scores…" })

  // ── Phase 2: Build sender frequency map ───────────────────────────────────
  const senderFreq = new Map<string, number>()
  for (const msg of rawMessages) {
    senderFreq.set(msg.sender, (senderFreq.get(msg.sender) ?? 0) + 1)
  }

  // ── Phase 3: Classify & score each message ────────────────────────────────
  const messageNodes: MessageNode[] = []
  const obligations: ObligationCard[] = []

  for (let i = 0; i < rawMessages.length; i++) {
    const raw = rawMessages[i]
    const type = classifyObligation(raw.content)
    const { ttlMs, expiresAt } = getTTL(type, raw.timestamp)
    const score = computeAttentionScore(raw, senderFreq, rawMessages.length)
    const isGhosted = type === "SOCIAL_NOISE" || score < 0.05

    const node: MessageNode = {
      id: raw.id,
      sender: raw.sender,
      timestamp: raw.timestamp,
      content: raw.content,
      obligationType: type,
      status: isGhosted ? "GHOSTED" : "ACTIVE",
      repliesTo: null,
      mentions: (raw.content.match(/@\w+/g) ?? []).map(m => m.slice(1)),
      attentionScore: score,
      senderFrequency: senderFreq.get(raw.sender) ?? 1,
      replyDepth: 0,
      ttlMs,
      expiresAt,
      snoozedUntil: null,
      encryptedContent: "",   // filled later
      contentIv: "",
    }

    messageNodes.push(node)

    // Only create obligation cards for active (non-ghosted) messages
    if (!isGhosted) {
      const priority: 1 | 2 | 3 =
        type === "URGENT" ? 1 :
        type === "DEADLINE" ? 1 :
        type === "QUESTION" ? 2 : 3

      obligations.push({
        id: `obl_${raw.id}`,
        type,
        title: extractTitle(raw.content),
        detail: raw.content,
        sourceMessageIds: [raw.id],
        assignedTo: raw.sender,
        dueAt: expiresAt,
        expiresAt,
        status: "ACTIVE",
        priority,
        createdAt: raw.timestamp,
        resolvedAt: null,
      })
    }

    if (i % 200 === 0) {
      onProgress({ phase: "scoring", processed: i, total: rawMessages.length, percent: 30 + Math.round(i / rawMessages.length * 50), message: "Scoring messages…" })
    }
  }

  onProgress({ phase: "graphing", processed: rawMessages.length, total: rawMessages.length, percent: 80, message: "Building attention ledger…" })

  // ── Phase 4: Build person nodes ───────────────────────────────────────────
  const personNodes: PersonNode[] = []
  for (const [name, count] of senderFreq.entries()) {
    const lastMsg = rawMessages.filter(m => m.sender === name).at(-1)
    personNodes.push({
      id: `person_${name}`,
      name,
      messageCount: count,
      lastSeen: lastMsg?.timestamp ?? new Date(),
      obligationCount: obligations.filter(o => o.assignedTo === name).length,
      attentionWeight: count / rawMessages.length,
    })
  }

  // ── Phase 5: Compile ledger ────────────────────────────────────────────────
  const active = obligations
    .filter(o => ["DEBT", "URGENT", "DEADLINE"].includes(o.type))
    .sort((a, b) => a.priority - b.priority)
    .slice(0, 20)

  const questions = obligations
    .filter(o => o.type === "QUESTION")
    .sort((a, b) => a.priority - b.priority)
    .slice(0, 15)

  const ghosted = messageNodes.filter(n => n.status === "GHOSTED").length

  const ledger: AttentionLedger = {
    active,
    questions,
    ghosted,
    totalProcessed: rawMessages.length,
    sessionId: `session_${Date.now()}`,
    lastUpdated: new Date(),
  }

  onProgress({ phase: "done", processed: rawMessages.length, total: rawMessages.length, percent: 100, message: "Done" })

  return { ledger, messageNodes, personNodes }
}
