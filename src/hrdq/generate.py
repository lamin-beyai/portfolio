"""Create a fictional HR extract, then plant known errors in it.

Every planted error is written to injected_errors.csv, so detection can be
measured. Valid but unusual records are listed in valid_edge_cases.csv: they
must NOT be flagged, which is what stops the checks passing by flagging everything.
"""
from __future__ import annotations

import csv
import random
from datetime import date, timedelta

from .config import (AS_OF, CONTRACT_TYPES, DATA_DIR, DECOYS_CSV, EMPLOYEE_COUNT,
                     RAW_CSV, SALARY_BANDS, SEED, TRUTH_CSV)

FIRST = """Alex Sam Robin Noa Camille Dominique Charlie Jules Maxime Andrea Sacha Lou Eden Morgan
Riley Taylor Jordan Casey Avery Quinn Rowan Sasha Kim Ari Nico Remi Elio Mika Tao Yuri Amal Dara
Ines Omar Lena Hugo Nadia Theo Maya Leo Zoe Ivan Aya Emil Sara Paul Rosa Marc Nora Adam""".split()
LAST = """Arden Belmont Calder Dorsey Ellery Fairfax Garland Hollis Ingram Jessup Kestrel Lindqvist
Marlowe Norwood Oakley Pemberton Quillon Rensley Stroud Thackery Underhill Vance Whitlock Yarrow
Zeller Ashgrove Brindle Corwin Dunmore Everly Fenwick Gresham Harrow Ivers Jolliffe Kirkby Lorne
Merrow Nettleton Orchard Penhale Radley Selwyn Tarrant Upton Varley Wexley Alder Birch Cotter""".split()
DEPARTMENTS = {
    "Engineering": ("CC100", 0.30, "Engineer"),
    "Sales": ("CC200", 0.20, "Account Executive"),
    "Customer Support": ("CC300", 0.15, "Support Specialist"),
    "Operations": ("CC400", 0.13, "Operations Analyst"),
    "Marketing": ("CC500", 0.09, "Marketing Specialist"),
    "Finance": ("CC600", 0.07, "Finance Analyst"),
    "People": ("CC700", 0.06, "People Partner"),
}
COUNTRIES = (("France", 0.6), ("Ireland", 0.25), ("Netherlands", 0.15))
LEVEL_WEIGHTS = (("L1", 0.34), ("L2", 0.36), ("L3", 0.21), ("L4", 0.09))
FIELDS = ["employee_id", "first_name", "last_name", "work_email", "department",
          "cost_centre", "job_title", "job_level", "manager_id", "country",
          "hire_date", "termination_date", "employment_status", "contract_type",
          "contract_end_date", "fte", "annual_salary_eur", "date_of_birth"]


def _pick(rng, weighted):
    return rng.choices([w[0] for w in weighted], [w[1] for w in weighted])[0]


def _day(rng, start: date, end: date) -> date:
    return start + timedelta(days=rng.randint(0, (end - start).days))


def _employee(rng, number: int, level: str, department: str, used_emails: set) -> dict:
    first, last = rng.choice(FIRST), rng.choice(LAST)
    email = f"{first}.{last}".lower()
    suffix = 1
    while email in used_emails:
        suffix += 1
        email = f"{first}.{last}{suffix}".lower()
    used_emails.add(email)
    cost_centre, _, title = DEPARTMENTS[department]
    low, high = SALARY_BANDS[level]
    hire = _day(rng, date(2016, 1, 4), date(2026, 9, 30))
    birth_year = hire.year - rng.randint(22, 45)
    contract = rng.choices(CONTRACT_TYPES, (0.86, 0.11, 0.03))[0]
    return {
        "employee_id": f"E{number:05d}", "first_name": first, "last_name": last,
        "work_email": f"{email}@example.com", "department": department,
        "cost_centre": cost_centre, "job_title": title, "job_level": level,
        "manager_id": "", "country": _pick(rng, COUNTRIES), "hire_date": hire.isoformat(),
        "termination_date": "", "employment_status": "Active", "contract_type": contract,
        "contract_end_date": "", "fte": rng.choices(("1.0", "0.8", "0.5"), (0.88, 0.09, 0.03))[0],
        "annual_salary_eur": str(rng.randrange(low, high, 500)),
        "date_of_birth": date(birth_year, rng.randint(1, 12), rng.randint(1, 28)).isoformat(),
    }


