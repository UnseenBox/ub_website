// Endless Mode: controlled procedural demolition challenges.
// Seeded RNG, archetype builders (exact stacking, never random soup),
// validation pipeline (geometry, stability, breakability), difficulty curve,
// run state + local best persistence.
import { GROUND_Y, WORLD_W, col, beam, perch } from './levels.js';
import { makeBlock, makeBall, stepWorld, PROJECTILES } from './physics.js';

const G = GROUND_Y;
const BEST_KEY = 'ktd_endless_best_v1';

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function loadEndlessBest() {
  try {
    const s = JSON.parse(localStorage.getItem(BEST_KEY) || '{}');
    return { score: s.score ?? 0, maps: s.maps ?? 0 };
  } catch { return { score: 0, maps: 0 }; }
}
export function storeEndlessBest(b) {
  try { localStorage.setItem(BEST_KEY, JSON.stringify(b)); } catch {}
}

export function createRun(seed) {
  return { seed: seed >>> 0, depth: 0, banked: 0, total: 0, maps: 0, current: null };
}

/* ---------------- archetype builders ---------------- */
// Each returns { blocks, targets, hint }. All stacking exact (col/beam/perch).
// Tower zone: x in [1150, 1780]. Tops stay below y=380 (reachable by lob).

function pickMat(rnd, stoneP, glassP) {
  const r = rnd();
  if (r < stoneP) return 'stone';
  if (r < stoneP + glassP) return 'glass';
  return 'wood';
}

function archTower(rnd, stoneP, glassP, stories, cx) {
  const blocks = [], targets = [];
  const floors = []; // {top: beam-top y, half: beam half width}
  const spreads = [];
  let baseY = G, spread = 52 + Math.floor(rnd() * 14);
  for (let s = 0; s < stories; s++) {
    spreads.push(spread);
    const pw = 13 + Math.floor(rnd() * 5), ph = 58 + Math.floor(rnd() * 20);
    const m = s === 0 && stories > 2 ? 'stone' : pickMat(rnd, stoneP, glassP);
    blocks.push(col(cx - spread, baseY, pw, ph, s === 0 ? 'stone' : m));
    blocks.push(col(cx + spread, baseY, pw, ph, pickMat(rnd, stoneP, glassP)));
    const bw = spread * 2 + 56 + Math.floor(rnd() * 24), bh = 14 + Math.floor(rnd() * 5);
    const top = baseY - ph;
    blocks.push(beam(cx, top - bh / 2, bw, bh, s === stories - 1 && rnd() < 0.4 ? 'stone' : 'wood'));
    floors.push({ top: top - bh, half: bw / 2 });
    baseY = top - bh;
    spread = Math.max(34, spread - 4 - Math.floor(rnd() * 6));
  }
  // top-floor targets (always safe: nothing above)
  const cap = floors[floors.length - 1];
  targets.push(perch(cx - 14, cap.top, 12));
  if (cap.half > 60 && rnd() < 0.7) targets.push(perch(cx + 17, cap.top, 11));
  // one mid-floor target with verified clearance from next-story posts above
  for (let s = 0; s < floors.length - 1 && targets.length < 4; s++) {
    if (rnd() > 0.55) continue;
    const f = floors[s], r = 11, postHalf = 9;
    const nSpread = spreads[s + 1];
    const dirs = rnd() < 0.5 ? [1, -1] : [-1, 1];
    for (const dir of dirs) {
      // candidate A: center gap between next posts
      if (nSpread - postHalf - r > 3) { targets.push(perch(cx, f.top, r)); break; }
      // candidate B: outside the next posts but on the beam
      const x = cx + dir * (nSpread + postHalf + r + 3);
      if (Math.abs(x - cx) + r < f.half - 2) { targets.push(perch(x, f.top, r)); break; }
    }
  }
  return { blocks, targets, hint: 'Read the stack. Base or joints — your call.' };
}

