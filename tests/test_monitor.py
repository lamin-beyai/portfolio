"""These tests rebuild the data, so they prove behaviour rather than a saved result."""
import csv

import duckdb
import pytest

from hrdq import checks, pipeline
from hrdq.config import AS_OF, RAW_CSV, SEED, TRUTH_CSV


@pytest.fixture(scope="session", autouse=True)
def restore_default_data():
    yield
    pipeline.main(SEED, build_site=False)


@pytest.mark.parametrize("seed", [SEED, 1, 2, 3, 4])
def test_finds_everything_planted_and_nothing_else(seed):
    result = pipeline.main(seed, build_site=False)
    assert result["missed"] == []
    assert result["unexpected"] == []
    assert result["edge_cases_flagged"] == []


def test_every_rule_is_exercised_by_a_planted_error():
    pipeline.main(SEED, build_site=False)
    with TRUTH_CSV.open() as handle:
        planted = {row["rule_id"] for row in csv.DictReader(handle)}
    assert planted == {rule.id for rule in checks.RULES}


def test_a_disabled_rule_is_noticed(monkeypatch):
    """Guards the guard: scoring must fail when a rule stops working."""
    pipeline.main(SEED, build_site=False)
    from hrdq.config import DB_PATH
    from hrdq.score import score
    con = checks.connect(DB_PATH)
    monkeypatch.setattr(checks, "RULES", [r for r in checks.RULES if r.id != "self_manager"])
    result = score(checks.run_all(con))
    con.close()
    assert len(result["missed"]) == 3
    assert {rule for _, rule in result["missed"]} == {"self_manager"}


def table(rows):
    con = duckdb.connect()
    con.execute("create table dim_employee (employee_id varchar, manager_id varchar)")
    con.executemany("insert into dim_employee values (?, ?)", rows)
    return con


def test_loop_rule_flags_only_people_inside_the_loop():
    con = table([("A", "B"), ("B", "C"), ("C", "A"), ("D", "A")])
    assert [row[0] for row in checks.reporting_loops(con)] == ["A", "B", "C"]


def test_loop_rule_leaves_a_normal_chain_alone():
    con = table([("A", "B"), ("B", "C"), ("C", None)])
    assert checks.reporting_loops(con) == []


def test_loop_rule_leaves_self_management_to_its_own_rule():
    assert checks.reporting_loops(table([("A", "A")])) == []


def test_same_seed_gives_identical_data():
    pipeline.generate.main(SEED)
    first = RAW_CSV.read_bytes()
    pipeline.generate.main(SEED)
    assert RAW_CSV.read_bytes() == first


def test_data_is_visibly_synthetic():
    pipeline.generate.main(SEED)
    with RAW_CSV.open() as handle:
        emails = [row["work_email"] for row in csv.DictReader(handle)]
    assert all("example.com" in email for email in emails)


def test_as_of_date_is_fixed():
    assert AS_OF.isoformat() == "2026-10-31"
