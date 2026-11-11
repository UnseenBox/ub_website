#!/usr/bin/env node
/* ============================================================================
   CRAZY KORA - Free Kicks card validator (offline, no dependencies).

   Loads the shipped free-kicks.js (see paths.js) in a sandbox and drives its own
   shared physics (CrazyKoraFreeKicks.physics), so a card is judged by the same
   rules the game plays by. For every card it:
     1. runs static gates (camera-safe zone, wall distances, wall size),
     2. sweeps aim angle x power x bend x ground/air against 8 keeper idle
        phases (a cell scores only if the shot beats Mimi in >= 6 of 8),
     3. finds the largest all-scoring window per route family
          lob   = air, straight       curl = air + bend
          drive = ground, straight    bend = ground + bend
     4. converts each window to a modelled make rate for a mouse and a touch
        player and tiers the card by its EASIEST route (touch rate). Each
        card gets two readings: "conservative" (only aims within 45 degrees of
        the goal axis, the basis of the approved design numbers) and "wide"
        (the whole +-80 degree sweep, which finds big curls aimed far off
        axis). The authored tier must lie between them; floors use the
        conservative reading,
     5. checks route clarity (what the player sees just outside the window),
     6. checks approved campaign rules per five-kick set.
   The make rates are MODELLED (assumed aim error), not measured. Real
   portrait-touch playtests must supplement this tool.

   Usage:  node tools/free-kicks/validate.js [cards.json] [options]
     --fast           coarse sweep for quick iteration (not for sign-off)
     --only 1.1,4.2   validate only these card ids (set rules are skipped)
     --jitter         also validate each card's +/-jitter ball corners
     --jitter-only    only the jittered corners (4 per card), skipping base and mirror
     --out file       metrics file (default <cards>.metrics.json)
     --no-write       do not write the metrics file
     --check          verify the stored metrics still match the current game
                      file and cards (no sweep); exit 1 when stale
     --self-test      known-answer test against the earlier independent probe
     --workers N      parallel workers (default up to 8)
     --json           print the full result JSON instead of the table
   Exit code: 0 = no failures (warnings allowed), 1 = failures or stale.
   ============================================================================ */
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const { Worker, isMainThread, parentPort } = require("worker_threads");

/* FK_GAME_FILE lets tests point the validator at another copy of the game file. */
const PATHS = require("./paths");
const GAME_FILE = path.resolve(process.env.FK_GAME_FILE || PATHS.gameFile);

/* ----- the model (approved design decisions live here) -------------------- */
const MODEL = {
  keeperPhases: [0, 0.9, 1.8, 2.7, 3.6, 4.5, 5.4, 6.3],   // initial idle phases of Mimi's sway
  needPhases: 6,                                          // 75% of phases
  angleRangeDeg: 80,                                      // sweep +-80 degrees around the goal axis (curls aim wide)
  /* Every route is measured twice: "conservative" only counts windows whose aim
     is within +-45 degrees of the goal axis (the basis of the approved design
     numbers); "wide" counts the whole +-80 degree sweep. Whether players find
     wide-aim routes is a human-factors question this tool cannot settle, so a
     card's authored tier must lie between the two, and floors use the
     conservative view. */
  conservativeAimDeg: 45,
  mouse: { angleSigmaDeg: 1.2, powerSigmaPct: 3 },        // assumed aim error
  touch: { angleSigmaDeg: 2.5, powerSigmaPct: 6 },
  tiers: [["Easy", 85], ["Medium", 60], ["Hard", 30], ["Expert", 10]],   // touch make rate of the easiest route
  floors: { mouse: 40, touch: 10 },                       // below = impossible for humans
  tierToleranceTouchPts: 2,                               // authored vs measured tier may differ this close to a band edge
  campaign: { kickTouchFloor: 35, softKickBelow: 60, maxSoftKicks: 1 },
  wall: { hardFloorPx: 170, softFloorPx: 190, minFrontOfKeeperPx: 90, menRange: [3, 6], heightRange: [58, 76] },
  unintendedRouteMarginPts: 15,
};
const GRIDS = {
  normal: { name: "normal", angleStepDeg: 0.5, powerStep: 0.025, bendStep: 0.1 },
  fast: { name: "fast", angleStepDeg: 1, powerStep: 0.05, bendStep: 0.2 },
};
const FAMILIES = ["lob", "curl", "drive", "bend"];

/* ----- helpers ------------------------------------------------------------ */
const sha256 = (text) => crypto.createHash("sha256").update(text).digest("hex");
/* file texts are hashed with LF endings, so a checkout with CRLF (git autocrlf on Windows) gives the same hash */
const sha256Text = (text) => sha256(String(text).split("\r\n").join("\n"));

function erf(x) {
  const s = Math.sign(x);
  const a = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * a);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-a * a);
  return s * y;
}
const makeRate = (box, s) =>
  erf(box.widthDeg / 2 / (s.angleSigmaDeg * Math.SQRT2)) * erf(box.widthPct / 2 / (s.powerSigmaPct * Math.SQRT2));

function loadPhysics() {
  const src = fs.readFileSync(GAME_FILE, "utf8");
  const win = {};
  /* The game file is trusted project code and only needs a `window` object at
     load time. A plain function scope runs ~8x faster than a vm context. */
  new Function("window", src)(win);
  const physics = win.CrazyKoraFreeKicks && win.CrazyKoraFreeKicks.physics;
  if (!physics) throw new Error("free-kicks.js does not expose CrazyKoraFreeKicks.physics");
  return { physics, hash: sha256Text(src), constants: physics.constants(), fingerprint: physicsFingerprint(physics) };
}

