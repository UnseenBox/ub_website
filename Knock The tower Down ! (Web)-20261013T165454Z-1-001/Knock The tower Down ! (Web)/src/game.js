// Game state, rules, scoring, progression, FX.
// States: title | levels | aim | flying | settling | result (win/lose inside result screen)
import { LEVELS, GROUND_Y, SLING, WORLD_W, levelView } from './levels.js';
import { MATERIALS, PROJECTILES, makeBlock, makeBall, stepWorld, warmup, BOUNDS } from './physics.js';
import { aimVel } from './renderer.js';
import { launchBoost } from './input.js';
import { createRun, genEndlessMap, loadEndlessBest, storeEndlessBest } from './endless.js';
import { sfx } from './audio.js';
import { PAL, DEBRIS } from './palette.js';

// Save persistence. The campaign gained eight levels inserted BEFORE the two
// monuments (levels 7-14, monuments now 15-16), which shifted every saved
// index, so the format moved to a v2 key. The migration is one-time and
// idempotent: v2 is authoritative once written, v1 is read for migration but
// never modified or deleted, and repeated loads never re-migrate.
const SAVE_KEY_V1 = 'ktd_save_v1'; // legacy: 6 campaign + monuments at 6,7
const SAVE_KEY = 'ktd_save_v2';    // current: monuments at the end

function readSaveJSON(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const s = JSON.parse(raw);
    return s && typeof s === 'object' ? s : null;
  } catch { return null; }
}

// Map a legacy save onto the new level layout. `unlocked` is a COUNT of
// unlocked levels (ui.js: i + 1 > unlocked = locked), so:
//   old N <= 6  -> N            (same campaign levels, same indices)
//   old N  > 6  -> N + 8        (old monuments 7-8 are now 15-16; in a
//                                 count-based schema the only way to keep them
//                                 unlocked is to extend the count, which also
//                                 unlocks the extension levels)
// stars/best are index-keyed arrays: entries at old index >= 6 shift by +8,
// everything else stays put, so nobody's record moves to a different tower.
function migrateSave(v1) {
  const ext = LEVELS.length - 8;                 // number of inserted extension levels
  const shiftAt = LEVELS.length - ext - 2;       // first monument index in the old layout (= 6)
  const stars = new Array(LEVELS.length).fill(0), best = new Array(LEVELS.length).fill(0);
  const s = Array.isArray(v1.stars) ? v1.stars : [];
  const b = Array.isArray(v1.best) ? v1.best : [];
  const oldCount = Math.max(s.length, b.length);
  for (let i = 0; i < oldCount; i++) {
    const ni = i >= shiftAt ? i + ext : i;
    stars[ni] = s[i] ?? 0;
    best[ni] = b[i] ?? 0;
  }
  const oldN = Math.max(1, Math.min(LEVELS.length - ext, v1.unlocked ?? 1));
  const unlocked = oldN <= shiftAt ? oldN : Math.min(LEVELS.length, oldN + ext);
  return { unlocked, stars, best };
}

export function loadSave() {
  const v2 = readSaveJSON(SAVE_KEY);
  let src = v2 && Array.isArray(v2.stars) ? v2 : null;
  let migrated = false;
  if (!src) {
    const v1 = readSaveJSON(SAVE_KEY_V1);
    if (v1) { src = migrateSave(v1); migrated = true; }
  }
  if (!src) return { unlocked: 1, stars: [], best: [] };
  if (migrated) {
    // persist the migrated copy under the new key only; v1 is left untouched
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(src)); } catch {}
  }
  return {
    unlocked: Math.min(LEVELS.length, Math.max(1, src.unlocked ?? 1)),
    stars: Array.isArray(src.stars) ? src.stars : [],
    best: Array.isArray(src.best) ? src.best : [],
  };
}
export function storeSave(save) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch {}
}

const PROJ_LABEL = { rock: '#', bouncy: 'o', splitter: '*' };
const PROJ_DESC = {
  rock: 'Heavy # — smashes stone & shakes towers.',
  bouncy: 'Bouncy o — wild angles, great for trick shots.',
  splitter: 'Splitter * — bursts into shards on hard impact.',
};

