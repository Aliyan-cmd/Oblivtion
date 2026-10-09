# Obliivon

**An AI-powered group chat analyzer that extracts deadlines, events, and plans so you don't have to.**

Group chats bury the one real deadline under hundreds of messages, memes, and banter. Obliivon reads a WhatsApp export, extracts only the deadlines, events, and changes of plan, and gives you a clean summary plus a calendar file you can import.

It handles **Hinglish**: "kal 5 baje", "parso", "ab Friday tak hai", resolving relative timestamps based on the conversation context.

Built for the DEV Hacktoberfest 2026 Weekend Challenge, *Build for a Friend*. Recently revamped with a stunning minimalist UI, sleek animations, and Groq's high-speed inference.

## Features

- **AI-Powered Context:** Our LPU engine resolves ambiguous phrases like 'kal' or 'next week' based on conversation context.
- **Event Deduplication:** No more spam. Multiple messages discussing the same deadline are automatically merged into a single event.
- **Instant Export:** Generate standard `.ics` files instantly. One click to populate your calendar.
- **Privacy First:** Your chat remains completely private. Processing is local/stateless. No logs kept.

## Web app (Groq + Next.js)

The project features a sleek, minimalist web UI with scroll-triggered animations. It uses Groq LPUs for instantaneous parsing.

```bash
git clone https://github.com/Aliyan-cmd/Oblivtion.git
cd Oblivtion
npm install
cp .env.example .env.local        # then add your key
npm run dev                       # http://localhost:3000
```

Add your key to `.env.local`:
```
GROQ_API_KEY=gsk_...
```
Get a free key at <https://console.groq.com/keys>. You can also manage multiple keys directly in the Web UI via the settings drawer.

### Deploy on Vercel

1. Push this repo to GitHub.
2. In Vercel, **Add New -> Project** and import the repo. It is auto-detected as Next.js.
3. Add an environment variable `GROQ_API_KEY` (Production, Preview and Development).
4. Deploy.

The API route streams per-window progress (NDJSON) so the UI shows which part of the chat is being read in real-time. Default model: `llama-3.3-70b-versatile`.

## CLI Usage (Local Models)

Requires Python 3.10+ and [Ollama](https://ollama.com).

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
ollama pull gemma4:e4b

python -m src.cli data/sample_chat.txt --verbose
```
Writes `out/tldr.md`, `out/tldr.ics` and `out/state.json`.

## How it works

```
chat.txt -> parse -> windows -> LLM extraction -> reconcile -> resolve dates -> render
```

- **Windows by time gap.** The chat is split where the conversation pauses, with overlap between windows so a plan that changes at a boundary isn't lost.
- **Stateful extraction.** Each window sees the items found so far and returns `new`, `update` or `cancel` per item.
- **Never trust the model's ids.** Small models invent ids. The reconcile step decides itself whether an item is something already known by title similarity.
- **Duplicates over silent merges.** When unsure, the matcher creates a new item.
- **Anchored relative dates.** The model returns the day *word* ("kal") and the id of the message it came from. `src/resolve.py` resolves it against *that message's* timestamp.

## Project layout

```
app/            Next.js web UI + /api/analyze route
components/     Minimalist UI components with framer-motion animations
hooks/          React hooks (API key management, chat state)
lib/            TypeScript port of the pipeline (Groq backend)
src/            Python CLI pipeline
eval/           Score outputs against gold.json
tests/          Unit tests
data/           sample_chat.txt, gold.json
```

## Evaluation & Results

The system can be tested against a hand-labelled gold set using the evaluation scripts in `eval/`.

- **Fast Extraction (Instant):** Highly deterministic, runs extremely fast but may miss nuanced context changes.
- **Deep Reasoning (Versatile models):** Achieves high precision on time extraction and resolves ambiguous references accurately.

## License

MIT, see [LICENSE](LICENSE).