/* A hash of what the physics DOES (240 fixed shots over 4 scenarios plus its
   constants), not of the file text, so UI edits to free-kicks.js do not make
   stored metrics stale while any change to the shot rules does. */
function physicsFingerprint(P) {
  const scenarios = [
    null,
    { ball: { x: 292, y: 639 }, wall: { men: 5, dist: 200, height: 64 }, keeper: "K4" },
    { ball: { x: 520, y: 690 }, wall: { men: 3, dist: 250, dx: 95 }, keeper: { tier: "K1" } },
    { keeper: "K5" },
  ];
  const rows = [];
  for (const spec of scenarios) {
    const card = P.resolveCard(spec);
    for (let t = 0; t < 60; t++) {
      const shot = { type: t % 2 ? "air" : "ground", power: (((t * 7) % 20) + 1) / 20, bend: (((t * 3) % 21) - 10) / 10, angle: ((((t * 13) % 121) - 60) * Math.PI) / 180 };
      const r = P.simulateShot(card, shot, { keeperPhase: (t % 8) * 0.9 });
      rows.push([r.outcome, +r.x.toFixed(3), +r.z.toFixed(3), +r.time.toFixed(3), +r.keeperX.toFixed(3)]);
    }
  }
  return sha256(JSON.stringify({ constants: P.constants(), tiers: P.keeperTiers(), rows }));
}

/* Hash of what a card file means for validation (names and other copy do not count). */
function cardsFingerprint(lib) {
  return sha256(JSON.stringify({
    cards: lib.cards.map((c) => ({ id: c.id, tier: c.tier, intended: c.intended, mirror: c.mirror, jitter: c.jitter, ball: c.ball, wall: c.wall, keeper: c.keeper })),
    sets: (lib.sets || []).map((x) => ({ id: x.id, kind: x.kind, kicks: x.kicks })),
  }));
}

function tierOf(touchPct) {
  for (const [name, min] of MODEL.tiers) if (touchPct >= min) return name;
  return "Reject";
}

/* Mirror a card about the goal axis (x -> 1040 - x). */
function mirrorSpec(spec, axisX) {
  const m = JSON.parse(JSON.stringify(spec));
  const flip = (x) => 2 * axisX - x;
  if (m.ball && m.ball.x != null) m.ball.x = flip(m.ball.x);   // an omitted ball sits on the goal axis already
  if (m.wall && m.wall.dx) m.wall.dx = -m.wall.dx;
  if (m.keeper && typeof m.keeper === "object" && m.keeper.homeX != null) m.keeper.homeX = flip(m.keeper.homeX);
  m.id = `${spec.id}<->`;
  return m;
}

/* ----- the sweep (runs inside workers) ------------------------------------ */
function maxBox(M, nP, nA, aLo = 0, aHi = nA - 1) {
  let best = null;
  const col = new Uint8Array(nA);
  for (let p1 = 0; p1 < nP; p1++) {
    col.fill(1);
    for (let p2 = p1; p2 < nP; p2++) {
      const row = M[p2];
      let run = 0, start = 0, bRun = 0, bStart = 0;
      for (let a = aLo; a <= aHi; a++) {
        col[a] &= row[a];
        if (col[a]) {
          if (!run) start = a;
          run++;
          if (run > bRun) { bRun = run; bStart = start; }
        } else run = 0;
      }
      if (!bRun) break;
      const area = (p2 - p1 + 1) * bRun;
      if (!best || area > best.area) best = { area, p1, p2, a1: bStart, a2: bStart + bRun - 1 };
    }
  }
  return best;
}

function familyOf(type, bend) {
  const straight = Math.abs(bend) <= 0.05;
  return type === "air" ? (straight ? "lob" : "curl") : straight ? "drive" : "bend";
}

