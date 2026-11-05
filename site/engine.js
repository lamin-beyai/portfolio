/* The same rules as src/hrdq/checks.py, run in the browser so visitors can use them.
   tests/test_browser_engine.py checks both versions agree on every planted error. */
(function (root) {
  const ISO = /^\d{4}-\d{2}-\d{2}$/;
  const clean = v => { const t = (v == null ? "" : String(v)).trim(); return t === "" ? null : t; };
  function date(v) {
    const t = clean(v);
    if (!t || !ISO.test(t)) return null;
    const [y, m, d] = t.split("-").map(Number), x = new Date(Date.UTC(y, m - 1, d));
    return x.getUTCMonth() === m - 1 && x.getUTCDate() === d ? t : null;
  }
  const num = v => { const t = clean(v); if (t === null) return null; const n = Number(t); return Number.isFinite(n) ? n : null; };

  function parseCsv(text) {
    const rows = []; let row = [], cell = "", quoted = false;
    text = text.replace(/^﻿/, "");
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (quoted) {
        if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
        else if (c === '"') quoted = false;
        else cell += c;
      } else if (c === '"') quoted = true;
      else if (c === ",") { row.push(cell); cell = ""; }
      else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        row.push(cell); cell = "";
        if (row.some(v => v !== "")) rows.push(row);
        row = [];
      } else cell += c;
    }
    if (cell !== "" || row.length) { row.push(cell); if (row.some(v => v !== "")) rows.push(row); }
    const head = (rows.shift() || []).map(h => h.trim());
    return { head, rows: rows.map(r => Object.fromEntries(head.map((h, i) => [h, r[i] == null ? "" : r[i]]))) };
  }

  function toCsv(fields, rows) {
    const q = v => { const t = v == null ? "" : String(v); return /[",\n\r]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t; };
    return [fields.join(","), ...rows.map(r => fields.map(f => q(r[f])).join(","))].join("\n") + "\n";
  }

  function stage(rows) {
    const staged = rows.map(r => ({
      id: clean(r.employee_id), first: (clean(r.first_name) || "").toLowerCase(), last: (clean(r.last_name) || "").toLowerCase(),
      email: clean(r.work_email), dept: clean(r.department), cc: clean(r.cost_centre), title: clean(r.job_title) || "",
      level: clean(r.job_level), mgr: clean(r.manager_id), hireRaw: clean(r.hire_date), hire: date(r.hire_date),
      term: date(r.termination_date), status: clean(r.employment_status), contract: clean(r.contract_type),
      end: date(r.contract_end_date), fte: num(r.fte), salary: num(r.annual_salary_eur), dob: date(r.date_of_birth),
    }));
    const seen = new Map();
    staged.forEach(r => { if (r.id && !seen.has(r.id)) seen.set(r.id, r); });
    return { all: staged, dim: [...seen.values()], byId: seen };
  }

  const group = (items, key) => { const m = new Map(); items.forEach(i => { const k = key(i); if (k == null) return; (m.get(k) || m.set(k, []).get(k)).push(i); }); return m; };
  const addYears = (iso, n) => (Number(iso.slice(0, 4)) + n) + iso.slice(4);

  /* Each rule lists the columns it needs, so a file missing them skips only that rule. */
  const LOGIC = {
    duplicate_employee_id: { needs: ["employee_id"], run: ({ all }) => [...group(all, r => r.id)].filter(([, v]) => v.length > 1).map(([id, v]) => [id, `ID appears on ${v.length} rows`]) },
    possible_duplicate_person: { needs: ["first_name", "last_name", "date_of_birth"], run: ({ dim }) => {
      const out = [];
      group(dim.filter(r => r.dob && r.first && r.last), r => `${r.first}|${r.last}|${r.dob}`).forEach(v => {
        if (v.length > 1) v.forEach(r => out.push([r.id, "Same name and birth date as " + v.map(o => o.id).filter(i => i !== r.id).sort()[0]]));
      });
      return out;
    } },
    duplicate_email: { needs: ["work_email"], run: ({ dim }) => {
      const out = [];
      group(dim.filter(r => r.email), r => r.email.toLowerCase()).forEach(v => { if (v.length > 1) v.forEach(r => out.push([r.id, "Shares " + r.email])); });
      return out;
    } },
    missing_manager: { needs: ["manager_id", "employment_status", "job_level"], run: ({ dim }) => dim.filter(r => r.status === "Active" && !r.mgr && r.level !== "L6").map(r => [r.id, `${r.title || "Employee"} has no manager`]) },
    missing_cost_centre: { needs: ["cost_centre"], run: ({ dim }) => dim.filter(r => !r.cc).map(r => [r.id, `${r.dept || "This"} record has no cost centre`]) },
    missing_hire_date: { needs: ["hire_date"], run: ({ dim }) => dim.filter(r => !r.hireRaw).map(r => [r.id, "Hire date is blank"]) },
    invalid_hire_date: { needs: ["hire_date"], run: ({ dim }) => dim.filter(r => r.hireRaw && !r.hire).map(r => [r.id, `Hire date reads "${r.hireRaw}"`]) },
    invalid_email: { needs: ["work_email"], run: ({ dim }) => dim.filter(r => r.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(r.email)).map(r => [r.id, `Email reads "${r.email}"`]) },
    fte_out_of_range: { needs: ["fte"], run: ({ dim }) => dim.filter(r => r.fte === null || r.fte <= 0 || r.fte > 1).map(r => [r.id, `FTE is ${r.fte === null ? "unreadable" : r.fte}`]) },
    unknown_contract_type: { needs: ["contract_type"], run: ({ dim }, p) => dim.filter(r => !p.contractTypes.includes(r.contract)).map(r => [r.id, `Contract type reads "${r.contract || ""}"`]) },
    salary_outside_band: { needs: ["annual_salary_eur", "job_level"], run: ({ dim }, p) => dim.filter(r => {
      const b = p.bands[r.level]; if (!b) return false;
      const slack = (p.bandSlack || 0) / 100;
      return r.salary === null || r.salary < b[0] * (1 - slack) || r.salary > b[1] * (1 + slack);
    }).map(r => [r.id, `${r.level} salary is ${r.salary === null ? "unreadable" : r.salary}, band is ${p.bands[r.level][0]} to ${p.bands[r.level][1]}`]) },
    underage_at_hire: { needs: ["date_of_birth", "hire_date"], run: ({ dim }, p) => dim.filter(r => r.dob && r.hire && addYears(r.dob, p.minAge) > r.hire).map(r => [r.id, `Born ${r.dob}, hired ${r.hire}`]) },
    termination_before_hire: { needs: ["termination_date", "hire_date"], run: ({ dim }) => dim.filter(r => r.term && r.hire && r.term < r.hire).map(r => [r.id, `Left ${r.term}, hired ${r.hire}`]) },
    active_with_past_termination: { needs: ["employment_status", "termination_date"], run: ({ dim }, p) => dim.filter(r => r.status === "Active" && r.term && r.term < p.asOf).map(r => [r.id, `Active, but left on ${r.term}`]) },
    terminated_without_date: { needs: ["employment_status", "termination_date"], run: ({ dim }) => dim.filter(r => r.status === "Terminated" && !r.term).map(r => [r.id, "Status is Terminated, leaving date is blank"]) },
    future_hire_marked_active: { needs: ["employment_status", "hire_date"], run: ({ dim }, p) => dim.filter(r => r.status === "Active" && r.hire && r.hire > p.asOf).map(r => [r.id, `Active, but starts ${r.hire}`]) },
    fixed_term_missing_end_date: { needs: ["contract_type", "contract_end_date", "employment_status"], run: ({ dim }) => dim.filter(r => r.contract === "Fixed-term" && !r.end && r.status === "Active").map(r => [r.id, "Active fixed-term contract has no end date"]) },
    manager_not_found: { needs: ["manager_id"], run: ({ dim, byId }) => dim.filter(r => r.mgr && !byId.has(r.mgr)).map(r => [r.id, `Manager ${r.mgr} is not on file`]) },
    manager_inactive: { needs: ["manager_id", "employment_status"], run: ({ dim, byId }) => dim.filter(r => r.status === "Active" && byId.get(r.mgr)?.status === "Terminated").map(r => [r.id, `Manager ${r.mgr} left on ${byId.get(r.mgr).term || "an unknown date"}`]) },
    self_manager: { needs: ["manager_id"], run: ({ dim }) => dim.filter(r => r.mgr && r.mgr === r.id).map(r => [r.id, "Manager ID is the same as employee ID"]) },
    reporting_loop: { needs: ["manager_id"], run: ({ dim }) => {
      const up = new Map(dim.filter(r => r.mgr).map(r => [r.id, r.mgr])), out = [];
      up.forEach((_, start) => {
        const path = []; let at = start;
        while (up.has(at) && !path.includes(at)) { path.push(at); at = up.get(at); }
        if (at === start && path.length >= 2) out.push([start, "Reporting line returns to this person: " + [...path, start].join(" > ")]);
      });
      return out;
    } },
  };

  function check(rows, columns, params, rulesMeta) {
    const data = stage(rows), issues = [], skipped = [];
    rulesMeta.forEach(meta => {
      const logic = LOGIC[meta.id];
      if (params.off && params.off.includes(meta.id)) return;
      const missing = logic.needs.filter(c => !columns.includes(c));
      if (missing.length) { skipped.push({ ...meta, missing }); return; }
      logic.run(data, params).forEach(([id, detail]) => issues.push({ employee_id: id, rule_id: meta.id, detail, title: meta.title, severity: meta.severity, fix: meta.fix, why: meta.why }));
    });
    return { issues, skipped, data };
  }

  root.HRDQ = { parseCsv, toCsv, check, stage, ruleIds: Object.keys(LOGIC) };
  if (typeof module !== "undefined") module.exports = root.HRDQ;
})(typeof window !== "undefined" ? window : globalThis);
