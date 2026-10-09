import type { Known, PipelineResult, TraceEntry } from "./types";
import { parseChat } from "./parse";
import { makeWindows } from "./window";
import { apply, extractWindow } from "./extract";

export type ProgressUpdate = {
  phase: "parse" | "window" | "done";
  window: number;
  totalWindows: number;
  from?: number;
  to?: number;
  itemCount?: number;
  messages: number;
};

export type RunOptions = {
  model?: string;
  apiKey: string;
  onProgress?: (update: ProgressUpdate) => void;
};

/** parse -> windows -> extract -> apply, updating known items per window. */
export async function runPipeline(
  chatText: string,
  { model, apiKey, onProgress }: RunOptions,
): Promise<PipelineResult & { windows: number }> {
  const msgs = parseChat(chatText);
  const windows = makeWindows(msgs);
  const known: Known = {};
  const trace: TraceEntry[] = [];
  let nextId = 1;
  let lastSeen = -1;

  onProgress?.({
    phase: "parse",
    window: 0,
    totalWindows: windows.length,
    messages: msgs.length,
  });

  for (let i = 0; i < windows.length; i++) {
    const window = windows[i];
    const items = await extractWindow(window, {
      model,
      apiKey,
      known,
      lastSeenId: lastSeen,
    });

    trace.push({
      window: i + 1,
      from: window[0].id,
      to: window[window.length - 1].id,
      itemCount: items.length,
      items,
    });

    nextId = apply(known, items, nextId);
    lastSeen = window[window.length - 1].id;

    onProgress?.({
      phase: "window",
      window: i + 1,
      totalWindows: windows.length,
      from: window[0].id,
      to: window[window.length - 1].id,
      itemCount: items.length,
      messages: msgs.length,
    });
  }

  onProgress?.({
    phase: "done",
    window: windows.length,
    totalWindows: windows.length,
    messages: msgs.length,
  });

  return { known, msgs, trace, windows: windows.length };
}
