from datetime import datetime, time, timedelta, timezone

from src.resolve import resolve_item


def resolve_rows(known: dict, msgs_by_id: dict) -> list[dict]:
    """Add resolved date and time to every known item."""
    rows = []

    for item in known.values():
        date, item_time = resolve_item(item, msgs_by_id)
        rows.append({
            **item,
            "when_date": date,
            "when_time": item_time,
        })

    return rows


def _line(item: dict, redact) -> str:
    when = f"{item['when_time']:%H:%M}" if item["when_time"] else "all day"
    kind = "due" if item["kind"] == "deadline" else "event"
    location = f" ({redact(item['location'])})" if item["location"] else ""
    ids = ", ".join(str(i) for i in item["source_msg_ids"])

    return f"- **{when}** · {redact(item['title'])}{location} — {kind} · msgs {ids}"


def render_markdown(
    known: dict,
    msgs_by_id: dict,
    redact=None,
    fmt_msg=None,
    sources=False,
) -> str:
    redact = redact or (lambda s: s)
    fmt_msg = fmt_msg or (lambda m: f"{m.sender}: {m.text}")

    rows = resolve_rows(known, msgs_by_id)

    active = [x for x in rows if x["status"] == "active"]
    dated = sorted(
        [x for x in active if x["when_date"]],
        key=lambda x: (x["when_date"], x["when_time"] or time.min),
    )
    undated = [x for x in active if not x["when_date"]]
    cancelled = [x for x in rows if x["status"] == "cancelled"]

    def quotes(item):
        quotes = []

        for msg_id in item["source_msg_ids"]:
            msg = msgs_by_id.get(msg_id)

            if msg:
                quotes.append(
                    "  > " + fmt_msg(msg).replace("\n", " ")
                )

        return quotes

    output = ["# tl;dr", ""]
    current_date = None

    for item in dated:
        if item["when_date"] != current_date:
            current_date = item["when_date"]
            output += ["", f"## {current_date:%a %d %b}"]

        output.append(_line(item, redact))

        if sources:
            output += quotes(item)

    if undated:
        output += ["", "## Date unclear (check these by hand)"]

        for item in undated:
            words = " ".join(
                word for word in (item["day"], item["time"]) if word
            ) or "no time words"

            output.append(
                f"- {redact(item['title'])} — "
                f"model said: {redact(words)} · msgs "
                + ", ".join(str(i) for i in item["source_msg_ids"])
            )

            if sources:
                output += quotes(item)

    if cancelled:
        output += ["", "## Cancelled"]

        for item in cancelled:
            output.append(f"- ~~{redact(item['title'])}~~")

    return "\n".join(output) + "\n"


def _esc(value: str) -> str:
    """Escape characters required by calendar files."""
    return (
        value
        .replace("\\", "\\\\")
        .replace(";", "\\;")
        .replace(",", "\\,")
        .replace("\n", "\\n")
    )


def write_ics(known: dict, msgs_by_id: dict, path: str) -> int:
    """Write active dated items to an ICS file."""
    rows = [
        x for x in resolve_rows(known, msgs_by_id)
        if x["status"] == "active" and x["when_date"]
    ]

    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//tldr//EN",
        "CALSCALE:GREGORIAN",
    ]

    for item in rows:
        date = item["when_date"]
        item_time = item["when_time"]

        lines += [
            "BEGIN:VEVENT",
            f"UID:tldr-{item['id']}-{date:%Y%m%d}@tldr.local",
            f"DTSTAMP:{stamp}",
        ]

        if item_time:
            start = datetime.combine(date, item_time)
            minutes = 30 if item["kind"] == "deadline" else 60
            end = start + timedelta(minutes=minutes)

            lines += [
                f"DTSTART:{start:%Y%m%dT%H%M%S}",
                f"DTEND:{end:%Y%m%dT%H%M%S}",
            ]
        else:
            lines += [
                f"DTSTART;VALUE=DATE:{date:%Y%m%d}",
                f"DTEND;VALUE=DATE:{date + timedelta(days=1):%Y%m%d}",
            ]

        title = (
            "DUE: " if item["kind"] == "deadline" else ""
        ) + item["title"]

        lines.append(f"SUMMARY:{_esc(title)}")

        if item["location"]:
            lines.append(f"LOCATION:{_esc(item['location'])}")

        lines.append("END:VEVENT")

    lines.append("END:VCALENDAR")

    with open(path, "w", encoding="utf-8", newline="") as file:
        file.write("\r\n".join(lines) + "\r\n")

    return len(rows)