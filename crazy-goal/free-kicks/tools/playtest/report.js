#!/usr/bin/env node
/* Turns playtest logs into a tuning report.
     node tools/free-kicks/playtest/report.js log1.json [log2.json ...] [--json]
   Compares what testers did with the validator's modelled odds
   (tools/free-kicks/cards.v1.metrics.json): touch odds for phones and tablets
   (coarse pointer), mouse odds for everything else.
   A kick slot is flagged only when it has at least 8 attempts AND the modelled
   rate lies outside the 95% Wilson interval of what testers achieved. With 5
   testers most slots will have too few attempts to flag: treat flags as leads
   for the next session, not as proof, and never tune on one tester. */
"use strict";
const fs = require("fs");
const path = require("path");

const files = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const asJson = process.argv.includes("--json");
if (!files.length) {
  console.error("usage: node tools/free-kicks/playtest/report.js log1.json [log2.json ...] [--json]");
  process.exit(2);
}
const metrics = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../cards.v1.metrics.json"), "utf8"));
const runs = [];
for (const f of files) {
  const data = JSON.parse(fs.readFileSync(f, "utf8"));
  for (const r of Array.isArray(data) ? data : data.entries || []) runs.push(r);
}
if (!runs.length) {
  console.log("no runs in the given files");
  process.exit(0);
}

const wilson = (k, n, z = 1.96) => {   // 95% interval
  if (!n) return [0, 1];
  const p = k / n, d = 1 + (z * z) / n;
  const c = (p + (z * z) / (2 * n)) / d, h = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d;
  return [Math.max(0, c - h), Math.min(1, c + h)];
};
const pct = (x) => (100 * x).toFixed(0) + "%";
const cls = (r) => (r.device && r.device.coarse ? "touch" : "mouse");

const stageSets = new Map(metrics.sets.map((s) => [s.id, s]));
const baseRate = new Map();   // quick kicks: card id (+ <-> for mirror) -> modelled rate
for (const r of metrics.results) baseRate.set(r.id + (r.variant === "mirror" ? "<->" : ""), r);

const out = { runs: runs.length, testers: [...new Set(runs.map((r) => r.tester))], devices: { touch: 0, mouse: 0 }, stages: [], slots: [], quick: null, flags: [] };
for (const r of runs) out.devices[cls(r)]++;

/* per stage: run count, goal distribution, clear and star rates against the model */
for (const [id, s] of stageSets) {
  if (s.kind !== "campaign") continue;
  for (const dev of ["touch", "mouse"]) {
    const rs = runs.filter((r) => r.setId === id && cls(r) === dev);
    if (!rs.length) continue;
    const n = rs.length;
    const k = (min) => rs.filter((r) => r.goals >= min).length;
    const m = s.odds[dev];
    out.stages.push({
      stage: id, device: dev, runs: n, meanGoals: +(rs.reduce((a, r) => a + r.goals, 0) / n).toFixed(2),
      clear: { seen: k(3) / n, model: m.atLeast3 / 100 }, twoStars: { seen: k(4) / n, model: m.atLeast4 / 100 }, threeStars: { seen: k(5) / n, model: m.all5 / 100 },
    });
  }
  /* per kick slot of the stage */
  s.kicks.forEach((kick, i) => {
    for (const dev of ["touch", "mouse"]) {
      let tries = 0, makes = 0;
      for (const r of runs) if (r.setId === id && cls(r) === dev && r.kicks[i]) { tries++; if (r.kicks[i].outcome === "goal") makes++; }
      if (!tries) continue;
      const model = (dev === "touch" ? kick.touch : kick.mouse) / 100, [lo, hi] = wilson(makes, tries);
      const flag = tries >= 8 && (model < lo || model > hi);
      const row = { stage: id, slot: i + 1, kick: kick.id, device: dev, tries, makes, seen: makes / tries, lo, hi, model, flag };
      out.slots.push(row);
      if (flag) out.flags.push(row);
    }
  });
}

/* Quick Five: per card, with mirror variants kept apart */
const quickRuns = runs.filter((r) => r.kind === "quick");
if (quickRuns.length) {
  const by = new Map();
  for (const r of quickRuns) r.kicks.forEach((k) => {
    const key = k.id + "|" + cls(r);
    const e = by.get(key) || { tries: 0, makes: 0 };
    e.tries++; if (k.outcome === "goal") e.makes++;
    by.set(key, e);
  });
  out.quick = [...by].map(([key, e]) => {
    const [id, dev] = key.split("|");
    const m = baseRate.get(id);
    const model = m ? (dev === "touch" ? m.touch : m.mouse) / 100 : null;
    const [lo, hi] = wilson(e.makes, e.tries);
    const flag = model != null && e.tries >= 8 && (model < lo || model > hi);
    const row = { card: id, device: dev, tries: e.tries, makes: e.makes, seen: e.makes / e.tries, lo, hi, model, flag };
    if (flag) out.flags.push(Object.assign({ stage: "quick" }, row));
    return row;
  }).sort((a, b) => a.card.localeCompare(b.card));
}

if (asJson) {
  console.log(JSON.stringify(out, null, 1));
  process.exit(0);
}

console.log(`${out.runs} stage runs by ${out.testers.length} tester(s) (${out.testers.join(", ")}); touch ${out.devices.touch}, mouse ${out.devices.mouse}\n`);
console.log("STAGES  (seen vs modelled: at least 3 goals = clear / at least 4 = 2 stars / 5 = 3 stars)");
for (const s of out.stages) {
  console.log(`  ${s.stage.padEnd(24)} ${s.device.padEnd(5)} runs ${String(s.runs).padStart(3)}  goals ${s.meanGoals.toFixed(1)}  ` +
    `clear ${pct(s.clear.seen)} (${pct(s.clear.model)})  2* ${pct(s.twoStars.seen)} (${pct(s.twoStars.model)})  3* ${pct(s.threeStars.seen)} (${pct(s.threeStars.model)})`);
}
console.log("\nKICK SLOTS  (seen [95% interval] vs modelled; * = flagged: 8+ tries and the model is outside the interval)");
for (const r of out.slots) {
  console.log(`  ${r.stage.slice(0, 7).padEnd(7)} #${r.slot} ${r.kick.padEnd(6)} ${r.device.padEnd(5)} ${String(r.makes).padStart(2)}/${String(r.tries).padEnd(3)} ${pct(r.seen).padStart(4)} [${pct(r.lo)}-${pct(r.hi)}]  model ${pct(r.model)}${r.flag ? "  *" : ""}`);
}
if (out.quick) {
  console.log("\nQUICK FIVE CARDS");
  for (const r of out.quick) console.log(`  ${r.card.padEnd(7)} ${r.device.padEnd(5)} ${String(r.makes).padStart(2)}/${String(r.tries).padEnd(3)} ${pct(r.seen).padStart(4)} [${pct(r.lo)}-${pct(r.hi)}]  model ${r.model == null ? "?" : pct(r.model)}${r.flag ? "  *" : ""}`);
}
console.log(out.flags.length ? `\n${out.flags.length} flagged slot(s): lead(s) for the next session, not proof.` : "\nNothing flagged (often just too few tries: 8+ per slot are needed).");