function archNarrow(rnd, stoneP, glassP, cx) {
  // absurdly narrow spire with a heavy hat — breath on it and it goes.
  // stone feet widen the stance just enough to stand at rest.
  const h = 120 + Math.floor(rnd() * 40);
  const capW = 100 + Math.floor(rnd() * 30);
  const blocks = [
    col(cx - 15, G, 10, 26, 'stone'),
    col(cx + 15, G, 10, 26, 'stone'),
    col(cx, G, 12, h, pickMat(rnd, stoneP, Math.min(0.5, glassP + 0.2))),
    beam(cx, G - h - 7, capW, 14, rnd() < 0.5 ? 'stone' : 'wood'),
  ];
  const targets = [perch(cx, G - h - 14, 12)];
  return { blocks, targets, hint: 'One breath could do it. Tap the spire.' };
}

function archBridge(rnd, stoneP, glassP, cx) {
  // two span halves sharing one glass center leg — take the leg, take the bridge
  const half = 110 + Math.floor(rnd() * 50);
  const x0 = cx - half, x1 = cx + half;
  const pierM = pickMat(rnd, Math.max(stoneP, 0.3), glassP);
  const spanY = G - 88 - 8;
  const blocks = [
    col(x0, G, 16, 88, pierM),
    col(x1, G, 16, 88, pierM),
    col(cx, G, 20, 88, 'glass'),
    beam((x0 + cx) / 2, spanY, cx - x0, 16, 'wood'),
    beam((cx + x1) / 2, spanY, x1 - cx, 16, 'wood'),
  ];
  const targets = [perch(cx - 32, G - 104, 12)];
  if (half > 130) targets.push(perch(cx + 34, G - 104, 11));
  return { blocks, targets, hint: 'The glass leg holds the whole span. You know what to do.' };
}

function archBunker(rnd, stoneP, glassP, cx) {
  const spread = 62 + Math.floor(rnd() * 14);
  const blocks = [
    col(cx - spread, G, 18, 72, 'stone'),
    col(cx + spread, G, 18, 72, 'stone'),
    beam(cx, G - 72 - 11, spread * 2 + 90, 22, 'stone'),
  ];
  const targets = [perch(cx, G, 13)]; // sheltering inside, on the dirt
  if (rnd() < 0.6) {
    blocks.push(beam(cx, G - 72 - 22 - 8, 70, 16, 'glass')); // skylight
    targets.push(perch(cx, G - 72 - 22 - 16, 11));
  } else {
    blocks.push(col(cx - spread, G - 94, 14, 52, pickMat(rnd, stoneP, glassP)));
    blocks.push(col(cx + spread, G - 94, 14, 52, 'wood'));
    blocks.push(beam(cx, G - 146 - 7, spread * 2 + 60, 14, 'wood'));
    targets.push(perch(cx, G - 160, 11));
  }
  return { blocks, targets, hint: 'Shell is stone. Go through the gap — or through the roof.' };
}

function archTwins(rnd, stoneP, glassP, cx) {
  const gap = 150 + Math.floor(rnd() * 60);
  const blocks = [], targets = [];
  for (const tx of [cx - gap / 2, cx + gap / 2]) {
    const m = pickMat(rnd, stoneP, glassP);
    blocks.push(col(tx - 34, G, 14, 66, m));
    blocks.push(col(tx + 34, G, 14, 66, pickMat(rnd, stoneP, glassP)));
    blocks.push(beam(tx, G - 66 - 8, 110, 16, 'wood'));
    blocks.push(col(tx - 30, G - 82, 13, 54, 'glass'));
    blocks.push(col(tx + 30, G - 82, 13, 54, 'glass'));
    blocks.push(beam(tx, G - 136 - 7, 100, 14, 'wood'));
    targets.push(perch(tx, G - 150, 12));
  }
  return { blocks, targets, hint: 'Twins. Drop one onto the other for a 2-for-1.' };
}

