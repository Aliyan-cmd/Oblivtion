from datetime import date, time

from eval.run_eval import score
from src.parse import parse
from src.redact import build_redactor
from src.render import _esc


def row(title, d, t=None, loc=None):
    return {"title": title, "when_date": d, "when_time": t, "location": loc}


def test_score_counts_found_missed_and_extra():
    gold = [
        {"title": "Lab", "date": "2026-10-01", "time": "14:00", "location": "Room 304"},
        {"title": "OS paper", "date": "2026-10-14", "time": "10:00", "location": None},
    ]
    rows = [
        row("Lab session", date(2026, 10, 1), time(14, 0), "Room 207"),   # right slot, wrong room
        row("Random thing", date(2026, 11, 1), time(9, 0)),               # not in gold
    ]
    s = score(rows, gold)
    assert (s["tp"], s["fp"], s["fn"]) == (1, 1, 1)
    assert (s["loc_ok"], s["loc_total"]) == (0, 1)


def test_gold_without_time_ignores_time():
    gold = [{"title": "Record", "date": "2026-10-05", "time": None, "location": None}]
    s = score([row("DBMS lab record", date(2026, 10, 5), time(9, 0))], gold)
    assert s["tp"] == 1


def test_redactor_hides_names_and_phones():
    msgs = parse("data/chat.txt")
    redact, label = build_redactor(msgs)
    assert "Aditi" not in redact("Aditi said call +91 98765 43210")
    assert "[phone]" in redact("call +91 98765 43210")
    assert len(set(label.values())) == len(label)   # one label per person


def test_ics_escaping():
    assert _esc("Room 304, 3rd floor; B-wing") == "Room 304\\, 3rd floor\\; B-wing"