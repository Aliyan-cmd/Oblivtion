from typing import Literal
from pydantic import BaseModel
import ollama
from src.parse import parse

MODEL = "gemma4:e4b"  # same name as in `ollama list`

class Item(BaseModel):
    kind: Literal["deadline", "event", "plan_change"]
    title: str
    location: str | None   # room or place, if one is mentioned
    raw_when: str
    source_msg_ids: list[int]


class Extraction(BaseModel):
    items: list[Item]        # wrapper object, because zero items is a valid answer


SYSTEM = """You read a WhatsApp group chat between college students.
The chat is Hinglish: Hindi written in English letters.
Extract only real deadlines, events, and changes of plan.
Ignore jokes, hypotheticals, and small talk.
If there is nothing, return an empty list.
Every message starts with [id]. Put the ids of the messages that support an item in source_msg_ids.
Copy the time words exactly as written into raw_when.
raw_when must include the day word exactly as written, for example "kal 5 baje", never just "5 baje".

You also receive KNOWN ITEMS as JSON. Item ids are separate from message ids.
If a new message changes, postpones, corrects or cancels a known item, output action "update" (or "cancel") with updates_id set to that item's id. For an update, give the COMPLETE new details of the item.
If an update only changes the time, keep the old day in raw_when and use the new time.
Only use action "new" for things that are not already known.
If a message just repeats or confirms a known item, output nothing for it."""

msgs = parse("data/chat.txt")
window = msgs[25:]
chat_text = "\n".join(f"[{m.id}] {m.sender}: {m.text}" for m in window)

resp = ollama.chat(
    model=MODEL,
    messages=[
        {"role": "system", "content": SYSTEM},
        {"role": "user", "content": chat_text},
    ],
    format=Extraction.model_json_schema(),
    think=False,
    options={"temperature": 0, "num_ctx": 4096},
)

result = Extraction.model_validate_json(resp["message"]["content"])
for item in result.items:
    print(item)

print("prompt tokens:", resp["prompt_eval_count"], "| output tokens:", resp["eval_count"])

print("seconds:", resp["total_duration"] / 1e9)
print("raw reply length (chars):", len(resp["message"]["content"]))
print("thinking:", getattr(resp["message"], "thinking", None))