function archStair(rnd, stoneP, glassP, x0, dir) {
  const blocks = [], targets = [];
  const heights = [40, 82, 124];
  const m = pickMat(rnd, stoneP, glassP);
  heights.forEach((h, i) => {
    const x = x0 + dir * i * 95;
    blocks.push(col(x, G, 15, h, i === 0 ? 'stone' : m));
    blocks.push(beam(x, G - h - 7, 64, 14, 'wood'));
  });
  targets.push(perch(x0 + dir * 190, G - 124 - 14, 12));
  if (rnd() < 0.5) targets.push(perch(x0 + dir * 95, G - 82 - 14, 11));
  return { blocks, targets, hint: 'Climb the staircase. Start at the tall end.' };
}

function archCrown(rnd, stoneP, glassP, cx) {
  const spread = 42 + Math.floor(rnd() * 10);
  const blocks = [
    col(cx - spread, G, 14, 82, 'glass'),
    col(cx + spread, G, 14, 82, 'glass'),
    beam(cx, G - 82 - 12, spread * 2 + 100, 24, 'stone'), // the crown
  ];
  const targets = [perch(cx, G - 106, 12)];
  if (rnd() < 0.5) targets.push(perch(cx + 27, G - 106, 11));
  return { blocks, targets, hint: 'Heavy crown, glass legs. You know what to do.' };
}

/* ---- second-generation archetypes ----
   Same rules as the campaign extension (documented at levels.js): stacked
   single columns, decks with wide bearing on two posts, long spans resting
   on both ends, stone low, everything exact-resting. Each one is a miniature
   of a handcrafted campaign level, parameterised for controlled variety. */

// Continuous settlement deck: 3-4 posts bridged by bay beams with a turret
// somewhere along the span and a core sheltered underneath.
function archDeck(rnd, stoneP, glassP, cx) {
  const blocks = [];
  const n = 4 + 2 * Math.floor(rnd() * 2);    // 4 or 6: the sheltered ground core
                                             // must land BETWEEN posts, never on one
  const pitch = 110;
  const h = 100 + Math.floor(rnd() * 40);
  const x0 = cx - ((n - 1) * pitch) / 2;
  for (let i = 0; i < n; i++) {
    const m = i === 0 || i === n - 1 ? 'stone' : pickMat(rnd, stoneP, glassP);
    blocks.push(col(x0 + i * pitch, G, 24, h, m, { pattern: 'braced' }));
  }
  const postTop = G - h;
  for (let i = 0; i < n - 1; i++) blocks.push(beam(x0 + i * pitch + pitch / 2, postTop - 8, 106, 16, 'wood'));
  const deckTop = postTop - 16;
  const ti = 1 + Math.floor(rnd() * Math.max(1, n - 2));
  const tx = x0 + ti * pitch;
  const th = 60 + Math.floor(rnd() * 30);
  blocks.push(col(tx - 30, deckTop, 14, th, pickMat(rnd, stoneP, glassP)));
  blocks.push(col(tx + 30, deckTop, 14, th, pickMat(rnd, stoneP, glassP)));
  blocks.push(beam(tx, deckTop - th - 7, 100, 14, rnd() < 0.4 ? 'stone' : 'wood'));
  const targets = [perch(tx, deckTop - th - 14, 12)];
  if (rnd() < 0.7) targets.push(perch(x0 + ((n - 1) * pitch) / 2, G, 13));  // sheltered under the deck
  return { blocks, targets, hint: 'A deck on many legs, a core underneath. Break a leg and the deck walks.' };
}

// The nested frame: two stone decks over wall pairs, tied at the top, with
// the core on the dirt inside the frame.
function archNest(rnd, stoneP, glassP, cx) {
  const blocks = [];
  const h = 100 + Math.floor(rnd() * 30);
  const m = pickMat(rnd, stoneP, glassP);
  blocks.push(col(cx - 80, G, 24, h, 'stone'));
  blocks.push(col(cx - 30, G, 24, h, 'stone'));
  blocks.push(col(cx + 30, G, 24, h, m));
  blocks.push(col(cx + 80, G, 24, h, m));
  const capY = G - h - 7;
  blocks.push(beam(cx - 55, capY, 100, 14, 'stone', { pattern: 'braced' }));
  blocks.push(beam(cx + 55, capY, 100, 14, 'stone', { pattern: 'braced' }));
  blocks.push(beam(cx, capY - 14, 70, 14, 'wood'));                    // tie top capY-21
  return {
    blocks,
    targets: [
      perch(cx, G, 12),          // inside the frame, on the dirt
      perch(cx, capY - 21, 11),  // on the tie
      perch(cx - 55, capY - 7, 11),
      perch(cx + 55, capY - 7, 11),
    ],
    hint: 'A stone frame over a sheltered core. Take a deck, take the tie, or pull the frame apart.',
  };
}

