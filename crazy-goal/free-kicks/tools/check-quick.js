#!/usr/bin/env node
/* Quick Five rule checker. Draws many sets with the game's own generator and
   verifies every promise made about them. Run it after any card or generator
   change:   node tools/free-kicks/check-quick.js [--seeds 20000] [--jitter-results file.json]
   Checks per set: determinism, five distinct cards, tier slots, at most one
   Hard, no Expert, no adjacent route clash, a lob and a bend-style kick,
   jitter inside each card's limit, camera-safe and wall-distance gates on the
   resolved (mirrored + jittered) cards, and the approved campaign fairness
   rules using the validator's stored touch rates (every kick >= 35%, at most
   one kick under 60%), including the worst jittered corner when
   cards.v1.jitter.json (made from validate.js --jitter-only) exists. Run it
   after any card or generator change.
   Exit 1 on any violation. */
"use strict";
const fs = require("fs");
const path = require("path");

const GAME = require("./paths").gameFile;
const METRICS = path.resolve(__dirname, "cards.v1.metrics.json");
const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : def; };
const SEEDS = parseInt(opt("--seeds", "20000"), 10);

const win = {};
new Function("window", fs.readFileSync(GAME, "utf8"))(win);
const API = win.CrazyKoraFreeKicks;
const Q = API.quick, P = API.physics;
const C = P.constants();
const metrics = JSON.parse(fs.readFileSync(METRICS, "utf8"));
const baseTouch = new Map(metrics.results.filter((r) => r.variant === "base").map((r) => [r.id, r.touch]));
const cornerMin = new Map();
const jr = opt("--jitter-results", path.resolve(__dirname, "cards.v1.jitter.json"));
let jitterStale = null;
if (fs.existsSync(jr)) {
  const J = JSON.parse(fs.readFileSync(jr, "utf8"));
  if (J.physicsFingerprint !== metrics.physics.fingerprint) jitterStale = "the physics changed since the jitter corners were validated";
  else if (J.cardsFingerprint !== metrics.cards.fingerprint) jitterStale = "the cards changed since the jitter corners were validated";
  for (const id of Object.keys(J.corners)) for (const r of J.corners[id]) cornerMin.set(id, Math.min(cornerMin.has(id) ? cornerMin.get(id) : 1e9, r.touch));
}
// the cards as the game embeds them: read them back through the generator's resolver
const lib = JSON.parse(fs.readFileSync(path.resolve(__dirname, "cards.v1.json"), "utf8"));
const card = new Map(lib.cards.map((c) => [c.id, c]));

const slots = Q.slots();
/* the whole ball (17 px radius) must be inside the narrowest camera, so the margin is the radius plus 3 */
const F = C.FOCUS, safeX0 = F.cx - F.minW / 2 + 20, safeX1 = F.cx + F.minW / 2 - 20, safeY1 = F.cy + F.h / 2 - 25;
const violations = {};
const bad = (code, msg) => { (violations[code] = violations[code] || []).push(msg); };
const clash = (a, b) => a !== "any" && b !== "any" && a === b;

