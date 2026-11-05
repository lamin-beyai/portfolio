"""Run everything: generate data, build dbt models, run checks, score, build the site."""
from __future__ import annotations

import subprocess
import sys
import time
from pathlib import Path

from . import generate
from .checks import connect, run_all
from .config import DB_PATH, DBT_DIR, SEED
from .score import score


def dbt(*args: str) -> None:
    binary = Path(sys.executable).with_name("dbt")
    result = subprocess.run([str(binary), *args, "--profiles-dir", ".", "--quiet"],
                            cwd=DBT_DIR, capture_output=True, text=True)
    if result.returncode:
        sys.exit(result.stdout + result.stderr)


def main(seed: int = SEED, build_site: bool = True) -> dict:
    generate.main(seed)
    DB_PATH.unlink(missing_ok=True)
    dbt("seed")
    dbt("run")
    dbt("test")
    con = connect(DB_PATH)
    started = time.perf_counter()
    issues = run_all(con)
    seconds = time.perf_counter() - started
    result = score(issues)
    print(f"checks ran in {seconds:.2f}s")
    print(f"{result['correct']} of {result['planted']} planted issues found, "
          f"{len(result['unexpected'])} unexpected, "
          f"{len(result['edge_cases_flagged'])} of {result['edge_cases']} valid edge cases flagged")
    if build_site:
        from .site import build
        build(con, issues, result, seconds)
    con.close()
    return result


if __name__ == "__main__":
    main()
