// Endless Mode verification. Generates maps headlessly for depths 1-30 across
// several seeds and checks, independently of the generator's own pipeline:
//   * generation never throws and rarely falls back to the plain stack
//   * every generated map actually RESTS (240 real steps, drift <= 12)
//   * no authoring errors (overlaps, floating/embedded cores, sunk blocks)
//   * a greedy shot plan clears the map inside its own shot budget
//     (checked for a subset of depths — the greedy is slow by nature)
//
//   node tools/verify-endless.mjs
import { genEndlessMap, difficultyFor, createRun } from '../src/endless.js';
import { GROUND_Y, WORLD_W } from '../src/levels.js';
import { makeBlock, makeBall, stepWorld, warmup } from '../src/physics.js';
import { greedyPlan, confirm } from './greedy-play.mjs';

const DEPTHS = 30;
const SEEDS = [1, 7, 42, 1337, 90210];
const SOLVE_DEPTHS = [1, 2, 3, 4, 6, 9, 13, 19, 26, 30];
const SOLVE_SEEDS = [42, 1337];
const G = GROUND_Y;

function bodies(def) {
  const out = [];
  for (const b of def.blocks) out.push(makeBlock(b.x, b.y, b.w, b.h, b.material, b.angle || 0));
  for (const t of def.targets) out.push(makeBall(t.x, t.y, t.r, { kind: 'target', isTarget: true, hp: 22, density: 0.9 }));
  return out;
}

// Independent authoring re-check: overlaps, sunk blocks, embedded/floating cores.
function geometry(def) {
  const errs = [];
  const r = def.blocks.map((b) => ({ b, l: b.x - b.w / 2, rr: b.x + b.w / 2, t: b.y - b.h / 2, bo: b.y + b.h / 2 }));
  for (let i = 0; i < r.length; i++) {
    if (r[i].bo > G + 0.5 || r[i].l < 100 || r[i].rr > WORLD_W - 40 || r[i].t < 300) errs.push('block out of bounds');
    for (let j = i + 1; j < r.length; j++) {
      const a = r[i], c = r[j];
      if (Math.min(a.rr, c.rr) - Math.max(a.l, c.l) > 0.5 && Math.min(a.bo, c.bo) - Math.max(a.t, c.t) > 0.5) errs.push('overlap');
    }
  }
  for (const t of def.targets) {
    if (t.x < 150 || t.x > WORLD_W - 40 || t.y < 320) errs.push('target out of bounds');
    for (const o of r) {
      const nx = Math.max(o.l, Math.min(t.x, o.rr)), ny = Math.max(o.t, Math.min(t.y, o.bo));
      if (Math.hypot(t.x - nx, t.y - ny) < t.r - 0.5) errs.push('target embedded');
    }
    const bot = t.y + t.r;
    let rest = Math.abs(bot - G) < 1.5;
    for (const o of r) if (t.x > o.l - t.r && t.x < o.rr + t.r && Math.abs(bot - o.t) < 1.5) rest = true;
    if (!rest) errs.push('target floating');
  }
  return errs;
}

// Does the map stand still? Same standard as the campaign validator.
function restCheck(def) {
  const bs = bodies(def);
  warmup(bs, G);
  const x0 = bs.map((b) => b.x), y0 = bs.map((b) => b.y);
  for (let s = 0; s < 240; s++) stepWorld(bs, 1 / 60, G, []);
  let drift = 0, destroyed = 0, awake = 0;
  bs.forEach((b, k) => {
    if (b.isStatic) return;
    if (b.destroyed) { destroyed++; return; }
    if (!b.sleeping) awake++;
    drift = Math.max(drift, Math.hypot(b.x - x0[k], b.y - y0[k]));
  });
  return { drift, destroyed, awake };
}

const archetypes = {};
let total = 0, fallbacks = 0, restFails = 0, geomFails = 0, drills = 0, cleared = 0, solveTried = 0;

console.log('depth wave         seed    archetype        blocks targets shots  drift  gone awake geom  verdict');
console.log('-'.repeat(96));
for (let depth = 1; depth <= DEPTHS; depth++) {
  const diff = difficultyFor(depth);
  for (const seed of SEEDS) {
    let def;
    try {
      def = genEndlessMap(depth, seed);
    } catch (e) {
      console.log(`${String(depth).padStart(5)} ${diff.wave.padEnd(12)} ${String(seed).padStart(6)}  THREW: ${e.message}`);
      drills++;
      continue;
    }
    total++;
    if (def.fallback) fallbacks++;
    const arch = def.archetype;
    archetypes[arch] = (archetypes[arch] || 0) + 1;
    const geo = geometry(def);
    const rest = restCheck(def);
    const restBad = rest.drift > 12 || rest.destroyed > 0 || rest.awake > 0;
    if (geo.length) geomFails++;
    if (restBad) restFails++;
    const ok = !geo.length && !restBad;
    console.log(
      `${String(depth).padStart(5)} ${diff.wave.padEnd(12)} ${String(seed).padStart(6)}  ${String(arch).padEnd(16)} ` +
      `${String(def.blocks.length).padStart(6)} ${String(def.targets.length).padStart(7)} ${String(def.shots.length).padStart(5)} ` +
      `${rest.drift.toFixed(1).padStart(7)} ${String(rest.destroyed).padStart(5)} ${String(rest.awake).padStart(5)} ` +
      `${String(geo.length).padStart(4)}  ${ok ? 'ok' : 'FAIL ' + geo.join(',') + (restBad ? ` drift=${rest.drift.toFixed(1)} gone=${rest.destroyed} awake=${rest.awake}` : '')}`
    );
  }
}

// Solvability subset: can a greedy plan clear generated maps in budget?
console.log('\nsolvability (greedy plan, evidence over replays):');
for (const depth of SOLVE_DEPTHS) {
  for (const seed of SOLVE_SEEDS) {
    const def = genEndlessMap(depth, seed);
    const run = createRun(seed);
    const start = (g) => {
      g.state.mode = 'endless';
      g.state.run = run;
      g.loadDef(def);
      g.state.screen = 'play';
      g.state.canAim = !!g.state.loaded;
    };
    const { chosen } = greedyPlan(start, def.shots.length);
    const { wins, replays } = confirm(start, chosen, 3);
    solveTried++;
    if (wins > 0) cleared++;
    console.log(`  depth ${String(depth).padStart(2)} seed ${String(seed).padStart(6)}  ${def.archetype.padEnd(16)} ${wins}/${replays} ${wins > 0 ? 'CLEARED' : 'NOT CLEARED'}   plan: ${chosen.join(' ')}`);
  }
}

console.log(`\n=== summary ===`);
console.log(`maps generated: ${total} (${fallbacks} fallback, ${drills} threw)`);
console.log(`rest failures: ${restFails}   geometry failures: ${geomFails}`);
console.log(`archetype mix: ${Object.entries(archetypes).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}:${v}`).join('  ')}`);
console.log(`solvable: ${cleared}/${solveTried} generated maps cleared inside their shot budget`);
const bad = restFails + geomFails + drills;
console.log(bad ? `\n${bad} problem(s) found.` : '\nAll generated maps rest, validate, and stay inside bounds.');