// Two towers on aligned shelves, tied by one beam: the bridge pair. The tie's
// weight lands on the shelves, which hand it to the post pairs.
function archTowers(rnd, stoneP, glassP, cx) {
  const blocks = [];
  const gap = 200 + Math.floor(rnd() * 70);
  const a = cx - gap / 2, b = cx + gap / 2;
  for (const [tx, pw] of [[a, 26], [b, 24]]) {
    const m = tx === a ? 'stone' : 'wood';
    blocks.push(col(tx - 45, G, pw, 100, m));
    blocks.push(col(tx + 45, G, pw, 100, m));
    blocks.push(beam(tx, G - 108, 130, 16, m === 'stone' ? 'stone' : 'wood', { pattern: 'braced' }));
    blocks.push(col(tx, G - 116, pw - 4, 130, 'wood', { pattern: 'braced' }));
    blocks.push(col(tx, G - 246, pw - 8, 90, pickMat(rnd, stoneP, glassP)));
    blocks.push(beam(tx, G - 342, 40, 12, 'stone'));
  }
  const tieW = gap - 90; // 20px bearing on each shelf
  blocks.push(beam(cx, G - 123, tieW, 14, 'wood', { pattern: 'braced' }));
  const targets = [perch(a, G - 348, 11), perch(b, G - 348, 11)];
  if (tieW >= 100) targets.push(perch(a + 90, G - 130, 11), perch(b - 90, G - 130, 11));
  else targets.push(perch(cx, G - 130, 11));
  return { blocks, targets, hint: 'Two towers, one tie. The cores walking the tie only have that beam.' };
}

// The cantilevered gallows: pier pair, heavy counterweight west, light glass
// cage far out on the east arm.
function archGallows(rnd, stoneP, glassP, cx) {
  const blocks = [
    col(cx - 40, G, 30, 190, 'stone'),
    col(cx + 40, G, 30, 190, 'stone'),
    beam(cx, G - 201, 290, 22, 'stone', { pattern: 'braced' }),
    col(cx - 90, G - 212, 26, 80, 'stone'),
    col(cx - 90, G - 292, 20, 60, 'stone'),
    col(cx + 20, G - 212, 14, 62, 'wood'),
    col(cx + 80, G - 212, 14, 62, 'wood'),
    beam(cx + 50, G - 281, 126, 14, 'wood'),
    col(cx + 38, G - 288, 12, 34, 'glass'),
    col(cx + 62, G - 288, 12, 34, 'glass'),
    beam(cx + 50, G - 328, 86, 12, 'glass'),
  ];
  return {
    blocks,
    targets: [
      perch(cx - 90, G - 352, 11),  // the counterweight's crown
      perch(cx - 125, G - 212, 11), // on the span, west of the weight
      perch(cx + 50, G - 334, 11),  // the cage cap, far out on the arm
    ],
    hint: 'A cantilever on a counterweight. Pull the weight, or drop the cage.',
  };
}

