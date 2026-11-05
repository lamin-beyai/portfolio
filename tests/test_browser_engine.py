"""The browser rules must agree with the Python rules, and K-means must earn its result."""
import csv
import json
import subprocess

import pytest

from hrdq import checks, pipeline, rfm
from hrdq.config import AS_OF, CONTRACT_TYPES, DB_PATH, MIN_WORKING_AGE, RAW_CSV, ROOT, SALARY_BANDS

RUNNER = """
const fs = require('fs'), E = require(process.argv[1]);
const input = JSON.parse(fs.readFileSync(0, 'utf8'));
const { head, rows } = E.parseCsv(fs.readFileSync(input.csv, 'utf8'));
const out = E.check(rows, head, input.params, input.rules);
console.log(JSON.stringify({ issues: out.issues.map(i => [i.employee_id, i.rule_id]), ids: E.ruleIds, skipped: out.skipped.length }));
"""


def browser_result():
    payload = {
        "csv": str(RAW_CSV),
        "rules": [{"id": r.id, "title": r.title, "severity": r.severity, "fix": r.fix, "why": r.why} for r in checks.RULES],
        "params": {"asOf": AS_OF.isoformat(), "bands": SALARY_BANDS, "minAge": MIN_WORKING_AGE,
                   "contractTypes": list(CONTRACT_TYPES)},
    }
    done = subprocess.run(["node", "-e", RUNNER, str(ROOT / "site" / "engine.js")],
                          input=json.dumps(payload), capture_output=True, text=True, check=True)
    return json.loads(done.stdout)


@pytest.mark.parametrize("seed", [20261105, 1, 2])
def test_browser_and_python_find_the_same_issues(seed):
    pipeline.main(seed, build_site=False)
    con = checks.connect(DB_PATH)
    python_found = {(i["employee_id"], i["rule_id"]) for i in checks.run_all(con)}
    con.close()
    result = browser_result()
    assert {tuple(i) for i in result["issues"]} == python_found
    assert result["skipped"] == 0


def test_every_python_rule_exists_in_the_browser():
    pipeline.main(20261105, build_site=False)
    assert set(browser_result()["ids"]) == {r.id for r in checks.RULES}


def test_kmeans_rediscovers_the_planted_groups():
    result = rfm.segments()
    assert result["agreement"] >= 90
    assert {s["name"] for s in result["segments"]} == set(rfm.GROUPS)
    assert sum(s["customers"] for s in result["segments"]) == result["customers"]


def test_kmeans_is_repeatable():
    assert rfm.segments() == rfm.segments()
