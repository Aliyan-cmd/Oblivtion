"""Score a model against your hand-written answer key.

    python -m eval.run_eval --model gemma4:e4b
    python -m eval.run_eval --model gemma4:e4b --think on
    python -m eval.run_eval --model qwen3:8b

A predicted item counts as found when its date matches a gold item
(and its time, if the gold item has one). If several fit, the closest
title wins.
"""

import argparse
import json
import sys
from datetime import date, datetime, time
from difflib import SequenceMatcher
from pathlib import Path
from time import perf_counter

from src.cli import THINK
from src.extract import MODEL
from src.pipeline import run
from src.render import resolve_rows


def score(rows: list[dict], gold: list[dict]) -> dict:
    """Compare predicted items with the answer key."""

    unmatched = list(rows)
    found = []
    missed = []
    loc_ok = 0
    loc_total = 0

    for expected in gold:
        expected_date = date.fromisoformat(expected["date"])
        expected_time = (
            time.fromisoformat(expected["time"])
            if expected.get("time")
            else None
        )

        candidates = [
            item for item in unmatched
            if item["when_date"] == expected_date
            and (
                expected_time is None
                or item["when_time"] == expected_time
            )
        ]

        if not candidates:
            missed.append(expected)
            continue

        best = max(
            candidates,
            key=lambda item: SequenceMatcher(
                None,
                item["title"].lower(),
                expected["title"].lower(),
            ).ratio(),
        )

        unmatched.remove(best)
        found.append((expected, best))

        if expected.get("location"):
            loc_total += 1

            if expected["location"].lower() in (
                best["location"] or ""
            ).lower():
                loc_ok += 1

    tp = len(found)
    fp = len(unmatched)

    precision = tp / (tp + fp) if tp + fp else 0.0
    recall = tp / len(gold) if gold else 0.0
    f1 = (
        2 * precision * recall / (precision + recall)
        if precision + recall
        else 0.0
    )

    return {
        "tp": tp,
        "fp": fp,
        "fn": len(missed),
        "precision": precision,
        "recall": recall,
        "f1": f1,
        "loc_ok": loc_ok,
        "loc_total": loc_total,
        "missed": missed,
        "extra": unmatched,
    }


def main():
    reconfigure_stdout = getattr(sys.stdout, "reconfigure", None)
    if reconfigure_stdout is not None:
        reconfigure_stdout(encoding="utf-8")

    parser = argparse.ArgumentParser()
    parser.add_argument("--model", default=MODEL)
    parser.add_argument("--think", choices=THINK, default="off")
    parser.add_argument("--chat", default="data/chat.txt")
    parser.add_argument("--gold", default="data/gold.json")
    parser.add_argument("--runs", default="runs")
    args = parser.parse_args()

    gold = json.loads(
        Path(args.gold).read_text(encoding="utf-8")
    )

    start = perf_counter()

    known, msgs = run(
        args.chat,
        model=args.model,
        think=THINK[args.think],
    )

    seconds = perf_counter() - start

    msgs_by_id = {msg.id: msg for msg in msgs}

    rows = [
        row
        for row in resolve_rows(known, msgs_by_id)
        if row["status"] == "active"
    ]

    results = score(rows, gold)
    seconds_per_100 = seconds / max(len(msgs), 1) * 100

    print(
        f"\nmodel={args.model} think={args.think} | "
        f"{seconds:.0f}s total | "
        f"{seconds_per_100:.0f}s per 100 msgs"
    )

    print(
        f"found {results['tp']}/{len(gold)} | "
        f"extra items {results['fp']} | "
        f"precision {results['precision']:.0%} "
        f"recall {results['recall']:.0%} "
        f"F1 {results['f1']:.2f} | "
        f"locations {results['loc_ok']}/{results['loc_total']}"
    )

    for item in results["missed"]:
        print(
            f"  MISSED: {item['title']} "
            f"{item['date']} {item.get('time') or ''}"
        )

    for item in results["extra"]:
        print(
            f"  EXTRA:  {item['title']} -> "
            f"{item['when_date']} {item['when_time']} "
            f"({item['day']!r}, {item['time']!r})"
        )

    print("\n| Model | Think | Found | Extra | Precision | Recall | Sec/100 msgs |")
    print("|---|---|---|---|---|---|---|")
    print(
        f"| {args.model} | {args.think} | "
        f"{results['tp']}/{len(gold)} | "
        f"{results['fp']} | "
        f"{results['precision']:.0%} | "
        f"{results['recall']:.0%} | "
        f"{seconds_per_100:.0f} |"
    )

    Path(args.runs).mkdir(exist_ok=True)

    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    model_name = args.model.replace(":", "_").replace("/", "_")

    log = {
        key: value
        for key, value in results.items()
        if key not in ("missed", "extra")
    }

    log.update(
        model=args.model,
        think=args.think,
        seconds=seconds,
        n_msgs=len(msgs),
        missed=results["missed"],
        extra=[
            {key: str(value) for key, value in item.items()}
            for item in results["extra"]
        ],
        final_state=known,
    )

    output = Path(args.runs) / (
        f"{timestamp}_{model_name}_think-{args.think}.json"
    )

    output.write_text(
        json.dumps(log, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()