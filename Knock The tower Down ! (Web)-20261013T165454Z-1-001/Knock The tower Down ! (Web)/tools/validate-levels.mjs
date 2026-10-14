// Headless level validator. Runs the real physics engine over every campaign
// level with no DOM, and reports: resting drift (does the structure stand?),
// solver cost, and what a single rock to the midsection actually achieves.
//
//   node tools/validate-levels.mjs
//   node tools/validate-levels.mjs 6        # one level, verbose
import { LEVELS, GROUND_Y, SLING, levelView } from '../src/levels.js';
import { makeBlock, makeBall, stepWorld, warmup, PROJECTILES, BOUNDS } from '../src/physics.js';

function build(def) {
  const bodies = [];
  for (const b of def.blocks) bodies.push(makeBlock(b.x, b.y, b.w, b.h, b.material, b.angle || 0));
  for (const p of def.platforms || []) bodies.push(makeBlock(p.x, p.y, p.w, p.h, 'steel', p.angle || 0, { isStatic: true }));
  for (const t of def.targets) bodies.push(makeBall(t.x, t.y, t.r, { kind: 'target', isTarget: true, hp: 22, density: 0.9 }));
  return bodies;
}

// Static authoring check, run before any simulation. Overlapping bodies fire a
// huge separating impulse on frame 1 and can fell an otherwise sound structure,
// and a core sunk into the surface it rests on does the same — both are easy
// to introduce by hand and impossible to see in the numbers afterwards.
function geometryCheck(def) {
  const errs = [];
  const r = def.blocks.map(b => ({
    b, l: b.x - b.w / 2, r: b.x + b.w / 2, t: b.y - b.h / 2, bo: b.y + b.h / 2,
    id: `${b.material} ${b.w}x${b.h} @${Math.round(b.x)},${Math.round(b.y)}`,
  }));
  for (let i = 0; i < r.length; i++) {
    for (let j = i + 1; j < r.length; j++) {
      const a = r[i], c = r[j];
      const ox = Math.min(a.r, c.r) - Math.max(a.l, c.l);
      const oy = Math.min(a.bo, c.bo) - Math.max(a.t, c.t);
      if (ox > 0.5 && oy > 0.5) errs.push(`overlap ${ox.toFixed(0)}x${oy.toFixed(0)}: ${a.id} vs ${c.id}`);
    }
    if (r[i].bo > GROUND_Y + 0.5) errs.push(`sunk ${(r[i].bo - GROUND_Y).toFixed(1)} into ground: ${r[i].id}`);
  }
  for (const t of def.targets) {
    const id = `core r${t.r} @${Math.round(t.x)},${Math.round(t.y)}`;
    for (const o of r) {
      const nx = Math.max(o.l, Math.min(t.x, o.r)), ny = Math.max(o.t, Math.min(t.y, o.bo));
      const d = Math.hypot(t.x - nx, t.y - ny);
      if (d < t.r - 0.5) errs.push(`core embedded ${(t.r - d).toFixed(1)} deep: ${id} in ${o.id}`);
    }
    // it must actually be resting on something
    const bot = t.y + t.r;
    let rest = Math.abs(bot - GROUND_Y) < 1.5;
    for (const o of r) {
      if (t.x > o.l - t.r && t.x < o.r + t.r && Math.abs(bot - o.t) < 1.5) rest = true;
    }
    if (!rest) errs.push(`core floating (bottom ${bot.toFixed(1)} rests on nothing): ${id}`);
  }
  return errs;
}

// Does the level stand still when nobody touches it?
function restTest(def, steps = 240) {
  const bodies = build(def);
  // measure drift from the pose the player is actually shown, after warm-up
  warmup(bodies, GROUND_Y);
  const x0 = bodies.map(b => b.x), y0 = bodies.map(b => b.y), a0 = bodies.map(b => b.angle);
  const t0 = performance.now();
  for (let s = 0; s < steps; s++) stepWorld(bodies, 1 / 60, GROUND_Y, []);
  const ms = (performance.now() - t0) / steps;
  // Blocks and cores are held to different standards: a block that moves has
  // shifted structurally, while a core is a sphere on a flat top and always
  // creeps a few px as the stack settles under it.
  let drift = 0, roll = 0, spin = 0, worst = '', destroyed = 0, awake = 0;
  bodies.forEach((b, k) => {
    if (b.destroyed) { destroyed++; return; }
    if (b.isStatic) return;
    if (!b.sleeping) awake++;
    const d = Math.hypot(b.x - x0[k], b.y - y0[k]);
    if (b.isTarget) { roll = Math.max(roll, d); return; }
    if (d > drift) { drift = d; worst = `${b.material} ${Math.round(b.w)}x${Math.round(b.h)} @${Math.round(x0[k])},${Math.round(y0[k])}`; }
    spin = Math.max(spin, Math.abs(b.angle - a0[k]));
  });
  return { drift, roll, spin, worst, destroyed, awake, ms, n: bodies.length };
}

