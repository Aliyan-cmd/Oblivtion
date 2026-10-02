"""Hide real people before anything goes into a screenshot or post.

Senders become "Person A", "Person B", etc., and phone numbers become [phone].
The same person always gets the same label.
"""

import re


PHONE = re.compile(r"\+?\d[\d\s\-]{8,}\d")


def build_redactor(msgs):
    """Return a function that hides sender names and phone numbers."""

    senders = list(dict.fromkeys(msg.sender for msg in msgs))

    labels = {
        sender: f"Person {chr(65 + i) if i < 26 else i}"
        for i, sender in enumerate(senders)
    }

    patterns = []

    for sender, label in labels.items():
        patterns.append(
            (re.compile(re.escape(sender)), label)
        )

        first_name = sender.split()[0] if sender.split() else ""

        if first_name.isalpha() and len(first_name) >= 3:
            patterns.append(
                (re.compile(rf"\b{re.escape(first_name)}\b", re.I), label)
            )

    patterns.sort(key=lambda item: -len(item[0].pattern))

    def redact(text: str) -> str:
        text = PHONE.sub("[phone]", text)

        for pattern, label in patterns:
            text = pattern.sub(label, text)

        return text

    return redact, labels