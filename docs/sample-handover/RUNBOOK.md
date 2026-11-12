# Runbook: monthly headcount check (sample)

Sample packet version 1.0, fixture 138ddb00f91c. Fictional example.

## Before the run: inputs

- One export of the employee list as CSV, one row per person, with these 17 columns: employee_id, first_name, last_name, work_email, department, cost_centre, job_title, job_level, manager_id, hire_date, termination_date, employment_status, contract_type, contract_end_date, fte, annual_salary_eur, date_of_birth.
- Dates written as YYYY-MM-DD. A date in any other form is flagged, not guessed.
- The report date. In this sample it is 2026-10-31.
- The approved contract types and the salary band for each level, kept in the rule settings.

## Run

- Export the file and save it under the agreed name.
- Run the rules. In this sample they are the public monitor's rules, which run in Python and in the browser.
- Open the exception log. Each line names the record, the rule and what was found.

## Review

- Apply a correction only when the owner or the source document confirms it, and write down which.
- Never fill a missing fact to clear a warning. If nobody knows the answer yet, hold the item for its owner with a next step.
- Run the rules again after corrections. A corrected item must no longer be found. A new item after a correction is treated as open.

## Publish the report

- State active headcount with the number of records still under review beside it.
- Send the held items with the report as a visible list, each with its owner and next step.

## When a run fails

- A column is missing: the rules that need it are skipped and named in the result. Fix the export and run again.
- The file cannot be read: check it is CSV with a header row, then export again.
- Results look wrong: compare the run with the previous month's log before changing a rule. Rule changes go through the agreed change process.

## Who owns what

- Export: HR operations.
- Running the check: a named operator in the client team.
- Confirming facts and deciding corrections: HR operations, with the relevant manager.
- Signing off the report: the report owner.
- In a real engagement each of these is a named person, agreed before handover.

## What the checks do not establish

- Passing the rules does not prove every value is true. They check format, completeness and consistency inside one file.
- They do not compare the file with payroll, contracts or any other system.