def build_clean(rng) -> list[dict]:
    used: set = set()
    rows = [_employee(rng, 1, "L6", "Operations", used)]
    rows[0].update(job_title="Chief Executive", hire_date="2016-01-04")
    n = 2
    for department in DEPARTMENTS:  # one director per department, under the CEO
        row = _employee(rng, n, "L5", department, used)
        row.update(job_title=f"Director, {department}", manager_id=rows[0]["employee_id"],
                   hire_date=f"2016-0{rng.randint(2, 9)}-01")
        rows.append(row)
        n += 1
    for row in rows:  # hire dates above were set by hand, so keep birth dates consistent
        row["date_of_birth"] = f"{int(row['hire_date'][:4]) - rng.randint(35, 50)}" + row["date_of_birth"][4:]
    weights = [DEPARTMENTS[d][1] for d in DEPARTMENTS]
    while len(rows) < EMPLOYEE_COUNT:
        rows.append(_employee(rng, n, _pick(rng, LEVEL_WEIGHTS),
                              rng.choices(list(DEPARTMENTS), weights)[0], used))
        n += 1
    order = {"L5": 5, "L4": 4, "L3": 3, "L2": 2, "L1": 1}
    for row in rows[8:]:  # everyone reports to someone more senior in the department
        options = [m for m in rows[1:] if m is not row and m["department"] == row["department"]
                   and order[m["job_level"]] > order[row["job_level"]]]
        row["manager_id"] = rng.choice(options)["employee_id"]
    managers = {r["manager_id"] for r in rows}
    for row in rows:
        if row["contract_type"] != "Permanent":
            hire = date.fromisoformat(row["hire_date"])
            row["contract_end_date"] = (hire + timedelta(days=rng.randint(365, 1095))).isoformat()
        leaver_rate = 0 if row["employee_id"] in managers else 0.18
        if rng.random() < leaver_rate:
            hire = date.fromisoformat(row["hire_date"])
            if (AS_OF - hire).days > 120:
                row["employment_status"] = "Terminated"
                row["termination_date"] = _day(rng, hire + timedelta(days=90), AS_OF).isoformat()
    for row in rows:  # a contract that ended means the person has left
        end = row["contract_end_date"]
        if row["employment_status"] == "Active" and end and date.fromisoformat(end) < AS_OF:
            row["contract_end_date"] = (AS_OF + timedelta(days=rng.randint(30, 500))).isoformat()
    return rows


class Injector:
    """Plants each error on a fresh record, so one record maps to one known error."""

    def __init__(self, rows, rng):
        self.rows, self.rng, self.truth = rows, rng, []
        managers = {r["manager_id"] for r in rows}
        self.leaves = [r for r in rows if r["employment_status"] == "Active"
                       and r["employee_id"] not in managers
                       and r["contract_type"] == "Permanent"]
        rng.shuffle(self.leaves)
        self.next_id = 90000

    def take(self):
        return self.leaves.pop()

    def mark(self, rule, *rows):
        self.truth += [{"employee_id": r["employee_id"], "rule_id": rule} for r in rows]

    def new_id(self):
        self.next_id += 1
        return f"E{self.next_id}"

    def each(self, rule, count, change):
        for _ in range(count):
            row = self.take()
            change(row)
            self.mark(rule, row)


