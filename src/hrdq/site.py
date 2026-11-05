"""Build the public page: one HTML file with its data inside, plus CSV exports."""
from __future__ import annotations

import csv
import json
import re
import shutil
from collections import Counter
from pathlib import Path

from . import rfm
from .checks import RULES
from .config import (AS_OF, CONTRACT_TYPES, MIN_WORKING_AGE, PUBLIC_PRICES, RAW_CSV, ROOT,
                     SALARY_BANDS, SITE_DIR, SITE_URL)

SOURCE = ROOT / "site"


def _write_csv(path: Path, rows: list[dict]) -> None:
    with path.open("w", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)


def _page(html: str) -> str:
    """Keep prices out of the published file, not merely hidden, until they are switched on."""
    drop, keep = ("noprices", "prices") if PUBLIC_PRICES else ("prices", "noprices")
    html = re.sub(rf"<!-- {drop} -->.*?<!-- /{drop} -->", "", html, flags=re.S)
    html = re.sub(rf"<!-- /?{keep} -->", "", html)
    if not SITE_URL:
        html = re.sub(r'\s*<(meta property="og:(image|url)"|link rel="canonical")[^>]*__SITE_URL__[^>]*>', "", html)
    return html.replace("__SITE_URL__", SITE_URL)


def build(con, issues: list[dict], result: dict, seconds: float) -> None:
    people = {r[0]: {"department": r[1] or "Unassigned", "status": r[2]} for r in con.execute(
        "select employee_id, department, employment_status from dim_employee").fetchall()}
    rules = {r.id: r for r in RULES}
    rows = [{
        "employee_id": i["employee_id"], "department": people[i["employee_id"]]["department"],
        "rule_id": i["rule_id"], "title": rules[i["rule_id"]].title,
        "severity": rules[i["rule_id"]].severity, "dimension": rules[i["rule_id"]].dimension,
        "detail": i["detail"], "fix": rules[i["rule_id"]].fix,
    } for i in issues]
    order = {"critical": 0, "high": 1, "medium": 2}
    rows.sort(key=lambda r: (order[r["severity"]], r["title"], r["employee_id"]))

    by_rule = Counter(r["rule_id"] for r in rows)
    rule_rows = [{"id": r.id, "title": r.title, "dimension": r.dimension, "severity": r.severity,
                  "why": r.why, "fix": r.fix, "count": by_rule[r.id]} for r in RULES]
    rule_rows.sort(key=lambda r: (-r["count"], order[r["severity"]], r["title"]))

    totals = Counter(p["department"] for p in people.values())
    affected: dict[str, set] = {}
    for r in rows:
        affected.setdefault(r["department"], set()).add(r["employee_id"])
    departments = sorted(({
        "department": d, "records": n, "affected": len(affected.get(d, ())),
        "rate": round(100 * len(affected.get(d, ())) / n, 1)} for d, n in totals.items()),
        key=lambda d: -d["rate"])

    months = [{"month": str(m)[:7], "headcount": h, "joiners": j, "leavers": l}
              for m, h, j, l in con.execute(
                  "select month_start, headcount, joiners, leavers from mart_headcount_monthly order by 1").fetchall()]

    records = len(people)
    with_issue = len({r["employee_id"] for r in rows})
    data = {
        "asOf": AS_OF.isoformat(), "records": records, "withIssue": with_issue,
        "cleanRate": round(100 * (records - with_issue) / records, 1),
        "issueCount": len(rows), "ruleCount": len(RULES),
        "critical": sum(r["severity"] == "critical" for r in rows),
        "seconds": round(seconds, 2),
        "score": {k: (len(v) if isinstance(v, list) else v) for k, v in result.items()},
        "rules": rule_rows, "departments": departments, "months": months, "issues": rows,
    }
    SITE_DIR.mkdir(exist_ok=True)
    exports = SITE_DIR / "exports"
    exports.mkdir(exist_ok=True)
    _write_csv(exports / "issues.csv", rows)
    _write_csv(exports / "issues_by_rule.csv", rule_rows)
    _write_csv(exports / "issue_rate_by_department.csv", departments)
    _write_csv(exports / "headcount_monthly.csv", months)
    payload = json.dumps(data, ensure_ascii=False).replace("</", "<\\/")
    html = (SOURCE / "monitor.html").read_text().replace("/*DATA*/null", payload)
    (SITE_DIR / "monitor.html").write_text(html)
    for name in ("style.css", "engine.js", "app.js", "favicon.svg"):
        (SITE_DIR / name).write_text((SOURCE / name).read_text())
    shutil.copytree(SOURCE / "fonts", SITE_DIR / "fonts", dirs_exist_ok=True)
    if (SOURCE / "og.png").exists():
        shutil.copy(SOURCE / "og.png", SITE_DIR / "og.png")
    (SITE_DIR / "index.html").write_text(_page((SOURCE / "index.html").read_text()))
    raw = RAW_CSV.read_text()
    lines = raw.splitlines()
    (exports / "template.csv").write_text("\n".join(lines[:4]) + "\n")
    portfolio = {
        "params": {"asOf": AS_OF.isoformat(), "bands": SALARY_BANDS, "minAge": MIN_WORKING_AGE,
                   "contractTypes": list(CONTRACT_TYPES)},
        "rules": [{"id": r.id, "title": r.title, "dimension": r.dimension, "severity": r.severity,
                   "why": r.why, "fix": r.fix} for r in RULES],
        "score": data["score"], "sampleCsv": raw, "winback": rfm.segments(),
    }
    (SITE_DIR / "data.js").write_text(
        "window.PORTFOLIO = " + json.dumps(portfolio, ensure_ascii=False).replace("</", "<\\/") + ";\n")
    (SITE_DIR / ".nojekyll").write_text("")
    print(f"site built: {SITE_DIR / 'index.html'}")
