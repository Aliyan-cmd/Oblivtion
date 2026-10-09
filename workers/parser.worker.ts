// ─── Oblivion Web Worker ───────────────────────────────────────────────────────
// Runs all heavy parsing off the main thread.
// NO React, NO DOM APIs. Pure computation only.

/// <reference lib="webworker" />

import { parseChat } from "../lib/parser"
import type { WorkerInbound, WorkerOutbound, ParseProgress } from "../lib/types"

self.addEventListener("message", (event: MessageEvent<WorkerInbound>) => {
  const msg = event.data

  if (msg.type === "PARSE") {
    try {
      const { text } = msg.payload

      const result = parseChat(text, (progress: ParseProgress) => {
        const out: WorkerOutbound = { type: "PROGRESS", payload: progress }
        self.postMessage(out)
      })

      const out: WorkerOutbound = { type: "RESULT", payload: result.ledger }
      self.postMessage(out)
    } catch (err) {
      const out: WorkerOutbound = {
        type: "ERROR",
        payload: { message: err instanceof Error ? err.message : "Unknown error during parsing" },
      }
      self.postMessage(out)
    }
    return
  }

  if (msg.type === "DESTROY") {
    self.close()
    return
  }
})

