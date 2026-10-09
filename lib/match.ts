import type { Known } from "./types";

const THRESHOLD = 0.6;
const SUBSET_SCORE = 0.45;
const OVERLAP_BONUS = 0.16;
const HINT_BONUS = 0.16;

const GENERIC = new Set([
  "the", "a", "an", "of", "for", "to", "in", "on", "at", "and",
  "due", "deadline", "submission", "submit", "postponed",
  "rescheduled", "moved", "changed", "old", "new", "updated",
]);

const SYNONYMS: Record<string, string> = {
  paper: "exam",
  test: "exam",
  shift: "session",
  meetup: "session",
  meeting: "session",
};

export function tokens(title: string | null | undefined): string[] {
  const words = (title || "").toLowerCase().match(/[a-z0-9]+/g) || [];
  const kept = words.filter((w) => !GENERIC.has(w)).map((w) => SYNONYMS[w] ?? w);
  if (kept.length) return kept;
  return words.map((w) => SYNONYMS[w] ?? w);
}

export type MatchOutcome = {
  id: number | null;
  score: number;
  contender: number | null;
  contenderScore: number;
  reason: "merge" | "new-close" | "new";
};

/** Similarity between two titles. */
export function titleScore(a: string, b: string): number {
  const ta = new Set(tokens(a));
  const tb = new Set(tokens(b));
  if (ta.size === 0 || tb.size === 0) return 0;

  const numA = [...ta].filter((w) => /^\d+$/.test(w));
  const numB = [...tb].filter((w) => /^\d+$/.test(w));
  if (numA.length && numB.length && numA.join() !== numB.join()) return 0;

  if (ta.size === tb.size && [...ta].every((w) => tb.has(w))) return 1.0;

  const intersection = [...ta].filter((w) => tb.has(w));
  if (intersection.length === 0) return 0;

  const isSubset =
    intersection.length === ta.size || intersection.length === tb.size;
  const strictSubset =
    (intersection.length === ta.size && ta.size < tb.size) ||
    (intersection.length === tb.size && tb.size < ta.size);
  if (isSubset && strictSubset) return SUBSET_SCORE;

  const union = new Set([...ta, ...tb]);
  return intersection.length / union.size;
}

/**
 * Decide whether an extracted item matches something already known.
 * The model's K-id is only a hint; title similarity decides.
 */
export function matchKnown(
  title: string,
  sourceIds: number[],
  known: Known,
  hint: number | null,
): MatchOutcome {
  const sources = new Set(sourceIds || []);
  let bestId: number | null = null;
  let bestScore = 0;

  for (const [key, item] of Object.entries(known)) {
    const kid = Number(key);
    if (item.status !== "active") continue;

    let score = titleScore(title, item.title);
    if ([...sources].some((s) => item.source_msg_ids.includes(s))) score += OVERLAP_BONUS;
    if (kid === hint) score += HINT_BONUS;

    if (score > bestScore) {
      bestScore = score;
      bestId = kid;
    }
  }

  if (bestScore >= THRESHOLD && bestId !== null) {
    return { id: bestId, score: bestScore, contender: bestId, contenderScore: bestScore, reason: "merge" };
  }
  return {
    id: null,
    score: bestScore,
    contender: bestId,
    contenderScore: bestScore,
    reason: bestScore > 0 ? "new-close" : "new",
  };
}