function sweepVariant(P, C, spec, grid) {
  const t0 = Date.now();
  const scn = P.resolveCard(spec);
  const keeperFree = Object.assign({}, scn, { keeper: Object.assign({}, scn.keeper, { reachX: -1 }) });
  const goalDir = Math.atan2(C.GOAL.cx - scn.ball.x, scn.ball.y - C.GOAL.lineY);
  const nP = Math.round(1 / grid.powerStep);
  const nA = Math.round((2 * MODEL.angleRangeDeg) / grid.angleStepDeg) + 1;
  const nB = Math.round(2 / grid.bendStep) + 1;
  const mid = (nA - 1) / 2;
  const angleAt = (ai) => goalDir + ((ai - mid) * grid.angleStepDeg * Math.PI) / 180;
  const need = MODEL.needPhases;
  const phases = MODEL.keeperPhases;

  const aLo = Math.max(0, Math.ceil(mid - MODEL.conservativeAimDeg / grid.angleStepDeg));
  const aHi = Math.min(nA - 1, Math.floor(mid + MODEL.conservativeAimDeg / grid.angleStepDeg));
  const routes = {};       // conservative: aim within +-conservativeAimDeg of the goal axis
  const routesWide = {};   // wide: the whole sweep
  const makeCand = (box, type, bend) => {
    const widthDeg = (box.a2 - box.a1 + 1) * grid.angleStepDeg;
    const widthPct = (box.p2 - box.p1 + 1) * grid.powerStep * 100;
    const cand = {
      family: familyOf(type, bend), type, bend,
      widthDeg, widthPct,
      power: ((box.p1 + box.p2) / 2 + 1) * grid.powerStep,
      angleRelDeg: ((box.a1 + box.a2) / 2 - mid) * grid.angleStepDeg,
      angleAbsDeg: (goalDir * 180) / Math.PI + ((box.a1 + box.a2) / 2 - mid) * grid.angleStepDeg,
      box, area: box.area,
      /* at a slider / power / outer-sweep limit (the +-45 degree edge of the conservative view is not a limit) */
      atLimit: Math.abs(bend) >= 0.999 || box.p2 === nP - 1 || box.a1 === 0 || box.a2 === nA - 1,
      truncated: box.a1 === aLo || box.a2 === aHi,
    };
    cand.mouse = Math.round(makeRate(cand, MODEL.mouse) * 1000) / 10;
    cand.touch = Math.round(makeRate(cand, MODEL.touch) * 1000) / 10;
    return cand;
  };
  /* Best window per family: higher touch rate, then mouse rate, then area;
     among exact ties prefer the gentler bend (a recipe away from the slider end). */
  const consider = (into, cand) => {
    const cur = into[cand.family];
    const better = !cur || cand.touch > cur.touch || (cand.touch === cur.touch && (cand.mouse > cur.mouse ||
      (cand.mouse === cur.mouse && (cand.area > cur.area || (cand.area === cur.area && Math.abs(cand.bend) < Math.abs(cur.bend))))));
    if (better) into[cand.family] = cand;
  };
  for (const type of ["ground", "air"]) {
    for (let bi = 0; bi < nB; bi++) {
      const bend = Math.round((-1 + bi * grid.bendStep) * 1000) / 1000;
      const M = [];
      let any = false;
      for (let pi = 0; pi < nP; pi++) {
        const power = (pi + 1) * grid.powerStep;
        const row = new Uint8Array(nA);
        for (let ai = 0; ai < nA; ai++) {
          const shot = { type, power, bend, angle: angleAt(ai) };
          // Mimi can only make a shot worse, so a shot that misses with no keeper can be skipped.
          if (P.simulateShot(keeperFree, shot, { keeperPhase: 0, preRoll: 0 }).outcome !== "goal") continue;
          let wins = 0;
          for (let k = 0; k < phases.length; k++) {
            if (P.simulateShot(scn, shot, { keeperPhase: phases[k] }).outcome === "goal") wins++;
            if (wins >= need || wins + (phases.length - 1 - k) < need) break;
          }
          if (wins >= need) { row[ai] = 1; any = true; }
        }
        M.push(row);
      }
      if (!any) continue;
      const boxWide = maxBox(M, nP, nA);
      if (boxWide) consider(routesWide, makeCand(boxWide, type, bend));
      const boxNarrow = maxBox(M, nP, nA, aLo, aHi);
      if (boxNarrow) consider(routes, makeCand(boxNarrow, type, bend));
    }
  }

  const pickBest = (set) => {
    let b = null;
    for (const f of FAMILIES) {
      const r = set[f];
      if (r && (!b || r.touch > b.touch || (r.touch === b.touch && r.mouse > b.mouse))) b = r;
    }
    return b;
  };
  const bestNarrow = pickBest(routes);
  const bestWide = pickBest(routesWide);

  /* Route clarity: what does the player see just outside the best window? */
  const best = bestNarrow || bestWide;
  let gradient = null;
  if (best) {
    const majority = (type, bend, power, angle) => {
      const tally = {};
      for (const ph of [0, 2.7, 5.4]) {
        const o = P.simulateShot(scn, { type, power, bend, angle }, { keeperPhase: ph }).outcome;
        tally[o] = (tally[o] || 0) + 1;
      }
      return Object.entries(tally).sort((a, b) => b[1] - a[1])[0][0];
    };
    const pC = Math.round(((best.box.p1 + best.box.p2) / 2));
    const aC = Math.round((best.box.a1 + best.box.a2) / 2);
    const edge = (axis, dir) => {
      for (let k = 1; k <= 8; k++) {
        const pi = axis === "p" ? (dir > 0 ? best.box.p2 + k : best.box.p1 - k) : pC;
        const ai = axis === "a" ? (dir > 0 ? best.box.a2 + k : best.box.a1 - k) : aC;
        if (pi < 0 || pi >= nP || ai < 0 || ai >= nA) return "limit";
        const o = majority(best.type, best.bend, (pi + 1) * grid.powerStep, angleAt(ai));
        if (o !== "goal") return o;
      }
      return "open";
    };
    gradient = { powerUp: edge("p", 1), powerDown: edge("p", -1), angleRight: edge("a", 1), angleLeft: edge("a", -1) };
  }

  const strip = (r) => r && { family: r.family, type: r.type, bend: r.bend, power: +r.power.toFixed(3), angleAbsDeg: +r.angleAbsDeg.toFixed(1), angleRelDeg: +r.angleRelDeg.toFixed(1), widthDeg: r.widthDeg, widthPct: +r.widthPct.toFixed(1), mouse: r.mouse, touch: r.touch, atLimit: r.atLimit, truncated: r.truncated };
  const out = {}, outWide = {};
  for (const f of FAMILIES) { out[f] = strip(routes[f]) || null; outWide[f] = strip(routesWide[f]) || null; }
  return {
    scenario: { ball: scn.ball, wall: { y: +scn.wall.y.toFixed(1), left: +scn.wall.left.toFixed(1), right: +scn.wall.right.toFixed(1), clearance: scn.wall.clearance, men: scn.wall.men }, keeper: { alertT: scn.keeper.alertT, reachZ: scn.keeper.reachZ, reachX: scn.keeper.reachX, homeX: scn.keeper.homeX } },
    routes: out,
    routesWide: outWide,
    best: bestNarrow ? bestNarrow.family : null,
    bestWide: bestWide ? bestWide.family : null,
    gradient,
    ms: Date.now() - t0,
  };
}