// The two-stage: a stone hut shelters a core, short stone legs carry a heavy
// cube above it. Stage two only opens after stage one.
function archWaist(rnd, stoneP, glassP, cx) {
  const h = 90 + Math.floor(rnd() * 40);
  const blocks = [
    col(cx - 70, G, 24, h, 'wood', { pattern: 'braced' }),
    col(cx + 70, G, 24, h, 'wood', { pattern: 'braced' }),
    beam(cx, G - h - 8, 170, 16, 'stone', { pattern: 'braced' }),
    col(cx - 48, G - h - 16, 20, 70, 'stone'),
    col(cx + 12, G - h - 16, 20, 70, 'stone'),
    col(cx - 18, G - h - 86, 90, 60, 'stone', { pattern: 'braced' }),
  ];
  return {
    blocks,
    targets: [
      perch(cx, G, 13),                    // sheltered inside the hut
      perch(cx + 60, G - h - 16, 12),      // on the deck, beside the waist
      perch(cx - 18, G - h - 146, 12),     // on top of the cube
    ],
    hint: 'A heavy cube on stone legs over a stone hut. Drop the cube, then drop the deck.',
  };
}

// Four short glass legs under a broad stone crown, with a tier on top.
function archCrown4(rnd, stoneP, glassP, cx) {
  const lh = 70 + Math.floor(rnd() * 30);
  const spread = 65 + Math.floor(rnd() * 20);   // inner legs stay clear of the ground core
  const blocks = [];
  for (const s of [-1, 1]) {
    blocks.push(col(cx + s * spread, G, 20, lh, 'glass'));
    blocks.push(col(cx + s * (spread * 0.37), G, 20, lh, rnd() < 0.5 ? 'glass' : 'wood'));
  }
  blocks.push(beam(cx, G - lh - 13, spread * 2 + 70, 26, 'stone', { pattern: 'braced' }));
  const crownTop = G - lh - 26;
  const th = 40 + Math.floor(rnd() * 20);
  blocks.push(col(cx - 40, crownTop, 14, th, 'wood'));
  blocks.push(col(cx + 40, crownTop, 14, th, 'wood'));
  blocks.push(beam(cx, crownTop - th - 7, 110, 14, 'wood'));
  return {
    blocks,
    targets: [
      perch(cx, G, 13),                        // sheltered under the crown
      perch(cx + spread + 22, crownTop, 9),    // riding the crown east of the legs
      perch(cx, crownTop - th - 14, 11),       // top of the tier
    ],
    hint: 'A broad crown on short glass legs. The crown is the weight; the legs are the puzzle.',
  };
}

const ARCHETYPES = [
  { id: 'tower', name: 'STACK', build: (rnd, sp, gp) => archTower(rnd, sp, gp, 2 + Math.floor(rnd() * 2), 1330 + Math.floor(rnd() * 260)) },
  { id: 'tower3', name: 'HIGH STACK', build: (rnd, sp, gp) => archTower(rnd, sp, gp, 3 + Math.floor(rnd() * 2), 1330 + Math.floor(rnd() * 260)) },
  { id: 'narrow', name: 'NARROW PERCH', special: true, build: (rnd, sp, gp) => archNarrow(rnd, sp, gp, 1330 + Math.floor(rnd() * 260)) },
  { id: 'bridge', name: 'DEAD JOINT', special: true, build: (rnd, sp, gp) => archBridge(rnd, sp, gp, 1380 + Math.floor(rnd() * 160)) },
  { id: 'bunker', name: 'BUNKER', build: (rnd, sp, gp) => archBunker(rnd, sp, gp, 1360 + Math.floor(rnd() * 200)) },
  { id: 'twins', name: 'TWINS', build: (rnd, sp, gp) => archTwins(rnd, sp, gp, 1410 + Math.floor(rnd() * 100)) },
  { id: 'stair', name: 'STAIRCASE', build: (rnd, sp, gp) => archStair(rnd, sp, gp, 1290 + Math.floor(rnd() * 200), rnd() < 0.5 ? 1 : -1) },
  { id: 'crown', name: 'CROWN', special: true, build: (rnd, sp, gp) => archCrown(rnd, sp, gp, 1360 + Math.floor(rnd() * 200)) },
  // second generation: designed structures, not random soup
  { id: 'deck', name: 'SETTLEMENT DECK', build: (rnd, sp, gp) => archDeck(rnd, sp, gp, 1340 + Math.floor(rnd() * 220)) },
  { id: 'nest', name: 'THE FRAME', build: (rnd, sp, gp) => archNest(rnd, sp, gp, 1350 + Math.floor(rnd() * 180)) },
  { id: 'crown4', name: 'FOUR-LEG CROWN', build: (rnd, sp, gp) => archCrown4(rnd, sp, gp, 1360 + Math.floor(rnd() * 180)) },
  { id: 'towers', name: 'BRIDGE PAIR', special: true, build: (rnd, sp, gp) => archTowers(rnd, sp, gp, 1345 + Math.floor(rnd() * 170)) },
  { id: 'gallows', name: 'GALLOWS', special: true, build: (rnd, sp, gp) => archGallows(rnd, sp, gp, 1330 + Math.floor(rnd() * 190)) },
  { id: 'waist', name: 'TWO-STAGE', special: true, build: (rnd, sp, gp) => archWaist(rnd, sp, gp, 1340 + Math.floor(rnd() * 180)) },
];

