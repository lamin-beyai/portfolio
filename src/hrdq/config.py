"""Shared settings. The as-of date is fixed so every run gives the same result."""
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = ROOT / "data"
RAW_CSV = DATA_DIR / "employees_raw.csv"
TRUTH_CSV = DATA_DIR / "injected_errors.csv"
DECOYS_CSV = DATA_DIR / "valid_edge_cases.csv"
DB_PATH = DATA_DIR / "hr.duckdb"
DBT_DIR = ROOT / "dbt_project"
SITE_DIR = ROOT / "docs"

AS_OF = date(2026, 10, 31)
SEED = 20261105
EMPLOYEE_COUNT = 520
MIN_WORKING_AGE = 16

# Annual salary band per job level, in euros. Also shipped as a dbt seed.
SALARY_BANDS = {
    "L1": (28000, 42000),
    "L2": (38000, 58000),
    "L3": (52000, 80000),
    "L4": (72000, 110000),
    "L5": (100000, 160000),
    "L6": (150000, 260000),
}
CONTRACT_TYPES = ("Permanent", "Fixed-term", "Apprenticeship")
