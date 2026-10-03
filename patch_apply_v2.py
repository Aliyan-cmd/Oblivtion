"""Run from the TLDR project root:  python patch_apply_v2.py
Replaces apply() (and _pick_anchor) in src/extract.py with the version that
matches items by title instead of trusting the model's K-ids.
Backup: src/extract.py.bak2.  SYSTEM prompt and everything else untouched.
Requires src/match.py to exist."""
import re
import shutil
from pathlib import Path

P = Path("src/extract.py")
src = P.read_text(encoding="utf-8")
shutil.copy(P, "src/extract.py.bak2")

NEW = '''def _pick_anchor(day_msg_id, source_ids):
    """Anchor must be one of the item's own source messages, else use the latest."""
    if day_msg_id in source_ids:
        return day_msg_id
    return max(source_ids) if source_ids else day_msg_id


def apply(known, items, next_id):
    for item in items:
        target = parse_kid(item.updates_id)

        # cancels trust a valid id (nothing else to go on)
        if item.action == "cancel":
            if target in known:
                known[target]["status"] = "cancelled"
            continue

        sources = list(dict.fromkeys(item.source_msg_ids))

        # "new" or "update" - we decide ourselves whether it's something we know
        hit = match_known(item.title, sources, known, hint=target)

        if hit is None:
            anchor = item.day_msg_id
            if item.day is not None:
                anchor = _pick_anchor(anchor, sources)

            known[next_id] = {
                "id": next_id,
                "status": "active",
                "kind": item.kind,
                "title": item.title,
                "location": item.location,
                "day": item.day,
                "time": item.time,
                "day_msg_id": anchor,
                "source_msg_ids": sources,
            }
            next_id += 1
            continue

        old = known[hit]

        if item.day is not None:
            old["day"] = item.day
            old["day_msg_id"] = _pick_anchor(item.day_msg_id, sources)

        if item.time is not None:
            old["time"] = item.time

        if item.location is not None:
            old["location"] = item.location

        old["source_msg_ids"] = list(
            dict.fromkeys(old["source_msg_ids"] + sources)
        )

    return next_id
'''

# drop old helper + apply (each runs to the next top-level def / EOF)
for name in ("_pick_anchor", "apply"):
    src = re.sub(rf"^def {name}\(.*?(?=^def |\Z)", "", src, flags=re.S | re.M)

if "from src.match import match_known" not in src:
    src = src.replace(
        "from pydantic import BaseModel\n",
        "from pydantic import BaseModel\n\nfrom src.match import match_known\n",
        1,
    )

P.write_text(src.rstrip() + "\n\n\n" + NEW, encoding="utf-8")
print("patched src/extract.py (backup: src/extract.py.bak2)")