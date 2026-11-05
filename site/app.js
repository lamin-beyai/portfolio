(function () {
  const P = window.PORTFOLIO, E = window.HRDQ;
  const $ = id => document.getElementById(id);
  const el = (tag, props = {}, ...kids) => { const n = Object.assign(document.createElement(tag), props); n.append(...kids); return n; };
  const euro = n => "€" + Math.round(n).toLocaleString("en-GB");
  const signedEuro = n => (n < 0 ? "−€" : "€") + Math.abs(Math.round(n)).toLocaleString("en-GB");
  const hours = m => { const h = Math.floor(m / 60), r = m % 60; return r ? `${h}h ${r}m` : `${h}h`; };
  const tip = $("tip");
  const showTip = (e, text) => { tip.textContent = text; tip.style.display = "block"; tip.style.left = Math.max(8, Math.min(e.clientX + 12, innerWidth - tip.offsetWidth - 8)) + "px"; tip.style.top = Math.max(8, e.clientY - tip.offsetHeight - 10) + "px"; };
  const hideTip = () => tip.style.display = "none";
  const sample = E.parseCsv(P.sampleCsv);

  /* ---------- Challenge 1: payroll ---------- */
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
    const { issues, data } = E.check(sample.rows, sample.head, P.params, P.rules);
    const groups = new Map();
    issues.forEach(i => {
      const imp = IMPACT[i.rule_id], person = data.byId.get(i.employee_id), band = P.params.bands[person.level] || [40000, 60000];
      const sane = person.salary >= band[0] && person.salary <= band[1] ? person.salary : (band[0] + band[1]) / 2;
      const monthly = sane / 12;
      let risk = imp.flat || monthly * (imp.months || 0);
      if (imp.band) risk = monthly;
      const g = groups.get(i.rule_id) || { id: i.rule_id, title: i.title, severity: i.severity, count: 0, minutes: 0, risk: 0, why: i.why };
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

  const game = buildGame(), chosen = new Set();
  $("gIssues").textContent = game.issues;
  $("gHours").textContent = Math.round(game.totalMinutes / 60) + " hours";
  const used = () => game.list.filter(g => chosen.has(g.id)).reduce((s, g) => s + g.minutes, 0);
  const protectedRisk = set => game.list.filter(g => set.has(g.id)).reduce((s, g) => s + g.risk, 0);

  function drawGame() {
    const u = used();
    $("gTime").textContent = `${hours(u) === "0h" ? "0" : hours(u)} of 4h`;
    $("gTrack").style.width = 100 * u / BUDGET + "%";
    $("gTrackWrap").setAttribute("aria-valuenow", u);
    $("gGo").disabled = chosen.size === 0;
    game.list.forEach(g => {
      const box = $("opt-" + g.id), wrap = box.parentElement, blocked = !chosen.has(g.id) && u + g.minutes > BUDGET;
      box.disabled = blocked; wrap.classList.toggle("block-out", blocked);
    });
  }
  game.list.forEach(g => {
    const box = el("input", { type: "checkbox", id: "opt-" + g.id });
    box.onchange = () => { box.checked ? chosen.add(g.id) : chosen.delete(g.id); $("gResult").hidden = true; document.querySelectorAll(".opt.best").forEach(o => o.classList.remove("best")); drawGame(); };
    const text = el("span", {}, el("b", { textContent: g.title }), el("small", { textContent: `${g.count} ${g.count === 1 ? "record" : "records"} · ${hours(g.minutes).replace("0h ", "")} · ${euro(g.risk)} at risk` }));
    const label = el("label", { className: "opt" }, box, text);
    label.dataset.id = g.id;
    $("gList").append(label);
  });
  drawGame();

  $("gGo").onclick = () => {
    const mine = protectedRisk(chosen), share = mine / game.best;
    const critical = game.list.filter(g => g.severity === "critical" && !chosen.has(g.id));
    const worst = game.list.filter(g => !chosen.has(g.id)).sort((a, b) => b.risk / b.minutes - a.risk / a.minutes)[0];
    const heading = share >= 0.999 ? "That's the best possible plan." : share >= 0.85 ? "Strong call. You protected most of what could be protected." : share >= 0.6 ? "Decent, but the data finds a better plan." : "Payroll locked with serious money still exposed.";
    const r = $("gResult"); r.replaceChildren();
    const row = (name, value, cls) => el("div", { className: "crow" }, el("span", { textContent: name }),
      el("div", { className: "bar " + cls }, Object.assign(el("i"), { style: `width:${100 * value / game.best}%` })), el("span", { textContent: euro(value) }));
    r.append(el("h3", { textContent: heading }),
      el("p", { textContent: `You protected ${Math.round(share * 100)}% of what 4 hours could protect, out of ${euro(game.totalRisk)} at risk in total.` }),
      el("div", { className: "compare" }, row("Your plan", mine, "you"), row("Best plan", game.best, "")));
    if (worst && share < 0.999) r.append(el("p", { textContent: `Biggest miss: "${worst.title}", at ${euro(worst.risk / worst.minutes * 60)} of risk per hour of work.` }));
    if (critical.length) r.append(el("p", { textContent: `${critical.length} critical ${critical.length === 1 ? "problem type remains" : "problem types remain"} open, so the rest would go on a follow-up list after payroll.` }));
    r.append(el("p", { innerHTML: "<b>The analyst's lesson:</b> don't start with the most common problem. Rank by risk per hour of work, then fix the cause so it doesn't return next month." }));
    const again = el("button", { type: "button", textContent: "Try again" });
    again.onclick = () => { chosen.clear(); document.querySelectorAll("#gList input").forEach(i => i.checked = false); document.querySelectorAll(".opt.best").forEach(o => o.classList.remove("best")); r.hidden = true; drawGame(); $("payroll").scrollIntoView(); };
    const show = el("button", { type: "button", textContent: "Show the best plan" });
    show.onclick = () => { document.querySelectorAll(".opt").forEach(o => o.classList.toggle("best", game.plan.has(o.dataset.id))); show.textContent = "Best plan is outlined in green above"; show.disabled = true; };
    r.append(el("div", { className: "tools" }, show, again));
    r.hidden = false; r.focus({ preventScroll: true }); r.scrollIntoView({ block: "center" });
  };

  /* ---------- Challenge 2: workbench ---------- */
  const FIELDS = sample.head;
  const ALIASES = { employee_id: ["employee id", "emp id", "id", "staff id", "matricule", "person id"], first_name: ["first name", "firstname", "given name", "prenom", "prénom"], last_name: ["last name", "lastname", "surname", "family name", "nom"], work_email: ["email", "e-mail", "work email", "mail"], department: ["department", "dept", "departement", "département", "team"], cost_centre: ["cost centre", "cost center", "centre de cout", "centre de coût"], job_title: ["job title", "title", "position", "poste"], job_level: ["job level", "level", "grade", "niveau"], manager_id: ["manager id", "manager", "reports to", "line manager id"], country: ["country", "pays"], hire_date: ["hire date", "start date", "date d'embauche", "date of hire"], termination_date: ["termination date", "end date", "leaving date", "date de sortie"], employment_status: ["status", "employment status", "statut"], contract_type: ["contract type", "contract", "type de contrat"], contract_end_date: ["contract end date", "contract end"], fte: ["fte", "working time", "taux d'activite"], annual_salary_eur: ["salary", "annual salary", "base salary", "salaire"], date_of_birth: ["date of birth", "dob", "birth date", "date de naissance"] };
  const FIX = { missing_manager: "manager_id", manager_not_found: "manager_id", manager_inactive: "manager_id", self_manager: "manager_id", reporting_loop: "manager_id", missing_cost_centre: "cost_centre", missing_hire_date: "hire_date", invalid_hire_date: "hire_date", invalid_email: "work_email", duplicate_email: "work_email", fte_out_of_range: "fte", unknown_contract_type: "contract_type", salary_outside_band: "annual_salary_eur", underage_at_hire: "date_of_birth", termination_before_hire: "termination_date", active_with_past_termination: "employment_status", terminated_without_date: "termination_date", future_hire_marked_active: "employment_status", fixed_term_missing_end_date: "contract_end_date" };
  const LABEL = f => f.replace(/_eur$/, "").replace(/_/g, " ").replace(/^fte$/, "FTE").replace(/^./, c => c.toUpperCase());
  const W = { rows: [], columns: [], fileName: "cleaned_hr_data.csv", changes: 0, limit: 12, params: { ...P.params, bandSlack: 0 }, startIssues: 0, result: null };

  function load(rows, columns, name) {
    Object.assign(W, { rows: rows.map(r => ({ ...r })), columns, fileName: name, changes: 0, limit: 12 });
    W.result = E.check(W.rows, W.columns, W.params, P.rules);
    W.startIssues = W.result.issues.length;
    $("wFixed").textContent = 0;
    drawW();
  }
  const rerun = () => { W.result = E.check(W.rows, W.columns, W.params, P.rules); drawW(); };
  const say = t => $("wMsg").textContent = t;

  function suggest(issue, row) {
    const f = FIX[issue.rule_id], v = row[f];
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

  function apply(issue, field, value) {
    const row = W.rows.find(r => (r.employee_id || "").trim() === issue.employee_id), before = W.result.issues.length;
    row[field] = value; W.changes++; $("wFixed").textContent = W.changes;
    rerun();
    const still = W.result.issues.some(i => i.employee_id === issue.employee_id && i.rule_id === issue.rule_id);
    const left = W.result.issues.length;
    say(still ? `That didn't clear it: the rule still fails for ${issue.employee_id}.` : left > before ? `Cleared, but that change created a new problem. ${left} issues left.` : left === 0 ? "File is clean. Nothing left to fix." : `Cleared. ${left} issues left.`);
  }
  function removeRow(issue) {
    const matches = W.rows.map((r, i) => [(r.employee_id || "").trim(), i]).filter(([id]) => id === issue.employee_id).map(([, i]) => i);
    W.rows.splice(matches[matches.length - 1], 1); W.changes++; $("wFixed").textContent = W.changes;
    rerun(); say(`Row removed. ${W.result.issues.length} issues left.`);
  }

  function issueCard(i) {
    const row = W.rows.find(r => (r.employee_id || "").trim() === i.employee_id), field = FIX[i.rule_id];
    const card = el("article", { className: "issue" });
    const sev = el("span", { className: "sev " + i.severity }, el("i", { ariaHidden: "true" }), i.severity);
    card.append(el("div", { className: "ihead" }, el("b", { textContent: `${i.employee_id} · ${i.title}` }), sev),
      el("div", { className: "d", textContent: i.detail }), el("div", { className: "w", textContent: i.why }));
    const fix = el("div", { className: "fixrow" });
    if (field && W.columns.includes(field) && row) {
      const id = `f-${i.rule_id}-${i.employee_id}`;
      const input = el("input", { type: "text", id, value: row[field] || "", placeholder: LABEL(field) });
      const save = el("button", { type: "button", textContent: "Apply" });
      save.onclick = () => apply(i, field, input.value);
      input.onkeydown = e => { if (e.key === "Enter") save.click(); };
      fix.append(el("label", { htmlFor: id, textContent: LABEL(field) }), input, save);
      const s = suggest(i, row);
      if (s && s !== row[field]) { const chip = el("button", { type: "button", className: "chip", textContent: "Use " + s }); chip.onclick = () => apply(i, field, s); fix.append(chip); }
    } else if (i.rule_id === "duplicate_employee_id" || i.rule_id === "possible_duplicate_person") {
      const b = el("button", { type: "button", textContent: i.rule_id === "duplicate_employee_id" ? "Remove the duplicate row" : "Remove this record" });
      b.onclick = () => removeRow(i); fix.append(b);
    }
    card.append(fix);
    return card;
  }

  function drawW() {
    const { issues, data, skipped } = W.result, records = data.dim.length || 1;
    const affected = new Set(issues.map(i => i.employee_id)).size, clean = 100 * (records - affected) / records;
    $("wClean").textContent = clean.toFixed(1) + "%";
    $("wCleanText").textContent = `of ${records.toLocaleString("en-GB")} records clean`;
    $("wLeft").textContent = issues.length;
    $("wTrack").style.width = clean + "%";
    const sev = $("wSev").value, rule = $("wRule").value, q = $("wQ").value.toLowerCase(), order = { critical: 0, high: 1, medium: 2 };
    const list = issues.filter(i => (!sev || i.severity === sev) && (!rule || i.rule_id === rule) && (!q || `${i.employee_id} ${i.title} ${i.detail}`.toLowerCase().includes(q)))
      .sort((a, b) => order[a.severity] - order[b.severity] || a.title.localeCompare(b.title) || a.employee_id.localeCompare(b.employee_id));
    const box = $("wList"); box.replaceChildren(...list.slice(0, W.limit).map(issueCard));
    if (!list.length) box.append(el("div", { className: "empty", textContent: issues.length ? "No issues match these filters." : "No issues found by the rules that ran." }));
    $("wMore").hidden = list.length <= W.limit;
    $("wMore").textContent = `Show more (${list.length - W.limit} remaining)`;
    W.skippedText = skipped.length ? `${skipped.length} ${skipped.length === 1 ? "rule was" : "rules were"} skipped because columns are missing.` : "";
  }

  function mapColumns(head) {
    const norm = s => s.trim().toLowerCase().replace(/[_-]+/g, " ");
    const map = {};
    head.forEach(h => {
      const n = norm(h);
      const hit = FIELDS.find(f => norm(f) === n || (ALIASES[f] || []).includes(n));
      if (hit && !Object.values(map).includes(hit)) map[h] = hit;
    });
    return map;
  }

  $("wFile").onchange = e => {
    const file = e.target.files[0]; e.target.value = "";
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) return say("That file is over 10 MB. Try a smaller extract.");
    const reader = new FileReader();
    reader.onerror = () => say("That file couldn't be read.");
    reader.onload = () => {
      const { head, rows } = E.parseCsv(String(reader.result)), map = mapColumns(head);
      if (!Object.values(map).includes("employee_id")) return say("No employee ID column found. Rename it employee_id, or use the CSV template.");
      if (!rows.length) return say("That file has no data rows.");
      const mapped = rows.map(r => { const o = {}; for (const h in map) o[map[h]] = r[h]; return o; });
      $("wAsOf").value = W.params.asOf = new Date().toISOString().slice(0, 10);
      load(mapped, Object.values(map), file.name.replace(/\.csv$/i, "") + "_cleaned.csv");
      say(`Read ${rows.length.toLocaleString("en-GB")} rows on your device. Matched ${Object.keys(map).length} of ${head.length} columns. ${W.skippedText}`.trim());
    };
    reader.readAsText(file);
  };
  $("wReset").onclick = () => { W.params.asOf = P.params.asOf; $("wAsOf").value = P.params.asOf; load(sample.rows, sample.head, "cleaned_hr_data.csv"); say("Back to the sample file."); };
  $("wDownload").onclick = () => {
    const url = URL.createObjectURL(new Blob([E.toCsv(W.columns, W.rows)], { type: "text/csv" }));
    el("a", { href: url, download: W.fileName }).click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  $("wMore").onclick = () => { W.limit += 25; drawW(); };
  ["wSev", "wRule"].forEach(id => $(id).onchange = () => { W.limit = 12; drawW(); });
  $("wQ").oninput = () => { W.limit = 12; drawW(); };
  $("wSlack").oninput = e => { W.params.bandSlack = +e.target.value; $("wSlackOut").textContent = e.target.value + "%"; rerun(); };
  $("wAsOf").value = P.params.asOf; $("wAsOf").onchange = e => { if (e.target.value) { W.params.asOf = e.target.value; rerun(); } };
  $("wAge").value = P.params.minAge; $("wAge").onchange = e => { W.params.minAge = +e.target.value || P.params.minAge; rerun(); };
  $("wTypes").value = P.params.contractTypes.join(", ");
  $("wTypes").onchange = e => { W.params.contractTypes = e.target.value.split(",").map(s => s.trim()).filter(Boolean); rerun(); };
  $("wRuleCount").textContent = P.rules.length;
  $("wRule").append(el("option", { value: "", textContent: "All rules" }), ...[...P.rules].sort((a, b) => a.title.localeCompare(b.title)).map(r => el("option", { value: r.id, textContent: r.title })));
  load(sample.rows, sample.head, "cleaned_hr_data.csv");

  /* ---------- Challenge 3: win-back ---------- */
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
  SEGS.forEach(s => {
    const out = el("b", { id: "rv-" + s.name.replace(/\W/g, "") });
    const range = el("input", { type: "range", min: 0, max: 100, step: 5, value: share[s.name], ariaLabel: `Share of ${s.name} to contact` });
    range.oninput = () => { share[s.name] = +range.value; $("rResult").hidden = true; drawR(); };
    range.dataset.seg = s.name;
    $("rSegs").append(el("div", { className: "seg" }, el("h3", { textContent: s.name }),
      el("div", { className: "stats", textContent: `${s.customers} customers · last order ${s.recency} days ago · ${s.orders} orders · ${euro(s.spend)} spent` }),
      el("label", {}, el("span", { textContent: "Contact" }), out), range));
  });
  function drawR() {
    const a = A(); let contacts = 0, profit = 0;
    SEGS.forEach(s => {
      const n = Math.round(s.customers * share[s.name] / 100);
      contacts += n; profit += n * perContact(s, a);
      $("rv-" + s.name.replace(/\W/g, "")).textContent = `${share[s.name]}% (${n})`;
    });
    const spend = contacts * a.cost, over = spend > a.budget;
    $("rBudgetTop").textContent = a.budget.toLocaleString("en-GB");
    $("rBudgetOut").textContent = euro(a.budget); $("rCostOut").textContent = "€" + a.cost.toFixed(2);
    $("rMarginOut").textContent = Math.round(a.margin * 100) + "%"; $("rOrdersOut").textContent = a.orders;
    $("rUsed").textContent = `${euro(spend)} of ${euro(a.budget)}${over ? " (over budget)" : ""}`;
    $("rTrack").style.width = Math.min(100, 100 * spend / a.budget) + "%";
    $("rTrack").style.background = over ? "var(--critical)" : "";
    $("rProfit").textContent = signedEuro(profit);
    $("rReveal").disabled = over;
    $("rReveal").title = over ? "Reduce your contacts to fit the budget" : "";
    return { profit, a };
  }
  ["rBudget", "rCost", "rMargin", "rOrders"].forEach(id => $(id).oninput = () => { $("rResult").hidden = true; drawR(); });
  drawR();
  $("rReveal").onclick = () => {
    const { profit, a } = drawR(), best = bestPlan(a), r = $("rResult"); r.replaceChildren();
    const gap = best.profit - profit;
    r.append(el("h3", { textContent: gap < 1 ? "You found the best plan." : `The data finds ${signedEuro(gap)} more.` }),
      el("p", { textContent: `Your plan earns ${signedEuro(profit)}. The best plan earns ${signedEuro(best.profit)} from the same budget.` }));
    const nets = SEGS.map(s => [s, perContact(s, a)]).sort((x, y) => y[1] - x[1]), max = Math.max(...nets.map(n => Math.abs(n[1])));
    const bars = el("div", { className: "pbars" });
    nets.forEach(([s, v]) => {
      const w = 50 * Math.abs(v) / max, mark = el("i", { className: v < 0 ? "neg" : "" });
      mark.style.cssText = v < 0 ? `right:50%;width:${w}%` : `left:50%;width:${w}%`;
      const rowEl = el("div", { className: "prow" }, el("span", { textContent: s.name }), el("div", { className: "axis" }, mark), el("span", { textContent: `${v < 0 ? "−" : ""}€${Math.abs(v).toFixed(2)}` }));
      rowEl.onmousemove = e => showTip(e, `${(s.uplift * 100).toFixed(1)}% extra buyers. ${v < 0 ? "Loses" : "Earns"} €${Math.abs(v).toFixed(2)} per contact. Best plan contacts ${best.plan[s.name]}.`);
      rowEl.onmouseleave = hideTip;
      bars.append(rowEl);
    });
    r.append(el("p", { innerHTML: "<b>Profit per contact</b>" }), bars,
      el("p", { innerHTML: "<b>The analyst's lesson:</b> your biggest spenders aren't always the best target. Champions buy anyway, so an offer mostly pays for sales you'd already have. The value is in people a campaign actually changes." }));
    const use = el("button", { type: "button", textContent: "Apply the best plan" });
    use.onclick = () => {
      document.querySelectorAll("#rSegs input").forEach(i => { const s = SEGS.find(x => x.name === i.dataset.seg); const v = Math.floor(100 * best.plan[s.name] / s.customers / 5) * 5; share[s.name] = v; i.value = v; });
      drawR();
    };
    r.append(el("div", { className: "tools" }, use));
    r.hidden = false; r.focus({ preventScroll: true }); r.scrollIntoView({ block: "center" });
  };
})();
