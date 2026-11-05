(function () {
  const P = window.PORTFOLIO, E = window.HRDQ;
  const $ = id => document.getElementById(id);
  const el = (tag, props = {}, ...kids) => { const n = Object.assign(document.createElement(tag), props); n.append(...kids); return n; };
  const money = new Intl.NumberFormat("en-GB");
  const euro = n => "€" + money.format(Math.round(n));
  const signedEuro = n => (n < 0 ? "−€" : "€") + Math.abs(Math.round(n)).toLocaleString("en-GB");
  const hours = m => { const h = Math.floor(m / 60), r = m % 60; return h && r ? `${h}h ${r}m` : h ? `${h}h` : `${r}m`; };
  const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const tip = $("tip");
  const showTip = (x, y, text) => { tip.textContent = text; tip.style.display = "block"; tip.style.left = Math.max(8, Math.min(x + 14, innerWidth - tip.offsetWidth - 8)) + "px"; tip.style.top = Math.max(8, y - tip.offsetHeight - 12) + "px"; };
  const hideTip = () => tip.style.display = "none";
  const sample = E.parseCsv(P.sampleCsv);
  function countTo(node, to, format, ms = 520) {
    if (calm) { node.textContent = format(to); return; }
    const from = node._now ?? 0, t0 = performance.now(), run = node._run = {};
    (function step(t) {
      if (node._run !== run) return;
      const p = Math.max(0, Math.min(1, (t - t0) / ms)), e = 1 - Math.pow(1 - p, 4);
      node._now = from + (to - from) * e; node.textContent = format(node._now);
      if (p < 1) requestAnimationFrame(step);
    })(t0);
  }

  /* ---------- The field: one pencil mark per record ---------- */
  function Field(canvas, { cell = 20, maxHeight = 420, onPick, label } = {}) {
    const ctx = canvas.getContext("2d"), f = { marks: [], cols: 1, size: cell };
    const colors = () => { const c = getComputedStyle(document.documentElement); return { ink: c.getPropertyValue("--ink2").trim(), red: c.getPropertyValue("--red").trim(), blue: c.getPropertyValue("--pen").trim(), hl: c.getPropertyValue("--hl").trim() }; };
    function fit() {
      const w = canvas.clientWidth || 300, n = Math.max(1, f.marks.length);
      let size = Math.min(cell, Math.max(5, Math.sqrt(w * maxHeight / n)));
      if (w < 520) size = Math.min(size, Math.max(6, w / 26));
      f.cols = Math.max(1, Math.floor(w / size)); f.size = w / f.cols;
      const h = Math.ceil(n / f.cols) * f.size, dpr = devicePixelRatio || 1;
      canvas.style.height = h + "px"; canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    function shape(m, x, y, s, c) {
      const heal = m.heal, r = s * .3 * (1 - heal) + .01;
      if (heal < 1 && m.sev) {
        ctx.globalAlpha = (1 - heal) * m.show; ctx.fillStyle = c.hl; ctx.fillRect(x - s * .46, y - s * .46, s * .92, s * .92);
        ctx.fillStyle = ctx.strokeStyle = c.red;
        if (m.sev === "critical") ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
        else if (m.sev === "high") { ctx.beginPath(); ctx.arc(x, y, r * 1.08, 0, 7); ctx.fill(); }
        else { ctx.lineWidth = Math.max(1.4, s * .09); ctx.beginPath(); ctx.moveTo(x, y - r * 1.25); ctx.lineTo(x + r * 1.25, y); ctx.lineTo(x, y + r * 1.25); ctx.lineTo(x - r * 1.25, y); ctx.closePath(); ctx.stroke(); }
      }
      const stroke = m.wasBad ? heal : 1;
      if (stroke > 0) {
        const l = s * (m.wasBad ? .3 : .2) * stroke;
        ctx.globalAlpha = (m.wasBad ? 1 : .62) * m.show; ctx.strokeStyle = m.wasBad ? c.blue : c.ink;
        ctx.lineWidth = m.wasBad ? Math.max(1.5, s * .1) : Math.max(1, s * .06); ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(x - l * .55, y + l); ctx.lineTo(x + l * .55, y - l); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    f.draw = () => {
      const c = colors(), s = f.size;
      ctx.clearRect(0, 0, canvas.clientWidth, canvas.height);
      f.marks.forEach((m, i) => {
        const x = (i % f.cols + .5) * s, y = (Math.floor(i / f.cols) + .5) * s;
        shape(m, x, y, s, c);
        if (m.id === f.current) { ctx.strokeStyle = c.ink; ctx.lineWidth = 1.5; ctx.strokeRect(x - s * .46, y - s * .46, s * .92, s * .92); }
      });
    };
    f.set = marks => { f.marks = marks; fit(); f.draw(); };
    f.animate = (key, target, ms, stagger = true) => {
      if (calm) { f.marks.forEach(m => m[key] = target(m)); f.draw(); return; }
      const t0 = performance.now(), n = f.marks.length, from = f.marks.map(m => m[key]), to = f.marks.map(target);
      (function step(t) {
        let live = false;
        f.marks.forEach((m, i) => {
          const delay = stagger ? (i % f.cols) / f.cols * ms * .5 : 0;
          const p = Math.max(0, Math.min(1, (t - t0 - delay) / (ms * .5)));
          m[key] = from[i] + (to[i] - from[i]) * (1 - Math.pow(1 - p, 3));
          if (p < 1) live = true;
        });
        f.draw();
        if (live) requestAnimationFrame(step);
      })(t0);
    };
    const at = e => { const r = canvas.getBoundingClientRect(), col = Math.floor((e.clientX - r.left) / f.size), row = Math.floor((e.clientY - r.top) / f.size); return col < f.cols ? f.marks[row * f.cols + col] : null; };
    const peek = e => { const m = at(e); if (m && label) showTip(e.clientX, e.clientY, label(m)); else hideTip(); };
    canvas.addEventListener("pointermove", peek);
    canvas.addEventListener("pointerdown", peek);
    canvas.addEventListener("pointerleave", hideTip);
    if (onPick) canvas.addEventListener("click", e => { const m = at(e); if (m) onPick(m); });
    new ResizeObserver(() => { if (f.marks.length) { fit(); f.draw(); } }).observe(canvas);
    addEventListener("load", () => f.marks.length && f.draw());
    document.fonts?.ready.then(() => f.marks.length && f.draw());
    return f;
  }

  /* ---------- The file as it arrives ---------- */
  const heroRun = E.check(sample.rows, sample.head, P.params, P.rules);
  const heroBy = new Map();
  heroRun.issues.forEach(i => { if (!heroBy.has(i.employee_id)) heroBy.set(i.employee_id, i); });
  const rank = { critical: 3, high: 2, medium: 1 };
  heroRun.issues.forEach(i => { if (rank[i.severity] > rank[heroBy.get(i.employee_id).severity]) heroBy.set(i.employee_id, i); });
  /* ---------- Entry 1: payroll ---------- */
  const IMPACT = { // minutes per issue; months of pay at risk, or a flat euro estimate
    duplicate_employee_id: { min: 30, months: 1 }, possible_duplicate_person: { min: 20, months: 0.5 },
    active_with_past_termination: { min: 20, months: 1 }, salary_outside_band: { min: 15, band: true },
    fte_out_of_range: { min: 10, months: 0.5 }, terminated_without_date: { min: 10, months: 0.25 },
    termination_before_hire: { min: 15, months: 0.25 }, missing_hire_date: { min: 15, flat: 400 },
    invalid_hire_date: { min: 15, flat: 400 }, underage_at_hire: { min: 15, flat: 150 },
    fixed_term_missing_end_date: { min: 15, flat: 600 }, duplicate_email: { min: 10, flat: 100 },
    missing_manager: { min: 10, flat: 120 }, manager_not_found: { min: 10, flat: 120 },
    manager_inactive: { min: 10, flat: 120 }, reporting_loop: { min: 15, flat: 120 },
    self_manager: { min: 5, flat: 200 }, missing_cost_centre: { min: 5, flat: 180 },
    unknown_contract_type: { min: 10, flat: 80 }, invalid_email: { min: 5, flat: 30 }, future_hire_marked_active: { min: 5, flat: 90 },
  };
  const BUDGET = 240;

  function buildGame() {
    const { issues, data } = heroRun, groups = new Map();
    issues.forEach(i => {
      const imp = IMPACT[i.rule_id], person = data.byId.get(i.employee_id), band = P.params.bands[person.level] || [40000, 60000];
      const sane = person.salary >= band[0] && person.salary <= band[1] ? person.salary : (band[0] + band[1]) / 2;
      const monthly = sane / 12, risk = imp.band ? monthly : imp.flat || monthly * (imp.months || 0);
      const g = groups.get(i.rule_id) || { id: i.rule_id, title: i.title, severity: i.severity, count: 0, minutes: 0, risk: 0 };
      g.count++; g.minutes += imp.min; g.risk += risk; groups.set(i.rule_id, g);
    });
    const list = [...groups.values()].sort((a, b) => b.count - a.count || a.title.localeCompare(b.title));
    // Exact best plan: 0/1 knapsack over 5-minute steps.
    const cap = BUDGET / 5, best = Array(cap + 1).fill(0), keep = list.map(() => Array(cap + 1).fill(false));
    list.forEach((g, i) => { const w = g.minutes / 5; for (let c = cap; c >= w; c--) if (best[c - w] + g.risk > best[c]) { best[c] = best[c - w] + g.risk; keep[i][c] = true; } });
    const plan = new Set(); let c = cap;
    for (let i = list.length - 1; i >= 0; i--) if (keep[i][c]) { plan.add(list[i].id); c -= list[i].minutes / 5; }
    return { list, plan, best: best[cap], totalMinutes: list.reduce((s, g) => s + g.minutes, 0), totalRisk: list.reduce((s, g) => s + g.risk, 0), issues: issues.length };
  }
  const game = buildGame(), chosen = [];
  $("gIssues").textContent = game.issues;
  $("gHours").textContent = Math.round(game.totalMinutes / 60) + " hours";
  for (let i = 0; i < 48; i++) $("gTicks").append(el("i"));
  const byId = id => game.list.find(g => g.id === id);
  const used = () => chosen.reduce((s, id) => s + byId(id).minutes, 0);
  const rows = new Map();
  game.list.forEach(g => {
    const box = el("input", { type: "checkbox", id: "g-" + g.id });
    box.setAttribute("aria-label", `${g.title}, ${g.count} records, ${hours(g.minutes)}, ${euro(g.risk)} at risk`);
    box.onchange = () => { box.checked ? chosen.push(g.id) : chosen.splice(chosen.indexOf(g.id), 1); clearVerdict(); drawGame(); };
    const row = el("label", { className: "lrow" }, box, el("span", { className: "box" }), el("span", { className: "t", textContent: g.title }),
      el("span", { className: "m c", textContent: g.count + (innerWidth < 560 ? " records" : "") }), el("span", { className: "m tm", textContent: hours(g.minutes) }), el("span", { className: "m k2", textContent: innerWidth < 560 ? `${hours(g.minutes)} · ${euro(g.risk)}` : euro(g.risk) }));
    rows.set(g.id, row); $("gList").append(row);
  });
  function clearVerdict() { $("gResult").hidden = true; rows.forEach(r => r.classList.remove("best")); }
  function drawGame() {
    const u = used();
    $("gTime").textContent = `${u ? hours(u) : "0"} of 4h, ${hours(BUDGET - u)} left`;
    countTo($("gProtect"), chosen.reduce((s, id) => s + byId(id).risk, 0), euro, 300);
    $("gTicks").setAttribute("aria-valuenow", u);
    const ticks = $("gTicks").children; let at = 0;
    [...ticks].forEach(t => t.className = "");
    chosen.forEach((id, n) => { const k = byId(id).minutes / 5; for (let j = 0; j < k; j++) ticks[at++].className = n % 2 ? "on alt" : "on"; });
    $("gGo").disabled = !chosen.length;
    game.list.forEach(g => {
      const row = rows.get(g.id), on = chosen.includes(g.id), locked = !on && u + g.minutes > BUDGET, box = row.querySelector("input");
      box.disabled = locked; row.classList.toggle("locked", locked); row.classList.toggle("checked", on);
    });
  }
  function sortBy(btn, cmp) {
    ["sCount", "sRisk", "sTime"].forEach(id => $(id).setAttribute("aria-pressed", String(id === btn)));
    [...game.list].sort(cmp).forEach(g => $("gList").append(rows.get(g.id)));
  }
  $("sCount").onclick = () => sortBy("sCount", (a, b) => b.count - a.count);
  $("sRisk").onclick = () => sortBy("sRisk", (a, b) => b.risk - a.risk);
  $("sTime").onclick = () => sortBy("sTime", (a, b) => a.minutes - b.minutes);
  drawGame();

  const reveal = node => { node.hidden = false; node.focus({ preventScroll: true }); node.scrollIntoView({ block: "start", behavior: calm ? "auto" : "smooth" }); };
  const barRow = (name, value, max, cls) => {
    const fill = el("i"); requestAnimationFrame(() => requestAnimationFrame(() => fill.style.transform = `scaleX(${value / max})`));
    return el("div", { className: "crow " + cls }, el("span", { textContent: name }), el("div", { className: "bar" }, fill), el("span", { className: "m", textContent: euro(value) }));
  };
  $("gGo").onclick = () => {
    const mine = game.list.filter(g => chosen.includes(g.id)).reduce((s, g) => s + g.risk, 0), share = mine / game.best;
    const critical = game.list.filter(g => g.severity === "critical" && !chosen.includes(g.id));
    const miss = game.list.filter(g => !chosen.includes(g.id)).sort((a, b) => b.risk / b.minutes - a.risk / a.minutes)[0];
    const heading = share >= .999 ? "That is the best possible plan." : share >= .85 ? "A strong call. Very little was left on the table." : share >= .6 ? "Decent, and the data finds a better plan." : "Payroll locked with serious money still exposed.";
    const r = $("gResult"); r.replaceChildren();
    r.append(el("h3", { textContent: heading }),
      el("p", { textContent: `You protected ${Math.round(share * 100)}% of what 4 hours could protect, from ${euro(game.totalRisk)} at risk in total.` }),
      el("div", { className: "compare" }, barRow("You", mine, game.best, ""), barRow("Best plan", game.best, game.best, "best")));
    if (miss && share < .999) r.append(el("p", { textContent: `Biggest miss: ${miss.title}, at ${euro(miss.risk / miss.minutes * 60)} of risk per hour of work.` }));
    if (critical.length) r.append(el("p", { textContent: `${critical.length} critical ${critical.length === 1 ? "problem type stays" : "problem types stay"} open, ready for the follow-up list after payroll.` }));
    r.append(el("p", { innerHTML: "<b>The analyst's habit:</b> rank by risk per hour of work, then fix the cause so the problem doesn't return next month." }));
    const show = el("button", { className: "tool", type: "button", textContent: "Show the best plan" });
    show.onclick = () => { rows.forEach((row, id) => row.classList.toggle("best", game.plan.has(id))); show.textContent = "Highlighted above"; show.disabled = true; };
    const again = el("button", { className: "tool", type: "button", textContent: "Try again" });
    again.onclick = () => { chosen.length = 0; rows.forEach(row => row.querySelector("input").checked = false); clearVerdict(); drawGame(); $("entry-1").scrollIntoView({ behavior: calm ? "auto" : "smooth" }); };
    r.append(el("div", { className: "vacts" }, show, again));
    reveal(r);
  };

  /* ---------- Entry 2: workbench ---------- */
  const FIELDS = sample.head;
  const ALIASES = { employee_id: ["employee id", "emp id", "id", "staff id", "matricule", "person id"], first_name: ["first name", "firstname", "given name", "prenom", "prénom"], last_name: ["last name", "lastname", "surname", "family name", "nom"], work_email: ["email", "e-mail", "work email", "mail"], department: ["department", "dept", "departement", "département", "team"], cost_centre: ["cost centre", "cost center", "centre de cout", "centre de coût"], job_title: ["job title", "title", "position", "poste"], job_level: ["job level", "level", "grade", "niveau"], manager_id: ["manager id", "manager", "reports to", "line manager id"], country: ["country", "pays"], hire_date: ["hire date", "start date", "date d'embauche", "date of hire"], termination_date: ["termination date", "end date", "leaving date", "date de sortie"], employment_status: ["status", "employment status", "statut"], contract_type: ["contract type", "contract", "type de contrat"], contract_end_date: ["contract end date", "contract end"], fte: ["fte", "working time", "taux d'activite"], annual_salary_eur: ["salary", "annual salary", "base salary", "salaire"], date_of_birth: ["date of birth", "dob", "birth date", "date de naissance"] };
  const FIX = { missing_manager: "manager_id", manager_not_found: "manager_id", manager_inactive: "manager_id", self_manager: "manager_id", reporting_loop: "manager_id", missing_cost_centre: "cost_centre", missing_hire_date: "hire_date", invalid_hire_date: "hire_date", invalid_email: "work_email", duplicate_email: "work_email", fte_out_of_range: "fte", unknown_contract_type: "contract_type", salary_outside_band: "annual_salary_eur", underage_at_hire: "date_of_birth", termination_before_hire: "termination_date", active_with_past_termination: "employment_status", terminated_without_date: "termination_date", future_hire_marked_active: "employment_status", fixed_term_missing_end_date: "contract_end_date" };
  const LABEL = f => f.replace(/_eur$/, "").replace(/_/g, " ").replace(/^fte$/, "FTE").replace(/^./, c => c.toUpperCase());
  const W = { rows: [], columns: [], fileName: "cleaned_hr_data.csv", changes: 0, pos: 0, params: { ...P.params, bandSlack: 0 }, result: null, list: [], firstBad: new Set() };
  const benchField = Field($("wField"), { cell: 21, maxHeight: 300,
    label: m => m.sev ? `${m.id}: ${m.n} ${m.n === 1 ? "issue" : "issues"}. Select to open.` : m.wasBad ? `${m.id}: fixed` : `${m.id}: clean`,
    onPick: m => { const i = W.list.findIndex(x => x.employee_id === m.id); if (i < 0) return; W.pos = i; drawFocus(); } });

  function drawMap() {
    const counts = new Map();
    W.result.issues.forEach(i => { const c = counts.get(i.employee_id) || { n: 0, sev: "medium" }; c.n++; if (rank[i.severity] > rank[c.sev]) c.sev = i.severity; counts.set(i.employee_id, c); });
    benchField.set(W.result.data.dim.map(r => { const c = counts.get(r.id); return { id: r.id, sev: c && c.sev, n: c ? c.n : 0, wasBad: W.firstBad.has(r.id), heal: c ? 0 : 1, show: 1 }; }));
  }
  function load(rows, columns, name) {
    Object.assign(W, { rows: rows.map(r => ({ ...r })), columns, fileName: name, changes: 0, pos: 0, history: [] });
    W.result = E.check(W.rows, W.columns, W.params, P.rules);
    W.firstBad = new Set(W.result.issues.map(i => i.employee_id));
    $("wFixed").textContent = 0; drawW();
  }
  const rerun = () => { W.result = E.check(W.rows, W.columns, W.params, P.rules); drawW(); };
  const say = (t, bad) => { $("wMsg").textContent = t; $("wMsg").classList.toggle("bad", !!bad); };
  function suggest(issue, row) {
    const v = row[FIX[issue.rule_id]];
    if (issue.rule_id === "invalid_email") return String(v).replace(/ at |@@|#/g, "@");
    if (issue.rule_id === "missing_cost_centre") {
      const n = {}; W.rows.forEach(r => { if (r.department === row.department && r.cost_centre) n[r.cost_centre] = (n[r.cost_centre] || 0) + 1; });
      return Object.keys(n).sort((a, b) => n[b] - n[a])[0];
    }
    if (issue.rule_id === "active_with_past_termination") return "Terminated";
    if (issue.rule_id === "future_hire_marked_active") return "Pending";
    if (issue.rule_id === "unknown_contract_type") return W.params.contractTypes[0];
    return null;
  }
  const rowOf = id => W.rows.find(r => (r.employee_id || "").trim() === id);
  function apply(issue, field, value) {
    const before = W.result.issues.length;
    const target = rowOf(issue.employee_id);
    W.history.push([{ row: target, field, old: target[field] }]); target[field] = value; W.changes++; $("wFixed").textContent = W.changes;
    rerun();
    const still = W.result.issues.some(i => i.employee_id === issue.employee_id && i.rule_id === issue.rule_id), left = W.result.issues.length;
    if (still) say(`The rule still fails for ${issue.employee_id}. Try another value.`, true);
    else if (left > before) say(`Fixed, but that change created a new problem. ${left} left.`, true);
    else say(left ? `Fixed. ${left} left.` : "File is clean.");
  }
  function removeRow(issue) {
    const at = W.rows.map((r, i) => [(r.employee_id || "").trim(), i]).filter(([id]) => id === issue.employee_id).map(([, i]) => i);
    const gone = W.rows.splice(at[at.length - 1], 1)[0]; W.history.push([{ removed: gone, index: at[at.length - 1] }]); W.changes++; $("wFixed").textContent = W.changes;
    rerun(); say(`Row removed. ${W.result.issues.length} left.`);
  }
  function drawFocus() {
    const box = $("wFocus"), n = W.list.length;
    W.pos = Math.max(0, Math.min(W.pos, n - 1));
    box.replaceChildren(); box.classList.toggle("done", !n);
    $("wPrev").disabled = W.pos <= 0; $("wNext").disabled = W.pos >= n - 1;
    $("wPos").textContent = n ? `Issue ${W.pos + 1} of ${n}` : "";
    if (!n) {
      benchField.current = null; benchField.draw();
      box.append(el("h3", { textContent: W.result.issues.length ? "No issues match these filters." : "This file passes every rule that ran." }),
        el("p", { className: "w", textContent: W.result.issues.length ? "Change the filters to see the rest." : "Download the cleaned file, or load another one." }));
      return;
    }
    const i = W.list[W.pos], row = rowOf(i.employee_id), field = FIX[i.rule_id];
    benchField.current = i.employee_id; benchField.draw();
    const mark = el("i", { className: "k " + i.severity, ariaHidden: "true" });
    box.append(el("span", { className: "sev" }, mark, `${i.severity} · ${i.employee_id}`), el("h3", { textContent: i.title }),
      el("p", { className: "d", textContent: i.detail }), el("p", { className: "w", textContent: i.why }));
    const fix = el("div", { className: "fix" });
    if (field && W.columns.includes(field) && row) {
      const input = el("input", { type: "text", id: "wFixInput", value: row[field] || "", placeholder: LABEL(field) });
      const save = el("button", { className: "apply", type: "button", textContent: "Apply" });
      save.onclick = () => apply(i, field, input.value);
      input.onkeydown = e => { if (e.key === "Enter") save.click(); };
      fix.append(el("label", { htmlFor: "wFixInput", textContent: LABEL(field) }), el("div", { className: "fixline" }, input, save));
      const s = suggest(i, row);
      if (s && s !== row[field]) { const chip = el("button", { type: "button", className: "chip", textContent: "Use " + s }); chip.onclick = () => apply(i, field, s); fix.append(chip); }
    } else if (i.rule_id === "duplicate_employee_id" || i.rule_id === "possible_duplicate_person") {
      const b = el("button", { className: "apply", type: "button", textContent: i.rule_id === "duplicate_employee_id" ? "Remove the duplicate row" : "Remove this record" });
      b.onclick = () => removeRow(i); fix.append(b);
    } else fix.append(el("p", { className: "w", textContent: i.fix }));
    box.append(fix);
  }
  function drawW() {
    const { issues, data, skipped } = W.result, records = data.dim.length || 1;
    const affected = new Set(issues.map(i => i.employee_id)).size, clean = 100 * (records - affected) / records;
    $("wClean").textContent = clean.toFixed(1) + "%";
    $("wCleanText").textContent = `of ${records.toLocaleString("en-GB")} clean`;
    $("wLeft").textContent = issues.length;
    const sev = $("wSev").value, rule = $("wRule").value, order = { critical: 0, high: 1, medium: 2 };
    W.list = issues.filter(i => (!sev || i.severity === sev) && (!rule || i.rule_id === rule))
      .sort((a, b) => order[a.severity] - order[b.severity] || a.title.localeCompare(b.title) || a.employee_id.localeCompare(b.employee_id));
    W.skippedText = skipped.length ? `${skipped.length} ${skipped.length === 1 ? "rule was" : "rules were"} skipped because columns are missing.` : "";
    drawMap(); drawFocus();
    const n = safeFixes().length; $("wAuto").textContent = n ? `Apply ${n} suggested fixes` : "No suggested fixes left"; $("wAuto").disabled = !n || W.busy;
    $("wUndo").disabled = !W.history.length;
  }
  const safeFixes = () => W.result.issues.map(i => { const row = rowOf(i.employee_id), field = FIX[i.rule_id], to = row && field && W.columns.includes(field) ? suggest(i, row) : null; return { row, field, to }; }).filter(f => f.to && f.to !== f.row[f.field]);
  function undo() {
    const step = W.history.pop(); if (!step) return;
    step.slice().reverse().forEach(c => { if (c.removed) W.rows.splice(c.index, 0, c.removed); else c.row[c.field] = c.old; });
    W.changes = Math.max(0, W.changes - step.length); $("wFixed").textContent = W.changes; rerun(); say(step.length > 1 ? `Undid ${step.length} changes.` : "Undone.");
  }
  $("wUndo").onclick = undo;
  $("entry-2").addEventListener("keydown", e => {
    if ((e.metaKey || e.ctrlKey) && e.key === "z" && !/INPUT|SELECT/.test(e.target.tagName)) { e.preventDefault(); undo(); }
    if (/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
    if (e.key === "ArrowRight" && !$("wNext").disabled) $("wNext").click();
    if (e.key === "ArrowLeft" && !$("wPrev").disabled) $("wPrev").click();
  });
  $("wAuto").onclick = async () => {
    const todo = safeFixes(), started = performance.now(), batch = []; if (!todo.length || W.busy) return;
    W.busy = true; $("wAuto").disabled = true;
    for (let k = 0; k < todo.length; k++) {
      const f = todo[k]; batch.push({ row: f.row, field: f.field, old: f.row[f.field] }); f.row[f.field] = f.to; W.changes++;
      if (!calm) { $("wFixed").textContent = W.changes; rerun(); say(`Fixing ${k + 1} of ${todo.length}`); await new Promise(r => setTimeout(r, 55)); }
    }
    W.history.push(batch); W.busy = false; $("wFixed").textContent = W.changes; rerun();
    const left = W.result.issues.length, secs = ((performance.now() - started) / 1000).toFixed(1);
    say(`${todo.length} fixed in ${secs} seconds. ${left} left that need a person's decision. Undo is one click away.`);
  };
  function mapColumns(head) {
    const norm = s => s.trim().toLowerCase().replace(/[_-]+/g, " "), map = {};
    head.forEach(h => { const n = norm(h), hit = FIELDS.find(f => norm(f) === n || (ALIASES[f] || []).includes(n)); if (hit && !Object.values(map).includes(hit)) map[h] = hit; });
    return map;
  }
  $("wFile").onchange = e => { const file = e.target.files[0]; e.target.value = ""; if (file) readFile(file); };
  let dragDepth = 0; const veil = $("dropVeil"), hasFile = e => [...(e.dataTransfer?.types || [])].includes("Files");
  addEventListener("dragenter", e => { if (hasFile(e)) { dragDepth++; veil.classList.add("on"); } });
  addEventListener("dragleave", e => { if (hasFile(e) && --dragDepth <= 0) { dragDepth = 0; veil.classList.remove("on"); } });
  addEventListener("dragover", e => { if (hasFile(e)) e.preventDefault(); });
  addEventListener("drop", e => {
    if (!hasFile(e)) return; e.preventDefault(); dragDepth = 0; veil.classList.remove("on");
    const file = e.dataTransfer.files[0]; if (!file) return;
    $("entry-2").scrollIntoView({ behavior: calm ? "auto" : "smooth" });
    if (/\.csv$/i.test(file.name) || file.type === "text/csv") readFile(file); else say("That isn't a CSV. In Excel, use Save As, then CSV.", true);
  });
  function readFile(file) {
    if (file.size > 10 * 1024 * 1024) return say("That file is over 10 MB. Try a smaller extract.", true);
    const reader = new FileReader();
    reader.onerror = () => say("That file couldn't be read.", true);
    reader.onload = () => {
      const { head, rows } = E.parseCsv(String(reader.result)), map = mapColumns(head);
      if (!Object.values(map).includes("employee_id")) return say("No employee ID column found. Rename it employee_id, or use the CSV template.", true);
      if (!rows.length) return say("That file has no data rows.", true);
      const mapped = rows.map(r => { const o = {}; for (const h in map) o[map[h]] = r[h]; return o; });
      $("wAsOf").value = W.params.asOf = new Date().toISOString().slice(0, 10);
      load(mapped, Object.values(map), file.name.replace(/\.csv$/i, "") + "_cleaned.csv");
      say(`Read ${rows.length.toLocaleString("en-GB")} rows on your device. Matched ${Object.keys(map).length} of ${head.length} columns. ${W.skippedText}`.trim());
    };
    reader.readAsText(file);
  }
  $("wReset").onclick = () => { W.params.asOf = P.params.asOf; $("wAsOf").value = P.params.asOf; load(sample.rows, sample.head, "cleaned_hr_data.csv"); say("Back to the sample file."); };
  $("wDownload").onclick = () => {
    const url = URL.createObjectURL(new Blob([E.toCsv(W.columns, W.rows)], { type: "text/csv" }));
    el("a", { href: url, download: W.fileName }).click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  $("wPrev").onclick = () => { W.pos--; drawFocus(); };
  $("wNext").onclick = () => { W.pos++; drawFocus(); };
  ["wSev", "wRule"].forEach(id => $(id).onchange = () => { W.pos = 0; drawW(); });
  $("wSlack").oninput = e => { W.params.bandSlack = +e.target.value; $("wSlackOut").textContent = e.target.value + "%"; rerun(); };
  $("wAsOf").value = P.params.asOf; $("wAsOf").onchange = e => { if (e.target.value) { W.params.asOf = e.target.value; rerun(); } };
  $("wAge").value = P.params.minAge; $("wAge").onchange = e => { W.params.minAge = +e.target.value || P.params.minAge; rerun(); };
  $("wTypes").value = P.params.contractTypes.join(", ");
  $("wTypes").onchange = e => { W.params.contractTypes = e.target.value.split(",").map(s => s.trim()).filter(Boolean); rerun(); };
  $("wRuleCount").textContent = P.rules.length;
  $("wRule").append(el("option", { value: "", textContent: "All rules" }), ...[...P.rules].sort((a, b) => a.title.localeCompare(b.title)).map(r => el("option", { value: r.id, textContent: r.title })));
  load(sample.rows, sample.head, "cleaned_hr_data.csv");

  /* ---------- Entry 3: win-back ---------- */
  const SEGS = P.winback.segments, share = Object.fromEntries(SEGS.map(s => [s.name, 25]));
  $("rCustomers").textContent = P.winback.customers.toLocaleString("en-GB");
  const A = () => ({ budget: +$("rBudget").value, cost: +$("rCost").value, margin: +$("rMargin").value / 100, orders: +$("rOrders").value });
  const perContact = (s, a) => s.uplift * s.orderValue * a.orders * a.margin - a.cost;
  function bestPlan(a) { // spending on the best net return first is exact here
    let left = a.budget, profit = 0; const plan = {};
    [...SEGS].sort((x, y) => perContact(y, a) - perContact(x, a)).forEach(s => {
      const n = perContact(s, a) > 0 ? Math.min(s.customers, Math.floor(left / a.cost)) : 0;
      plan[s.name] = n; left -= n * a.cost; profit += n * perContact(s, a);
    });
    return { plan, profit };
  }
  const slug = s => s.replace(/\W/g, "");
  SEGS.forEach(s => {
    const id = "seg" + slug(s.name), range = el("input", { type: "range", id, min: 0, max: 100, step: 5, value: share[s.name] });
    range.setAttribute("aria-label", `Share of ${s.name} to contact`);
    range.dataset.seg = s.name;
    range.oninput = () => { share[s.name] = +range.value; $("rResult").hidden = true; drawR(); };
    const head = el("div", {}, el("h3", { textContent: s.name }), el("small", { textContent: `${s.customers} people · ${s.recency} days since last order · ${euro(s.spend)} spent` }));
    $("rSegs").append(el("div", { className: "rrow" }, head, el("div", { className: "slider" }, range), el("span", { className: "m", id: "rv" + slug(s.name) })));
  });
  function drawR() {
    const a = A(); let contacts = 0, profit = 0;
    SEGS.forEach(s => {
      const n = Math.round(s.customers * share[s.name] / 100);
      contacts += n; profit += n * perContact(s, a);
      $("rv" + slug(s.name)).textContent = `${share[s.name]}% · ${n}`;
    });
    const spend = contacts * a.cost, over = spend > a.budget;
    $("rBudgetTop").textContent = a.budget.toLocaleString("en-GB");
    $("rBudgetOut").textContent = euro(a.budget); $("rCostOut").textContent = "€" + a.cost.toFixed(2);
    $("rMarginOut").textContent = Math.round(a.margin * 100) + "%"; $("rOrdersOut").textContent = a.orders;
    $("rUsed").textContent = `${euro(spend)} of ${euro(a.budget)}${over ? " · over budget" : ""}`;
    $("rTrack").style.transform = `scaleX(${Math.min(1, spend / a.budget)})`;
    $("rTrack").classList.toggle("over", over);
    $("rProfit").textContent = signedEuro(profit);
    $("rReveal").disabled = over;
    return { profit, a };
  }
  ["rBudget", "rCost", "rMargin", "rOrders"].forEach(id => $(id).oninput = () => { $("rResult").hidden = true; drawR(); });
  drawR();
  $("rReveal").onclick = () => {
    const { profit, a } = drawR(), best = bestPlan(a), r = $("rResult"), gap = best.profit - profit; r.replaceChildren();
    r.append(el("h3", { textContent: gap < 1 ? "You found the best plan." : `The data finds ${signedEuro(gap)} more.` }),
      el("p", { textContent: `Your plan earns ${signedEuro(profit)}. The best plan earns ${signedEuro(best.profit)} from the same budget.` }));
    const nets = SEGS.map(s => [s, perContact(s, a)]).sort((x, y) => y[1] - x[1]), max = Math.max(...nets.map(n => Math.abs(n[1])));
    const bars = el("div", { className: "pbars" });
    nets.forEach(([s, v]) => {
      const w = 50 * Math.abs(v) / max, mark = el("i", { className: v < 0 ? "neg" : "" });
      mark.style.cssText = v < 0 ? `right:50%;width:${w}%` : `left:50%;width:${w}%`;
      const row = el("div", { className: "prow" }, el("span", { textContent: s.name }), el("div", { className: "axis" }, mark), el("span", { className: "m", textContent: `${v < 0 ? "−" : ""}€${Math.abs(v).toFixed(2)}` }));
      row.onmousemove = e => showTip(e.clientX, e.clientY, `${(s.uplift * 100).toFixed(1)}% extra buyers. ${v < 0 ? "Loses" : "Earns"} €${Math.abs(v).toFixed(2)} per contact. The best plan contacts ${best.plan[s.name]}.`);
      row.onmouseleave = hideTip;
      bars.append(row);
    });
    r.append(el("p", { innerHTML: "<b>Profit per contact</b>" }), bars,
      el("p", { innerHTML: "<b>The analyst's habit:</b> measure who a campaign changes. Champions spend the most, yet they buy anyway, so an offer mostly pays for sales you already had." }));
    const use = el("button", { className: "tool", type: "button", textContent: "Apply the best plan" });
    use.onclick = () => {
      document.querySelectorAll("#rSegs input").forEach(i => { const s = SEGS.find(x => x.name === i.dataset.seg), v = Math.floor(100 * best.plan[s.name] / s.customers / 5) * 5; share[s.name] = v; i.value = v; });
      drawR();
    };
    r.append(el("div", { className: "vacts" }, use));
    reveal(r);
  };

  /* ---------- The live sheet: the first thing a visitor touches ---------- */
  const HERO = {
    active_with_past_termination: r => `left in ${r.termination_date.slice(0, 4)}. still active??`,
    invalid_email: () => "that's not an email", missing_cost_centre: () => "whose budget is this?",
    unknown_contract_type: () => "what contract is this?", future_hire_marked_active: () => "hasn't started yet!",
  };
  const COLS = [["employee_id", "Employee ID", 96], ["name", "Name", 160], ["cost_centre", "Cost centre", 96], ["contract_type", "Contract", 112], ["hire_date", "Start date", 96], ["termination_date", "Leaving date", 104], ["employment_status", "Status", 120], ["work_email", "Work email", 214]];
  const sheet = { rows: sample.rows.map(r => ({ ...r })), cells: [], at: null, done: [] };
  const perPerson = {}; heroRun.issues.forEach(i => perPerson[i.employee_id] = (perPerson[i.employee_id] || 0) + 1);
  const managers = new Set(sample.rows.map(r => (r.manager_id || "").trim()));
  const seenId = {}; sample.rows.forEach(r => { const k = (r.employee_id || "").trim(); seenId[k] = (seenId[k] || 0) + 1; });
  Object.keys(HERO).forEach(rule => {
    const hit = heroRun.issues.find(i => i.rule_id === rule && perPerson[i.employee_id] === 1 && seenId[i.employee_id] === 1 && !managers.has(i.employee_id));
    if (hit) { const index = sheet.rows.findIndex(r => r.employee_id.trim() === hit.employee_id); sheet.cells.push({ issue: hit, index, field: FIX[rule], to: suggest(hit, sheet.rows[index]), fixed: false }); }
  });
  const flagged = new Map(sheet.cells.map(c => [c.index, c]));
  const isClean = i => i < sheet.rows.length && !perPerson[(sheet.rows[i].employee_id || "").trim()];
  const keep = new Set(flagged.keys());
  for (const step of [1, 2]) [...flagged.keys()].forEach(i => { if (keep.size < 11 && isClean(i + step)) keep.add(i + step); });
  const shown = [...keep].sort((a, b) => a - b);
  const grid = $("fGrid"), letters = "ABCDEFGHIJ";
  grid.classList.add(calm ? "still" : "loading");
  const colgroup = el("colgroup", {}, el("col", { style: "width:46px" }), ...COLS.map(c => { const n = el("col"); n.style.width = c[2] + "px"; return n; }), el("col", { style: "width:230px" }));
  const letterRow = el("tr", {}, el("td", { className: "corner" }), ...[...COLS, ["", ""]].map((c, i) => el("th", { textContent: letters[i] })));
  const nameRow = el("tr", {}, el("th", { className: "rn", textContent: "1" }), ...COLS.map(c => el("th", { textContent: c[1], scope: "col" })), el("th", {}, el("span", { className: "skip-sr", textContent: "Notes" })));
  const tbody = el("tbody");
  const cellValue = (r, key) => key === "name" ? `${r.first_name} ${r.last_name}` : r[key] || "";
  let order = 0;
  shown.forEach(index => {
    const r = sheet.rows[index], flag = flagged.get(index), tr = el("tr", {}, el("th", { className: "rn", scope: "row", textContent: index + 2 }));
    COLS.forEach(([key], ci) => {
      const td = el("td");
      if (flag && flag.field === key) {
        const v = r[key] || "", btn = el("button", { type: "button", className: "cellbtn" + (v ? "" : " empty") }, el("i", { className: "hl" }), el("span", { className: "v", textContent: v || "blank" }));
        btn.setAttribute("aria-label", `Row ${index + 2}, ${COLS[ci][1]}: ${v || "blank"}. ${flag.issue.title}`);
        btn.setAttribute("aria-pressed", "false");
        btn.style.setProperty("--i", order); btn.onclick = e => { pickCell(flag); if (!e.detail && !flag.fixed) $("fFix").focus({ preventScroll: true }); };
        Object.assign(flag, { btn, ref: letters[ci] + (index + 2), order, was: v }); td.append(btn);
      } else td.append(el("span", { textContent: cellValue(r, key) }));
      tr.append(td);
    });
    const note = el("td", { className: "note" }, flag ? el("span", { className: "strike", textContent: HERO[flag.issue.rule_id](r) }) : "");
    if (flag) { note.style.setProperty("--i", order++); flag.note = note; }
    tr.append(note); tbody.append(tr);
  });
  grid.append(colgroup, el("thead", {}, letterRow, nameRow), tbody);
  if (!calm) requestAnimationFrame(() => requestAnimationFrame(() => { grid.classList.remove("loading"); grid.classList.add("drawn"); }));
  sheet.cells.sort((a, b) => a.index - b.index);
  const sheetRun = () => E.check(sheet.rows, sample.head, P.params, P.rules);
  function sheetCount() {
    const run = sheetRun(), bad = new Set(run.issues.map(i => i.employee_id)).size, left = sheet.cells.filter(c => !c.fixed).length;
    $("fCount").textContent = `${left} of ${sheet.cells.length} left on this screen. Whole file: ${bad} of ${run.data.dim.length} records still wrong.`;
    $("fDots").replaceChildren(...sheet.cells.map(c => el("i", { className: c.fixed ? "on" : "" })));
    $("fUndo").hidden = !sheet.done.length;
    return bad;
  }
  function pickCell(c) {
    sheet.at = c; sheet.cells.forEach(x => x.btn.setAttribute("aria-pressed", String(x === c)));
    $("fName").textContent = c.ref; $("fText").textContent = c.issue.detail;
    $("fWhy").textContent = c.issue.why;
    const b = $("fFix"); b.hidden = c.fixed; b.textContent = `Correct it to ${c.to}`;
    const box = grid.parentElement, cell = c.btn.getBoundingClientRect(), view = box.getBoundingClientRect();
    if (cell.left < view.left + 46 || cell.right > view.right) box.scrollTo({ left: box.scrollLeft + cell.left - view.left - 60, behavior: calm ? "auto" : "smooth" });
  }
  function sheetFinished(bad) {
    sheet.cells.forEach(x => x.btn.setAttribute("aria-pressed", "false")); sheet.at = null;
    $("fName").textContent = "A1"; $("fText").textContent = `All ${sheet.cells.length} corrected. Every rule reran each time.`;
    $("fWhy").textContent = `${bad} more records in this file have the same kind of problem. No person should have to do those by hand.`;
    const go = $("fFix"); go.hidden = false; go.textContent = "See what a machine does with them";
  }
  $("fFix").onclick = () => {
    const c = sheet.at;
    if (!c) { $("story").scrollIntoView({ behavior: calm ? "auto" : "smooth" }); return; }
    if (c.fixed) return;
    sheet.rows[c.index][c.field] = c.to; c.fixed = true; sheet.done.push(c);
    c.btn.classList.add("fixed"); c.btn.classList.remove("empty"); c.btn.querySelector(".v").textContent = c.to; c.btn.setAttribute("aria-label", `Corrected to ${c.to}`); c.note.classList.add("done");
    const bad = sheetCount(), next = sheet.cells.find(x => !x.fixed);
    drawDash();
    if (next) { pickCell(next); $("fFix").focus({ preventScroll: true }); } else sheetFinished(bad);
  };
  $("fUndo").onclick = () => {
    const c = sheet.done.pop(); if (!c) return;
    sheet.rows[c.index][c.field] = c.was; c.fixed = false;
    c.btn.classList.remove("fixed"); c.btn.classList.toggle("empty", !c.was); c.btn.querySelector(".v").textContent = c.was || "blank"; c.note.classList.remove("done");
    sheetCount(); drawDash(); pickCell(c);
  };
  grid.parentElement.addEventListener("keydown", e => {
    const move = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key]; if (!move) return;
    e.preventDefault(); const list = sheet.cells.filter(c => !c.fixed); if (!list.length) return;
    const at = list.indexOf(sheet.at), next = list[(at + move + list.length) % list.length]; pickCell(next); next.btn.focus({ preventScroll: true });
  });
  $("hRules").textContent = P.rules.length;
  sheetCount(); if (sheet.cells.length) pickCell(sheet.cells[0]);

  /* ---------- Printable summary of whatever file is loaded ---------- */
  $("wPrint").onclick = () => {
    const { issues, data } = W.result, tally = new Map();
    issues.forEach(i => tally.set(i.title, (tally.get(i.title) || 0) + 1));
    const affected = new Set(issues.map(i => i.employee_id)).size, total = data.dim.length || 1, out = $("printout");
    const table = el("table", {}, el("tr", {}, el("th", { textContent: "Problem" }), el("th", { className: "n", textContent: "Records" })),
      ...[...tally].sort((a, b) => b[1] - a[1]).slice(0, 15).map(([t, n]) => el("tr", {}, el("td", { textContent: t }), el("td", { className: "n", textContent: n }))));
    out.replaceChildren(el("h1", { textContent: "HR file check" }),
      el("p", { textContent: `${W.fileName.replace(/_cleaned\.csv$/, ".csv")}, checked ${new Date().toLocaleDateString("en-GB")} as of ${W.params.asOf}.` }),
      el("p", { textContent: `${total.toLocaleString("en-GB")} records, ${affected.toLocaleString("en-GB")} with at least one problem, ${issues.length.toLocaleString("en-GB")} problems in all. ${(100 * (total - affected) / total).toFixed(1)}% clean.` }),
      table, el("p", { textContent: "Checked in the browser. The file was never uploaded. Tool by Lamin Beyai, mlfbeyai@outlook.com" }));
    print();
  };

  /* ---------- What the report costs ---------- */
  const PRICED = !!$("cPayback");
  function drawCost() {
    const h = +$("cHours").value, rate = +$("cRate").value, s = +$("cShare").value / 100, year = h * 12 * rate, save = year * s, days = Math.round(h * 12 / 7);
    $("cHoursOut").textContent = h + " h"; $("cRateOut").textContent = "€" + rate; $("cShareOut").textContent = Math.round(s * 100) + "%";
    $("cDays").textContent = `${days} working days`; countTo($("cYear"), year, euro, 260); countTo($("cSave"), save, euro, 260);
    if (PRICED) { const m = 2800 / (save / 12); $("cPayback").innerHTML = ""; $("cPayback").append(el("span", { textContent: "Audit and sprint pay back in" }), el("b", { textContent: m < 1 ? "under a month" : `about ${Math.ceil(m)} months` })); }
    const name = $("cName").value.trim() || "A report";
    const body = `Hi Lamin,\n\nReport: ${name}\nHours each month: ${h}\nCost of an hour: €${rate}\nShare that could run by itself: ${Math.round(s * 100)}%\nThat comes to about ${euro(save)} a year.\n\nCan we talk for 15 minutes?\n`;
    $("cSend").href = `mailto:mlfbeyai@outlook.com?subject=${encodeURIComponent(name + ": can this be automated?")}&body=${encodeURIComponent(body)}`;
  }
  ["cHours", "cRate", "cShare", "cName"].forEach(id => $(id).oninput = drawCost);
  drawCost();

  $("copyMail").onclick = async e => {
    const b = e.currentTarget, was = "Copy mlfbeyai@outlook.com";
    try { await navigator.clipboard.writeText("mlfbeyai@outlook.com"); b.textContent = "Copied"; }
    catch { b.textContent = "mlfbeyai@outlook.com"; }
    setTimeout(() => b.textContent = was, 2200);
  };

  /* ---------- A personal page, from a link: ?for=Company&n=Name ---------- */
  (function personal() {
    const q = new URLSearchParams(location.search), safe = v => { const t = (v || "").trim(); return /^[\p{L}\p{N} &.'’-]{1,40}$/u.test(t) ? t : ""; };
    const who = safe(q.get("for")), name = safe(q.get("n"));
    if (!who) return;
    document.querySelector("h1").textContent = `Someone at ${who} checks this by hand every month.`;
    document.title = `For ${who}: Lamin Beyai`;
    if (name) document.querySelector(".herohead").before(el("p", { className: "page forwho", textContent: `${name}, I made this for you. Try the yellow cells.` }));
    document.querySelector(".tab").textContent = who.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "_") + "_hr_extract.csv";
    document.querySelector(".heronote").prepend(`This is not ${who}'s data. `);
    $("mailMe").href = `mailto:mlfbeyai@outlook.com?subject=${encodeURIComponent(who + ": a report that takes too long")}`;
  })();

  /* ---------- The scroll story: every record, sorted, fixed, rebuilt ---------- */
  const storyCanvas = $("storyCanvas"), sctx = storyCanvas.getContext("2d");
  $("sN").textContent = heroRun.data.dim.length; $("sR").textContent = P.rules.length;
  const worst = new Map(); heroRun.issues.forEach(i => { if (!worst.has(i.employee_id) || rank[i.severity] > rank[worst.get(i.employee_id)]) worst.set(i.employee_id, i.severity); });
  const marks = heroRun.data.dim.map(r => ({ dept: r.dept || "Unassigned", active: r.status === "Active", sev: worst.get(r.id) || null, seed: (r.id.charCodeAt(5) * 37 + r.id.charCodeAt(4) * 11) % 100 / 100 }));
  const RGB = { clean: [255, 255, 255, .42], bad: [255, 232, 61, 1], critical: [255, 107, 94, 1], fixed: [150, 170, 255, 1], gone: [255, 255, 255, .05] };
  const startColour = m => m.sev === "critical" ? RGB.critical : m.sev ? RGB.bad : RGB.clean;
  let stages = [], labels = [], sw = 0, sh = 0, sp = 0;
  function layoutStory() {
    const dpr = devicePixelRatio || 1; sw = storyCanvas.clientWidth; sh = storyCanvas.clientHeight; if (!sw || !sh) return;
    storyCanvas.width = sw * dpr; storyCanvas.height = sh * dpr; sctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const small = sw < 520, n = marks.length, cell = Math.floor(Math.sqrt(sw * sh * .8 / n)), cols = Math.floor(sw / cell), ox = (sw - cols * cell) / 2, oy = (sh - Math.ceil(n / cols) * cell) / 2;
    const home = marks.map((m, i) => [ox + (i % cols) * cell, oy + Math.floor(i / cols) * cell]);
    const c2 = Math.max(4, Math.floor(cell * .72)), groups = [["critical", "Critical"], ["high", "High"], ["medium", "Medium"]], top = small ? 44 : 34, gw = sw / 5.2, sorted = new Array(n), l1 = [];
    const cleanCols = Math.floor(sw * .4 / c2); let k = 0;
    marks.forEach((m, i) => { if (!m.sev) { sorted[i] = [(k % cleanCols) * c2, top + Math.floor(k / cleanCols) * c2]; k++; } });
    if (small) l1.push({ text: "Clean", x: 0, y: 14 }, { text: String(k), x: 0, y: 32 }); else l1.push({ text: `Clean ${k}`, x: 0, y: 20 });
    groups.forEach(([sev, name], g) => {
      const x0 = sw * .46 + g * gw, per = Math.max(1, Math.floor((gw - 10) / c2)); let j = 0;
      marks.forEach((m, i) => { if (m.sev === sev) { sorted[i] = [x0 + (j % per) * c2, top + Math.floor(j / per) * c2]; j++; } });
      if (small) l1.push({ text: name, x: x0, y: 14 }, { text: String(j), x: x0, y: 32 }); else l1.push({ text: `${name} ${j}`, x: x0, y: 20 });
    });
    const depts = [...new Set(marks.filter(m => m.active).map(m => m.dept))].sort((a, b) => marks.filter(m => m.active && m.dept === b).length - marks.filter(m => m.active && m.dept === a).length);
    const rowH = (sh - 10) / depts.length, labelW = small ? 118 : 136, maxN = Math.max(...depts.map(d => marks.filter(m => m.active && m.dept === d).length));
    const barW = sw - labelW - 44, c3 = Math.max(3, Math.floor(Math.sqrt(barW * rowH * .66 / maxN))), rowsPer = Math.max(1, Math.ceil(maxN * c3 / barW)), bars = new Array(n), l3 = [];
    depts.forEach((d, r) => {
      let j = 0; marks.forEach((m, i) => { if (m.active && m.dept === d) { bars[i] = [labelW + Math.floor(j / rowsPer) * c3, r * rowH + (rowH - rowsPer * c3) / 2 + (j % rowsPer) * c3]; j++; } });
      l3.push({ text: d, x: 0, y: r * rowH + rowH / 2 + 4 }, { text: String(j), x: labelW + Math.ceil(j / rowsPer) * c3 + 8, y: r * rowH + rowH / 2 + 4 });
    });
    marks.forEach((m, i) => { if (!bars[i]) bars[i] = home[i]; });
    stages = [{ pos: home, size: cell * .78, colour: startColour }, { pos: sorted, size: c2 * .8, colour: startColour }, { pos: home, size: cell * .78, colour: m => m.sev ? RGB.fixed : RGB.clean }, { pos: bars, size: c3 * .84, colour: m => m.active ? RGB.fixed : RGB.gone }];
    labels = [[], l1, [], l3]; drawStory();
  }
  const smooth = t => t * t * (3 - 2 * t);
  function drawStory() {
    if (!stages.length) return;
    sctx.clearRect(0, 0, sw, sh);
    const a = Math.min(2, Math.floor(sp)), b = a + 1, raw = sp - a, A = stages[a], B = stages[b];
    marks.forEach((m, i) => {
      const t = smooth(Math.max(0, Math.min(1, raw * 1.5 - m.seed * .5))), ca = A.colour(m), cb = B.colour(m), mix = q => ca[q] + (cb[q] - ca[q]) * t, size = A.size + (B.size - A.size) * t;
      sctx.fillStyle = `rgba(${mix(0) | 0},${mix(1) | 0},${mix(2) | 0},${mix(3)})`;
      sctx.fillRect(A.pos[i][0] + (B.pos[i][0] - A.pos[i][0]) * t, A.pos[i][1] + (B.pos[i][1] - A.pos[i][1]) * t, size, size);
    });
    sctx.font = `600 ${sw < 520 ? 12 : 14}px Franklin, Arial, sans-serif`;
    labels.forEach((list, s) => { const on = Math.max(0, 1 - Math.abs(sp - s) * 3.2); if (on) { sctx.fillStyle = `rgba(255,255,255,${on})`; list.forEach(l => sctx.fillText(l.text, l.x, l.y)); } });
  }
  const stepsEls = [...document.querySelectorAll(".sstep")];
  let storyTarget = 0, storyLive = false;
  function storyTick() {
    const d = storyTarget - sp;
    if (Math.abs(d) < .0015) { sp = storyTarget; drawStory(); storyLive = false; return; }
    sp += d * .11; drawStory(); requestAnimationFrame(storyTick);
  }
  function storyScroll() {
    const line = innerHeight * .55, tops = stepsEls.map(e => { const r = e.getBoundingClientRect(); return r.top + r.height / 2; });
    let p = 0;
    if (line >= tops[3]) p = 3; else if (line > tops[0]) { const i = tops.findIndex((t, k) => line >= t && line < tops[k + 1]); p = i + (line - tops[i]) / (tops[i + 1] - tops[i]); }
    stepsEls.forEach((e, i) => e.classList.toggle("on", Math.round(p) === i));
    if (calm) { sp = storyTarget = Math.round(p); drawStory(); return; }
    storyTarget = p; if (!storyLive && Math.abs(p - sp) > .0015) { storyLive = true; requestAnimationFrame(storyTick); }
  }
  let storyQueued = false; const prog = $("navProg");
  addEventListener("scroll", () => { if (!storyQueued) { storyQueued = true; requestAnimationFrame(() => { storyQueued = false; storyScroll(); prog.style.transform = `scaleX(${scrollY / (document.documentElement.scrollHeight - innerHeight || 1)})`; }); } }, { passive: true });
  const navLinks = [...document.querySelectorAll(".links a")];
  const spy = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) navLinks.forEach(a => a.setAttribute("aria-current", String(a.hash === "#" + e.target.id))); }), { rootMargin: "-45% 0px -50% 0px" });
  ["work", "entry-2", "cost", "how", "hiring", "story", "dash", "contact"].forEach(id => spy.observe($(id)));
  const later = f => (window.requestIdleCallback || (g => setTimeout(g, 200)))(f, { timeout: 1500 });
  later(() => { new ResizeObserver(layoutStory).observe(storyCanvas); document.fonts?.ready.then(drawStory); layoutStory(); storyScroll(); });

  /* ---------- The dashboard, computed from the sheet as it stands ---------- */
  const D = { mode: "raw", dept: "", country: "" }, asOf = P.params.asOf;
  const monthEnds = Array.from({ length: 24 }, (_, i) => { const d = new Date(Date.UTC(+asOf.slice(0, 4), +asOf.slice(5, 7) - 23 + i, 0)); return d.toISOString().slice(0, 10); });
  function people(mode) {
    const staged = E.stage(sheet.rows).all.map((p, i) => ({ ...p, country: sheet.rows[i].country }));
    if (mode === "raw") return staged;
    const ids = new Set(), persons = new Set();
    return staged.filter(p => { const key = `${p.first}|${p.last}|${p.dob}`; if (!p.id || ids.has(p.id) || (p.dob && persons.has(key))) return false; ids.add(p.id); persons.add(key); return true; });
  }
  const here = (p, d, mode) => p.hire && p.hire <= d && (mode === "raw" ? p.status === "Active" || !p.term || p.term > d : !p.term || p.term > d);
  function stats(mode) {
    const list = people(mode).filter(p => (!D.dept || p.dept === D.dept) && (!D.country || p.country === D.country));
    const line = monthEnds.map(d => list.filter(p => here(p, d, mode)).length), start = monthEnds[11];
    const inMonth = (v, i) => v && v.slice(0, 7) === monthEnds[i].slice(0, 7);
    const flow = monthEnds.map((_, i) => ({ j: list.filter(p => inMonth(p.hire, i)).length, l: list.filter(p => inMonth(p.term, i)).length }));
    const year = flow.slice(12), joiners = year.reduce((s, f) => s + f.j, 0), leavers = year.reduce((s, f) => s + f.l, 0), avg = line.slice(12).reduce((s, v) => s + v, 0) / 12 || 1;
    const now = list.filter(p => here(p, asOf, mode)), tenure = now.reduce((s, p) => s + (Date.parse(asOf) - Date.parse(p.hire)) / 31557600000, 0) / (now.length || 1);
    return { line, flow, joiners, leavers, turnover: 100 * leavers / avg, tenure, headcount: line[23], now, start };
  }
  const niceStep = span => { const m = 10 ** Math.floor(Math.log10(Math.max(span, 1) / 4)), r = span / 4 / m; return Math.max(1, (r <= 1 ? 1 : r <= 2 ? 2 : r <= 5 ? 5 : 10) * m); };
  function drawLine(s) {
    const W = 680, H = 230, L = 38, R = 44, T = 12, B = 24, top = Math.max(...s.line, 1), low = Math.min(...s.line), step = niceStep(Math.max(top - low, 4)), lo = Math.floor(low / step) * step, hi = Math.ceil(top / step) * step, x = i => L + i * (W - L - R) / 23, y = v => H - B - (v - lo) * (H - T - B) / (hi - lo || 1);
    const values = []; for (let v = lo; v <= hi; v += step) values.push(v);
    const ticks = values.map(v => `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="#e4e7ec"/><text x="${L - 6}" y="${y(v) + 4}" text-anchor="end">${v}</text>`).join("");
    const months = [0, 6, 12, 18, 23].map(i => `<text x="${x(i)}" y="${H - 6}" text-anchor="middle">${monthEnds[i].slice(0, 7)}</text>`).join("");
    const path = s.line.map((v, i) => (i ? "L" : "M") + x(i).toFixed(1) + " " + y(v).toFixed(1)).join("");
    $("dLine").innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Headcount over 24 months, ending at ${s.headcount}">${ticks}${months}<path d="${path}" fill="none" stroke="#1f3bb3" stroke-width="2.5" stroke-linejoin="round"/><circle cx="${x(23)}" cy="${y(s.line[23])}" r="4" fill="#1f3bb3"/><text x="${x(23) + 8}" y="${y(s.line[23]) + 5}" style="font-weight:700;fill:#15171c">${Math.round(s.line[23])}</text><line id="dCross" y1="${T}" y2="${H - B}" stroke="#15171c" visibility="hidden"/></svg>`;
    const svg = $("dLine").firstChild, cross = svg.querySelector("#dCross");
    const peek = e => { const b = svg.getBoundingClientRect(), i = Math.max(0, Math.min(23, Math.round(((e.clientX - b.left) * W / b.width - L) / ((W - L - R) / 23)))); cross.setAttribute("x1", x(i)); cross.setAttribute("x2", x(i)); cross.setAttribute("visibility", "visible"); showTip(e.clientX, e.clientY, `${monthEnds[i].slice(0, 7)}: ${Math.round(s.line[i])} people`); };
    svg.onpointermove = peek; svg.onpointerdown = peek; svg.onpointerleave = () => { cross.setAttribute("visibility", "hidden"); hideTip(); };
  }
  function drawFlow(s) {
    const W = 1060, H = 170, L = 30, B = 22, mid = 84, max = Math.max(...s.flow.flatMap(f => [f.j, f.l]), 1), bw = (W - L) / 24, sc = (mid - 10) / max;
    const bars = s.flow.map((f, i) => { const x = L + i * bw + 3; return `<rect data-i="${i}" x="${x}" y="${mid - f.j * sc}" width="${bw - 6}" height="${Math.max(f.j * sc, f.j ? 1 : 0)}" fill="#1f3bb3"/><rect data-i="${i}" x="${x}" y="${mid + 1}" width="${bw - 6}" height="${Math.max(f.l * sc, f.l ? 1 : 0)}" fill="#c9281d"/><rect data-i="${i}" x="${L + i * bw}" y="0" width="${bw}" height="${H - B}" fill="transparent"/>`; }).join("");
    const months = [0, 6, 12, 18, 23].map(i => `<text x="${L + (i + .5) * bw}" y="${H - 5}" text-anchor="middle">${monthEnds[i].slice(0, 7)}</text>`).join("");
    $("dFlow").innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Joiners and leavers by month"><line x1="${L}" x2="${W}" y1="${mid}" y2="${mid}" stroke="#8a90a0"/>${bars}${months}</svg>`;
    const svg = $("dFlow").firstChild, peek = e => { const i = e.target.dataset?.i; if (i != null) showTip(e.clientX, e.clientY, `${monthEnds[i].slice(0, 7)}: ${Math.round(s.flow[i].j)} joined, ${Math.round(s.flow[i].l)} left`); else hideTip(); };
    svg.onpointermove = peek; svg.onpointerdown = peek; svg.onpointerleave = hideTip;
  }
  const barNodes = new Map();
  function drawBars(mode) {
    const pool = people(mode).filter(p => (!D.country || p.country === D.country) && here(p, asOf, mode)), n = {};
    pool.forEach(p => { const k = p.dept || "Unassigned"; n[k] = (n[k] || 0) + 1; });
    const list = Object.entries(n).sort((a, b) => b[1] - a[1]), max = list[0]?.[1] || 1, box = $("dBars");
    list.forEach(([d, v]) => {
      let b = barNodes.get(d);
      if (!b) { const fill = el("i"), num = el("em"); b = el("button", { type: "button", className: "dbar" }, el("span", { textContent: d }), el("span", {}, fill), num); b.fill = fill; b.num = num; b.onclick = () => { D.dept = D.dept === d ? "" : d; drawDash(); }; barNodes.set(d, b); }
      b.fill.style.transform = `scaleX(${v / max})`; countTo(b.num, v, x => String(Math.round(x)), 380);
      b.classList.toggle("dim", !!D.dept && D.dept !== d); b.setAttribute("aria-pressed", String(D.dept === d)); box.append(b);
    });
    barNodes.forEach((b, d) => { if (!n[d]) b.remove(); });
  }
  const kpis = [["headcount"], ["joiners, 12 months"], ["leavers, 12 months"], ["turnover, 12 months"], ["average tenure"]].map(([t]) => { const b = el("b", { textContent: "0" }); $("dKpis").append(el("div", { className: "kpi" }, b, el("span", { textContent: t }))); return b; });
  let dashNow = null, morphId = 0;
  function morph(s) {
    const id = ++morphId, from = dashNow;
    if (calm || !from) { dashNow = s; drawLine(s); drawFlow(s); return; }
    const t0 = performance.now(), mix = (a, b, e) => a + (b - a) * e;
    (function step(t) {
      if (id !== morphId) return;
      const p = Math.max(0, Math.min(1, (t - t0) / 460)), e = 1 - Math.pow(1 - p, 4);
      dashNow = { ...s, line: s.line.map((v, i) => mix(from.line[i], v, e)), flow: s.flow.map((f, i) => ({ j: mix(from.flow[i].j, f.j, e), l: mix(from.flow[i].l, f.l, e) })) };
      drawLine(dashNow); drawFlow(dashNow);
      if (p < 1) requestAnimationFrame(step); else { dashNow = s; drawLine(s); drawFlow(s); }
    })(t0);
  }
  function gapRecords() {
    const seenIds = new Set(), persons = new Set(), out = [];
    E.stage(sheet.rows).all.forEach((p, i) => {
      const country = sheet.rows[i].country, key = `${p.first}|${p.last}|${p.dob}`, dupId = !p.id || seenIds.has(p.id), dupPerson = !dupId && p.dob && persons.has(key), kept = !dupId && !dupPerson;
      if (kept) { seenIds.add(p.id); persons.add(key); }
      if ((D.dept && p.dept !== D.dept) || (D.country && country !== D.country) || !here(p, asOf, "raw")) return;
      const why = dupId ? "Second row for the same employee ID" : dupPerson ? "Same person under a second ID" : !here(p, asOf, "clean") ? `Still marked active, left on ${p.term}` : null;
      if (why) out.push({ id: p.id, name: `${sheet.rows[i].first_name} ${sheet.rows[i].last_name}`, why });
    });
    return out;
  }
  function showWhy(open) {
    const box = $("dWhyList"), b = $("dWhy"); b.setAttribute("aria-expanded", String(open)); b.textContent = open ? "Hide the records" : "Show me which records"; box.hidden = !open;
    if (!open) return;
    box.replaceChildren(...gapRecords().map(r => { const row = el("button", { type: "button", className: "whyrow" }, el("span", { textContent: r.id }), el("span", { textContent: r.name }), el("span", { textContent: r.why }), el("em", { textContent: "Open it" })); row.onclick = () => openRecord(r.id); return row; }));
  }
  function openRecord(id) {
    $("wSev").value = ""; $("wRule").value = ""; drawW();
    const at = W.list.findIndex(i => i.employee_id === id);
    if (at >= 0) { W.pos = at; drawFocus(); say(`Opened ${id}.`); } else say(`${id} passes every rule in the workbench now.`);
    $("entry-2").scrollIntoView({ behavior: calm ? "auto" : "smooth" });
  }
  $("dWhy").onclick = () => showWhy($("dWhy").getAttribute("aria-expanded") !== "true");
  function drawDash() {
    const s = stats(D.mode), raw = stats("raw"), clean = stats("clean"), gap = raw.headcount - clean.headcount;
    const whole = v => String(Math.round(v)), one = u => v => v.toFixed(1) + u;
    [[s.headcount, whole], [s.joiners, whole], [s.leavers, whole], [s.turnover, one("%")], [s.tenure, one(" yrs")]].forEach(([v, f], i) => countTo(kpis[i], v, f));
    $("dDelta").textContent = gap ? `The raw export ${gap > 0 ? "overstates" : "understates"} headcount by ${Math.abs(gap)}` : "Raw and checked headcount agree here";
    $("dWhy").hidden = !gap; if (!gap) showWhy(false); else if ($("dWhy").getAttribute("aria-expanded") === "true") showWhy(true);
    morph(s); drawBars(D.mode);
    $("dAll").hidden = !D.dept;
    const t = el("table", {}, el("tr", {}, ...["Month", "Headcount", "Joiners", "Leavers"].map(h => el("th", { textContent: h }))), ...monthEnds.map((m, i) => el("tr", {}, ...[m.slice(0, 7), s.line[i], s.flow[i].j, s.flow[i].l].map(v => el("td", { textContent: v })))));
    $("dTable").replaceChildren(t);
  }
  const setMode = m => { D.mode = m; $("dRaw").setAttribute("aria-pressed", String(m === "raw")); $("dClean").setAttribute("aria-pressed", String(m === "clean")); drawDash(); };
  $("dRaw").onclick = () => setMode("raw"); $("dClean").onclick = () => setMode("clean");
  $("dAll").onclick = () => { D.dept = ""; drawDash(); };
  [...new Set(sample.rows.map(r => r.country).filter(Boolean))].sort().forEach(c => $("dCountry").append(el("option", { value: c, textContent: c })));
  $("dCountry").onchange = e => { D.country = e.target.value; drawDash(); };
  later(drawDash);

  /* ---------- SMD assignments ---------- */
  const JOBS = [[2024, "Gender-integrated climate risk analysis, RICAR project", "WFP, UN Women, FAO", "Analysis"], [2024, "UNDP outcome evaluation, governance response", "UNDP", "Evaluation"], [2024, "Ecosystem-based adaptation exit and sustainability strategy", "Framework and roadmap", "Strategy"], [2024, "Financial literacy and inclusion baseline for women and youth", "NACCUG, DSIK", "Baseline"], [2023, "Youth empowerment through TVET evaluation", "UNESCO, KOICA", "Evaluation"], [2023, "Youth skills and volunteering assessment, Banjul", "UNDP, ILO, UNV", "Analysis"], [2022, "Rural integrated climate adaptation baseline", "WFP", "Baseline"], [2022, "Performance management system enhancement", "Social Security and Housing Finance Corporation", "Strategy"], [2022, "Strategic plan development 2021 to 2025", "National Human Rights Commission", "Strategy"], [2022, "Cross-border resilience and cohesion baseline", "IOM, FAO", "Baseline"]];
  function drawJobs(kind) {
    $("aList").replaceChildren(...JOBS.filter(j => !kind || j[3] === kind).map(j => el("li", {}, el("b", { textContent: j[0] }), el("span", {}, j[1], el("small", { textContent: j[2] })))));
    [...$("aFilter").children].forEach(b => b.setAttribute("aria-pressed", String(b.dataset.k === kind)));
  }
  ["", "Evaluation", "Baseline", "Analysis", "Strategy"].forEach(k => { const b = el("button", { type: "button", textContent: k || "All" }); b.dataset.k = k; b.onclick = () => drawJobs(k); $("aFilter").append(b); });
  drawJobs("");

  /* ---------- K-means you can watch ---------- */
  (function cluster() {
    const c = $("kCanvas"), x = c.getContext("2d"), hue = ["#1f3bb3", "#c9281d", "#107c41", "#15171c"], shapes = 4;
    let seed = 7; const rnd = () => (seed = seed * 16807 % 2147483647) / 2147483647, gauss = () => (rnd() + rnd() + rnd() - 1.5) / 1.5;
    const pts = []; P.winback.segments.forEach((s, g) => { const R = P.winback.segments.map(v => v.recency), Sp = P.winback.segments.map(v => Math.log10(v.spend + 10)), cx = .16 + .68 * (s.recency - Math.min(...R)) / (Math.max(...R) - Math.min(...R)), cy = .16 + .68 * (Math.log10(s.spend + 10) - Math.min(...Sp)) / (Math.max(...Sp) - Math.min(...Sp)); for (let i = 0; i < 55; i++) pts.push({ x: Math.min(.98, Math.max(.02, cx + gauss() * .11)), y: Math.min(.98, Math.max(.02, cy + gauss() * .09)), k: 0 }); });
    let cen = [], timer = null, iter = 0;
    function draw() {
      const dpr = devicePixelRatio || 1, w = c.clientWidth, h = c.clientHeight; c.width = w * dpr; c.height = h * dpr; x.setTransform(dpr, 0, 0, dpr, 0, 0);
      x.font = "13px Franklin, Arial, sans-serif"; x.fillStyle = "#4a5060"; x.fillText("Days since last order", w - 136, h - 8); x.fillText("Spend", 8, 16);
      pts.forEach(p => { x.fillStyle = hue[p.k]; const X = p.x * w, Y = h - p.y * h; if (p.k % 2) x.fillRect(X - 3, Y - 3, 6, 6); else { x.beginPath(); x.arc(X, Y, 3.3, 0, 7); x.fill(); } });
      cen.forEach((q, i) => { const X = q.x * w, Y = h - q.y * h; x.strokeStyle = "#fff"; x.lineWidth = 5; x.beginPath(); x.moveTo(X - 8, Y - 8); x.lineTo(X + 8, Y + 8); x.moveTo(X + 8, Y - 8); x.lineTo(X - 8, Y + 8); x.stroke(); x.strokeStyle = hue[i]; x.lineWidth = 2.5; x.stroke(); });
    }
    function step() {
      let moved = 0;
      pts.forEach(p => { let best = 0, d = 9; cen.forEach((q, i) => { const e = (p.x - q.x) ** 2 + (p.y - q.y) ** 2; if (e < d) { d = e; best = i; } }); p.k = best; });
      cen.forEach((q, i) => { const m = pts.filter(p => p.k === i); if (!m.length) return; const nx = m.reduce((s, p) => s + p.x, 0) / m.length, ny = m.reduce((s, p) => s + p.y, 0) / m.length; moved += Math.abs(nx - q.x) + Math.abs(ny - q.y); q.x = nx; q.y = ny; });
      iter++; draw(); $("kNote").textContent = moved < .001 ? `Settled after ${iter} rounds. Fictional customers.` : `Round ${iter}`;
      return moved >= .001 && iter < 30;
    }
    function run() {
      clearInterval(timer); iter = 0; cen = [{ ...pts[Math.floor(rnd() * pts.length)] }];
      while (cen.length < shapes) { let far = pts[0], gap = -1; pts.forEach(p => { const d = Math.min(...cen.map(q => (p.x - q.x) ** 2 + (p.y - q.y) ** 2)); if (d > gap) { gap = d; far = p; } }); cen.push({ ...far }); }
      if (calm) { while (step()); return; }
      timer = setInterval(() => { if (!step()) clearInterval(timer); }, 420);
    }
    $("kRun").onclick = run;
    new IntersectionObserver((e, o) => { if (e[0].isIntersecting) { run(); o.disconnect(); } }, { threshold: .4 }).observe(c);
    draw();
  })();

  /* ---------- Small finishes ---------- */
  const fillRange = r => r.style.setProperty("--p", 100 * (r.value - r.min) / (r.max - r.min) + "%");
  document.querySelectorAll("input[type=range]").forEach(r => { fillRange(r); r.addEventListener("input", () => fillRange(r)); });
  new IntersectionObserver((e, o) => { if (e[0].isIntersecting) { o.disconnect(); kpis.forEach(k => k._now = 0); const base = stats(D.mode), flat = Math.min(...base.line); dashNow = { ...base, line: base.line.map(() => flat), flow: base.flow.map(() => ({ j: 0, l: 0 })) }; drawDash(); } }, { threshold: .25 }).observe($("dKpis"));
  const big = document.querySelector(".count");
  if (big && !calm) new IntersectionObserver((e, o) => { if (e[0].isIntersecting) { o.disconnect(); big._now = 0; countTo(big, +big.dataset.to, v => String(Math.round(v)), 1100); } }, { threshold: 1 }).observe(big);
})();