export function createGame() {
  const save = loadSave();
  const fx = {
    particles: [], confetti: [], floaters: [],
    shake: 0, flash: 0, time: 0,
    tsTimer: 0, tsScale: 1, // cinematic timescale accent (hit-stop / slow-mo)
  };
  // particle pool (fixed cap)
  for (let i = 0; i < 320; i++) fx.particles.push({ life: 0, maxLife: 1, x: 0, y: 0, vx: 0, vy: 0, size: 3, color: '#fff', rot: 0, vr: 0, shape: 'dot' });
  let pCursor = 0;
  for (let i = 0; i < 120; i++) fx.confetti.push({ life: 0, x: 0, y: 0, vx: 0, vy: 0, rot: 0, vr: 0, color: '#fff' });
  let cCursor = 0;

  const state = {
    screen: 'title', levelIndex: 0, def: null,
    mode: 'campaign', run: null, // endless run state (null in campaign)
    bodies: [], platforms: [],
    shots: [], shotIndex: 0, loadedType: null, loaded: false,
    canAim: false, flying: null, settleTimer: 0, stillTimer: 0,
    score: 0, destroyedCount: 0, toppledCount: 0, targetsDown: 0, targetsTotal: 0,
    totalMass: 0, massDown: 0, collapseFired: false, chunkCount: 0, view: null,
    shotsUsed: 0, result: null, resultShown: false,
    hint: '', save, muted: false,
  };

  function spawnParticles(x, y, opts = {}) {
    const n = opts.n ?? 10;
    for (let i = 0; i < n; i++) {
      const p = fx.particles[pCursor]; pCursor = (pCursor + 1) % fx.particles.length;
      const a = opts.dir !== undefined
        ? opts.dir + (Math.random() - 0.5) * (opts.spread ?? 1.8)
        : Math.random() * Math.PI * 2;
      const sp = (opts.speed ?? 260) * (0.3 + Math.random() * 0.9);
      p.x = x; p.y = y;
      p.vx = Math.cos(a) * sp + (opts.vx ?? 0); p.vy = Math.sin(a) * sp - (opts.up ?? 120);
      p.maxLife = p.life = (opts.life ?? 0.7) * (0.6 + Math.random() * 0.7);
      p.size = (opts.size ?? 4) * (0.6 + Math.random() * 0.8);
      p.color = Array.isArray(opts.color) ? opts.color[i % opts.color.length] : (opts.color ?? '#fff');
      p.ch = Array.isArray(opts.ch) ? opts.ch[i % opts.ch.length] : (opts.ch ?? null);
      p.rot = Math.random() * 6; p.vr = (Math.random() - 0.5) * 12;
      p.shape = opts.shape ?? 'dot';
    }
  }
  function burstConfetti(n = 80) {
    const cols = [PAL.white, PAL.bone, PAL.grey];
    for (let i = 0; i < n; i++) {
      const c = fx.confetti[cCursor]; cCursor = (cCursor + 1) % fx.confetti.length;
      c.x = WORLD_W * 0.4 + Math.random() * WORLD_W * 0.5; c.y = -20 - Math.random() * 120;
      c.vx = (Math.random() - 0.5) * 120; c.vy = 120 + Math.random() * 160;
      c.rot = Math.random() * 6; c.vr = (Math.random() - 0.5) * 10;
      c.color = cols[i % cols.length]; c.life = 2.5 + Math.random();
    }
  }
  function floater(x, y, text, color = '#ff9b2f', small = false) {
    fx.floaters.push({ x, y, text, color, small, life: small ? 0.7 : 1.2, max: small ? 0.7 : 1.2 });
    if (fx.floaters.length > 16) fx.floaters.shift();
  }

  function loadDef(def) {
    state.def = def;
    state.bodies = []; state.platforms = [];
    state.shots = [...def.shots]; state.shotIndex = 0;
    state.score = 0; state.destroyedCount = 0; state.toppledCount = 0; state.targetsDown = 0;
    state.targetsTotal = def.targets.length;
    state.shotsUsed = 0; state.result = null; state.resultShown = false;
    state.flying = null; state.settleTimer = 0; state.stillTimer = 0;
    destroyTimes = []; lastComboAt = -99;
    lastHitstop = -99; lastSlowmo = -99;
    fx.tsTimer = 0; fx.tsScale = 1;
    fx.floaters.length = 0;
    for (const p of fx.particles) p.life = 0;
    for (const c of fx.confetti) c.life = 0;
    fx.shake = 0; fx.flash = 0;

    for (const b of def.blocks) state.bodies.push(makeBlock(b.x, b.y, b.w, b.h, b.material, b.angle || 0, { pattern: b.pattern }));
    for (const pf of (def.platforms || [])) {
      const s = makeBlock(pf.x, pf.y, pf.w, pf.h, 'steel', pf.angle || 0, { isStatic: true });
      state.platforms.push(s); state.bodies.push(s);
    }
    def.targets.forEach((td, i) => {
      const t = makeBall(td.x, td.y, td.r, {
        kind: 'target', material: 'core', friction: 0.9, restitution: 0.2,
        hp: 22, maxHp: 22, isTarget: true, density: 0.9, groundY: GROUND_Y,
      });
      t.coreIdx = ((state.mode === 'endless' && state.run ? state.run.depth : state.levelIndex) + i) % 4;
      state.bodies.push(t);
    });
    // Settle the structure before the player sees it, then take the settled
    // pose as home. Without this every level visibly slumps a few px on load,
    // and the slump itself would score topple bonuses and shift the cores.
    warmup(state.bodies, GROUND_Y);
    for (const b of state.bodies) { b.homeX = b.x; b.homeY = b.y; b.toppleScored = false; }
    // Collapse accounting: how much of this structure is still standing is
    // what separates knocking a block over from bringing a building down.
    state.totalMass = 0;
    for (const b of state.bodies) if (b.kind === 'block' && !b.isStatic) state.totalMass += b.mass;
    state.massDown = 0;
    state.collapseFired = false;
    state.chunkCount = 0;
    state.view = levelView(def);
    state.hint = def.hint;
    loadNextShot();
  }

  function loadLevel(idx) {
    state.levelIndex = idx;
    loadDef(LEVELS[idx]);
  }

  function loadNextShot() {
    if (state.shotIndex >= state.shots.length) { state.loaded = false; state.loadedType = null; return; }
    state.loadedType = state.shots[state.shotIndex];
    state.loaded = true;
    state.canAim = state.screen === 'play';
  }

  function fire(aim) {
    if (!state.loaded || !state.canAim || state.screen !== 'play') return false;
    const boost = launchBoost(aim); // fast-launch: quick flicks hit up to +45%
    const v = aimVel(aim);
    const vx = v.x * boost, vy = v.y * boost;
    const speed = Math.min(1700, Math.hypot(vx, vy));
    if (speed < 120) return false;
    const type = state.loadedType;
    const P = PROJECTILES[type];
    const b = makeBall(SLING.x, SLING.y, P.r, {
      kind: 'proj', material: type, friction: P.friction, restitution: P.restitution,
      density: P.density, isProjectile: true,
    });
    const k = speed / Math.max(1, Math.hypot(vx, vy));
    b.vx = vx * k; b.vy = vy * k;
    b.angVel = -b.vx * 0.002;
    b.boosted = boost;
    b.trail = null;
    lastSlowmo = -99; // fresh shot, fresh spectacle
    state.bodies.push(b);
    state.flying = b;
    state.loaded = false; state.canAim = false;
    state.shotsUsed++;
    sfx.launch(Math.min(1, speed / 1000));
    spawnParticles(SLING.x, SLING.y, { n: 8, color: [PAL.bone, PAL.white], ch: ['.', '+'], speed: 140 * boost, size: 4, life: 0.4 });
    if (boost > 1.15) {
      fx.shake = Math.min(10, fx.shake + 3);
      floater(SLING.x, SLING.y - 60, `FAST x${boost.toFixed(2)}`, PAL.hot);
    }
    return true;
  }

  function splitterBurst(parent) {
    if (parent.hasSplit) return;
    parent.hasSplit = true;
    sfx.split();
    spawnParticles(parent.x, parent.y, { n: 14, color: [PAL.white, PAL.bone], ch: ['*', '+', 'x'], speed: 380, size: 5, life: 0.6, shape: 'spark' });
    fx.shake = Math.min(14, fx.shake + 5);
    for (let k = -1; k <= 1; k++) {
      const P = PROJECTILES.shard;
      const s = makeBall(parent.x, parent.y, P.r, {
        kind: 'shard', material: 'splitter', friction: P.friction, restitution: P.restitution,
        density: P.density, isProjectile: true,
      });
      const baseA = Math.atan2(parent.vy, parent.vx);
      const a = baseA + k * 0.55;
      const sp = Math.min(900, Math.hypot(parent.vx, parent.vy) * 0.75 + 150);
      s.vx = Math.cos(a) * sp; s.vy = Math.sin(a) * sp - 80;
      s.hasSplit = true;
      state.bodies.push(s);
    }
  }

  function onImpact(ev) {
    const spd = ev.speed;
    const a = ev.a, b = ev.b;
    const matA = a?.material, matB = b?.material;
    // hit-stop accent on truly heavy connects (brief, cooldown-guarded)
    if (spd > 750 && fx.time - lastHitstop > 0.4 && fx.tsTimer <= 0) {
      lastHitstop = fx.time;
      fx.tsTimer = 0.07; fx.tsScale = 0.12;
    }
    // sound routing
    if (matA === 'glass' || matB === 'glass') sfx.glass();
    else if (matA === 'stone' || matB === 'stone' || spd > 700) sfx.stone(spd);
    else if (matA === 'wood' || matB === 'wood') sfx.wood(spd);
    else sfx.impact(spd, spd > 650);
    // fx: directional debris cone along the collision axis + material glyphs
    if (spd > 260) {
      const glassy = matA === 'glass' || matB === 'glass';
      const stony = matA === 'stone' || matB === 'stone';
      const cols = glassy
        ? [PAL.white, PAL.bone, PAL.grey]
        : stony ? [PAL.bone, PAL.grey] : [PAL.grey, PAL.bone];
      const ch = DEBRIS[glassy ? 'glass' : stony ? 'stone' : 'wood'];
      const dir = Math.atan2(ev.ny ?? 1, ev.nx ?? 0);
      spawnParticles(ev.x, ev.y, { n: Math.min(14, 3 + spd / 130), color: cols, ch, dir, spread: 2.4, speed: spd * 0.35, size: 4, life: 0.55 });
      // heavy rock digs in: compact clod-burst (few, slow, dense glyphs)
      const rockProj = [a, b].find(p => p && p.kind === 'proj' && p.material === 'rock');
      if (rockProj && spd > 500) {
        spawnParticles(ev.x, ev.y, { n: 6, color: [PAL.bone, PAL.grey], ch: ['#', '#', '%'], dir, spread: 1.2, speed: spd * 0.16, size: 7, life: 0.9 });
      }
      if (spd > 620) {
        fx.shake = Math.min(16, fx.shake + (spd - 620) / 130);
        spawnParticles(ev.x, ev.y, { n: 1, color: [PAL.white], speed: 40, size: 8, life: 0.25, shape: 'ring' });
      }
    }
    // splitter trigger
    for (const body of [a, b]) {
      if (body && (body.kind === 'proj') && body.material === 'splitter' && !body.hasSplit && spd > 330) {
        splitterBurst(body);
      }
    }
    // squash targets on hard hits
    for (const body of [a, b]) {
      if (body && body.isTarget && spd > 200) body.squash = Math.min(1, (body.squash || 0) + spd / 900);
    }
    // stress: the renderer reads this to crack a block's glyph pattern where
    // it was actually struck, so damage is visible before failure
    for (const body of [a, b]) {
      if (body && !body.isStatic) body.stress = Math.min(1, (body.stress || 0) + spd / 1400);
    }
  }

  // Non-lethal damage numbers (screenshot-style): throttled per body so a
  // graze still reads without spamming during grinding contacts.
  function onHarm(ev) {
    const b = ev.body;
    if (!b || b.destroyed) return;
    if (ev.amount < 5) return;
    if (fx.time - (b._lastHarmT ?? -99) < 0.3) return;
    b._lastHarmT = fx.time;
    floater(ev.x, ev.y - 12, `-${Math.round(ev.amount)}`, PAL.grey, true);
  }

  function onDestroy(body) {
    // scoring + fx for blocks and targets — every award fires exactly once
    // per body (destroyed flag) or per burst (combo throttle below).
    if (body.isTarget) {
      killTarget(body, false);
      comboHit(body.x, body.y);
      return;
    }
    if (body.kind === 'shard' || body.kind === 'proj') {
      spawnParticles(body.x, body.y, { n: 6, color: [PAL.bone, PAL.grey], ch: ['*', '+'], speed: 200, size: 3, life: 0.4 });
      return;
    }
    // debris breaking up again: fragments only, no score, no chunks
    if (body.isDebris) {
      state.chunkCount = Math.max(0, state.chunkCount - 1);
      spawnParticles(body.x, body.y, {
        n: 6, color: [PAL.grey, PAL.dim], ch: DEBRIS[body.material] || DEBRIS.wood,
        speed: 180, size: 4, life: 0.45, shape: 'rect',
      });
      return;
    }
    const M = MATERIALS[body.material] || MATERIALS.wood;
    state.score += M.score;
    state.destroyedCount++;
    floater(body.x, body.y - 20, `+${M.score}`, PAL.bone);
    comboHit(body.x, body.y - 44);
    countDown(body);
    spawnChunks(body);
    const ch = DEBRIS[body.material] || DEBRIS.wood;
    if (body.material === 'glass') {
      sfx.glass();
      spawnParticles(body.x, body.y, { n: 18, color: [PAL.white, PAL.bone, PAL.grey], ch, speed: 360, size: 5, life: 0.7, shape: 'rect' });
    } else if (body.material === 'stone') {
      sfx.collapse();
      fx.shake = Math.min(15, fx.shake + 4);
      spawnParticles(body.x, body.y, { n: 14, color: [PAL.white, PAL.bone, PAL.grey], ch, speed: 300, size: 7, life: 0.85, shape: 'rect' });
    } else {
      spawnParticles(body.x, body.y, { n: 12, color: [PAL.bone, PAL.grey, PAL.dim], ch, speed: 280, size: 6, life: 0.7, shape: 'rect' });
    }
  }

  // Structural accounting. A block counts as "down" the first time it is
  // destroyed or clearly displaced; once enough of the structure's mass is
  // down at once, this was not a block falling over, it was a collapse.
  function countDown(b) {
    if (b._counted || b.isStatic || b.isDebris || b.kind !== 'block') return;
    b._counted = true;
    state.massDown += b.mass;
    if (state.collapseFired || !state.totalMass) return;
    if (state.destroyedCount + state.toppledCount < 5) return;
    if (state.massDown / state.totalMass < 0.42) return;
    state.collapseFired = true;
    const bonus = 1500;
    state.score += bonus;
    floater(b.x, b.y - 70, `COLLAPSE +${bonus}`, PAL.hot);
    sfx.collapse();
    fx.shake = Math.min(22, fx.shake + 14);
    fx.flash = 1;
    // the decisive moment earns a real slow-motion beat
    if (fx.tsTimer <= 0) { fx.tsTimer = 1.0; fx.tsScale = 0.35; }
    spawnParticles(b.x, b.y, { n: 3, color: [PAL.hot, PAL.white], speed: 60, size: 11, life: 0.6, shape: 'ring' });
  }

  // Chain-reaction bonus: 3+ destroys inside 1.5s pay extra, once per burst.
  let destroyTimes = [];
  let lastComboAt = -99;
  let lastHitstop = -99;
  let lastSlowmo = -99;
  function comboHit(x, y) {
    const now = fx.time;
    destroyTimes.push(now);
    while (destroyTimes.length && now - destroyTimes[0] > 1.5) destroyTimes.shift();
    const count = destroyTimes.length;
    if (count >= 3 && now - lastComboAt > 1.5) {
      lastComboAt = now;
      const bonus = 100 * (count - 2);
      state.score += bonus;
      floater(x, y - 18, `COMBO x${count} +${bonus}`, PAL.hot);
      sfx.pop();
      fx.shake = Math.min(14, fx.shake + 4);
    }
  }

  function killTarget(t, byGround) {
    if (t.dead) return;
    t.dead = true; t.destroyed = true;
    state.targetsDown++;
    state.score += 1000;
    sfx.pop();
    floater(t.x, t.y - 24, '+1000', PAL.acc);
    spawnParticles(t.x, t.y, { n: 18, color: [PAL.hot, PAL.white, PAL.bone], ch: ['@', '*', '+'], speed: 340, size: 5, life: 0.8, shape: 'spark' });
    // twin shockwave rings: the kill reads at a glance
    spawnParticles(t.x, t.y, { n: 2, color: [PAL.hot, PAL.white], speed: 60, size: 9, life: 0.4, shape: 'ring' });
    fx.shake = Math.min(12, fx.shake + 3);
  }

  function checkTargets() {
    for (const b of state.bodies) {
      if (!b.isTarget || b.dead) continue;
      // Defeated by damage is handled by the destroy event. Here: knocked to
      // the ground, or shifted far enough off its perch to count as loose.
      //
      // A core authored on the dirt is sheltered by design, not already
      // defeated, so ground contact must not count as a fall for it —
      // otherwise every level with a core at ground level hands it over free
      // on frame one, including to shots that miss the structure entirely.
      const grounded = b.startsGrounded;
      const fell = b.touchedGround && !grounded;
      const fellFar = !grounded && b.y > GROUND_Y - b.r - 4;
      const displaced = Math.hypot(b.x - b.homeX, b.y - b.homeY) > 130;
      if (b.destroyed && !b.dead) { killTarget(b); continue; }
      if (fell || fellFar || displaced) killTarget(b, true);
      if (b.squash > 0) b.squash = Math.max(0, b.squash - 0.03);
    }
  }

  // Physical debris. A destroyed block leaves behind a couple of real pieces
  // instead of only particles, so a building comes apart into chunks that
  // tumble and strike rather than simply vanishing into sparks.
  //
  // These are deliberately second-class: `isDebris` keeps them out of
  // isCritical (they can never hold up the next shot), out of scoring, and
  // out of the topple count. They are capped, and once they fall asleep they
  // cost almost nothing — a visual remnant, which is what they are for.
  const CHUNK_CAP = 34;
  function spawnChunks(b) {
    const area = b.w * b.h;
    if (area < 1500 || state.chunkCount >= CHUNK_CAP) return;
    const n = area > 7000 ? 3 : 2;
    const along = b.h >= b.w;             // split the long axis
    const cw = along ? b.w : b.w / n;
    const ch = along ? b.h / n : b.h;
    if (Math.min(cw, ch) < 8) return;
    const ca = Math.cos(b.angle), sa = Math.sin(b.angle);
    for (let i = 0; i < n; i++) {
      const off = (i - (n - 1) / 2) * (along ? ch : cw);
      const lx = along ? 0 : off, ly = along ? off : 0;
      const c = makeBlock(b.x + lx * ca - ly * sa, b.y + lx * sa + ly * ca, cw, ch, b.material, b.angle);
      c.kind = 'chunk';
      c.isDebris = true;
      c.hp = c.maxHp = Math.max(4, MATERIALS[b.material].hp * 0.3);
      c.vx = b.vx + (Math.random() - 0.5) * 150;
      c.vy = b.vy - Math.random() * 90;
      c.angVel = b.angVel + (Math.random() - 0.5) * 7;
      state.bodies.push(c);
      state.chunkCount++;
    }
  }

  // "Knocked off its support" award: first time a block is clearly displaced
  // or tipped, +40 once. Settling jitter (<70px, <~30deg) never qualifies.
  function checkTopples() {
    for (const b of state.bodies) {
      if (b.destroyed || b.kind !== 'block' || b.toppleScored || b.isStatic) continue;
      const moved = Math.hypot(b.x - (b.homeX ?? b.x), b.y - (b.homeY ?? b.y));
      let a = b.angle % (Math.PI * 2);
      if (a > Math.PI) a -= Math.PI * 2;
      if (a < -Math.PI) a += Math.PI * 2;
      if (moved > 70 || Math.abs(a) > 0.5) {
        b.toppleScored = true;
        state.toppledCount++;
        state.score += 40;
        floater(b.x, b.y - 16, '+40', PAL.bone);
        countDown(b);
      }
    }
  }

  // Gameplay-critical bodies: live targets, heavy structural blocks, and
  // anything moving fast (active destruction). Small slow debris is residual:
  // it never blocks the next shot and gets extra settling help below.
  function isCritical(b) {
    if (b.destroyed || b.isStatic) return false;
    if (b.isDebris) return false; // visual remnants, never a gate on progress
    if (b.isTarget && !b.dead) return true;
    if (b.kind === 'block' && b.mass >= 1.0) return true;
    // fast + massive enough to matter (tiny shards never gate, however they spin)
    if (b.mass >= 0.35 && (Math.hypot(b.vx, b.vy) > 150 || Math.abs(b.angVel) > 2.5)) return true;
    return false;
  }

  function allQuiet() {
    for (const b of state.bodies) {
      if (!isCritical(b)) continue;
      if (!b.sleeping && (Math.abs(b.vx) > 26 || Math.abs(b.vy) > 26 || Math.abs(b.angVel) > 0.7)) return false;
    }
    return true;
  }

  // Residual-debris settling: slow + supported + not a live target gets strong
  // damping after 0.8s so it reaches natural sleep in ~0.5s instead of rolling
  // for 15+s. Never freezes mid-air feats: unsupported bodies are untouched,
  // and anything re-hit wakes via impulses / support-loss as usual.
  function settleResidual(dt) {
    for (const b of state.bodies) {
      if (b.destroyed || b.isStatic || b.sleeping) { if (b.calmTime) b.calmTime = 0; continue; }
      if (b.isTarget && !b.dead) { b.calmTime = 0; continue; } // live cores settle on their own terms
      const spd = Math.hypot(b.vx, b.vy);
      if (spd < 45 && Math.abs(b.angVel) < 3.0 && b._sup) {
        b.calmTime = (b.calmTime || 0) + dt;
        if (b.calmTime > 0.8) { b.vx *= 0.92; b.vy *= 0.92; b.angVel *= 0.85; }
      } else b.calmTime = 0;
    }
  }

  function update(dt) {
    fx.time += dt;
    // decay fx
    fx.shake = Math.max(0, fx.shake - dt * 26);
    fx.flash = Math.max(0, fx.flash - dt * 2.2);
    for (const p of fx.particles) {
      if (p.life <= 0) continue;
      p.life -= dt;
      p.vy += 900 * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.rot += p.vr * dt;
      if (p.y > GROUND_Y - 2) { p.y = GROUND_Y - 2; p.vy *= -0.4; p.vx *= 0.7; }
    }
    for (const c of fx.confetti) {
      if (c.life <= 0) continue;
      c.life -= dt; c.x += c.vx * dt; c.y += c.vy * dt; c.rot += c.vr * dt;
      c.vx *= 0.99;
      if (c.y > GROUND_Y) { c.y = GROUND_Y; c.vy = 0; c.vx *= 0.9; }
    }
    for (let i = fx.floaters.length - 1; i >= 0; i--) {
      fx.floaters[i].life -= dt;
      if (fx.floaters[i].life <= 0) fx.floaters.splice(i, 1);
    }

    if (state.screen !== 'play') return;

    const events = [];
    stepWorld(state.bodies, Math.min(dt, 1 / 30), GROUND_Y, events);
    let destroysNow = 0;
    for (const ev of events) {
      if (ev.type === 'impact') onImpact(ev);
      else if (ev.type === 'harm') onHarm(ev);
      else if (ev.type === 'destroy') { destroysNow++; onDestroy(ev.body); }
    }
    // cascade slow-mo: 4+ breaks inside 0.8s = the decisive moment. Short,
    // cooldown-guarded, and pacing-safe (timers below run on sim steps, but
    // the accent is 0.7s — control returns promptly).
    if (destroysNow > 0) {
      const recent = destroyTimes.filter(t => fx.time - t < 0.8).length;
      if (recent >= 4 && fx.time - lastSlowmo > 3 && fx.tsTimer <= 0) {
        lastSlowmo = fx.time;
        fx.tsTimer = 0.7; fx.tsScale = 0.45;
      }
    }
    // compact destroyed non-target debris? keep targets flagged; remove destroyed blocks/shards
    state.bodies = state.bodies.filter(b => {
      if (!b.destroyed) return true;
      if (b.isTarget) return false;
      if (b.kind === 'proj' && !b.dead) {
        // keep flying reference check below
        return false;
      }
      return false;
    });
    checkTargets();
    checkTopples();

    // flying projectile lifecycle
    if (state.flying) {
      const f = state.flying;
      // bouncy prediction trail (utility signature: read its ricochets)
      if (f.material === 'bouncy') {
        f.trail = f.trail || [];
        f.trail.push({ x: f.x, y: f.y });
        if (f.trail.length > 14) f.trail.shift();
      }
      const gone = f.destroyed || f.dead || f.age > 6 || f.x > WORLD_W + 60 || f.x < -80 || f.y > GROUND_Y + 40;
      const slow = Math.hypot(f.vx, f.vy) < 60 && f.age > 1.2;
      if (gone || slow) {
        if (!f.destroyed) { f.destroyed = true; spawnParticles(f.x, Math.min(f.y, GROUND_Y - 6), { n: 6, color: [PAL.bone, PAL.grey], ch: ['.', ':'], speed: 120, size: 3, life: 0.4 }); }
        state.flying = null;
        state.bodies = state.bodies.filter(b => b !== f);
        state.shotIndex++;
        state.settleTimer = 0;
      }
    } else {
      // between shots: wait for motion to settle, then next shot or resolve.
      // Only critical bodies gate progress; residual debris settles assisted.
      settleResidual(dt);
      state.settleTimer += dt;
      if (allQuiet()) {
        state.stillTimer += dt;
      } else state.stillTimer = 0;

      const needResolve = state.settleTimer > 0.5 && state.stillTimer > 0.6;
      if (needResolve) {
        if (state.targetsDown >= state.targetsTotal) return win();
        if (state.shotIndex >= state.shots.length) return lose();
        loadNextShot();
        state.canAim = true;
        state.settleTimer = 0; state.stillTimer = 0;
      }
      // safety: hard cap so debris can never hold the game hostage
      if (state.settleTimer > 6) {
        if (state.targetsDown >= state.targetsTotal) return win();
        if (state.shotIndex >= state.shots.length) return lose();
        loadNextShot(); state.canAim = true; state.settleTimer = 0; state.stillTimer = 0;
      }
    }
  }

  function finish(winGame) {
    state.result = winGame ? 'win' : 'lose';
    // bonus for unused shots
    if (winGame) {
      const left = state.shots.length - state.shotIndex;
      const bonus = left * 500;
      state.score += bonus;
      const par = state.mode === 'endless' && state.run?.current
        ? state.run.current.par : LEVELS[state.levelIndex].par;
      const stars = state.shotsUsed <= par - 1 ? 3 : state.shotsUsed <= par ? 2 : 1;
      state.bonus = bonus;
      if (state.mode === 'endless' && state.run) {
        // run total recomputed (replaying a cleared map can't farm points)
        state.run.maps += state.run.scoredDepth === state.run.depth ? 0 : 1;
        state.run.scoredDepth = state.run.depth;
        state.run.total = state.run.banked + state.score;
        const best = loadEndlessBest();
        if (state.run.total > (best.score || 0)) best.score = state.run.total;
        if (state.run.maps > (best.maps || 0)) best.maps = state.run.maps;
        storeEndlessBest(best);
        state.endlessBest = best;
        state.starsEarned = stars;
      } else {
        // persist campaign progress
        const prevStars = save.stars[state.levelIndex] || 0;
        if (stars > prevStars) save.stars[state.levelIndex] = stars;
        const prevBest = save.best[state.levelIndex] || 0;
        if (state.score > prevBest) save.best[state.levelIndex] = state.score;
        if (state.levelIndex + 1 < LEVELS.length) save.unlocked = Math.max(save.unlocked, state.levelIndex + 2);
        storeSave(save);
        state.starsEarned = stars;
      }
      sfx.win();
      burstConfetti(90);
      fx.flash = 1;
    } else {
      state.starsEarned = 0;
      if (state.mode === 'endless' && state.run) {
        // run over: bank what we earned, record best
        state.run.total = state.run.banked;
        const best = loadEndlessBest();
        if (state.run.total > (best.score || 0)) best.score = state.run.total;
        if (state.run.maps > (best.maps || 0)) best.maps = state.run.maps;
        storeEndlessBest(best);
        state.endlessBest = best;
      }
      sfx.lose();
    }
    state.screen = 'result';
    state.canAim = false;
    state.resultShown = true;
  }
  function win() { finish(true); }
  function lose() { finish(false); }

  return {
    state, fx, save,
    PROJ_LABEL, PROJ_DESC,
    loadLevel, loadDef, fire, update,
    startPlay(idx) {
      state.mode = 'campaign'; state.run = null;
      loadLevel(idx);
      state.screen = 'play';
      state.canAim = !!state.loaded;
    },
    startEndless(seed) {
      state.mode = 'endless';
      state.run = createRun(seed ?? ((Math.random() * 1e9) | 0));
      this.startEndlessMap();
    },
    startEndlessMap() {
      const run = state.run;
      run.depth++;
      run.current = genEndlessMap(run.depth, run.seed);
      run.banked = run.total;
      state.mode = 'endless';
      state.levelIndex = -1;
      loadDef(run.current);
      state.screen = 'play';
      state.canAim = !!state.loaded;
    },
    retry() {
      if (state.mode === 'endless' && state.run?.current) {
        const cur = state.run.current;
        loadDef(cur); // same map, same depth; total recomputed on win
        state.screen = 'play';
        state.canAim = !!state.loaded;
        return;
      }
      const idx = state.levelIndex;
      loadLevel(idx);
      state.screen = 'play';
      state.canAim = !!state.loaded;
    },
  };
}