/* ----- static gates -------------------------------------------------------- */
function staticChecks(scn, C) {
  const issues = [];
  const add = (level, code, msg) => issues.push({ level, code, msg });
  const F = C.FOCUS;
  const safeX0 = F.cx - F.minW / 2 + 5, safeX1 = F.cx + F.minW / 2 - 5, safeY1 = F.cy + F.h / 2 - 25;
  const b = scn.ball, w = scn.wall;
  if (b.x < safeX0 || b.x > safeX1) add("fail", "camera-ball-x", `ball x ${b.x} outside the portrait-safe zone ${safeX0}-${safeX1}`);
  if (b.y > safeY1) add("fail", "camera-ball-y", `ball y ${b.y} below the safe zone (max ${safeY1})`);
  if (w.left < safeX0 - 40 || w.right > safeX1 + 40) add("warn", "camera-wall-x", `wall spans ${w.left.toFixed(0)}-${w.right.toFixed(0)}, partly outside the portrait-safe zone`);
  const dist = Math.hypot((w.left + w.right) / 2 - b.x, w.y - b.y);
  if (dist < MODEL.wall.hardFloorPx) add("fail", "wall-too-close", `wall is ${dist.toFixed(0)} px from the ball (hard floor ${MODEL.wall.hardFloorPx})`);
  else if (dist < MODEL.wall.softFloorPx) add("warn", "wall-close", `wall is ${dist.toFixed(0)} px from the ball (recommended at least ${MODEL.wall.softFloorPx})`);
  const front = w.y - C.KEEPER.catY;
  if (front < MODEL.wall.minFrontOfKeeperPx) add("fail", "wall-near-keeper", `wall only ${front.toFixed(0)} px in front of Mimi's line (need ${MODEL.wall.minFrontOfKeeperPx})`);
  if (w.men < MODEL.wall.menRange[0] || w.men > MODEL.wall.menRange[1]) add("warn", "wall-men", `wall of ${w.men} is outside the planned ${MODEL.wall.menRange.join("-")} range`);
  if (w.clearance < MODEL.wall.heightRange[0] || w.clearance > MODEL.wall.heightRange[1]) add("warn", "wall-height", `wall height ${w.clearance} is outside the planned ${MODEL.wall.heightRange.join("-")} range`);
  return { issues, wallDistancePx: +dist.toFixed(0), wallFrontOfKeeperPx: +front.toFixed(0) };
}

/* ----- judging a swept variant -------------------------------------------- */
function judge(card, variantTag, sweep, C) {
  const issues = [];
  const add = (level, code, msg) => issues.push({ level, code, msg });
  const stat = staticChecks({ ball: sweep.scenario.ball, wall: sweep.scenario.wall }, C);
  stat.issues.forEach((i) => issues.push(i));

  const names = MODEL.tiers.map((t) => t[0]).concat("Reject");
  const tierFor = (route) => (!route || route.mouse < MODEL.floors.mouse || route.touch < MODEL.floors.touch ? "Reject" : tierOf(route.touch));
  const best = sweep.best ? sweep.routes[sweep.best] : null;                 // conservative (+-45 deg aim)
  const bestWide = sweep.bestWide ? sweep.routesWide[sweep.bestWide] : null;  // whole sweep
  const touch = best ? best.touch : 0, mouse = best ? best.mouse : 0;
  const touchWide = bestWide ? bestWide.touch : 0, mouseWide = bestWide ? bestWide.mouse : 0;
  const tierC = tierFor(best);
  const tierO = tierFor(bestWide);

  if (tierC === "Reject" && tierO === "Reject") {
    add("fail", "no-human-route", bestWide ? `easiest route is ${mouseWide}% mouse / ${touchWide}% touch even with wide aim (floor ${MODEL.floors.mouse}/${MODEL.floors.touch})` : "no scoring window found at all");
  } else if (tierC === "Reject") {
    add("warn", "wide-aim-only", `no workable route within ${MODEL.conservativeAimDeg} deg of the goal axis; only a wide-aim route (${bestWide.family}, aim ${bestWide.angleRelDeg} deg off axis, ${mouseWide}/${touchWide}%)`);
  }

  /* authored tier must lie between the optimistic and conservative measurements */
  if (card.tier) {
    const ia = names.indexOf(card.tier), iC = names.indexOf(tierC), iO = names.indexOf(tierO);
    if (ia < 0) add("fail", "tier-unknown", `authored tier "${card.tier}" is not one of ${names.slice(0, 4).join("/")}`);
    else if (ia < iO || ia > iC) {
      // just outside, and the measurement sits within a couple of points of the band edge -> warn only
      const towardEasy = ia < iO;
      const ref = towardEasy ? { idx: iO, touch: touchWide } : { idx: iC, touch: touch };
      const edge = MODEL.tiers[Math.min(ia, ref.idx)][1];
      const near = Math.abs(ia - ref.idx) === 1 && Math.abs(ref.touch - edge) <= MODEL.tierToleranceTouchPts;
      add(near ? "warn" : "fail", near ? "tier-edge" : "tier-mismatch", `authored ${card.tier}, measured ${tierC}${tierC !== tierO ? ` (${tierO} with wide aim)` : ""} (touch ${touch}%${touchWide !== touch ? `, ${touchWide}% wide` : ""})`);
    }
  }
  if (tierC !== tierO && tierC !== "Reject") add("warn", "tier-spread", `${tierC} if players aim within ${MODEL.conservativeAimDeg} deg of the goal, ${tierO} if they find a wider aim (${bestWide.family}, ${bestWide.angleRelDeg} deg off axis)`);

  if (best && best.atLimit) {
    const others = FAMILIES.filter((f) => f !== best.family && sweep.routes[f] && sweep.routes[f].touch >= 25);
    if (!others.length) add("warn", "route-at-limit", `the only workable route (${best.family}) sits at a slider/power limit - review by hand`);
  }
  if (card.intended && card.intended !== "any") {
    const want = sweep.routes[card.intended];
    if (!want && !sweep.routesWide[card.intended]) add("fail", "intended-route-missing", `intended route "${card.intended}" has no scoring window`);
    else if (!want) add("warn", "intended-route-wide-only", `intended route "${card.intended}" only exists with wide aim (${sweep.routesWide[card.intended].angleRelDeg} deg off axis)`);
    else if (best && best.touch - want.touch >= MODEL.unintendedRouteMarginPts) add("warn", "unintended-route", `players will find ${best.family} (${best.touch}% touch) before the intended ${card.intended} (${want.touch}%)`);
  }
  if (sweep.gradient) {
    const g = sweep.gradient;
    const unreadable = Object.entries(g).filter(([, v]) => v === "missed").map(([k]) => k);
    if (unreadable.length) add("warn", "unreadable-failure", `just outside the window the shot is "missed" on: ${unreadable.join(", ")} (no coaching message fits)`);
    if (g.powerUp === g.powerDown && g.powerUp !== "limit" && g.powerUp !== "open") add("warn", "ambiguous-power", `both more and less power end as "${g.powerUp}" - the result alone does not say which way to go`);
  }
  const status = issues.some((i) => i.level === "fail") ? "fail" : issues.some((i) => i.level === "warn") ? "warn" : "pass";
  return {
    id: card.id, variant: variantTag, tierAuthored: card.tier || null, tierMeasured: tierC, tierOptimistic: tierO,
    touch, mouse, touchWide, mouseWide, best: sweep.best, bestWide: sweep.bestWide,
    routes: sweep.routes, routesWide: sweep.routesWide, gradient: sweep.gradient,
    static: { wallDistancePx: stat.wallDistancePx, wallFrontOfKeeperPx: stat.wallFrontOfKeeperPx },
    scenario: sweep.scenario, issues, status, ms: sweep.ms,
  };
}

