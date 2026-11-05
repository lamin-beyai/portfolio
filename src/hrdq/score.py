"""Compare what the checks found with what was planted."""
from __future__ import annotations

import csv

from .config import DECOYS_CSV, TRUTH_CSV


def read_csv(path) -> list[dict]:
    with path.open(newline="") as handle:
        return list(csv.DictReader(handle))


def score(issues: list[dict]) -> dict:
    planted = {(r["employee_id"], r["rule_id"]) for r in read_csv(TRUTH_CSV)}
    found = {(i["employee_id"], i["rule_id"]) for i in issues}
    decoys = read_csv(DECOYS_CSV)
    decoy_ids = {d["employee_id"] for d in decoys}
    return {
        "planted": len(planted),
        "found": len(found),
        "correct": len(planted & found),
        "missed": sorted(planted - found),
        "unexpected": sorted(found - planted),
        "edge_cases": len(decoys),
        "edge_cases_flagged": sorted({e for e, _ in found if e in decoy_ids}),
    }
