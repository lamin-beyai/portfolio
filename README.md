# Lamin Beyai: interactive analytics portfolio

Three business problems you can solve in the browser, backed by a tested data pipeline. All data is fictional.

| Challenge | The business question | The analytics behind it |
|---|---|---|
| Payroll closes in 4 hours | With limited time, which data problems do you fix first? | 21 data-quality rules, risk per hour, exact knapsack optimisation |
| Clean a broken HR file | How do you find and fix bad records, and prove it worked? | The same rules live in the browser, on the sample or your own CSV |
| Spend a win-back budget | Who is worth contacting? | RFM features, K-means clustering, incremental profit per contact |

## How it works

```
generate fictional data and plant known errors
        |
dbt models on DuckDB  ->  Python rules  ->  score against planted errors
        |
static site in docs/  (browser rules in site/engine.js)
```

- `src/hrdq/generate.py` creates the company, 91 planted errors and 9 valid edge cases.
- `dbt_project/` types the raw extract and builds headcount tables.
- `src/hrdq/checks.py` holds the 21 rules, in SQL plus a Python graph walk for reporting loops.
- `src/hrdq/rfm.py` builds RFM features and runs K-means written from scratch.
- `site/engine.js` is the browser version of the rules.
- `tests/` covers detection, false alarms, browser and Python agreement, and K-means.

## Run it

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
PYTHONPATH=src .venv/bin/python -m hrdq.pipeline
.venv/bin/python -m pytest -q
python3 -m http.server 8000 --directory docs
```

Then open http://localhost:8000.

## What the tests prove, and what they don't

Across five random datasets, the rules find every planted error and raise no false alarms, including on valid but unusual records. A separate test confirms the scoring fails if a rule stops working. Three of those datasets also confirm the browser and Python rules agree.

That shows the rules do what they were written to do. It doesn't show how they would perform on a real company's data, which contains errors nobody planned for. Risk figures, minutes, uplift rates and salary bands are assumptions for the exercises.

## Credits

Designed by Lamin Beyai and built with AI assistance. No code, data or documents from any employer were used.
