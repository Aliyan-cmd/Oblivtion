import pytest

from src.match import match_known, title_score


def known_with(*titles):
    return {
        i: {"id": i, "status": "active", "title": t, "source_msg_ids": [i * 100]}
        for i, t in enumerate(titles, start=1)
    }


@pytest.mark.parametrize("a, b", [
    ("Lab shift", "Lab session"),
    ("DBMS Exam", "DBMS paper"),
    ("DBMS Assignment 2", "DBMS assignment 2 deadline"),
    ("Study Session (DBMS/Joins)", "Study session (DBMS joins)"),
    ("Library meetup (moved)", "Library meetup"),
])
def test_same_thing_scores_high(a, b):
    assert title_score(a, b) >= 0.6


@pytest.mark.parametrize("a, b", [
    ("Lab", "Lab shift"),
    ("Assignment Submission", "DBMS assignment 2 deadline"),
    ("Assignment Deadline Postponed", "DBMS assignment 2 deadline"),
])
def test_title_inside_another_is_plausible_but_not_enough(a, b):
    assert 0.3 < title_score(a, b) < 0.6


@pytest.mark.parametrize("a, b", [
    ("DBMS paper", "OS paper"),
    ("DBMS paper", "Makeup class"),
    ("DBMS paper", "DBMS assignment 2 deadline"),
    ("DBMS lab record submission", "DBMS assignment 2 deadline"),
    ("DBMS assignment 1", "DBMS assignment 2"),
    ("Portal submission", "DBMS lab record submission"),
])
def test_different_things_score_low(a, b):
    assert title_score(a, b) < 0.6


def test_no_match_returns_none():
    assert match_known("Makeup class", [5], known_with("DBMS paper")) is None


def test_subset_title_needs_evidence():
    known = known_with("Lab shift")
    known[1]["source_msg_ids"] = [12, 13]
    assert match_known("Lab", [41], known) is None                 # no evidence
    assert match_known("Lab", [41], known, hint=1) == 1            # model agrees
    assert match_known("Lab", [13, 41], known) == 1                # shares a message


def test_short_title_does_not_absorb_a_longer_different_item():
    # real bug: known "Lab" swallowed "DBMS lab record submission"
    known = known_with("Lab")
    assert match_known("DBMS lab record submission", [51], known) is None


def test_model_hint_alone_cannot_force_a_half_match():
    known = known_with("DBMS paper", "OS paper")
    assert match_known("OS paper", [9], known, hint=1) == 2
    assert match_known("Makeup class", [9], known, hint=1) is None


def test_hint_picks_between_equally_plausible_subsets():
    known = known_with("DBMS lab record submission", "Lab shift")
    assert match_known("Lab", [9], known, hint=2) == 2


def test_cancelled_items_are_skipped():
    known = known_with("Makeup class")
    known[1]["status"] = "cancelled"
    assert match_known("Makeup class", [9], known) is None