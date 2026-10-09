import type { Msg } from "./types";

const HEADERS: RegExp[] = [
  // Android: 28/09/2026, 8:41 pm - Name: text
  /^(\d{1,2})\/(\d{1,2})\/(\d{2,4}),?\s(\d{1,2}):(\d{2})(?::(\d{2}))?\s?([AaPp][Mm])?\s-\s(.*)$/,
  // iOS: [28/09/26, 8:41:03 PM] Name: text
  /^\[(\d{1,2})\/(\d{1,2})\/(\d{2,4}),?\s(\d{1,2}):(\d{2})(?::(\d{2}))?\s?([AaPp][Mm])?\]\s(.*)$/,
];

const JUNK = new Set([
  "<Media omitted>",
  "This message was deleted",
  "You deleted this message",
]);

function matchHeader(line: string): RegExpMatchArray | null {
  for (const re of HEADERS) {
    const m = line.match(re);
    if (m) return m;
  }
  return null;
}

/** Infer day-first vs month-first by looking for a value that can only be a day. */
function detectOrder(lines: string[]): "dmy" | "mdy" {
  const firsts: number[] = [];
  const seconds: number[] = [];
  for (const line of lines) {
    const m = matchHeader(line);
    if (m) {
      firsts.push(Number(m[1]));
      seconds.push(Number(m[2]));
    }
  }
  if (firsts.some((n) => n > 12)) return "dmy";
  if (seconds.some((n) => n > 12)) return "mdy";
  return "dmy";
}

function toTimestamp(m: RegExpMatchArray, order: "dmy" | "mdy"): Date {
  const a = Number(m[1]);
  const b = Number(m[2]);
  let y = Number(m[3]);
  let hh = Number(m[4]);
  const mm = Number(m[5]);
  const ss = Number(m[6] || 0);
  const ap = m[7];

  const [day, mon] = order === "dmy" ? [a, b] : [b, a];

  if (y < 100) y += 2000;

  if (ap) {
    if (ap.toLowerCase() === "pm") hh = (hh % 12) + 12;
    else hh = hh % 12;
  }

  return new Date(y, mon - 1, day, hh, mm, ss);
}

/** Parse a WhatsApp "Export chat -> without media" file's raw text. */
export function parseChat(text: string): Msg[] {
  const clean = text.replace(/\u200e/g, "");
  const lines = clean.split(/\r?\n/);
  const order = detectOrder(lines);

  const msgs: Msg[] = [];
  let cur: Msg | null = null;

  for (const line of lines) {
    const m = matchHeader(line);
    if (m) {
      const rest = m[8];
      const idx = rest.indexOf(": ");
      const hasSender = idx >= 0;
      if (hasSender) {
        const sender = rest.slice(0, idx);
        const body = rest.slice(idx + 2);
        cur = { id: msgs.length, ts: toTimestamp(m, order), sender, text: body };
        msgs.push(cur);
      } else {
        // system line ("X added Y", encryption notice)
        cur = null;
      }
    } else if (cur) {
      cur.text += "\n" + line;
    }
  }

  const out: Msg[] = [];
  for (const msg of msgs) {
    msg.text = msg.text.replace("<This message was edited>", "").trim();
    if (msg.text && !JUNK.has(msg.text)) out.push(msg);
  }
  return out;
}
