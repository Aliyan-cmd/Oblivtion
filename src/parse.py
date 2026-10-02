from __future__ import annotations
import re
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

# extracting data using regex
HEADERS = [
    # Android: 28/09/2026, 8:41 pm - Name: text
    re.compile(r"^(\d{1,2})/(\d{1,2})/(\d{2,4}),?\s(\d{1,2}):(\d{2})(?::(\d{2}))?\s?([AaPp][Mm])?\s-\s(.*)$"),
    # iOS: [28/09/26, 8:41:03 PM] Name: text
    re.compile(r"^\[(\d{1,2})/(\d{1,2})/(\d{2,4}),?\s(\d{1,2}):(\d{2})(?::(\d{2}))?\s?([AaPp][Mm])?\]\s(.*)$"),
]

# removing unwanted stuff to save tokens
JUNK = {"<Media omitted>", "This message was deleted", "You deleted this message"}


@dataclass
class Msg:
    """This defines what a msg body looks like"""
    id: int
    ts: datetime
    sender: str
    text: str


def _match(line: str):
    for i in HEADERS:
        if m := i.match(line):
            return m
    return None


def _order(lines: list[str]) -> str:
    """The data format maybe dd/mm or mm/dd to know which one it is, we compare if the
    first number is >12 since months can't be greater than 12, its a dd/mm and vice-versa"""
    firsts, seconds = [], []
    for line in lines:
        if m := _match(line):
            firsts.append(int(m[1]))
            seconds.append(int(m[2]))
    if max(firsts, default=0) > 12:
        return "dmy"
    if max(seconds, default=0) > 12:
        return "mdy"
    return "dmy"  # default


def _ts(m, order: str) -> datetime:
    """Converts data into a datetime object"""
    a, b, y, hh, mm, ss, ap = m.groups()[:7]
    
    if order == 'dmy':
        day, mon = (int(a), int(b))
    else:
        mon, day = (int(a), int(b))

    # year maybe 2026 or just 26
    if int(y) < 100:
        y = int(y) + 2000
    else:
        y = int(y)
        
    hh = int(hh)
    
    # converting am/pm to 24 hr format
    if ap:
        if ap.lower() == 'pm':
            hh = hh % 12 + 12
        else:
            hh = hh % 12 
            
    return datetime(y, mon, day, hh, int(mm), int(ss or 0))


def parse(path: str) -> list[Msg]:
    text = Path(path).read_text(encoding="utf-8").replace("\u200e", "")
    lines = text.splitlines()
    order = _order(lines)

    msgs: list[Msg] = []
    cur: Msg | None = None
    for line in lines:
        if m := _match(line):
            sender, sep, body = m[8].partition(": ")
            # no "Sender: " part means a system line ("X added Y", encryption notice)
            # to handle 28/09/2026, 8:41 pm - Karan joined using this group's invite link
            cur = Msg(len(msgs), _ts(m, order), sender, body) if sep else None
            
            # multiline msg
            if cur:
                msgs.append(cur)
                
        elif cur:  # continuation of a multiline message
            cur.text += "\n" + line

    out = []
    
    for msg in msgs:
        # removing unwanted info
        msg.text = msg.text.replace("<This message was edited>", "").strip()
        if msg.text and msg.text not in JUNK:
            out.append(msg)
            
    return out