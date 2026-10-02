from src.parse import parse

MSGS = parse("data/chat.txt")

def find(s):
    return next(m for m in MSGS if s in m.text)

def test_system_and_media_dropped():
    assert all(m.sender for m in MSGS)
    assert not any("Media omitted" in m.text or "deleted" in m.text.lower() for m in MSGS)

def test_multiline_joined():
    assert find("natural join").text.count("\n") == 2

def test_ambiguous_date_resolves_dmy():
    m = find("2moro submit")
    assert (m.ts.month, m.ts.day) == (10, 1)

def test_12h_clock():
    assert find("gm").ts.hour == 7
    assert find("library band").ts.hour == 17

def test_edit_marker_stripped():
    assert "edited" not in find("1:30 tak").text