def inject(rows, rng) -> tuple[list[dict], Injector]:
    i = Injector(rows, rng)
    i.each("missing_manager", 5, lambda r: r.update(manager_id=""))
    i.each("missing_cost_centre", 6, lambda r: r.update(cost_centre=""))
    i.each("missing_hire_date", 3, lambda r: r.update(hire_date=""))
    i.each("invalid_hire_date", 4, lambda r: r.update(
        hire_date=rng.choice(["31/02/2023", "2023-13-01", "March 2022", "00/00/0000"])))
    i.each("invalid_email", 5, lambda r: r.update(
        work_email=r["work_email"].replace("@", rng.choice([" at ", "@@", "#"]))))
    i.each("fte_out_of_range", 4, lambda r: r.update(fte=rng.choice(["1.5", "0", "80", "-1"])))
    i.each("unknown_contract_type", 4, lambda r: r.update(
        contract_type=rng.choice(["Perm", "Contractor?", "CDI ", "TBC"])))
    i.each("salary_outside_band", 6, lambda r: r.update(annual_salary_eur=str(
        rng.choice([int(r["annual_salary_eur"]) * 10, int(r["annual_salary_eur"]) // 10, 0]))))
    i.each("active_with_past_termination", 4, lambda r: r.update(
        termination_date=(AS_OF - timedelta(days=rng.randint(5, 200))).isoformat()))
    i.each("terminated_without_date", 4, lambda r: r.update(employment_status="Terminated"))
    i.each("future_hire_marked_active", 3, lambda r: r.update(
        hire_date=(AS_OF + timedelta(days=rng.randint(10, 90))).isoformat()))
    i.each("underage_at_hire", 3, lambda r: r.update(
        date_of_birth=date(int(r["hire_date"][:4]) - 12, 5, 14).isoformat()))
    i.each("manager_not_found", 4, lambda r: r.update(manager_id=f"E{rng.randint(70000, 79999)}"))
    i.each("self_manager", 3, lambda r: r.update(manager_id=r["employee_id"]))

    def before_hire(r):
        hire = date.fromisoformat(r["hire_date"])
        r.update(employment_status="Terminated",
                 termination_date=(hire - timedelta(days=rng.randint(1, 300))).isoformat())
    i.each("termination_before_hire", 4, before_hire)

    def fixed_no_end(r):
        r.update(contract_type="Fixed-term", contract_end_date="")
    i.each("fixed_term_missing_end_date", 4, fixed_no_end)

    for _ in range(3):  # a departed manager who still has a direct report
        boss, report = i.take(), i.take()
        boss.update(employment_status="Terminated", termination_date=(
            AS_OF - timedelta(days=rng.randint(20, 150))).isoformat())
        report["manager_id"] = boss["employee_id"]
        i.mark("manager_inactive", report)

    for size in (2, 3):  # reporting loops
        loop = [i.take() for _ in range(size)]
        for pos, row in enumerate(loop):
            row["manager_id"] = loop[(pos + 1) % size]["employee_id"]
        i.mark("reporting_loop", *loop)

    for _ in range(3):  # two people share one mailbox
        a, b = i.take(), i.take()
        b["work_email"] = a["work_email"]
        i.mark("duplicate_email", a, b)

    for _ in range(3):  # one ID on two rows, as after a bad merge
        row = i.take()
        copy = dict(row, department=rng.choice([d for d in DEPARTMENTS if d != row["department"]]))
        copy["cost_centre"] = DEPARTMENTS[copy["department"]][0]
        rows.append(copy)
        i.mark("duplicate_employee_id", row)

    for _ in range(4):  # one person entered twice under two IDs
        row = i.take()
        copy = dict(row, employee_id=i.new_id(),
                    work_email=row["work_email"].replace("@", ".2@"))
        rows.append(copy)
        i.mark("possible_duplicate_person", row, copy)
    return i.truth, i


def add_decoys(rows, inj) -> list[dict]:
    """Unusual but valid records. A good check leaves these alone."""
    decoys = []

    def note(row, reason):
        decoys.append({"employee_id": row["employee_id"], "reason": reason})

    note(rows[0], "The chief executive has no manager")
    a, b = inj.take(), inj.take()
    b.update(first_name=a["first_name"], last_name=a["last_name"],
             date_of_birth=str(int(a["date_of_birth"][:4]) + 7) + a["date_of_birth"][4:])
    note(a, "Shares a name with a colleague, different birth date")
    note(b, "Shares a name with a colleague, different birth date")
    c = inj.take()
    c.update(annual_salary_eur=str(SALARY_BANDS[c["job_level"]][1]))
    note(c, "Salary exactly at the top of the band")
    d = inj.take()
    d.update(annual_salary_eur=str(SALARY_BANDS[d["job_level"]][0]))
    note(d, "Salary exactly at the bottom of the band")
    e = inj.take()
    e.update(fte="0.2")
    note(e, "Very low but valid working time")
    f = inj.take()
    f.update(employment_status="Active", termination_date=(AS_OF + timedelta(days=30)).isoformat())
    note(f, "Active with a future leaving date, so serving notice")
    g = inj.take()
    g.update(date_of_birth=date(int(g["hire_date"][:4]) - 16, 1, 1).isoformat())
    note(g, "Exactly at or just above the minimum working age when hired")
    h = inj.take()
    h.update(hire_date=AS_OF.isoformat())
    note(h, "Joined on the extract date")
    return decoys


def main(seed: int = SEED) -> None:
    rng = random.Random(seed)
    rows = build_clean(rng)
    truth, inj = inject(rows, rng)
    decoys = add_decoys(rows, inj)
    rng.shuffle(rows)
    DATA_DIR.mkdir(exist_ok=True)
    for path, fields, data in ((RAW_CSV, FIELDS, rows),
                               (TRUTH_CSV, ["employee_id", "rule_id"], truth),
                               (DECOYS_CSV, ["employee_id", "reason"], decoys)):
        with path.open("w", newline="") as handle:
            writer = csv.DictWriter(handle, fieldnames=fields)
            writer.writeheader()
            writer.writerows(data)
    print(f"{len(rows)} rows, {len(truth)} planted issues, {len(decoys)} valid edge cases")


if __name__ == "__main__":
    main()