/* ---------------- validation ---------------- */

function buildBodies(def) {
  const bodies = [];
  for (const b of def.blocks) bodies.push(makeBlock(b.x, b.y, b.w, b.h, b.material, b.angle || 0));
  for (const pf of (def.platforms || [])) bodies.push(makeBlock(pf.x, pf.y, pf.w, pf.h, 'steel', pf.angle || 0, { isStatic: true }));
  def.targets.forEach((td) => bodies.push(makeBall(td.x, td.y, td.r, { kind: 'target', isTarget: true, hp: 22, density: 0.9 })));
  return bodies;
}

function geometryCheck(def) {
  const rects = def.blocks.map((b) => ({ ...b, top: b.y - b.h / 2, bot: b.y + b.h / 2, l: b.x - b.w / 2, r: b.x + b.w / 2 }));
  for (const b of rects) {
    if (b.l < 100 || b.r > WORLD_W - 40 || b.top < 300) return false; // usable area
    if (Math.abs(b.bot - GROUND_Y) < 1.5) continue;
    let best = null;
    for (const o of rects) {
      if (o === b) continue;
      const ox = Math.min(b.r, o.r) - Math.max(b.l, o.l);
      if (ox > 2 && o.top <= b.bot + 12 && o.top > (best?.top ?? -1e9)) best = o;
    }
    if (!best || Math.abs(b.bot - best.top) > 1.5) return false; // floating or sunk
  }
  for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) {
    const a = rects[i], b = rects[j];
    if (Math.min(a.r, b.r) - Math.max(a.l, b.l) > 2 && Math.min(a.bot, b.bot) - Math.max(a.top, b.top) > 2) return false;
  }
  for (const t of def.targets) {
    if (t.x < 150 || t.x > WORLD_W - 40 || t.y < 320) return false;
    for (const o of rects) {
      const dx = Math.max(o.l, Math.min(t.x, o.r)), dy = Math.max(o.top, Math.min(t.y, o.bot));
      if (Math.hypot(t.x - dx, t.y - dy) < t.r - 1.5) return false; // embedded
    }
    // resting: bottom within 2px of some top or the ground (ceilings above don't count)
    const bot = t.y + t.r;
    let floor = GROUND_Y;
    for (const o of rects) {
      if (t.x > o.l - t.r * 0.4 && t.x < o.r + t.r * 0.4 && o.top <= bot + 2 && o.top >= bot - 2 * t.r) {
        if (o.top > floor - 420 && (floor === GROUND_Y || o.top > floor)) floor = o.top;
      }
    }
    if (Math.abs(bot - floor) > 2.5) return false;
  }
  return def.targets.length >= 1 && def.targets.length <= 4;
}

function stabilityCheck(def) {
  const bodies = buildBodies(def);
  const x0 = bodies.map(b => b.x), y0 = bodies.map(b => b.y);
  for (let s = 0; s < 180; s++) stepWorld(bodies, 1 / 60, GROUND_Y, []);
  let md = 0;
  for (let k = 0; k < bodies.length; k++) {
    const b = bodies[k];
    if (b.destroyed) return { ok: false, drift: 999 };
    if (!b.isStatic) md = Math.max(md, Math.hypot(b.x - x0[k], b.y - y0[k]));
  }
  return { ok: md <= 12, drift: md };
}

