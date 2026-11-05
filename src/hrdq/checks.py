"""The data-quality rules. Each rule returns (employee_id, detail) pairs.

Add a rule by adding one Rule to RULES. SQL runs against the dbt models; a rule
that needs more than SQL can supply a Python function instead.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Callable

import duckdb

from .config import AS_OF, CONTRACT_TYPES, MIN_WORKING_AGE

STG = "stg_employees"
DIM = "dim_employee"
TODAY = f"date '{AS_OF.isoformat()}'"
TYPES = ", ".join(f"'{c}'" for c in CONTRACT_TYPES)


@dataclass(frozen=True)
class Rule:
    id: str
    title: str
    dimension: str
    severity: str  # critical, high or medium
    why: str
    fix: str
    sql: str | None = None
    function: Callable | None = None

    def run(self, con) -> list[tuple[str, str]]:
        if self.function:
            return self.function(con)
        return con.execute(self.sql).fetchall()


def reporting_loops(con) -> list[tuple[str, str]]:
    """Walk each reporting line upward and flag people who sit inside a loop."""
    managers = dict(con.execute(
        f"select employee_id, manager_id from {DIM} where manager_id is not null").fetchall())
    found = {}
    for start in managers:
        seen, current = [], start
        while current in managers and current not in seen:
            seen.append(current)
            current = managers[current]
        if current == start and len(seen) >= 2:
            found[start] = "Reporting line returns to this person: " + " > ".join(seen + [start])
    return sorted(found.items())


RULES: list[Rule] = [
    Rule("duplicate_employee_id", "Same employee ID on more than one row", "Uniqueness", "critical",
         "Headcount and payroll feeds count this person twice.",
         "Find which row is correct and remove the other at source.",
         sql=f"""select employee_id, 'ID appears on ' || count(*) || ' rows'
                 from {STG} group by 1 having count(*) > 1"""),
    Rule("possible_duplicate_person", "Same person under two employee IDs", "Uniqueness", "critical",
         "A rehire or import may have created a second record, splitting pay and history.",
         "Confirm with HR and merge the records.",
         sql=f"""select employee_id, 'Same name and birth date as ' || other
                 from (select a.employee_id, min(b.employee_id) as other
                       from {DIM} a join {DIM} b
                         on lower(a.first_name) = lower(b.first_name)
                        and lower(a.last_name) = lower(b.last_name)
                        and a.date_of_birth = b.date_of_birth
                        and a.employee_id <> b.employee_id
                       group by 1)"""),
    Rule("duplicate_email", "Work email shared by two employees", "Uniqueness", "high",
         "System sign-in and notifications can reach the wrong person.",
         "Give each person a unique address.",
         sql=f"""select employee_id, 'Shares ' || work_email
                 from {DIM}
                 where lower(work_email) in (select lower(work_email) from {DIM}
                                             group by 1 having count(distinct employee_id) > 1)"""),
    Rule("missing_manager", "Active employee with no manager", "Completeness", "high",
         "Approvals and reviews have nowhere to go.",
         "Assign the correct manager.",
         sql=f"""select employee_id, job_title || ' has no manager'
                 from {DIM} where employment_status = 'Active' and manager_id is null
                 and job_level <> 'L6'"""),
    Rule("missing_cost_centre", "No cost centre", "Completeness", "high",
         "Pay cost cannot be charged to the right budget.",
         "Add the cost centre for the department.",
         sql=f"select employee_id, department || ' record has no cost centre' from {DIM} where cost_centre is null"),
    Rule("missing_hire_date", "No hire date", "Completeness", "critical",
         "Tenure, leave and headcount trends cannot be calculated.",
         "Enter the date from the contract.",
         sql=f"select employee_id, 'Hire date is blank' from {DIM} where hire_date_raw is null"),
    Rule("invalid_hire_date", "Hire date cannot be read", "Validity", "critical",
         "The value is not a real date, so reports drop this person.",
         "Correct it from the contract.",
         sql=f"""select employee_id, 'Hire date reads "' || hire_date_raw || '"'
                 from {DIM} where hire_date_raw is not null and hire_date is null"""),
    Rule("invalid_email", "Work email format is invalid", "Validity", "medium",
         "Messages and account creation will fail.",
         "Correct the address.",
         sql=f"""select employee_id, 'Email reads "' || work_email || '"' from {DIM}
                 where work_email is not null
                 and not regexp_full_match(work_email, '[^@\\s]+@[^@\\s]+\\.[^@\\s]+')"""),
    Rule("fte_out_of_range", "Working time outside 0 to 1", "Validity", "high",
         "Pay and full-time-equivalent reporting are distorted.",
         "Correct the working-time fraction.",
         sql=f"""select employee_id, 'FTE is ' || coalesce(cast(fte as varchar), 'unreadable')
                 from {DIM} where fte is null or fte <= 0 or fte > 1"""),
    Rule("unknown_contract_type", "Contract type not on the approved list", "Validity", "medium",
         "Contract reporting and legal end-date tracking miss this person.",
         "Choose an approved contract type.",
         sql=f"""select employee_id, 'Contract type reads "' || coalesce(contract_type, '') || '"'
                 from {DIM} where contract_type is null or contract_type not in ({TYPES})"""),
    Rule("salary_outside_band", "Salary outside the band for the level", "Plausibility", "high",
         "Often a typing error, and it distorts pay analysis.",
         "Check against the contract. If correct, record the approved exception.",
         sql=f"""select e.employee_id,
                        e.job_level || ' salary is ' || coalesce(cast(e.annual_salary_eur as varchar), 'unreadable')
                        || ', band is ' || b.min_salary_eur || ' to ' || b.max_salary_eur
                 from {DIM} e join salary_bands b using (job_level)
                 where e.annual_salary_eur is null
                    or e.annual_salary_eur not between b.min_salary_eur and b.max_salary_eur"""),
    Rule("underage_at_hire", f"Under {MIN_WORKING_AGE} on the hire date", "Plausibility", "high",
         "Almost certainly a wrong birth date or hire date.",
         "Check against an identity document.",
         sql=f"""select employee_id, 'Born ' || date_of_birth || ', hired ' || hire_date
                 from {DIM} where date_of_birth + interval {MIN_WORKING_AGE} year > hire_date"""),
    Rule("termination_before_hire", "Leaving date before hire date", "Consistency", "critical",
         "Tenure is negative and turnover reports break.",
         "Correct whichever date is wrong.",
         sql=f"""select employee_id, 'Left ' || termination_date || ', hired ' || hire_date
                 from {DIM} where termination_date < hire_date"""),
    Rule("active_with_past_termination", "Marked active after the leaving date", "Consistency", "critical",
         "This person may still be paid or keep system access.",
         "Confirm the status and close the record if they have left.",
         sql=f"""select employee_id, 'Active, but left on ' || termination_date
                 from {DIM} where employment_status = 'Active' and termination_date < {TODAY}"""),
    Rule("terminated_without_date", "Terminated with no leaving date", "Consistency", "high",
         "Turnover cannot be placed in the right month.",
         "Enter the leaving date.",
         sql=f"""select employee_id, 'Status is Terminated, leaving date is blank'
                 from {DIM} where employment_status = 'Terminated' and termination_date is null"""),
    Rule("future_hire_marked_active", "Active before the start date", "Consistency", "medium",
         "Headcount is overstated until the person actually joins.",
         "Set the status to pending until the start date.",
         sql=f"""select employee_id, 'Active, but starts ' || hire_date
                 from {DIM} where employment_status = 'Active' and hire_date > {TODAY}"""),
    Rule("fixed_term_missing_end_date", "Fixed-term contract with no end date", "Consistency", "high",
         "The contract can expire with nobody alerted.",
         "Add the end date from the contract.",
         sql=f"""select employee_id, 'Active fixed-term contract has no end date'
                 from {DIM} where contract_type = 'Fixed-term' and contract_end_date is null
                 and employment_status = 'Active'"""),
    Rule("manager_not_found", "Manager ID does not exist", "Integrity", "high",
         "The reporting line is broken, so org charts and approvals fail.",
         "Assign a valid manager.",
         sql=f"""select employee_id, 'Manager ' || manager_id || ' is not on file' from {DIM}
                 where manager_id is not null and manager_id not in (select employee_id from {DIM})"""),
    Rule("manager_inactive", "Reports to someone who has left", "Integrity", "high",
         "Requests go to a person who is no longer there.",
         "Move this employee to a current manager.",
         sql=f"""select e.employee_id, 'Manager ' || m.employee_id || ' left on ' || m.termination_date
                 from {DIM} e join {DIM} m on e.manager_id = m.employee_id
                 where e.employment_status = 'Active' and m.employment_status = 'Terminated'"""),
    Rule("self_manager", "Listed as their own manager", "Integrity", "high",
         "Self-approval bypasses a basic control.",
         "Assign a different manager.",
         sql=f"select employee_id, 'Manager ID is the same as employee ID' from {DIM} where manager_id = employee_id"),
    Rule("reporting_loop", "Reporting line loops back on itself", "Integrity", "high",
         "Nobody at the top of this chain, so org charts and approval routing fail.",
         "Correct the manager on at least one person in the loop.",
         function=reporting_loops),
]


def run_all(con) -> list[dict]:
    issues = []
    for rule in RULES:
        for employee_id, detail in rule.run(con):
            issues.append({"employee_id": employee_id, "rule_id": rule.id, "detail": detail})
    return issues


def connect(path, read_only=True):
    return duckdb.connect(str(path), read_only=read_only)
