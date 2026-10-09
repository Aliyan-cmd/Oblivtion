// ─── Oblivion Core Data Models ────────────────────────────────────────────────
// All types are strictly typed. No `any`. No implicit `undefined`.

export type ObligationType =
  | "DEBT"         // A commitment someone made
  | "QUESTION"     // An unanswered question
  | "URGENT"       // Time-sensitive action required
  | "DEADLINE"     // Hard cutoff with a timestamp
  | "SOCIAL_NOISE" // Auto-ghosted low-value signal

export type NodeStatus =
  | "ACTIVE"    // Visible in Attention Ledger
  | "GHOSTED"   // Archived to encrypted GhostBin
  | "RESOLVED"  // Marked done by user
  | "SNOOZED"   // Temporarily hidden
  | "EXPIRED"   // TTL elapsed

// ─── Raw parsed message from chat export ──────────────────────────────────────
export interface RawMessage {
  id: string
  sender: string
  timestamp: Date
  content: string
  rawLine: string
}

// ─── Enriched message node in the knowledge graph ─────────────────────────────
export interface MessageNode {
  id: string
  sender: string
  timestamp: Date
  content: string
  obligationType: ObligationType
  status: NodeStatus

  // Graph relations
  repliesTo: string | null   // ID of parent message
  mentions: string[]         // Mentioned usernames

  // Scoring
  attentionScore: number     // Computed resonance score
  senderFrequency: number    // How often this sender appears
  replyDepth: number         // Depth in reply chain

  // Lifecycle
  ttlMs: number              // Time-to-live in milliseconds (0 = immediate ghost)
  expiresAt: Date | null     // Absolute expiry time
  snoozedUntil: Date | null

  // Encryption
  encryptedContent: string   // AES-GCM encrypted content
  contentIv: string          // IV for decryption
}

// ─── A person extracted from the chat ─────────────────────────────────────────
export interface PersonNode {
  id: string
  name: string
  messageCount: number
  lastSeen: Date
  obligationCount: number
  attentionWeight: number
}

// ─── An obligation (debt, question, deadline) ─────────────────────────────────
export interface ObligationCard {
  id: string
  type: ObligationType
  title: string
  detail: string
  sourceMessageIds: string[]
  assignedTo: string | null   // person responsible
  dueAt: Date | null
  expiresAt: Date | null
  status: NodeStatus
  priority: 1 | 2 | 3         // 1 = critical, 3 = low
  createdAt: Date
  resolvedAt: Date | null
}

// ─── Edge types in the knowledge graph ────────────────────────────────────────
export type EdgeType =
  | "REPLIES_TO"
  | "MENTIONS"
  | "OWES"
  | "EXPIRES_AT"
  | "ASSIGNED_TO"

export interface GraphEdge {
  id: string
  source: string    // Node ID
  target: string    // Node ID
  type: EdgeType
  weight: number
}

// ─── The ephemeral knowledge graph ────────────────────────────────────────────
export interface KnowledgeGraph {
  messages: Map<string, MessageNode>
  people: Map<string, PersonNode>
  obligations: Map<string, ObligationCard>
  edges: GraphEdge[]
  createdAt: Date
  sessionId: string  // Ephemeral session identifier
}

// ─── Attention Ledger (the final output shown to user) ────────────────────────
export interface AttentionLedger {
  active: ObligationCard[]       // Red panel: active obligations
  questions: ObligationCard[]    // Yellow panel: pending questions
  ghosted: number                // Count of ghosted messages
  totalProcessed: number
  sessionId: string
  lastUpdated: Date
}

// ─── Parse progress reporting (from Web Worker) ───────────────────────────────
export interface ParseProgress {
  phase: "reading" | "parsing" | "scoring" | "graphing" | "encrypting" | "done"
  processed: number
  total: number
  percent: number
  message: string
}

// ─── Encrypted storage envelope ───────────────────────────────────────────────
export interface EncryptedEnvelope {
  ciphertext: string   // base64-encoded
  iv: string           // base64-encoded, 12 bytes
  salt: string         // base64-encoded, 16 bytes
  version: 1
}

// ─── App state ────────────────────────────────────────────────────────────────
export type AppPhase =
  | "IDLE"        // No file loaded
  | "PARSING"     // File processing in worker
  | "READY"       // Ledger ready
  | "SEARCHING"   // GhostBin search active

export interface AppState {
  phase: AppPhase
  ledger: AttentionLedger | null
  parseProgress: ParseProgress | null
  error: string | null
  searchQuery: string
  searchResults: ObligationCard[]
  selectedCard: string | null
}

// ─── Worker message types ──────────────────────────────────────────────────────
export type WorkerInbound =
  | { type: "PARSE"; payload: { text: string; fileName: string } }
  | { type: "SEARCH"; payload: { query: string } }
  | { type: "DESTROY" }

export type WorkerOutbound =
  | { type: "PROGRESS"; payload: ParseProgress }
  | { type: "RESULT"; payload: AttentionLedger }
  | { type: "SEARCH_RESULT"; payload: ObligationCard[] }
  | { type: "ERROR"; payload: { message: string } }
