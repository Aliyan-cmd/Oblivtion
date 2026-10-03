from eval.score_gold import score


def P(title, date=None, time=None):
    return {"title": title, "date": date, "time": time}


def test_perfect():
    gold = [P("DBMS paper", "2026-10-12", "10:00")]
    result = score([P("DBMS Exam", "2026-10-12", "10:00")], gold)

    assert result["recall"] == result["precision"] == 1
    assert result["date_acc"] == result["time_acc"] == 1


def test_missing_and_extra():
    gold = [
        P("DBMS paper", "2026-10-12", "10:00"),
        P("Makeup class", "2026-10-03", "11:30"),
    ]
    pred = [
        P("DBMS paper", "2026-10-12", "10:00"),
        P("Mid-Sem Timetable Released"),
    ]

    result = score(pred, gold)

    assert result["recall"] == result["precision"] == 0.5
    assert [e["title"] for e in result["extras"]] == ["Mid-Sem Timetable Released"]


def test_wrong_date_counts_found_but_not_date_ok():
    gold = [P("DBMS paper", "2026-10-12", "10:00")]
    result = score([P("DBMS paper", "2026-10-03", "11:30")], gold)

    assert result["recall"] == 1
    assert result["date_acc"] == result["time_acc"] == 0


def test_one_prediction_cannot_satisfy_two_gold_items():
    gold = [
        P("Lab shift", "2026-10-01", "14:00"),
        P("Lab session", "2026-10-08", "14:00"),
    ]
    result = score([P("Lab", "2026-10-01", "14:00")], gold)

    assert result["recall"] == 0.5


def test_all_day_gold_requires_no_time():
    gold = [P("DBMS lab record submission", "2026-10-05")]

    assert score(
        [P("DBMS lab record submission", "2026-10-05")], gold
    )["time_acc"] == 1

    assert score(
        [P("DBMS lab record submission", "2026-10-05", "13:00")], gold
    )["time_acc"] == 0                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      