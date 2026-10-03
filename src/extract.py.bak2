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
    day: str | None
    time: str | None
    day_msg_id: int | None
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


def parse_kid(value):
    if value and re.fullmatch(r"K\d+", value):
        return int(value[1:])
    return None


def extract_window(window, known, last_seen_id=-1, model=MODEL, think=False):
    # Separate old messages from new messages
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

    # Give known items K-style IDs for the model
    known_items = []

    for item in known.values():
        item = item.copy()
        item["id"] = f"K{item['id']}"
        known_items.append(item)

    prompt = f"""
KNOWN ITEMS:
{json.dumps(known_items, ensure_ascii=False)}

CONTEXT:
{chr(10).join(context) if context else "(none)"}

NEW MESSAGES:
{chr(10).join(new)}
"""

    # Ask Gemma
    response = ollama.chat(
        model=model,
        think=think,
        messages=[
            {"role": "system", "content": SYSTEM},
            {"role": "user", "content": prompt},
        ],
        format=Extraction.model_json_schema(),
        options={
            "temperature": 0,
            "num_ctx": 8192,
        },
    )

    # Turn Gemma's JSON into Python objects
    result = Extraction.model_validate_json(
        response["message"]["content"]
    )

    # Only accept items supported by NEW messages
    new_ids = {msg.id for msg in window if msg.id > last_seen_id}

    return [
        item
        for item in result.items
        if any(msg_id in new_ids for msg_id in item.source_msg_ids)
    ]


def _pick_anchor(day_msg_id, source_ids):
    """Anchor must be one of the item's own source messages, else use the latest."""
    if day_msg_id in source_ids:
        return day_msg_id
    return max(source_ids) if source_ids else day_msg_id


def apply(known, items, next_id):
    for item in items:
        target = parse_kid(item.updates_id)
        action = item.action

        # An update pointing at an id we don't have is really a new item.
        if action == "update" and target not in known:
            action = "new"

        if action == "new":
            sources = list(dict.fromkeys(item.source_msg_ids))
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

        elif action == "update":
            old = known[target]
            sources = list(dict.fromkeys(item.source_msg_ids))

            if item.day is not None:
                old["day"] = item.day
                old["day_msg_id"] = _pick_anchor(item.day_msg_id, sources)

            if item.time is not None:
                old["time"] = item.time

            if item.location is not None:
                old["location"] = item.location

            # order-preserving merge, no duplicates, new list (no aliasing)
            old["source_msg_ids"] = list(
                dict.fromkeys(old["source_msg_ids"] + sources)
            )

        elif action == "cancel":
            if target in known:
                known[target]["status"] = "cancelled"

    return next_id