function breakabilityProbe(def) {
  // a rock into the midsection must do *something*: damage, displacement, or a kill
  const bodies = buildBodies(def);
  for (let s = 0; s < 120; s++) stepWorld(bodies, 1 / 60, GROUND_Y, []);
  const midY = bodies.filter(b => b.kind === 'block').reduce((a, b) => a + b.y, 0) / Math.max(1, bodies.filter(b => b.kind === 'block').length);
  const towerX = bodies.filter(b => b.kind === 'block').reduce((a, b) => a + b.x, 0) / Math.max(1, bodies.filter(b => b.kind === 'block').length);
  const P = PROJECTILES.rock;
  const rock = makeBall(towerX - 380, midY - 40, P.r, { kind: 'proj', material: 'rock', friction: P.friction, restitution: P.restitution, density: P.density, isProjectile: true });
  rock.vx = 950; rock.vy = -60;
  bodies.push(rock);
  const hb = bodies.map(b => ({ b, hp: b.hp, x: b.x, y: b.y }));
  let destroys = 0;
  for (let s = 0; s < 360; s++) {
    const ev = [];
    stepWorld(bodies, 1 / 60, GROUND_Y, ev);
    for (const e of ev) if (e.type === 'destroy' && e.body.kind !== 'proj' && e.body.kind !== 'shard') destroys++;
  }
  let displaced = 0, maxDrop = 0;
  for (const { b, hp, x, y } of hb) {
    if (b.destroyed || b.isStatic) continue;
    if (Math.hypot(b.x - x, b.y - y) > 60) displaced++;
    maxDrop = Math.max(maxDrop, hp - b.hp);
  }
  // meaningful progress: something broke, shifted a lot, or took a real hit
  // (one rock ≈ 40+ dmg to stone; the map's 3-5 shots finish the job)
  return destroys > 0 || displaced > 0 || maxDrop > 8;
}

/* ---------------- test hook ---------------- */
// Build one archetype directly (seeded) without validation — for debugging.
export function debugBuild(id, seed) {
  const rnd = mulberry32(seed >>> 0);
  const arch = ARCHETYPES.find(a => a.id === id);
  if (!arch) return null;
  const { blocks, targets, hint } = arch.build(rnd, 0.2, 0.25);
  return { blocks, targets, hint, archetype: id };
}

/* ---------------- generation ---------------- */

// Target-less mini tower beside the main structure: knock it INTO the tower.
function tryAttachAnnex(rnd, def) {
  const xs = def.blocks.map(b => b.x);
  const towerX = xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
  const sides = rnd() < 0.5 ? [1, -1] : [-1, 1];
  for (const side of sides) {
    const x = Math.round(towerX + side * (300 + rnd() * 60));
    const h = 56 + Math.floor(rnd() * 14);
    const m = rnd() < 0.5 ? 'glass' : 'wood';
    const extra = [
      col(x - 28, G, 13, h, m),
      col(x + 28, G, 13, h, m),
      beam(x, G - h - 7, 96, 14, 'wood'),
    ];
    const combined = { ...def, blocks: [...def.blocks, ...extra], hint: def.hint + ' + annex' };
    if (!geometryCheck(combined)) continue;
    const stab = stabilityCheck(combined);
    if (!stab.ok) continue;
    combined.stabilityDrift = stab.drift;
    return combined;
  }
  return null;
}

