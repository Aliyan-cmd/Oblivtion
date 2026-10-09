import type { ExtractedItem, Known, Msg, ResolvedItem } from "./types";
import { buildIcs, buildMarkdown, clockLabel, dayLabel, isoDate, resolveRows, sortRows } from "./render";
import type { Redactor } from "./render";

export type SourceQuote = { id: number; sender: string; text: string };

export type EventCard = {
  id: number;
  kind: "deadline" | "event";
  title: string;
  location: string | null;
  status: "active" | "cancelled";
  whenDate: string | null;
  whenLabel: string | null;
  whenTime: string | null;
  day: string | null;
  time: string | null;
  source_msg_ids: number[];
  quotes: SourceQuote[];
};

export type AnalyzePayload = {
  stats: {
    messages: number;
    windows: number;
    items: number;
    dated: number;
    undated: number;
    cancelled: number;
    icsEvents: number;
  };
  dated: EventCard[];
  undated: EventCard[];
  cancelled: { id: number; title: string }[];
  markdown: string;
  ics: string;
  trace: {
    window: number;
    from: number;
    to: number;
    itemCount: number;
    items: ExtractedItem[];
  }[];
};

const identity: Redactor = (s) => s ?? "";

export function buildResponse(
  known: Known,
  msgs: Msg[],
  windows: number,
  options: { redact?: Redactor; sources?: boolean; trace?: AnalyzePayload["trace"] } = {},
): AnalyzePayload {
  const redact = options.redact ?? identity;
  const msgsById = new Map(msgs.map((m) => [m.id, m]));
  const rows = resolveRows(known, msgsById);
  const { dated, undated, cancelled } = sortRows(rows);

  const toCard = (item: ResolvedItem): EventCard => ({
    id: item.id,
    kind: item.kind,
    title: redact(item.title),
    location: item.location ? redact(item.location) : null,
    status: item.status,
    whenDate: item.when_date ? isoDate(item.when_date) : null,
    whenLabel: item.when_date ? dayLabel(item.when_date) : null,
    whenTime: item.when_time ? clockLabel(item.when_time) : null,
    day: item.day,
    time: item.time,
    source_msg_ids: item.source_msg_ids,
    quotes: item.source_msg_ids
      .map((id) => msgsById.get(id))
      .filter((m): m is Msg => Boolean(m))
      .map((m) => ({ id: m.id, sender: redact(m.sender), text: redact(m.text) })),
  });

  const { ics, count } = buildIcs(known, msgsById, redact);
  const markdown = buildMarkdown(known, msgsById, { redact, sources: options.sources });

  return {
    stats: {
      messages: msgs.length,
      windows,
      items: Object.keys(known).length,
      dated: dated.length,
      undated: undated.length,
      cancelled: cancelled.length,
      icsEvents: count,
    },
    dated: dated.map(toCard),
    undated: undated.map(toCard),
    cancelled: cancelled.map((c) => ({ id: c.id, title: redact(c.title) })),
    markdown,
    ics,
    trace: options.trace ?? [],
  };
}