// Fire one rock at a point and report the damage done.
const MAX_SPEED = 1700; // fire() clamps launch speed to this
function shotTest(def, aimX, aimY, vx, vy, steps = 600) {
  const bodies = build(def);
  warmup(bodies, GROUND_Y);
  const before = bodies.map(b => ({ b, x: b.x, y: b.y }));
  const P = PROJECTILES.rock;
  const rock = makeBall(aimX, aimY, P.r, {
    kind: 'proj', material: 'rock', friction: P.friction,
    restitution: P.restitution, density: P.density, isProjectile: true,
  });
  rock.vx = vx; rock.vy = vy;
  bodies.push(rock);
  let broke = 0, peak = 0;
  const t0 = performance.now();
  for (let s = 0; s < steps; s++) {
    const ev = [];
    const st = performance.now();
    stepWorld(bodies, 1 / 60, GROUND_Y, ev);
    peak = Math.max(peak, performance.now() - st);
    for (const e of ev) if (e.type === 'destroy' && e.body.kind === 'block') broke++;
  }
  const ms = (performance.now() - t0) / steps;
  const landed = rock.destroyed
    ? (rock.x > BOUNDS.maxX ? 'flew past' : rock.y > GROUND_Y + 20 ? 'off world' : 'spent')
    : `x=${Math.round(rock.x)}`;
  let moved = 0, coresDown = 0;
  for (const rec of before) {
    const b = rec.b;
    if (b.isStatic) continue;
    const d = Math.hypot(b.x - rec.x, b.y - rec.y);
    if (b.isTarget) {
      // a core that starts on the dirt is sheltered, not already defeated
      if (b.destroyed || d > 130 || (!b.startsGrounded && b.y + b.r >= GROUND_Y - 4)) coresDown++;
    } else if (b.destroyed || d > 60) moved++;
  }
  return { broke, moved, coresDown, ms, peak, landed };
}

const only = process.argv[2] ? parseInt(process.argv[2], 10) : null;
let fails = 0;
console.log('level                 n    drift   roll   spin  awake  gone  ms/step  view');
console.log('-'.repeat(82));
LEVELS.forEach((def, i) => {
  if (only !== null && only !== i + 1) return;
  const geo = geometryCheck(def);
  const r = restTest(def);
  const v = levelView(def);
  const bad = geo.length > 0 || r.drift > 6 || r.roll > 40 || r.destroyed > 0 || r.awake > 0;
  if (bad) fails++;
  const tag = `${i + 1} ${def.name}${def.tier === 'bonus' ? ' *' : ''}`;
  console.log(
    `${tag.padEnd(20)} ${String(r.n).padStart(3)} ${r.drift.toFixed(2).padStart(8)} ` +
    `${r.roll.toFixed(1).padStart(6)} ${r.spin.toFixed(3).padStart(6)} ${String(r.awake).padStart(6)} ` +
    `${String(r.destroyed).padStart(5)} ${r.ms.toFixed(3).padStart(8)}  w=${Math.round(v.w)}${bad ? '  <-- FAIL' : ''}`
  );
  for (const e of geo.slice(0, 6)) console.log(`${' '.repeat(22)}geom: ${e}`);
  if (r.drift > 6 && r.worst) console.log(`${' '.repeat(22)}worst mover: ${r.worst}`);
});

if (only !== null) {
  const def = LEVELS[only - 1];
  // Fire from the real slingshot at the real speed cap, so the numbers mean
  // what a player can actually do. A probe launched point-blank at 1500 u/s
  // flatters every level and makes them all look trivially solvable.
  console.log(`\nshot probes from the sling (rock, max power ${MAX_SPEED} u/s, 600 steps):`);
  console.log('  angle  lands        broke  displaced  cores      ms/step  peak');
  let best = 0;
  for (const deg of [10, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65]) {
    const a = (deg * Math.PI) / 180;
    const vx = Math.cos(a) * MAX_SPEED, vy = -Math.sin(a) * MAX_SPEED;
    const s = shotTest(def, SLING.x, SLING.y, vx, vy);
    best = Math.max(best, s.coresDown);
    console.log(
      `  ${String(deg).padStart(4)}°  ${s.landed.padEnd(12)} ${String(s.broke).padStart(5)} ` +
      `${String(s.moved).padStart(10)}  ${s.coresDown}/${def.targets.length}` +
      `${s.coresDown === def.targets.length ? ' CLEAR' : '     '}  ${s.ms.toFixed(2).padStart(7)} ${s.peak.toFixed(1).padStart(5)}`
    );
  }
  console.log(`  best single shot: ${best}/${def.targets.length} cores  (par ${def.par}, ${def.shots.length} shots)`);
}
console.log(fails ? `\n${fails} level(s) do not rest.` : '\nAll levels rest at load.');
