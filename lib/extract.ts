import type { ExtractedItem, ItemAction, ItemKind, Known, KnownItem, Msg } from "./types";
import { matchKnown } from "./match";

export const DEFAULT_MODEL = "llama-3.3-70b-versatile";

export const GROQ_MODELS = [
  { id: "llama-3.3-70b-versatile", label: "Llama 3.3 70B Versatile" },
  { id: "llama-3.1-8b-instant", label: "Llama 3.1 8B Instant (fast)" },
  { id: "openai/gpt-oss-120b", label: "GPT-OSS 120B" },
  { id: "openai/gpt-oss-20b", label: "GPT-OSS 20B" },
  { id: "meta-llama/llama-4-scout-17b-16e-instruct", label: "Llama 4 Scout 17B" },
];

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

const SYSTEM = `You read a WhatsApp group chat between college students.
The chat is Hinglish: Hindi written in English letters.
Extract only real deadlines and events, and changes to them.
Ignore jokes, hypotheticals ("agar ... toh"), and small talk.

Rules:
1. Every message starts with [id]. Put the ids of the messages that support an item in source_msg_ids.
2. day: copy the day words exactly as written, for example "kal", "Thursday", "2 Oct". Never leave the day word out.
3. time: the clock time as written, for example "5 baje", "2pm", "10:30". Keep a time-of-day word if present.
4. location: the room or place if one is mentioned, otherwise null. A message that mentions an OLD room ("pehle 207 tha") does not give the new location.
5. The input has KNOWN ITEMS (JSON, ids like K1, K2), then CONTEXT messages, then NEW MESSAGES.
6. Only extract from NEW MESSAGES. CONTEXT is already processed. Use it only to understand NEW MESSAGES.
7. If a new message changes, postpones, corrects or cancels a known item, output action "update" (or "cancel") and set updates_id to that item's id, for example "K2". For an update, give the COMPLETE new day and time and location.
8. If a message only changes the time of a known item, keep the old day and use the new time.
9. Use action "new" only for things that are not already in KNOWN ITEMS. If a message just repeats or confirms a known item, output nothing for it.
10. day_msg_id: the id of the message that contains the day word.
11. If there is nothing to extract, return {"items": []}.

Respond with JSON only, in exactly this shape:
{"items": [{"action": "new", "updates_id": null, "kind": "deadline", "title": "DBMS assignment 2", "location": null, "day": "kal", "time": "2 baje", "day_msg_id": 41, "source_msg_ids": [41, 42]}]}
action is one of "new", "update", "cancel". kind is one of "deadline", "event".`;

function asString(v: unknown, fallback: string | null = null): string | null {
  if (typeof v === "string") return v;
  if (v === null || v === undefined) return fallback;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return fallback;
}

function asNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return Math.trunc(v);
  if (typeof v === "string" && /^-?\d+$/.test(v.trim())) return Number(v);
  return null;
}

function asIdList(v: unknown): number[] {
  if (!Array.isArray(v)) return [];
  return v.map(asNumber).filter((n): n is number => n !== null);
}

function normalizeItem(raw: unknown): ExtractedItem | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;

  const action = asString(r.action) as ItemAction | null;
  if (action !== "new" && action !== "update" && action !== "cancel") return null;

  const kind = asString(r.kind, "event") as ItemKind;
  const title = asString(r.title);
  if (!title) return null;

  return {
    action,
    updates_id: asString(r.updates_id),
    kind: kind === "deadline" ? "deadline" : "event",
    title,
    location: asString(r.location),
    day: asString(r.day),
    time: asString(r.time),
    day_msg_id: asNumber(r.day_msg_id),
    source_msg_ids: [...new Set(asIdList(r.source_msg_ids))],
  };
}

