import sys

from src.extract import MODEL, apply, extract_window
from src.parse import parse
from src.window import make_windows


def run(chat_path, model=MODEL, think=False, verbose=False):
    """Process each chat window and update the running list of known items."""
    msgs = parse(chat_path)
    windows = make_windows(msgs)
    known, next_id, last_seen = {}, 1, -1

    for i, window in enumerate(windows):
        print(
            f"  window {i + 1}/{len(windows)} "
            f"(msgs {window[0].id}-{window[-1].id})",
            file=sys.stderr,
        )

        items = extract_window(
            window, known, last_seen)

        if verbose:
            for item in items:
                print("    ", item.model_dump())

        next_id = apply(known, items, next_id)
        last_seen = window[-1].id

    return known, msgs