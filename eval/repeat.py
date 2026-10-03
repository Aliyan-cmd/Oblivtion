"""Run the eval several times and summarise the spread.

    python -m eval.repeat data/chat.txt data/gold.json -n 5
    python -m eval.repeat data/chat.txt data/gold.json -n 5 --think
    python -m eval.repeat data/chat.txt data/gold.json -n 3 --model gemma4:e4b

One run is an anecdote: output can differ between identical runs, and an early
difference carries into later windows. Report median and range, not one number.
Every run is appended to eval/results.csv.
"""

import argparse
import csv
import os
import statistics
import sys
import time as clock
from datetime import datetime


METRICS = ["recall", "precision", "date_acc", "time_acc", "seconds"]
CSV_PATH = os.path.join("eval", "results.csv")


def summarize(rows):
    """rows: list of dicts with METRICS keys -> {metric: (median, min, max)}."""

    summary = {}

    for metric in METRICS:
        values = [row[metric] for row in rows]
        summary[metric] = (
            statistics.median(values),
            min(values),
            max(values),
        )

    return summary


def format_summary(summary):
    lines = []

    for metric in METRICS:
        median, low, high = summary[metric]

        if metric == "seconds":
            lines.append(
                f"  {metric:<10} median {median:5.1f}s   range {low:.1f}-{high:.1f}s"
            )
        else:
            lines.append(
                f"  {metric:<10} median {median:4.0%}   range {low:.0%}-{high:.0%}"
            )

    return "\n".join(lines)


def append_csv(rows, label, model, think, path=CSV_PATH):
    new_file = not os.path.exists(path)

    with open(path, "a", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)

        if new_file:
            writer.writerow(
                ["timestamp", "label", "model", "think", "run", *METRICS]
            )

        stamp = datetime.now().isoformat(timespec="seconds")

        for index, row in enumerate(rows, start=1):
            writer.writerow(
                [stamp, label, model, think, index,
                 *[round(row[m], 4) for m in METRICS]]
            )


def main():
    ap = argparse.ArgumentParser()

    ap.add_argument("chat")
    ap.add_argument("gold")
    ap.add_argument("-n", type=int, default=3, help="number of runs")
    ap.add_argument("--model", default=None)
    ap.add_argument("--think", action="store_true")
    ap.add_argument("--label", default="", help="free-text tag, e.g. prompt-v2")

    args = ap.parse_args()

    from eval.score_gold import load_gold, predictions_from_state, score
    from src.extract import MODEL
    from src.pipeline import run

    model = args.model or MODEL
    gold = load_gold(args.gold)
    rows = []

    for i in range(1, args.n + 1):
        start = clock.time()
        known, msgs = run(args.chat, model=model, think=args.think)
        seconds = clock.time() - start

        result = score(predictions_from_state(known, msgs), gold)
        row = {
            "recall": result["recall"],
            "precision": result["precision"],
            "date_acc": result["date_acc"],
            "time_acc": result["time_acc"],
            "seconds": seconds,
        }
        rows.append(row)

        print(
            f"run {i}/{args.n}: recall {row['recall']:.0%} | "
            f"precision {row['precision']:.0%} | date {row['date_acc']:.0%} | "
            f"time {row['time_acc']:.0%} | {seconds:.1f}s",
            file=sys.stderr,
        )

    print(f"\nmodel {model} | think={args.think} | {args.n} runs")
    print(format_summary(summarize(rows)))

    append_csv(rows, args.label, model, args.think)
    print(f"\nappended to {CSV_PATH}")


if __name__ == "__main__":
    sys.exit(main())