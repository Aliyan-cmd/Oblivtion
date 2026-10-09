# tl;dr

**A local LLM that reads your college group chat so you don't have to.**

Group chats bury the one real deadline under hundreds of messages, memes and
"bhai sab aa gaye?". tl;dr reads a WhatsApp export, extracts only the
deadlines, events and changes of plan, and gives you a clean summary plus a
calendar file you can import.

It runs **entirely on your machine** (Ollama + an open model). The chats it was
built for are group chats of friends, so nothing is ever sent to a cloud API.
It handles **Hinglish**: "kal 5 baje", "parso", "ab Friday tak hai".

Built for the DEV Hacktoberfest 2026 Weekend Challenge, *Build for a Friend*.

![demo](docs/demo.png)

## Example

Input (abridged, from `data/sample_chat.txt`):

```
[3]  Aditi: guys DBMS assignment 2 ka deadline Thursday hai, 1 Oct
[22] Aditi: Update: assignment deadline postpone ho gaya, ab Friday 2 Oct tak hai
[35] Aditi: kal 2 baje tak submit karna hai
[50] Aditi: portal pe 1:30 tak
```

Output (`out/tldr.md`):

```markdown
## Fri 02 Oct
- **13:30** · DBMS assignment 2 deadline — due · msgs 3, 22, 35, 37, 50
```

One card with its history and the messages it came from, instead of four
contradictory deadlines. `out/tldr.ics` has the same events for your calendar.

## Quickstart

