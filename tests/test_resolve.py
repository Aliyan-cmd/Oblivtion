from datetime import date, time

from src.resolve import resolve_day, resolve_time

MON = date(2026, 9, 28)   # a Monday


def test_relative_words():
    assert resolve_day("kal", date(2026, 9, 29)) == date(2026, 9, 30)
    assert resolve_day("2moro", date(2026, 10, 1)) == date(2026, 10, 2)
    assert resolve_day("parso", date(2026, 9, 30)) == date(2026, 10, 2)
    assert resolve_day("aaj", date(2026, 10, 1)) == date(2026, 10, 1)


def test_weekday_means_next_occurrence():
    assert resolve_day("Thursday", MON) == date(2026, 10, 1)
    assert resolve_day("Saturday", date(2026, 10, 1)) == date(2026, 10, 3)
    assert resolve_day("Monday", MON) == MON          # same weekday means today


def test_explicit_date_wins_over_weekday():
    assert resolve_day("Friday 2 Oct", MON) == date(2026, 10, 2)
    assert resolve_day("Monday 5 Oct tak", date(2026, 10, 2)) == date(2026, 10, 5)
    assert resolve_day("12 Oct, 10am", date(2026, 9, 30)) == date(2026, 10, 12)
    assert resolve_day("14 October", date(2026, 9, 30)) == date(2026, 10, 14)
    assert resolve_day("Oct 14", date(2026, 9, 30)) == date(2026, 10, 14)


def test_year_rollover():
    assert resolve_day("2 Jan", date(2026, 12, 30)) == date(2027, 1, 2)


def test_unknown_day():
    assert resolve_day(None, MON) is None
    assert resolve_day("someday", MON) is None


def test_times():
    assert resolve_time("2pm") == time(14, 0)
    assert resolve_time("10am") == time(10, 0)
    assert resolve_time("2 baje") == time(14, 0)
    assert resolve_time("5 baje") == time(17, 0)
    assert resolve_time("1:30") == time(13, 30)
    assert resolve_time("1:30 tak") == time(13, 30)
    assert resolve_time("11:30 baje") == time(11, 30)
    assert resolve_time("2 baje PM") == time(14, 0)
    assert resolve_time("12 baje") == time(12, 0)
    assert resolve_time("9 baje subah") == time(9, 0)
    assert resolve_time("8 baje raat") == time(20, 0)
    assert resolve_time("14:00") == time(14, 0)


def test_no_time():
    assert resolve_time(None) is None
    assert resolve_time("tak") is None