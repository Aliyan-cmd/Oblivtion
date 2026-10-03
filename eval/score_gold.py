"""Score tl;dr's output against a hand-labelled gold file.

    python -m eval.score_gold data/chat.txt data/gold.json
    python -m eval.score_gold data/chat.txt data/gold.json --think
    python -m eval.score_gold data/chat.txt data/gold.json --model gemma4:e4b
    python -m eval.score_gold data/chat.txt data/gold.json --verbose --trace

gold.json: a list of items. Accepted keys (extras are ignored):
    title    str            "DBMS assignment 2 deadline"
    aliases  [str]          other titles the model may reasonably use
                            (e.g. ["Study session"] for "Library meetup")
    date     "YYYY-MM-DD"   final resolved date  (also accepted as "day")
    time     "HH:MM"|null   null = all-day / no time

Gold describes the FINAL state of the chat. A postponed deadline therefore
appears once, with its final date.

How scoring works:
  1. Each gold item is paired with the best unused prediction whose title
     (or any alias) scores >= 0.4.
  2. found   = gold item got a partner
  3. date_ok = partner's date matches the gold date
  4. time_ok = partner's time matches the gold time
  5. precision = paired predictions / active predictions
"""

import argparse
import json
import sys
import time as clock

from src.match import title_score


PAIR_THRESHOLD = 0.4


def load_gold(path):
    """Load and normalize the gold file."""

    with open(path, encoding="utf-8") as f:
        raw = json.load(f)

    if isinstance(raw, dict):
        raw = raw.get("items", list(raw.values()))

    gold = []

    for item in raw:
        gold.append({
            "title": item["title"],
            "aliases": item.get("aliases", []),
            "date": item.get("date") or item.get("day"),
            "time": item.get("time"),
        })

    return gold


def score(pred, gold):
    """Score predictions against the gold items."""

    unused = list(range(len(pred)))
    rows = []

    for gold_item in gold:
        names = [gold_item["title"], *gold_item.get("aliases", [])]

        best_index = None
        best_score = 0.0

        # Find the best unused prediction for this gold item.
        for index in unused:
            current_score = max(
                title_score(name, pred[index]["title"])
                for name in names
            )

            if current_score > best_score:
                best_index = index
                best_score = current_score

        # No good enough prediction was found.
        if best_index is None or best_score < PAIR_THRESHOLD:
            rows.append({
                "gold": gold_item,
                "pred": None,
                "found": False,
                "date_ok": False,
                "time_ok": False,
            })
            continue

        # This prediction can no longer be used for another gold item.
        unused.remove(best_index)

        prediction = pred[best_index]

        rows.append({
            "gold": gold_item,
            "pred": prediction,
            "found": True,
            "date_ok": prediction["date"] == gold_item["date"],
            "time_ok": prediction["time"] == gold_item["time"],
        })

    number_of_gold = len(gold)
    found = sum(row["found"] for row in rows)

    return {
        "rows": rows,
        "n_gold": number_of_gold,
        "n_pred": len(pred),
        "recall": found / number_of_gold if number_of_gold else 0.0,
        "precision": found / len(pred) if pred else 0.0,
        "date_acc": (
            sum(row["date_ok"] for row in rows) / number_of_gold
            if number_of_gold
            else 0.0
        ),
        "time_acc": (
            sum(row["time_ok"] for row in rows) / number_of_gold
            if number_of_gold
            else 0.0
        ),
        "extras": [pred[index] for index in unused],
    }


def predictions_from_state(known, msgs):
    """Turn pipeline output into title/date/time predictions."""

    from src.resolve import resolve_item

    if isinstance(msgs, dict):
        messages_by_id = msgs
    else:
        messages_by_id = {message.id: message for message in msgs}

    predictions = []

    for item in known.values():
        if item["status"] != "active":
            continue

        day, resolved_time = resolve_item(item, messages_by_id)

        predictions.append({
            "title": item["title"],
            "date": day.isoformat() if day else None,
            "time": resolved_time.strftime("%H:%M") if resolved_time else None,
        })

    return predictions


def report(res):
    """Print the scoring results."""

    print(
        f"\ngold items: {res['n_gold']}   "
        f"predicted (active): {res['n_pred']}\n"
    )

    for row in res["rows"]:
        gold_item = row["gold"]
        prediction = row["pred"]

        if not row["found"]:
            print(
                f"  MISSING  {gold_item['title']!r} "
                f"({gold_item['date']} {gold_item['time']})"
            )
            continue

        both_correct = row["date_ok"] and row["time_ok"]
        flag = "ok " if both_correct else "BAD"

        print(f"  {flag}      {gold_item['title']!r}")

        if not row["date_ok"]:
            print(
                f"             date: want {gold_item['date']}  "
                f"got {prediction['date']}"
            )

        if not row["time_ok"]:
            print(
                f"             time: want {gold_item['time']}  "
                f"got {prediction['time']}"
            )

    for prediction in res["extras"]:
        print(
            f"  EXTRA    {prediction['title']!r} "
            f"({prediction['date']} {prediction['time']})"
        )

    print(
        f"\nrecall {res['recall']:.0%} | "
        f"precision {res['precision']:.0%} | "
        f"date {res['date_acc']:.0%} | "
        f"time {res['time_acc']:.0%}"
    )


def main():
    ap = argparse.ArgumentParser()

    ap.add_argument("chat")
    ap.add_argument("gold")

    ap.add_argument("--model", default=None)
    ap.add_argument("--think", action="store_true")

    ap.add_argument(
        "--verbose",
        action="store_true",
        help="print every item the model returns",
    )

    ap.add_argument(
        "--trace",
        action="store_true",
        help="print every merge/new decision made by the matcher",
    )

    args = ap.parse_args()

    if args.trace:
        import logging

        logging.basicConfig(
            level=logging.INFO,
            stream=sys.stderr,
            format="    [match] %(message)s",
        )

        # hide the per-request "HTTP Request: POST ..." lines
        logging.getLogger("httpx").setLevel(logging.WARNING)

    from src.pipeline import run
    from src.extract import MODEL

    start_time = clock.time()

    known, msgs = run(
        args.chat,
        model=args.model or MODEL,
        think=args.think,
        verbose=args.verbose,
    )

    seconds = clock.time() - start_time

    predictions = predictions_from_state(known, msgs)
    gold = load_gold(args.gold)

    results = score(predictions, gold)

    report(results)

    print(
        f"model {args.model or MODEL} | "
        f"think={args.think} | {seconds:.1f}s"
    )


if __name__ == "__main__":
    sys.exit(main())