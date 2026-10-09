// ─── ARS Decay Engine ─────────────────────────────────────────────────────────
// Runs every 5 minutes, decrementing node relevance scores by 0.05.
// Nodes with score < 0.3 are marked for ghosting animation.
// This simulates the natural decay of attention over time.

import { getAllNodes, updateNodeScore, ghostNode } from "./storage"

const DECAY_INTERVAL_MS = 5 * 60 * 1000  // 5 minutes
const DECAY_AMOUNT = 0.05                 // Per tick
const GHOST_THRESHOLD = 0.3              // Below this → ghost

let _decayTimer: ReturnType<typeof setInterval> | null = null
let _onGhostCallbacks: Array<(nodeId: string) => void> = []

/**
 * Register a callback that fires when a node drops below the ghost threshold.
 * The callback receives the node ID and should trigger the ghosting animation.
 */
export function onNodeGhosted(callback: (nodeId: string) => void): () => void {
  _onGhostCallbacks.push(callback)
  return () => {
    _onGhostCallbacks = _onGhostCallbacks.filter(cb => cb !== callback)
  }
}

/**
 * Run a single decay tick.
 * - Decrements all active node ARS scores by DECAY_AMOUNT
 * - Nodes below GHOST_THRESHOLD trigger ghosting callbacks
 * Returns the IDs of nodes that were ghosted.
 */
export async function decayTick(): Promise<string[]> {
  const nodes = await getAllNodes()
  const ghostedIds: string[] = []

  for (const node of nodes) {
    if (node.obligation_type === "GHOSTED") continue
    if (node.obligation_type === "SOCIAL_NOISE") continue

    const newScore = Math.max(0, node.ars_score - DECAY_AMOUNT)
    await updateNodeScore(node.id, newScore)

    if (newScore < GHOST_THRESHOLD) {
      await ghostNode(node.id)
      ghostedIds.push(node.id)
    }
  }

  // Fire callbacks for ghosted nodes
  for (const id of ghostedIds) {
    for (const cb of _onGhostCallbacks) {
      try { cb(id) } catch { /* swallow callback errors */ }
    }
  }

  return ghostedIds
}

/**
 * Start the decay engine. Runs decayTick every 5 minutes.
 */
export function startDecayEngine(): void {
  if (_decayTimer) return // Already running
  _decayTimer = setInterval(() => {
    decayTick().catch(() => {
      // Silently handle decay errors — don't crash the app
    })
  }, DECAY_INTERVAL_MS)
}

/**
 * Stop the decay engine.
 */
export function stopDecayEngine(): void {
  if (_decayTimer) {
    clearInterval(_decayTimer)
    _decayTimer = null
  }
  _onGhostCallbacks = []
}
