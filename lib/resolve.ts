import type { Clock, KnownItem, Msg } from "./types";

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8,
  sep: 9, oct: 10, nov: 11, dec: 12,
};

const WEEKDAYS: Record<string, number> = {
  monday: 0, mon: 0,
  tuesday: 1, tue: 1, tues: 1,
  wednesday: 2, wed: 2,
  thursday: 3, thu: 3, thur: 3, thurs: 3,
  friday: 4, fri: 4,
  saturday: 5, sat: 5,
  sunday: 6, sun: 6,
};

const RELATIVE_DAYS: Record<string, number> = {
  aaj: 0, today: 0,
  kal: 1, tomorrow: 1, tmrw: 1, tmr: 1, "2moro": 1, "2mrw": 1, "2morrow": 1,
  parso: 2,
};

const FULL_MONTHS: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4,
  june: 6, july: 7, august: 8, september: 9,
  october: 10, november: 11, december: 12, sept: 9,
};

const MONTH_WORDS = new Set([...Object.keys(MONTHS), ...Object.keys(FULL_MONTHS)]);

function getMonth(name: string): number | undefined {
  return MONTHS[name] ?? FULL_MONTHS[name];
}

export function findDate(text: string): { day: number; month: number } | null {
  for (const m of text.matchAll(/\b(\d{1,2})(?:st|nd|rd|th)?\s*([a-z]{3,9})\b/g)) {
    const month = getMonth(m[2]);
    if (month) return { day: Number(m[1]), month };
  }
  for (const m of text.matchAll(/\b([a-z]{3,9})\s*(\d{1,2})(?:st|nd|rd|th)?\b/g)) {
    const month = getMonth(m[1]);
    if (month) return { day: Number(m[2]), month };
  }
  return null;
}

function makeDate(y: number, month: number, day: number): Date | null {
  const d = new Date(y, month - 1, day);
  if (d.getFullYear() !== y || d.getMonth() !== month - 1 || d.getDate() !== day) {
    return null;
  }
  return d;
}

/** Resolve "2 Oct", "kal", "Friday" against an anchor date. */
export function resolveDay(text: string | null | undefined, anchor: Date): Date | null {
  if (!text) return null;
  const lower = text.toLowerCase();
  const words = lower.match(/[a-z0-9]+/g) || [];

  const found = findDate(lower);
  if (found) {
    let result = makeDate(anchor.getFullYear(), found.month, found.day);
    if (!result) return null;
    if (result < anchor) {
      result = makeDate(anchor.getFullYear() + 1, found.month, found.day);
    }
    return result;
  }

  for (const word of words) {
    if (word in RELATIVE_DAYS) {
      const d = new Date(anchor);
      d.setDate(d.getDate() + RELATIVE_DAYS[word]);
      return d;
    }
  }

  for (const word of words) {
    if (word in WEEKDAYS) {
      const anchorWeekday = (anchor.getDay() + 6) % 7; // Monday=0
      const daysAhead = (WEEKDAYS[word] - anchorWeekday + 7) % 7;
      const d = new Date(anchor);
      d.setDate(d.getDate() + daysAhead);
      return d;
    }
  }

  return null;
}

export function resolveTime(text: string | null | undefined): Clock | null {
  if (!text) return null;
  const lower = text.toLowerCase();

  const hasClock = /\d\s*(am|pm)\b|\d:\d\d/.test(lower);
  if (findDate(lower) && !hasClock) return null;

  const match = lower.match(/(\d{1,2})(?::(\d{2}))?/);
  if (!match) return null;

  let hour = Number(match[1]);
  const minute = Number(match[2] || 0);
  if (hour > 23 || minute > 59) return null;

  if (/(?<![a-z])am(?![a-z])/.test(lower)) {
    hour = hour % 12;
  } else if (/(?<![a-z])pm(?![a-z])/.test(lower)) {
    hour = (hour % 12) + 12;
  } else if (/subah|savere|morning/.test(lower)) {
    hour = hour % 12;
  } else if (/shaam|sham|raat|dopahar|evening|night|afternoon/.test(lower)) {
    hour = (hour % 12) + 12;
  } else if (hour >= 1 && hour <= 6) {
    hour += 12;
  }

  return { hour, minute };
}

export function resolveItem(
  item: KnownItem,
  messages: Map<number, Msg>,
): { date: Date | null; time: Clock | null } {
  let message: Msg | undefined;
  if (item.day_msg_id !== null) message = messages.get(item.day_msg_id);
  if (!message && item.source_msg_ids.length) {
    message = messages.get(Math.max(...item.source_msg_ids));
  }

  const dayText = item.day || item.time;
  let date: Date | null = null;

  if (message && dayText) {
    const anchor = new Date(message.ts);
    anchor.setHours(0, 0, 0, 0);
    date = resolveDay(dayText, anchor);
  }

  return { date, time: resolveTime(item.time) };
}