function judgeAny(card, variantTag, sweep, C) {
  if (!sweep.invalid) return judge(card, variantTag, sweep, C);
  return { id: card.id, variant: variantTag, tierAuthored: card.tier || null, tierMeasured: "Reject", tierOptimistic: "Reject", touch: 0, mouse: 0, touchWide: 0, mouseWide: 0, best: null, bestWide: null, routes: {}, routesWide: {}, gradient: null, static: {}, issues: [{ level: "fail", code: "invalid-spec", msg: sweep.invalid }], status: "fail", ms: 0 };
}

/* ----- set rules and star odds -------------------------------------------- */
function distribution(rates) {
  let d = [1];
  for (const r of rates) {
    const n = new Array(d.length + 1).fill(0);
    d.forEach((v, i) => { n[i] += v * (1 - r); n[i + 1] += v * r; });
    d = n;
  }
  return d;
}
const atLeast = (d, k) => d.slice(k).reduce((a, b) => a + b, 0);

function judgeSet(set, kickResults) {
  const issues = [];
  const add = (level, code, msg) => issues.push({ level, code, msg });
  const campaign = (set.kind || "campaign") === "campaign";
  if (set.kicks.length !== 5) add("fail", "set-size", `a set must have 5 kicks (has ${set.kicks.length})`);
  /* Floors and soft-kick rules use the CONSERVATIVE rates (aim within +-45 deg of the goal);
     the wide-aim rates are reported next to them as an optimistic view. */
  const rates = kickResults.map((r) => ({ id: r.ref, touch: r.touch, mouse: r.mouse, touchWide: r.touchWide, mouseWide: r.mouseWide, tier: r.tierMeasured, tierWide: r.tierOptimistic, status: r.status }));
  rates.forEach((r) => { if (r.status === "fail") add("fail", "kick-invalid", `kick ${r.id} fails card validation`); });
  if (campaign) {
    rates.forEach((r) => { if (r.touch < MODEL.campaign.kickTouchFloor) add("fail", "touch-floor", `kick ${r.id} has ${r.touch}% touch (campaign floor ${MODEL.campaign.kickTouchFloor}%)`); });
    const soft = rates.filter((r) => r.touch < MODEL.campaign.softKickBelow);
    if (soft.length > MODEL.campaign.maxSoftKicks) add("fail", "too-many-soft", `${soft.length} kicks are under ${MODEL.campaign.softKickBelow}% touch (${soft.map((s) => s.id).join(", ")}); at most ${MODEL.campaign.maxSoftKicks} allowed`);
  } else {
    rates.forEach((r) => { if (r.status === "fail") return; if (r.touch < MODEL.floors.touch || r.mouse < MODEL.floors.mouse) add("fail", "no-human-route", `kick ${r.id} is below the human floor`); });
  }
  const oddsFor = (suffix) => {
    const odds = {};
    for (const name of ["mouse", "touch"]) {
      const d = distribution(rates.map((r) => r[name + suffix] / 100));
      odds[name] = { atLeast3: +(100 * atLeast(d, 3)).toFixed(0), atLeast4: +(100 * atLeast(d, 4)).toFixed(0), all5: +(100 * (d[5] || 0)).toFixed(0) };
    }
    return odds;
  };
  const odds = oddsFor("");
  const oddsWide = oddsFor("Wide");
  const status = issues.some((i) => i.level === "fail") ? "fail" : issues.some((i) => i.level === "warn") ? "warn" : "pass";
  return { id: set.id, kind: set.kind || "campaign", kicks: rates, odds, oddsWide, issues, status };
}