const usage = {}, sequences = new Set(), pairs = new Set();
let mirrors = 0, mirrorable = 0, forcedRepeat = 0, total = 0;
let recent = [];
for (let n = 0; n < SEEDS; n++) {
  const set = Q.drawNew(recent);
  total++;
  if (!set) { bad("no-set", "drawNew returned nothing"); continue; }
  const seed = set.seed;
  if (JSON.stringify(Q.draw(seed)) !== JSON.stringify(set)) bad("not-deterministic", seed);   // a seed always gives the same five
  const ids = set.kicks.map((k) => k.card);
  const cards = ids.map((id) => card.get(id));
  if (new Set(ids).size !== 5) bad("duplicate-card", `${seed} ${ids}`);
  cards.forEach((c, i) => { if (!slots[i].includes(c.tier)) bad("slot-tier", `${seed} slot ${i + 1} got ${c.tier}`); });
  if (cards.filter((c) => c.tier === "Hard").length > 1) bad("two-hard", `${seed} ${ids}`);
  if (cards.some((c) => c.tier === "Expert")) bad("expert", `${seed} ${ids}`);
  if (cards[0].tier !== "Easy") bad("first-kick", `${seed} ${ids}`);
  for (let i = 1; i < 5; i++) if (clash(cards[i - 1].intended, cards[i].intended)) bad("route-clash", `${seed} ${ids} at ${i + 1}`);
  if (!cards.some((c) => c.intended === "lob")) bad("no-lob", `${seed} ${ids}`);
  if (!cards.some((c) => c.intended === "curl" || c.intended === "bend")) bad("no-bend", `${seed} ${ids}`);
  if (ids.some((id) => recent.includes(id))) forcedRepeat++;

  let soft = 0;
  set.kicks.forEach((k, i) => {
    const c = cards[i];
    usage[c.id] = (usage[c.id] || 0) + 1;
    const j = c.jitter || 0;
    if (!Number.isInteger(k.dx) || !Number.isInteger(k.dy) || Math.abs(k.dx) > j || Math.abs(k.dy) > j) bad("jitter-range", `${seed} ${c.id} ${k.dx},${k.dy} limit ${j}`);
    const movable = !!c.mirror && (c.ball.x !== C.GOAL.cx || !!(c.wall && c.wall.dx));
    if (k.mirror && !movable) bad("pointless-mirror", `${seed} ${c.id}`);
    if (movable) { mirrorable++; if (k.mirror) mirrors++; }
    const r = Q.resolve(k);
    const scn = P.resolveCard(r.spec);
    if (scn.ball.x < safeX0 || scn.ball.x > safeX1 || scn.ball.y > safeY1) bad("camera", `${seed} ${c.id} ball ${scn.ball.x},${scn.ball.y}`);
    const dist = Math.hypot((scn.wall.left + scn.wall.right) / 2 - scn.ball.x, scn.wall.y - scn.ball.y);
    if (dist < 170) bad("wall-too-close", `${seed} ${c.id} ${dist.toFixed(0)}px`);
    if (scn.wall.y - C.KEEPER.catY < 90) bad("wall-near-keeper", `${seed} ${c.id}`);
    const t0 = baseTouch.get(c.id);
    if (t0 == null) bad("no-metrics", c.id);
    const worst = j && cornerMin.has(c.id) ? Math.min(t0, cornerMin.get(c.id)) : t0;
    if (worst < 35) bad("touch-floor", `${seed} ${c.id} ${worst}%`);
    if (worst < 60) soft++;
  });
  if (soft > 1) bad("too-many-soft", `${seed} ${ids} (${soft})`);
  sequences.add(ids.join(">"));
  recent = ids;
}

console.log(`Quick Five check: ${total} sets drawn (${SEEDS} seeds), chained so each avoids the previous set.`);
console.log(`  distinct card orders: ${sequences.size}`);
console.log(`  repeats of the previous set's cards (forced by the pool): ${forcedRepeat} sets (${((100 * forcedRepeat) / total).toFixed(2)}%)`);
console.log(`  mirror rate where it matters: ${((100 * mirrors) / mirrorable).toFixed(1)}% of ${mirrorable}`);
const u = Object.entries(usage).sort((a, b) => b[1] - a[1]);
console.log("  card usage (share of kicks): " + u.map(([id, n]) => `${id} ${((100 * n) / (total * 5)).toFixed(1)}%`).join("  "));
console.log(cornerMin.size ? `  jitter corners from ${path.basename(jr)}: worst-case touch used for the floor and soft-kick rules` : "  (no jitter results: floor and soft-kick rules use base touch only)");
if (jitterStale) bad("jitter-results-stale", jitterStale);
const codes = Object.keys(violations);
if (codes.length) {
  console.log("\nVIOLATIONS:");
  for (const c of codes) console.log(`  ${c}: ${violations[c].length}   e.g. ${violations[c].slice(0, 3).join(" | ")}`);
  process.exit(1);
}
console.log("\nAll Quick Five rules held for every drawn set.");
