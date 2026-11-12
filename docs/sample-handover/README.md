# Sample handover packet: October headcount check

Version 1.0 · fixture 138ddb00f91c · report date 2026-10-31

This is a sample snapshot generated from the fictional example on lamin-beyai.github.io/portfolio. It is not a live export and it is not client work.

## Provenance

- The seven employee records are invented for the demonstration. Names, IDs and example.com addresses are fictional.
- The confirmations used for corrections are invented too. On a real file, a missing fact needs its owner.
- No employer data, code or documents are included.

## Files

| File | What it holds |
|---|---|
| input.csv | The exact fictional file the example checks, all columns |
| rules.csv | The rules: identifier, title, dimension, severity, why it matters, fix |
| exceptions.csv | Every item the rules found, with its status, the basis for the decision, the next step and the owner |
| report.csv | The employee list after review: status, whether each person counts in active headcount, and any open item |
| RUNBOOK.md | Inputs, run steps, review, what to do when a run fails, and who owns what |

## What this run found

- The rules found 4 items in 7 records.
- 3 were corrected with a confirmed (fictional) answer, and the rules ran again.
- 1 is held for its owner: a start date written 03/12/2024 that could mean two different days.

## What the report says

- Active headcount on 2026-10-31: 6, including 1 record under review.
- The held item goes out with the report as an open exception.

## Reproduce it

Open the example on the site, apply the three confirmed answers and hold the unreadable start date. The counts match this packet.

## Limits

Passing the rules does not prove every value is true. They check format, completeness and consistency inside this file only.
