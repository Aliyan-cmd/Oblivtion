"""Decide whether an extracted item matches something we already know.

The model's K-id is only a hint. We calculate the title similarity ourselves
because small models can mix up IDs.

When unsure, keep the item separate. A duplicate is easier to fix than a
missing event.
"""

import logging
import re

log = logging.getLogger("tldr")

THRESHOLD = 0.6
SUBSET_SCORE = 0.45
OVERLAP_BONUS = 0.16
HINT_BONUS = 0.16

GENERIC = {
    "the", "a", "an", "of", "for", "to", "in", "on", "at", "and",
    "due", "deadline", "submission", "submit", "postponed",
    "rescheduled", "moved", "changed", "old", "new", "updated",
}

SYNONYMS = {
    "paper": "exam",
    "test": "exam",
    "shift": "session",
    "meetup": "session",
    "meeting": "session",
}


def tokens(title):
    words = re.findall(r"[a-z0-9]+", (title or "").lower())

    kept = []
    for word in words:
        if word not in GENERIC:
            kept.append(SYNONYMS.get(word, word))

    if kept:
        return kept

    return [SYNONYMS.get(word, word) for word in words]


def title_score(a, b):
    """Return the similarity between two titles."""

    tokens_a = set(tokens(a))
    tokens_b = set(tokens(b))

    if not tokens_a or not tokens_b:
        return 0.0

    # "assignment 1" and "assignment 2" are different things.
    numbers_a = {
        word for word in tokens_a if isinstance(word, str) and word.isdigit()
    }
    numbers_b = {
        word for word in tokens_b if isinstance(word, str) and word.isdigit()
    }

    if numbers_a and numbers_b and numbers_a != numbers_b:
        return 0.0

    if tokens_a == tokens_b:
        return 1.0

    if not tokens_a & tokens_b:
        return 0.0

    # One title being contained inside another is only weak evidence.
    if tokens_a < tokens_b or tokens_b < tokens_a:
        return SUBSET_SCORE

    intersection = len(tokens_a & tokens_b)
    union = len(tokens_a | tokens_b)

    return intersection / union


def match_known(title, source_ids, known, hint=None):
    """Return the id of the best matching active known item, or None."""

    sources = set(source_ids or [])

    best_id = None
    best_score = 0.0

    for kid, item in known.items():
        if item["status"] != "active":
            continue

        score = title_score(title, item["title"])

        # Shared source messages are extra evidence that these are the same.
        if sources & set(item["source_msg_ids"]):
            score += OVERLAP_BONUS

        # The model's K-id is supporting evidence, not the deciding factor.
        if kid == hint:
            score += HINT_BONUS

        if score > best_score:
            best_id = kid
            best_score = score

    if best_score >= THRESHOLD:
        log.info(
            "MERGE %r -> K%s %r (%.2f)",
            title,
            best_id,
            known[best_id]["title"],
            best_score,
        )
        return best_id

    if best_id:
        log.info(
            "NEW   %r (best %.2f vs K%s %r)",
            title,
            best_score,
            best_id,
            known[best_id]["title"],
        )
    else:
        log.info("NEW   %r (best %.2f)", title, best_score)

    return None