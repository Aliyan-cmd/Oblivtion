import json
import re
from typing import Literal

import ollama
from pydantic import BaseModel

MODEL = "gemma4:e4b"


class Item(BaseModel):
    action: Literal["new", "update", "cancel"]
    updates_id: str | None
    kind: Literal["deadline", "event"]
    title: str
    location: str | None
    raw_when: str
    source_msg_ids: list[int]


class Extraction(BaseModel):
    items: list[Item]


SYSTEM = """You read a WhatsApp group chat between college students.
The chat is Hinglish: Hindi written in English letters.
Extract only real deadlines and events, and changes to them.
Ignore jokes, hypotheticals ("agar ... toh"), and small talk.

Rules:
1. Every message starts with [id]. Put the ids of the messages that support an item in source_msg_ids.
2. raw_when: copy the time words exactly as written and include the day word, for example "kal 5 baje", never just "5 baje". Include the time of day if one is given, for example "12 Oct, 10am".
3. location: the room or place if one is mentioned, otherwise null. A message that mentions an OLD room ("pehle 207 tha") does not give the new location.
4. The input has KNOWN ITEMS (JSON, ids like K1, K2), then CONTEXT messages, then NEW MESSAGES.
5. Only extract from NEW MESSAGES. CONTEXT is already processed. Use it only to understand NEW MESSAGES.
6. If a new message changes, postpones, corrects or cancels a known item, output action "update" (or "cancel") and set updates_id to that item's id, for example "K2". For an update, give the COMPLETE new raw_when and location.
7. If a message only changes the time of a known item, keep the old day and use the new time.
8. Use action "new" only for things that are not already in KNOWN ITEMS. If a message just repeats or confirms a known item, output nothing for it.
9. If there is nothing to extract, return an empty list."""

# stores k1, k2 as 1, 2
def parse_kid(value: str | None) -> int | None:
    if value and re.fullmatch(r"K\d+", value):
        return int(value[1:])
    return None


def merge_ids(old: list[int], new: list[int]) -> list[int]:
    return list(dict.fromkeys(old + new))


def extract_window(window, known: dict, last_seen_id=-1) -> list[Item]:
    context = []
    new = []

    for msg in window:
        text = f"[{msg.id}] {msg.sender}: {msg.text}"

        if msg.id <= last_seen_id:
            context.append(text)
        else:
            new.append(text)

    if not new:
        return []

    known_items = []

    for item in known.values():
        copy = item.copy()
        copy["id"] = f"K{item['id']}"
        known_items.append(copy)

    context_text = "\n".join(context) if context else "(none)"
    new_text = "\n".join(new)

    user = (
        f"KNOWN ITEMS:\n{json.dumps(known_items, ensure_ascii=False)}\n\n"
        f"CONTEXT (already processed):\n{context_text}\n\n"
        f"NEW MESSAGES:\n{new_text}"
    )

    response = ollama.chat(
        model=MODEL,
        messages=[
            {"role": "system", "content": SYSTEM},
            {"role": "user", "content": user},
        ],
        format=Extraction.model_json_schema(),
        think=False,
        options={
            "temperature": 0,
            "num_ctx": 8192,
        },
    )

    result = Extraction.model_validate_json(
        response["message"]["content"]
    )

    return result.items


def apply(known: dict, items: list[Item], next_id: int) -> int:

    for item in items:

        target = parse_kid(item.updates_id)

        # NEW ITEM
        if item.action == "new":
            known[next_id] = {
                "id": next_id,
                "status": "active",
                "kind": item.kind,
                "title": item.title,
                "location": item.location,
                "raw_when": item.raw_when,
                "source_msg_ids": item.source_msg_ids,
            }

            next_id += 1

        # UPDATE EXISTING ITEM
        elif item.action == "update":
            if target not in known:
                continue

            old = known[target]

            old["raw_when"] = item.raw_when

            if item.location:
                old["location"] = item.location

            old["source_msg_ids"] = merge_ids(
                old["source_msg_ids"],
                item.source_msg_ids,
            )

        # CANCEL EXISTING ITEM
        elif item.action == "cancel":
            if target not in known:
                continue

            known[target]["status"] = "cancelled"

    return next_id