/* ----- worker plumbing ----------------------------------------------------- */
if (!isMainThread) {
  const { physics, constants } = loadPhysics();
  parentPort.on("message", (job) => {
    try {
      parentPort.postMessage({ key: job.key, result: sweepVariant(physics, constants, job.spec, GRIDS[job.grid]) });
    } catch (err) {
      // A bad card spec is a validation FAILURE for that card, not a crash of the whole run.
      parentPort.postMessage({ key: job.key, invalid: String((err && err.message) || err) });
    }
  });
  return;
}

function runJobs(jobs, workerCount, onDone) {
  return new Promise((resolve, reject) => {
    const results = new Map();
    let next = 0, finished = 0;
    const n = Math.max(1, Math.min(workerCount, jobs.length));
    const workers = [];
    const feed = (w) => {
      if (next < jobs.length) w.postMessage(jobs[next++]);
      else w.terminate();
    };
    for (let i = 0; i < n; i++) {
      const w = new Worker(__filename, { workerData: {} });
      workers.push(w);
      w.on("message", (m) => {
        results.set(m.key, m.invalid ? { invalid: m.invalid } : m.result);
        finished++;
        onDone && onDone(finished, jobs.length, m.key);
        if (finished === jobs.length) resolve(results);
        feed(w);
      });
      w.on("error", reject);
      feed(w);
    }
    if (!jobs.length) resolve(results);
  });
}