// Difficulty is a rhythm, not a ladder: approachable -> complex -> unusual ->
// demanding, then repeat with the base numbers creeping up a little each
// cycle. The player never meets two identical-feeling maps in a row, and no
// map is simply "+1 stat" of the last one.
export function difficultyFor(depth) {
  const wave = (depth - 1) % 4;               // 0 approachable, 1 complex, 2 unusual, 3 demanding
  const ramp = Math.floor((depth - 1) / 4);   // gentle long-run creep
  const stories = 2 + Math.min(2, ramp);
  const stoneP = Math.min(0.45, 0.08 + ramp * 0.05);
  const glassP = Math.min(0.45, 0.18 + ramp * 0.03);
  let targets = 1 + (depth > 1 ? 1 : 0) + (ramp >= 1 ? 1 : 0) + (ramp >= 2 ? 1 : 0);
  let shots = 3 + (depth % 2) + (ramp > 0 ? 1 : 0);
  let special = false;
  if (wave === 0) {
    // approachable: one fewer core, one fewer shot — a breather with a designed
    // structure rather than a harder version of the last map
    targets = Math.max(1, targets - 1);
    shots = Math.max(3, shots - 1);
  } else if (wave === 2) {
    // unusual: only the designed/architecture archetypes (and append the annex
    // more often, so the wave reads as a bigger, stranger structure)
    special = true;
  }
  return {
    wave: ['approachable', 'complex', 'unusual', 'demanding'][wave],
    stories, stoneP, glassP,
    targets: Math.min(4, targets),
    shots: Math.min(5, shots),
    special,
  };
}

function shotsFor(rnd, diff, glassHeavy) {
  const pool = ['rock', 'rock', 'bouncy'];
  if (glassHeavy || rnd() < 0.6) pool.push('splitter');
  if (diff.shots > 4 || rnd() < 0.4 + diff.stoneP) pool.push('rock');
  while (pool.length > diff.shots) pool.splice(Math.floor(rnd() * pool.length), 1);
  while (pool.length < 3) pool.push('rock');
  // shuffle
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1));[pool[i], pool[j]] = [pool[j], pool[i]]; }
  return pool;
}

export function genEndlessMap(depth, seed) {
  const diff = difficultyFor(depth);
  const cands = diff.special ? ARCHETYPES.filter(a => a.special) : ARCHETYPES;
  for (let attempt = 0; attempt < 40; attempt++) {
    const rnd = mulberry32((seed * 2654435761 + depth * 40503 + attempt * 65599) >>> 0);
    const arch = cands[Math.floor(rnd() * cands.length)];
    const { blocks, targets, hint } = arch.build(rnd, diff.stoneP, diff.glassP);
    // trim targets to difficulty count (keep first N — builders order important ones first)
    const tTargets = targets.slice(0, diff.targets);
    if (!tTargets.length) continue;
    const glassHeavy = blocks.filter(b => b.material === 'glass').length >= 3;
    const def = {
      name: `${arch.name} #${depth}`,
      hint: hint + ` [seed ${seed.toString(36)}:${depth}]`,
      shots: shotsFor(rnd, diff, glassHeavy),
      par: Math.max(2, Math.min(4, diff.shots - 1)),
      blocks, targets: tTargets, platforms: [],
      endless: true, archetype: arch.id, seed, depth,
    };
    if (!geometryCheck(def)) continue;
    const stab = stabilityCheck(def);
    if (!stab.ok) continue;
    if (!breakabilityProbe(def)) continue;
    def.stabilityDrift = stab.drift;
    // often attach a target-less annex (chain-reaction fuel); the more
    // demanding the wave, the more likely the yard around the tower is built
    // up. The combined map re-passes geometry + stability, else we ship the base.
    const annexP = diff.wave === 'demanding' ? 0.7 : diff.wave === 'approachable' ? 0.25 : 0.5;
    if (depth >= 3 && rnd() < annexP) {
      const withAnnex = tryAttachAnnex(rnd, def);
      if (withAnnex) return withAnnex;
    }
    return def;
  }
  // fallback: plain stable stack (always valid)
  const rnd = mulberry32(seed + depth);
  const { blocks, targets } = archTower(rnd, 0.1, 0.2, 2, 1400);
  return {
    name: `STACK #${depth}`, hint: 'A plain stack. Cash it in.',
    shots: ['rock', 'rock', 'bouncy'], par: 2,
    blocks, targets: targets.slice(0, 2), platforms: [],
    endless: true, archetype: 'tower', seed, depth, fallback: true,
  };
}
