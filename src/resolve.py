import re
from datetime import date, time, timedelta


MONTHS = {
    "jan": 1, "feb": 2, "mar": 3, "apr": 4,
    "may": 5, "jun": 6, "jul": 7, "aug": 8,
    "sep": 9, "oct": 10, "nov": 11, "dec": 12
}


WEEKDAYS = {
    "monday": 0, "mon": 0,
    "tuesday": 1, "tue": 1, "tues": 1,
    "wednesday": 2, "wed": 2,
    "thursday": 3, "thu": 3, "thur": 3, "thurs": 3,
    "friday": 4, "fri": 4,
    "saturday": 5, "sat": 5,
    "sunday": 6, "sun": 6
}


RELATIVE_DAYS = {
    "aaj": 0,
    "today": 0,
    "kal": 1,
    "tomorrow": 1,
    "tmrw": 1,
    "tmr": 1,
    "parso": 2
}


def get_month(name):
    return MONTHS.get(name[:3])


def resolve_day(text, anchor):
    if not text:
        return None

    text = text.lower()

    # Example: "2 Oct"
    match = re.search(
        r"\b(\d{1,2})(?:st|nd|rd|th)?\s*([a-z]{3,9})\b",
        text
    )

    # Example: "Oct 2"
    if not match:
        match = re.search(
            r"\b([a-z]{3,9})\s*(\d{1,2})\b",
            text
        )

        if match:
            day = int(match.group(2))
            month = get_month(match.group(1))
        else:
            day = None
            month = None

    else:
        day = int(match.group(1))
        month = get_month(match.group(2))

    # We found an actual date
    if day and month:
        try:
            result = date(anchor.year, month, day)

            # If the date already passed, assume next year
            if result < anchor:
                result = date(anchor.year + 1, month, day)

            return result

        except ValueError:
            return None

    # Example: "kal", "tomorrow", "parso"
    for word in text.split():
        if word in RELATIVE_DAYS:
            return anchor + timedelta(days=RELATIVE_DAYS[word])

    # Example: "Friday"
    for word in text.split():
        if word in WEEKDAYS:
            days_ahead = (
                WEEKDAYS[word] - anchor.weekday()
            ) % 7

            return anchor + timedelta(days=days_ahead)

    return None


def resolve_time(text):
    if not text:
        return None

    text = text.lower()

    # Find something like 2, 10, 10:30
    match = re.search(r"(\d{1,2})(?::(\d{2}))?", text)

    if not match:
        return None

    hour = int(match.group(1))
    minute = int(match.group(2) or 0)

    if hour > 23 or minute > 59:
        return None

    # Explicit AM/PM
    if "am" in text:
        hour = hour % 12

    elif "pm" in text:
        hour = hour % 12 + 12

    # Hindi time-of-day words
    elif re.search(r"subah|savere|morning", text):
        hour = hour % 12

    elif re.search(
        r"shaam|sham|raat|dopahar|evening|night|afternoon",
        text
    ):
        hour = hour % 12 + 12

    # No AM/PM → assume college hours
    elif 1 <= hour <= 6:
        hour += 12

    return time(hour, minute)


def resolve_item(item, messages):
    day = None
    item_time = None

    # Find the message that contains the day
    message = messages.get(item.get("day_msg_id"))

    # If we can't find it, use the last source message
    if message is None and item.get("source_msg_ids"):
        last_id = max(item["source_msg_ids"])
        message = messages.get(last_id)

    # Resolve the day
    if message and item.get("day"):
        day = resolve_day(
            item["day"],
            message.ts.date()
        )

    # Resolve the time
    item_time = resolve_time(item.get("time"))

    return day, item_time