from src.extract import Item, apply, parse_kid


def mk(action, **kwargs):
    base = {
        "action": action,
        "updates_id": None,
        "kind": "deadline",
        "title": "t",
        "location": None,
        "day": "Thursday",
        "time": None,
        "day_msg_id": 1,
        "source_msg_ids": [1],
    }

    return Item(**{**base, **kwargs})


def test_parse_kid():
    assert parse_kid("K3") == 3
    assert parse_kid("K12") == 12
    assert parse_kid(None) is None
    assert parse_kid("3") is None
    assert parse_kid("Kabc") is None


def test_new_gets_fresh_id():
    known = {}

    next_id = apply(known, [mk("new")], 1)

    assert list(known) == [1]
    assert next_id == 2
    assert known[1]["status"] == "active"


def test_update_day_moves_the_anchor_message():
    known = {}

    next_id = apply(
        known,
        [mk("new", day="Thursday", day_msg_id=1)],
        1,
    )

    apply(
        known,
        [mk(
            "update",
            updates_id="K1",
            day="Friday",
            day_msg_id=9,
            source_msg_ids=[9],
        )],
        next_id,
    )

    assert known[1]["day"] == "Friday"
    assert known[1]["day_msg_id"] == 9
    assert known[1]["source_msg_ids"] == [1, 9]


def test_time_only_update_keeps_old_day_and_anchor():
    known = {}

    next_id = apply(
        known,
        [mk("new", day="Friday", time="2 baje", day_msg_id=1)],
        1,
    )

    apply(
        known,
        [mk(
            "update",
            updates_id="K1",
            day=None,
            time="1:30",
            day_msg_id=None,
            source_msg_ids=[9],
        )],
        next_id,
    )

    assert known[1]["day"] == "Friday"
    assert known[1]["day_msg_id"] == 1
    assert known[1]["time"] == "1:30"


def test_bad_anchor_falls_back_to_latest_source():
    known = {}

    apply(
        known,
        [mk("new", day="kal", day_msg_id=77, source_msg_ids=[5, 6])],
        1,
    )

    assert known[1]["day_msg_id"] == 6


def test_cancel_marks_cancelled():
    known = {}

    next_id = apply(known, [mk("new")], 1)
    apply(known, [mk("cancel", updates_id="K1")], next_id)

    assert known[1]["status"] == "cancelled"


def test_cancel_of_unknown_item_is_ignored():
    known = {}

    next_id = apply(
        known,
        [mk("cancel", updates_id="K99")],
        1,
    )

    assert known == {}
    assert next_id == 1


def test_update_with_made_up_id_becomes_new():
    known = {}

    next_id = apply(
        known,
        [mk("update", updates_id="K99")],
        1,
    )

    assert list(known) == [1]
    assert next_id == 2


def test_update_with_garbage_id_becomes_new():
    known = {}

    next_id = apply(
        known,
        [mk("update", updates_id="3")],
        1,
    )

    assert list(known) == [1]
    assert next_id == 2


def test_update_cannot_change_title_or_kind():
    # same item (titles match), model tries to rename it and flip its kind
    known = {}

    next_id = apply(
        known,
        [mk("new", title="Library meetup", kind="event")],
        1,
    )

    apply(
        known,
        [mk(
            "update",
            updates_id="K1",
            title="Library meetup (moved)",
            kind="deadline",
            day="Saturday",
            day_msg_id=1,
        )],
        next_id,
    )

    assert list(known) == [1]
    assert known[1]["title"] == "Library meetup"
    assert known[1]["kind"] == "event"
    assert known[1]["day"] == "Saturday"


def test_update_with_wrong_k_id_does_not_overwrite_other_item():
    # model says "update K1" but the title is a different thing entirely
    known = {}

    next_id = apply(
        known,
        [mk("new", title="DBMS paper", day="12 Oct", day_msg_id=1)],
        1,
    )

    next_id = apply(
        known,
        [mk(
            "update",
            updates_id="K1",
            title="Makeup class",
            day="Saturday",
            day_msg_id=5,
            source_msg_ids=[5],
        )],
        next_id,
    )

    assert known[1]["title"] == "DBMS paper"
    assert known[1]["day"] == "12 Oct"
    assert known[2]["title"] == "Makeup class"
    assert known[2]["day"] == "Saturday"


def test_update_with_matching_hint_merges_instead_of_duplicating():
    known = {}

    next_id = apply(
        known,
        [mk("new", title="Lab shift", location="Room 304", day="Thursday")],
        1,
    )

    next_id = apply(
        known,
        [mk(
            "update",
            updates_id="K1",
            title="Lab",
            location=None,
            day="Today",
            time="2pm",
            day_msg_id=41,
            source_msg_ids=[41],
        )],
        next_id,
    )

    assert list(known) == [1]
    assert next_id == 2
    assert known[1]["location"] == "Room 304"
    assert known[1]["time"] == "2pm"
    assert known[1]["source_msg_ids"] == [1, 41]


def test_bare_new_with_no_evidence_stays_separate():
    # a visible duplicate beats a silently swallowed event
    known = {}

    next_id = apply(known, [mk("new", title="Lab shift", source_msg_ids=[1])], 1)
    apply(known, [mk("new", title="Lab", source_msg_ids=[41])], next_id)

    assert list(known) == [1, 2]


def test_model_k_id_is_redirected_to_the_item_the_title_matches():
    # model points at K1 (DBMS paper) but the title is clearly K2 (OS paper)
    known = {}

    next_id = apply(
        known,
        [
            mk("new", title="DBMS paper", source_msg_ids=[1]),
            mk("new", title="OS paper", source_msg_ids=[2]),
        ],
        1,
    )

    apply(
        known,
        [mk("update", updates_id="K1", title="OS paper", day="14 Oct",
            day_msg_id=9, source_msg_ids=[9])],
        next_id,
    )

    assert known[2]["day"] == "14 Oct"
    assert known[1]["day"] == "Thursday"


def test_cancelled_items_are_not_matched_again():
    known = {}

    next_id = apply(known, [mk("new", title="Makeup class")], 1)
    next_id = apply(known, [mk("cancel", updates_id="K1")], next_id)
    apply(known, [mk("new", title="Makeup class", source_msg_ids=[7])], next_id)

    assert known[1]["status"] == "cancelled"
    assert known[2]["status"] == "active"


def test_source_ids_have_no_duplicates():
    known = {}

    next_id = apply(
        known,
        [mk("new", source_msg_ids=[1, 2])],
        1,
    )

    apply(
        known,
        [mk("update", updates_id="K1", source_msg_ids=[2, 3])],
        next_id,
    )

    assert known[1]["source_msg_ids"] == [1, 2, 3]


def test_update_without_location_keeps_old_location():
    known = {}

    next_id = apply(
        known,
        [mk("new", location="Room 304")],
        1,
    )

    apply(
        known,
        [mk(
            "update",
            updates_id="K1",
            location=None,
            day="Friday",
        )],
        next_id,
    )

    assert known[1]["location"] == "Room 304"