/* ----- CLI ----------------------------------------------------------------- */
function parseArgs(argv) {
  const o = { cards: null, grid: "normal", only: null, jitter: false, out: null, write: true, check: false, selfTest: false, workers: Math.min(8, Math.max(1, os.cpus().length - 1)), json: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--fast") o.grid = "fast";
    else if (a === "--only") o.only = argv[++i].split(",").map((s) => s.trim());
    else if (a === "--jitter") o.jitter = true;
    else if (a === "--jitter-only") { o.jitter = true; o.jitterOnly = true; }   // just the 4 jittered ball corners per card
    else if (a === "--out") o.out = argv[++i];
    else if (a === "--no-write") o.write = false;
    else if (a === "--check") o.check = true;
    else if (a === "--self-test") o.selfTest = true;
    else if (a === "--workers") o.workers = Math.max(1, parseInt(argv[++i], 10) || 1);
    else if (a === "--json") o.json = true;
    else if (a === "--help" || a === "-h") { console.log(fs.readFileSync(__filename, "utf8").split("*/")[0].replace(/^\/\*|^#!.*\n/gm, "")); process.exit(0); }
    else if (!a.startsWith("--")) o.cards = a;
    else { console.error(`Unknown option ${a}`); process.exit(2); }
  }
  return o;
}

const pad = (s, n) => String(s).padEnd(n);
const fmtRoute = (r) => (r ? `${r.widthDeg.toFixed(1)}°x${r.widthPct.toFixed(0)}% ${r.mouse}/${r.touch}` : "--");

async function main() {
  const opt = parseArgs(process.argv.slice(2));
  const { physics, hash, constants, fingerprint } = loadPhysics();
  const grid = GRIDS[opt.grid];

  if (opt.selfTest) return selfTest(physics, constants, grid, opt);

  const cardsPath = path.resolve(opt.cards || path.join(__dirname, "cards.v1.json"));
  if (!fs.existsSync(cardsPath)) { console.error(`Cards file not found: ${cardsPath}`); process.exit(2); }
  const cardsText = fs.readFileSync(cardsPath, "utf8");
  let lib;
  try { lib = JSON.parse(cardsText); } catch (err) { console.error(`Cards file is not valid JSON: ${err.message}`); process.exit(2); }
  if (!lib || !Array.isArray(lib.cards)) { console.error('Cards file needs a "cards" array.'); process.exit(2); }
  const ids = lib.cards.map((c) => c.id);
  const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (dupes.length) { console.error(`Duplicate card ids: ${[...new Set(dupes)].join(", ")}`); process.exit(2); }
  const outPath = path.resolve(opt.out || cardsPath.replace(/\.json$/, ".metrics.json"));

  if (opt.check) {
    if (!fs.existsSync(outPath)) { console.error(`STALE: no metrics file at ${outPath}`); process.exit(1); }
    const stored = JSON.parse(fs.readFileSync(outPath, "utf8"));
    const problems = [];
    if (stored.physics.fingerprint !== fingerprint) problems.push("the shot physics in free-kicks.js changed since the metrics were made");
    if (!stored.validator || stored.validator.sha256 !== sha256Text(fs.readFileSync(__filename, "utf8"))) problems.push("the validator (its model or thresholds) changed since the metrics were made");
    if (stored.cards.fingerprint !== cardsFingerprint(lib)) problems.push("the cards (positions, walls, keepers, tiers or sets) changed since the metrics were made");
    if (stored.model.grid !== opt.grid) problems.push(`metrics were made with the "${stored.model.grid}" grid, not "${opt.grid}"`);
    if (stored.summary.fail > 0) problems.push(`${stored.summary.fail} failure(s) recorded in the stored metrics`);
    if (problems.length) { console.error("CHECK FAILED:\n - " + problems.join("\n - ")); process.exit(1); }
    console.log(`OK: metrics are current (${stored.summary.pass} pass, ${stored.summary.warn} warn, 0 fail).`);
    return;
  }

  /* collect every distinct variant to sweep */
  const specOf = (card) => { const s = JSON.parse(JSON.stringify(card)); return s; };
  const byId = new Map(lib.cards.map((c) => [c.id, c]));
  const variants = new Map();            // key -> { card, tag, spec }
  const keyOf = (spec) => sha256(JSON.stringify({ ball: spec.ball, wall: spec.wall, keeper: spec.keeper })).slice(0, 16);
  const addVariant = (card, tag, spec) => { const key = keyOf(spec); if (!variants.has(key)) variants.set(key, { key, card, tag, spec }); return key; };
  const cardKeys = [];                   // [{ card, tag, key }]
  const onlySet = opt.only ? new Set(opt.only) : null;
  for (const card of lib.cards) {
    if (onlySet && !onlySet.has(card.id)) continue;
    const base = specOf(card);
    if (!opt.jitterOnly) {
      cardKeys.push({ card, tag: "base", key: addVariant(card, "base", base) });
      if (card.mirror) {
        const mk = addVariant(card, "mirror", mirrorSpec(base, constants.GOAL.cx));
        if (mk !== cardKeys[cardKeys.length - 1].key) cardKeys.push({ card, tag: "mirror", key: mk });   // a card on the goal axis mirrors onto itself
      }
    }
    if (opt.jitter && card.jitter) {
      for (const [dx, dy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const s = specOf(card);
        const bx = (s.ball && s.ball.x != null ? s.ball.x : constants.BALL_START.x) + dx * card.jitter;
        const by = (s.ball && s.ball.y != null ? s.ball.y : constants.BALL_START.y) + dy * card.jitter;
        s.ball = { x: bx, y: by };
        cardKeys.push({ card, tag: `jitter(${dx > 0 ? "+" : "-"}${card.jitter},${dy > 0 ? "+" : "-"}${card.jitter})`, key: addVariant(card, "jitter", s) });
      }
    }
  }
  const setResolved = [];
  if (!onlySet) {
    for (const set of lib.sets || []) {
      const kicks = set.kicks.map((k) => {
        const ref = typeof k === "string" ? { card: k } : k;
        const base = byId.get(ref.card);
        if (!base) throw new Error(`set ${set.id}: unknown card ${ref.card}`);
        let spec = specOf(base);
        const label = ref.card + (ref.mirror ? "<->" : "") + (ref.keeper ? `[${typeof ref.keeper === "string" ? ref.keeper : "custom"}]` : "");
        if (ref.mirror) spec = mirrorSpec(spec, constants.GOAL.cx);
        if (ref.keeper) spec.keeper = ref.keeper;
        if (ref.wall) spec.wall = Object.assign({}, spec.wall, ref.wall);
        const tagCard = Object.assign({}, base, { id: label, tier: undefined, intended: undefined });
        return { ref: label, card: tagCard, key: addVariant(tagCard, "set-kick", spec) };
      });
      setResolved.push({ set, kicks });
    }
  }

  const jobs = [...variants.values()].map((v) => ({ key: v.key, spec: v.spec, grid: opt.grid }));
  const t0 = Date.now();
  if (!opt.json) process.stderr.write(`Sweeping ${jobs.length} variant(s) on ${Math.min(opt.workers, jobs.length)} worker(s), "${grid.name}" grid...\n`);
  const sweeps = await runJobs(jobs, opt.workers, (d, n) => { if (!opt.json) process.stderr.write(`\r  ${d}/${n} done`); });
  if (!opt.json) process.stderr.write("\n");

  const results = cardKeys.map((ck) => judgeAny(ck.card, ck.tag, sweeps.get(ck.key), constants));
  /* a mirrored/jitter variant must not be harder than one band off the base */
  const baseTier = new Map(results.filter((r) => r.variant === "base").map((r) => [r.id, r]));
  results.forEach((r) => {
    if (r.variant === "base") return;
    const base = baseTier.get(r.id);
    const names = MODEL.tiers.map((t) => t[0]).concat("Reject");
    if (base && Math.abs(names.indexOf(r.tierMeasured) - names.indexOf(base.tierMeasured)) > 1) {
      r.issues.push({ level: "warn", code: "variant-tier-shift", msg: `${r.variant} measures ${r.tierMeasured} vs base ${base.tierMeasured}` });
    }
    if (r.variant !== "mirror" && r.tierMeasured === "Reject") r.issues.push({ level: "fail", code: "jitter-breaks-card", msg: "a jittered ball spot has no human route" });
    r.status = r.issues.some((i) => i.level === "fail") ? "fail" : r.issues.some((i) => i.level === "warn") ? "warn" : "pass";
  });

  const setResults = setResolved.map(({ set, kicks }) => {
    const kr = kicks.map((k) => {
      return Object.assign({}, judgeAny(k.card, "set-kick", sweeps.get(k.key), constants), { ref: k.ref });
    });
    return judgeSet(set, kr);
  });

  const all = results.concat(setResults);
  const summary = { pass: all.filter((r) => r.status === "pass").length, warn: all.filter((r) => r.status === "warn").length, fail: all.filter((r) => r.status === "fail").length };
  const report = {
    tool: "fk-validate", version: 1, generated: new Date().toISOString(), seconds: +((Date.now() - t0) / 1000).toFixed(1),
    physics: { file: PATHS.show(GAME_FILE), sha256: hash, fingerprint },
    validator: { file: "tools/free-kicks/validate.js", sha256: sha256Text(fs.readFileSync(__filename, "utf8")) },
    cards: { file: path.relative(process.cwd(), cardsPath), sha256: sha256Text(cardsText), fingerprint: cardsFingerprint(lib) },
    model: Object.assign({ grid: opt.grid }, MODEL, { gridDetail: grid }),
    partial: !!onlySet,
    results, sets: setResults, summary,
  };

  if (opt.write && !onlySet) fs.writeFileSync(outPath, JSON.stringify(report, null, 2) + "\n");
  if (opt.json) { console.log(JSON.stringify(report, null, 2)); process.exit(summary.fail ? 1 : 0); }

  console.log("");
  console.log(`${pad("card", 14)}${pad("variant", 17)}${pad("authored", 9)}${pad("tier cons>wide", 16)}${pad("mouse/touch", 12)}${pad("lob", 22)}${pad("curl", 22)}${pad("drive", 22)}${pad("bend", 22)}status`);
  for (const r of results) {
    console.log(`${pad(r.id, 14)}${pad(r.variant, 17)}${pad(r.tierAuthored || "-", 9)}${pad(r.tierMeasured === r.tierOptimistic ? r.tierMeasured : `${r.tierMeasured}>${r.tierOptimistic}`, 16)}${pad(`${r.mouse}/${r.touch}`, 12)}${pad(fmtRoute(r.routes.lob), 22)}${pad(fmtRoute(r.routes.curl), 22)}${pad(fmtRoute(r.routes.drive), 22)}${pad(fmtRoute(r.routes.bend), 22)}${r.status.toUpperCase()}`);
    r.issues.forEach((i) => console.log(`${" ".repeat(14)}${i.level === "fail" ? "FAIL" : "warn"} [${i.code}] ${i.msg}`));
  }
  for (const s of setResults) {
    console.log(`\nSET ${s.id} (${s.kind}) ${s.status.toUpperCase()}   conservative (aim within ${MODEL.conservativeAimDeg} deg) mouse >=3/>=4/5: ${s.odds.mouse.atLeast3}/${s.odds.mouse.atLeast4}/${s.odds.mouse.all5}%   touch: ${s.odds.touch.atLeast3}/${s.odds.touch.atLeast4}/${s.odds.touch.all5}%`);
    console.log("  kicks: " + s.kicks.map((k) => `${k.id} ${k.tier} ${k.mouse}/${k.touch}`).join("  |  "));
    console.log(`  with wide aim: mouse ${s.oddsWide.mouse.atLeast3}/${s.oddsWide.mouse.atLeast4}/${s.oddsWide.mouse.all5}%   touch ${s.oddsWide.touch.atLeast3}/${s.oddsWide.touch.atLeast4}/${s.oddsWide.touch.all5}%`);
    s.issues.forEach((i) => console.log(`  ${i.level === "fail" ? "FAIL" : "warn"} [${i.code}] ${i.msg}`));
  }
  console.log(`\nSummary: ${summary.pass} pass, ${summary.warn} warn, ${summary.fail} fail  (${report.seconds}s, ${opt.grid} grid)`);
  if (opt.write && !onlySet) console.log(`Metrics written to ${path.relative(process.cwd(), outPath)}`);
  if (opt.grid === "fast") console.log("NOTE: the fast grid is for iteration only; sign off with the normal grid.");
  process.exit(summary.fail ? 1 : 0);
}

/* ----- self-test: known answers from the earlier independent probe -------- */
async function selfTest(physics, constants, grid, opt) {
  const cases = [
    { name: "Kick-off (3 men, 250, K1)", spec: { ball: { x: 520, y: 690 }, wall: { men: 3, dist: 250 }, keeper: { tier: "K1" } }, expect: { lob: [35.5, 30], curl: [31.0, 33], bend: [6.5, 18] } },
    { name: "Short Wall (3 men, 190, K2)", spec: { ball: { x: 520, y: 690 }, wall: { men: 3, dist: 190 }, keeper: "K2" }, expect: { lob: null, curl: [7.0, 23], bend: [6.0, 15] } },
    { name: "Edge of the Box (5 men, 190, K5)", spec: { ball: { x: 520, y: 540 }, wall: { men: 5, dist: 190 }, keeper: "K5" }, expect: { lob: null, curl: [2.5, 5], bend: null } },
  ];
  const jobs = cases.map((c, i) => ({ key: String(i), spec: c.spec, grid: "normal" }));
  const sweeps = await runJobs(jobs, opt.workers);
  let failed = 0;
  cases.forEach((c, i) => {
    const r = sweeps.get(String(i)).routes;
    for (const [fam, want] of Object.entries(c.expect)) {
      const got = r[fam];
      let ok;
      if (want === null) ok = !got || got.widthDeg < 2;
      else ok = !!got && Math.abs(got.widthDeg - want[0]) <= 1.5 && Math.abs(got.widthPct - want[1]) <= 2.5;
      if (!ok) failed++;
      console.log(`${ok ? "ok  " : "FAIL"} ${pad(c.name, 36)} ${pad(fam, 6)} expected ${want ? want.join("°x") + "%" : "none"}  got ${got ? `${got.widthDeg}°x${got.widthPct}%` : "none"}`);
    }
  });
  console.log(failed ? `\nSELF-TEST FAILED (${failed})` : "\nSelf-test passed: the validator reproduces the earlier independent measurements.");
  process.exit(failed ? 1 : 0);
}

main().catch((err) => { console.error(err); process.exit(1); });
