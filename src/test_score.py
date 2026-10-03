from eval.score_gold import score


def P(title, date=None, time=None):
    return {"title": title, "date": date, "time": time}


def test_perfect():
    gold = [P("DBMS paper", "2026-10-12", "10:00")]
    r = score([P("DBMS Exam", "2026-10-12", "10:00")], gold)
    assert r["recall"] == r["precision"] == r["date_acc"] == r["time_acc"] == 1


def test_missing_and_extra():
    gold = [P("DBMS paper", "2026-10-12", "10:00"), P("Makeup class", "2026-10-03", "11:30")]
    pred = [P("DBMS paper", "2026-10-12", "10:00"), P("Mid-Sem Timetable Released")]
    r = score(pred, gold)
    assert r["recall"] == 0.5
    assert r["precision"] == 0.5
    assert [e["title"] for e in r["extras"]] == ["Mid-Sem Timetable Released"]


def test_wrong_date_counts_found_but_not_date_ok():
    # the exact bug from the demo: right item, clobbered date
    gold = [P("DBMS paper", "2026-10-12", "10:00")]
    r = score([P("DBMS paper", "2026-10-03", "11:30")], gold)
    assert r["recall"] == 1
    assert r["date_acc"] == 0
    assert r["time_acc"] == 0


def test_one_prediction_cannot_satisfy_two_gold_items():
    gold = [P("Lab shift", "2026-10-01", "14:00"), P("Lab session", "2026-10-08", "14:00")]
    r = score([P("Lab", "2026-10-01", "14:00")], gold)
    assert r["recall"] == 0.5


def test_all_day_gold_requires_no_time():
    gold = [P("DBMS lab record submission", "2026-10-05", None)]
    assert score([P("DBMS lab record submission", "2026-10-05", None)], gold)["time_acc"] == 1
    assert score([P("DBMS lab record submission", "2026-10-05", "13:00")], gold)["time_acc"] == 0


def test_alias_lets_a_differently_worded_title_pair():
    # real case: gold says "Library meetup", the model says "Study session for DBMS joins"
    gold = [{"title": "Library meetup", "aliases": ["Study session"],
             "date": "2026-10-01", "time": "17:00"}]
    pred = [P("Study session for DBMS joins", "2026-10-01", "17:00")]

    r = score(pred, gold)
    assert r["recall"] == 1
    assert r["precision"] == 1
    assert r["extras"] == []


def test_without_alias_it_does_not_pair():
    gold = [P("Library meetup", "2026-10-01", "17:00")]
    pred = [P("Study session for DBMS joins", "2026-10-01", "17:00")]
    assert score(pred, gold)["recall"] == 0