Requires Python 3.10+ and [Ollama](https://ollama.com) (a recent version).

```bash
git clone https://github.com/karansingh-in/TL-DR.git
cd TL-DR
python -m venv .venv
# Windows: .venv\Scripts\activate      macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
ollama pull gemma4:e4b

python -m src.cli data/sample_chat.txt --verbose
```

Writes `out/tldr.md`, `out/tldr.ics` and `out/state.json`.

To use your own chat: in WhatsApp, open the chat, **Export chat -> Without
media**, put the `.txt` in `data/`, and point the CLI at it.

## Web app (Groq + Vercel)

There is a browser UI in this repo (Next.js, App Router) that runs the same
pipeline in a serverless function, but calls **Groq** instead of Ollama, so it
can be deployed to Vercel. The pipeline is ported 1:1 to TypeScript in `lib/`
(`parse`, `window`, `extract`, `match`, `resolve`, `render`, `redact`); the UI
lives in `app/page.tsx` and the API route in `app/api/analyze/route.ts`.

```bash
npm install
cp .env.example .env        # then add your key
npm run dev                 # http://localhost:3000
```

Add your key to `.env`:

```
GROQ_API_KEY=gsk_...
```

Get a free key at <https://console.groq.com/keys>. You can also paste a key
directly in the UI (it is only sent to this app's own API route for that
request, never stored).

### Deploy on Vercel

1. Push this repo to GitHub.
2. In Vercel, **Add New -> Project** and import the repo. It is auto-detected as
   Next.js, so no build settings are needed.
3. Add an environment variable `GROQ_API_KEY` (Production, Preview and
   Development).
4. Deploy.

The API route streams per-window progress (NDJSON) so the UI shows which part of
the chat is being read. Default model: `llama-3.3-70b-versatile`.

## How it works

```
chat.txt -> parse -> windows -> LLM extraction -> reconcile -> resolve dates -> render
```

- **Windows by time gap.** The chat is split where the conversation pauses, with
  overlap between windows so a plan that changes at a boundary isn't lost.
- **Stateful extraction.** Each window sees the items found so far (tagged `K1`,
  `K2`, ...) and returns `new`, `update` or `cancel` per item, so "Thursday"
  followed by "postponed to Friday" becomes one deadline, not two.
- **Never trust the model's ids.** Small models invent ids (`DBMS_Assignment_2`),
  put a title where an id belongs, or copy one item's title onto another's
  messages. The reconcile step (`apply` in `src/extract.py`, scoring in
  `src/match.py`) decides itself whether an item is something already known, by
  title similarity. The model's id is only a weak hint. A title that is merely
  *contained* in another ("Lab" inside "Lab shift") needs extra evidence (a shared
  source message or a matching hint) before it merges.
- **Duplicates over silent merges.** When unsure, the matcher creates a new item.
  A duplicate card is visible and easy to spot; a swallowed event is silent.
- **Anchored relative dates.** The model returns the day *word* ("kal") and the id
  of the message it came from. `src/resolve.py` resolves it against *that
  message's* timestamp, not today's date. It also copes with models that put
  "kal 5 baje" in the time field.

## Evaluation

`eval/` scores the output against a hand-labelled gold file and reports recall,
precision, date accuracy and time accuracy.

```bash
python -m eval.score_gold data/sample_chat.txt data/gold.json --verbose --trace
python -m eval.repeat data/sample_chat.txt data/gold.json -n 3 --label my-run
python -m eval.repeat data/sample_chat.txt data/gold.json -n 3 --think --label my-run-think
```

Every run is appended to `eval/results.csv`.

### Results

Setup: `gemma4:e4b` via Ollama, temperature 0, seed 0, frozen prompt "v2", the
53-message sample chat, **7 gold items**. Because the gold set is tiny, one item
is worth 14 percentage points, so counts are shown.

| mode | items found | precision | date correct | time correct | time / run |
|---|---|---|---|---|---|
| thinking off | 5 / 7 | 100% | 57% | 57% | ~58 s median, 47-69 s (9 identical runs) |
| thinking on | 7 / 7 | 78% | 71% | 71% | ~354 s median, 350-358 s (3 identical runs) |

What this shows:

- **Thinking off is fast and deterministic, but misses things.** It misses the
  study session and the makeup class (it copies the DBMS paper's title onto the
  makeup-class messages).
- **Thinking on finds everything but costs ~6x the time** and adds spurious items
  (lower precision). In an earlier 5-run test its date accuracy varied between
  43% and 86%; the 3 frozen runs were identical, so its stability is unproven.
- **Seed matters.** An unseeded single run once scored 6/7 with 86% on every
  metric. With the seed pinned, the same setup gave 5/7 in all 9 runs. A single
  unseeded run is not evidence, so report medians and ranges.

### What didn't help

Prompt and input changes tried after the v2 baseline, measured the same way:

| change | items found | precision | date | time | kept? |
|---|---|---|---|---|---|
| baseline (v2) | 5 / 7 | 100% | 57% | 57% | yes |
| slimmer "known items" in the prompt | 5 / 7 | 83% | 57% | 43% | no |
| rule: put day words in `day`, clock times in `time` | 4 / 7 | 100% | 43% | 43% | no |

The sample chat was also the development set for the prompt, so these numbers
are optimistic for unseen chats.

### Real-chat spot check (qualitative)

The tool was also run on a real 1,178-message group chat (61 windows). That chat
is not published and has no gold labels yet, so this is an observation, not a
score. One-off events with explicit dates were extracted well. Failure modes:

- **Recurring items with generic titles** ("Assignment submission", "Test") were
  merged across months into a single card, because the matcher has no notion of
  time.
- **Numeric dates** (`01.12.2025`, `31|03|2026`) and bare ordinals ("20th") are
  not parsed, so about half of the extracted items land in the "date unclear"
  section.
- **Devanagari** month names and times are not parsed.
- The summary omits the year, which hid at least one wrong-year date.

These are the planned next steps for v0.2.

## Limitations

- **Tiny, synthetic evaluation.** 7 gold items from one sample chat that the
  prompt was tuned on. Treat the numbers as a demo, not a benchmark.
- `kal` means both "tomorrow" and "yesterday" in Hinglish; it is read as
  tomorrow.
- The model sometimes splits one event into two items, or files a later change
  as a new item instead of an update. The matcher deliberately won't force-merge
  these.
- Title matching is fuzzy: with a wrong model hint, two different items with
  overlapping titles can still be merged.
- Parsing is only tested on the export format of the sample chat.
- Output quality depends heavily on the model; smaller models need the
  reconcile layer to stay usable.

## Privacy

Everything runs locally; the only network call is to your own Ollama server on
`localhost`. **`out/state.json` is not redacted**: do not publish output
generated from a real chat. Real chats are excluded by `.gitignore` (`data/*.txt`
except the sample, and `data/real_*`).

## Project layout

```
src/
  cli.py        command-line entry point
  pipeline.py   parse -> windows -> extract -> apply
  parse.py      WhatsApp export -> messages
  window.py     split the chat into overlapping windows by time gap
  extract.py    prompt, Ollama call, apply() (new / update / cancel)
  match.py      title matching used by apply()
  resolve.py    "kal", "Friday", "5 baje" -> real date and time
  render.py     markdown + .ics output
eval/           score_gold.py, repeat.py, results.csv
tests/          unit tests (no Ollama needed)
data/           sample_chat.txt, gold.json

app/            Next.js web UI + /api/analyze route
lib/            TypeScript port of the pipeline (Groq backend)
public/         sample_chat.txt served to the UI
```

## Tests

```bash
python -m pytest -q
```

The tests cover the code that handles model output (id handling, anchors,
merging, title matching, date and time parsing) and the scorer. They don't call
Ollama.

## Reproducibility

Record these when you report numbers: the commit/tag, `ollama list` (model ID),
the prompt version, `think` on/off, and the `label` in `eval/results.csv`.
Model: `gemma4:e4b`, temperature 0, seed 0.

## License

MIT, see [LICENSE](LICENSE).