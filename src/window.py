from datetime import timedelta
from src.parse import Msg


def make_windows(
    msgs: list[Msg],
    max_msgs=40,
    min_msgs=15,
    gap=timedelta(hours=3),
    overlap=5,
):
    windows = []
    current = []

    for msg in msgs:
        # Should we start a new window?
        too_many = len(current) >= max_msgs
        
        big_gap = (
            len(current) >= min_msgs
            and msg.ts - current[-1].ts > gap
        )

        # if number of messages is greater than the set mac limit or the time gap between 2 msg is greater than 3 hrs, we make a new window
        if too_many or big_gap:
            windows.append(current)

            # Keep the last 5 messages in the new window for some context
            current = current[-overlap:]

        current.append(msg)

    # Add the final window, since they may or may ot contain the minimum number of msg
    if current:
        windows.append(current)

    return windows