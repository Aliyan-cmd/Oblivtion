from src.parse import parse
from src.window import make_windows
from src.extract import extract_window, apply

known, nid, last_seen = {}, 1, -1

for i, w in enumerate(make_windows(parse("data/chat.txt"))):
    items = extract_window(w, known, last_seen)
    print(f"\n--- window {i}: msgs {w[0].id}-{w[-1].id} (new from id {last_seen + 1}) ---")
    for it in items:
        print("  ", it.model_dump())
    nid = apply(known, items, nid)
    last_seen = w[-1].id

print("\n=== FINAL STATE ===")
for k in known.values():
    print(k)