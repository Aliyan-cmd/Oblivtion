"""Usage:
    python -m src.cli data/chat.txt
    python -m src.cli data/real_chat.txt --redact --sources
"""

import argparse
import json
import sys
from pathlib import Path

from src.extract import MODEL
from src.pipeline import run
from src.redact import build_redactor
from src.render import render_markdown, write_ics


THINK = {"on": True, "off": False, "auto": None}


def main():
    # Prevent emoji-containing chats from crashing the Windows console.
    reconfigure_stdout = getattr(sys.stdout, "reconfigure", None)
    if callable(reconfigure_stdout):
        reconfigure_stdout(encoding="utf-8")

    parser = argparse.ArgumentParser(
        description="tl;dr: pull deadlines out of a WhatsApp group chat, locally"
    )

    parser.add_argument("chat", help="path to the exported chat .txt")
    parser.add_argument("--model", default=MODEL)
    parser.add_argument("--think", choices=THINK, default="off")
    parser.add_argument("--out", default="out", help="folder for the results")
    parser.add_argument(
        "--redact",
        action="store_true",
        help="hide names and phone numbers in the markdown",
    )
    parser.add_argument(
        "--sources",
        action="store_true",
        help="quote the source messages under each item",
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="print what the model returned per window",
    )

    args = parser.parse_args()

    known, msgs = run(
        args.chat,
        model=args.model,
        think=THINK[args.think],
        verbose=args.verbose,
    )

    msgs_by_id = {msg.id: msg for msg in msgs}

    redact = fmt_msg = None

    if args.redact:
        redact, labels = build_redactor(msgs)
        fmt_msg = lambda msg: f"{labels[msg.sender]}: {redact(msg.text)}"

    output_dir = Path(args.out)
    output_dir.mkdir(exist_ok=True)

    markdown = render_markdown(
        known,
        msgs_by_id,
        redact=redact,
        fmt_msg=fmt_msg,
        sources=args.sources,
    )

    (output_dir / "tldr.md").write_text(
        markdown,
        encoding="utf-8",
    )

    event_count = write_ics(
        known,
        msgs_by_id,
        str(output_dir / "tldr.ics"),
    )

    (output_dir / "state.json").write_text(
        json.dumps(known, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    print(markdown)
    print(
        f"wrote {output_dir}/tldr.md, "
        f"{output_dir}/tldr.ics ({event_count} events), "
        f"{output_dir}/state.json"
    )
    print("state.json is NOT redacted. Don't publish it from a real chat.")


if __name__ == "__main__":
    main()