function parseItems(content: string): ExtractedItem[] {
  let text = content.trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) text = fence[1].trim();

  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        data = JSON.parse(text.slice(start, end + 1));
      } catch {
        return [];
      }
    } else {
      return [];
    }
  }

  const obj = data as { items?: unknown } | unknown[];
  const list = Array.isArray(obj) ? obj : Array.isArray(obj?.items) ? obj.items : [];
  return list.map(normalizeItem).filter((i): i is ExtractedItem => i !== null);
}

export type ExtractOptions = {
  model?: string;
  apiKey: string;
  known: Known;
  lastSeenId: number;
  signal?: AbortSignal;
};

export async function extractWindow(
  window: Msg[],
  { model = DEFAULT_MODEL, apiKey, known, lastSeenId, signal }: ExtractOptions,
): Promise<ExtractedItem[]> {
  const context: string[] = [];
  const fresh: string[] = [];

  for (const msg of window) {
    const line = `[${msg.id}] ${msg.sender}: ${msg.text}`;
    if (msg.id <= lastSeenId) context.push(line);
    else fresh.push(line);
  }

  if (!fresh.length) return [];

  const knownItems = Object.values(known).map((item) => ({
    ...item,
    id: `K${item.id}`,
  }));

  const prompt = `KNOWN ITEMS:
${JSON.stringify(knownItems)}

CONTEXT:
${context.length ? context.join("\n") : "(none)"}

NEW MESSAGES:
${fresh.join("\n")}`;

  const request = (jsonMode: boolean) =>
    fetch(GROQ_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: prompt },
        ],
        temperature: 0,
        seed: 0,
        max_tokens: 2048,
        ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
      }),
      signal,
    });

  let res = await request(true);
  if (res.status === 400) {
    // Some models on Groq reject response_format; retry without JSON mode.
    res = await request(false);
  }

  if (!res.ok) {
    let detail = `${res.status} ${res.statusText}`;
    try {
      const body = await res.json();
      detail = body?.error?.message || detail;
    } catch {
      // ignore
    }
    throw new Error(`Groq request failed: ${detail}`);
  }

  const data = await res.json();
  const content: string = data?.choices?.[0]?.message?.content ?? "";
  const items = parseItems(content);

  const newIds = new Set(window.filter((m) => m.id > lastSeenId).map((m) => m.id));
  return items.filter((item) => item.source_msg_ids.some((id) => newIds.has(id)));
}

function parseKid(value: string | null): number | null {
  if (value && /^K\d+$/.test(value)) return Number(value.slice(1));
  return null;
}

function pickAnchor(dayMsgId: number | null, sourceIds: number[]): number | null {
  if (dayMsgId !== null && sourceIds.includes(dayMsgId)) return dayMsgId;
  return sourceIds.length ? Math.max(...sourceIds) : dayMsgId;
}

export function apply(known: Known, items: ExtractedItem[], nextId: number): number {
  for (const item of items) {
    const target = parseKid(item.updates_id);

    if (item.action === "cancel") {
      if (target !== null && known[target]) known[target].status = "cancelled";
      continue;
    }

    const sources = [...new Set(item.source_msg_ids)];
    const hit = matchKnown(item.title, sources, known, target);

    if (hit.id === null) {
      let anchor = item.day_msg_id;
      if (item.day !== null) anchor = pickAnchor(anchor, sources);

      known[nextId] = {
        id: nextId,
        status: "active",
        kind: item.kind,
        title: item.title,
        location: item.location,
        day: item.day,
        time: item.time,
        day_msg_id: anchor,
        source_msg_ids: sources,
      };
      nextId += 1;
      continue;
    }

    const old = known[hit.id];
    if (item.day !== null) {
      old.day = item.day;
      old.day_msg_id = pickAnchor(item.day_msg_id, sources);
    }
    if (item.time !== null) old.time = item.time;
    if (item.location !== null) old.location = item.location;
    old.source_msg_ids = [...new Set([...old.source_msg_ids, ...sources])];
  }

  return nextId;
}

export type { KnownItem };
