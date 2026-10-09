import type { Clock, Known, KnownItem, Msg, ResolvedItem } from "./types";
import { resolveItem } from "./resolve";

const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

export function clockLabel(c: Clock): string {
  return `${pad2(c.hour)}:${pad2(c.minute)}`;
}

export function dayLabel(d: Date): string {
  return `${WEEKDAY_SHORT[d.getDay()]} ${pad2(d.getDate())} ${MONTH_SHORT[d.getMonth()]}`;
}

export function isoDate(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function resolveRows(known: Known, msgsById: Map<number, Msg>): ResolvedItem[] {
  return Object.values(known).map((item) => {
    const { date, time } = resolveItem(item, msgsById);
    return { ...item, when_date: date, when_time: time };
  });
}

export type Redactor = (s: string | null) => string;

const identity: Redactor = (s) => s ?? "";

export function sortRows(rows: ResolvedItem[]): {
  dated: ResolvedItem[];
  undated: ResolvedItem[];
  cancelled: ResolvedItem[];
} {
  const active = rows.filter((x) => x.status === "active");
  const dated = active
    .filter((x) => x.when_date)
    .sort((a, b) => {
      const da = a.when_date!.getTime() - b.when_date!.getTime();
      if (da !== 0) return da;
      const ta = a.when_time ? a.when_time.hour * 60 + a.when_time.minute : -1;
      const tb = b.when_time ? b.when_time.hour * 60 + b.when_time.minute : -1;
      return ta - tb;
    });
  const undated = active.filter((x) => !x.when_date);
  const cancelled = rows.filter((x) => x.status === "cancelled");
  return { dated, undated, cancelled };
}

export function buildMarkdown(
  known: Known,
  msgsById: Map<number, Msg>,
  options: { redact?: Redactor; sources?: boolean } = {},
): string {
  const redact = options.redact ?? identity;
  const sources = options.sources ?? false;
  const { dated, undated, cancelled } = sortRows(resolveRows(known, msgsById));

  const quotes = (item: KnownItem): string[] => {
    const out: string[] = [];
    for (const id of item.source_msg_ids) {
      const msg = msgsById.get(id);
      if (msg) out.push("  > " + redact(`${msg.sender}: ${msg.text}`).replace(/\n/g, " "));
    }
    return out;
  };

  const lines: string[] = ["# Obliivon", ""];
  let currentDate: string | null = null;

  for (const item of dated) {
    const key = isoDate(item.when_date!);
    if (key !== currentDate) {
      currentDate = key;
      lines.push("", `## ${dayLabel(item.when_date!)}`);
    }
    const when = item.when_time ? clockLabel(item.when_time) : "all day";
    const kind = item.kind === "deadline" ? "due" : "event";
    const location = item.location ? ` (${redact(item.location)})` : "";
    const ids = item.source_msg_ids.join(", ");
    lines.push(
      `- **${when}** · ${redact(item.title)}${location} — ${kind} · msgs ${ids}`,
    );
    if (sources) lines.push(...quotes(item));
  }

  if (undated.length) {
    lines.push("", "## Date unclear (check these by hand)");
    for (const item of undated) {
      const words =
        [item.day, item.time].filter(Boolean).join(" ") || "no time words";
      lines.push(
        `- ${redact(item.title)} — model said: ${redact(words)} · msgs ${item.source_msg_ids.join(", ")}`,
      );
      if (sources) lines.push(...quotes(item));
    }
  }

  if (cancelled.length) {
    lines.push("", "## Cancelled");
    for (const item of cancelled) lines.push(`- ~~${redact(item.title)}~~`);
  }

  return lines.join("\n") + "\n";
}

function esc(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

function stampUtc(d: Date): string {
  const p = (n: number) => pad2(n);
  return (
    `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}` +
    `T${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`
  );
}

function compactDate(d: Date): string {
  return `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}`;
}

function compactDateTime(d: Date, c: Clock, addMinutes: number): string {
  const dt = new Date(d.getFullYear(), d.getMonth(), d.getDate(), c.hour, c.minute);
  dt.setMinutes(dt.getMinutes() + addMinutes);
  return `${compactDate(dt)}T${pad2(dt.getHours())}${pad2(dt.getMinutes())}00`;
}

/** Build an RFC 5545 calendar string for active dated items. */
export function buildIcs(
  known: Known,
  msgsById: Map<number, Msg>,
  redact: Redactor = identity,
): { ics: string; count: number } {
  const rows = resolveRows(known, msgsById).filter(
    (x) => x.status === "active" && x.when_date,
  );

  const stamp = stampUtc(new Date());
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//tldr//EN",
    "CALSCALE:GREGORIAN",
  ];

  for (const item of rows) {
    const date = item.when_date!;
    const t = item.when_time;

    lines.push("BEGIN:VEVENT");
    lines.push(`UID:tldr-${item.id}-${compactDate(date)}@tldr.local`);
    lines.push(`DTSTAMP:${stamp}`);

    if (t) {
      const minutes = item.kind === "deadline" ? 30 : 60;
      lines.push(`DTSTART:${compactDateTime(date, t, 0)}`);
      lines.push(`DTEND:${compactDateTime(date, t, minutes)}`);
    } else {
      const next = new Date(date);
      next.setDate(next.getDate() + 1);
      lines.push(`DTSTART;VALUE=DATE:${compactDate(date)}`);
      lines.push(`DTEND;VALUE=DATE:${compactDate(next)}`);
    }

    const title = (item.kind === "deadline" ? "DUE: " : "") + redact(item.title);
    lines.push(`SUMMARY:${esc(title)}`);
    if (item.location) lines.push(`LOCATION:${esc(redact(item.location))}`);
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return { ics: lines.join("\r\n") + "\r\n", count: rows.length };
}
