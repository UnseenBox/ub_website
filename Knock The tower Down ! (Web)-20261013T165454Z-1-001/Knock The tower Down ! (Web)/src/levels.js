// Handcrafted level definitions. World ground top GROUND_Y=936; the slingshot
// sits far left and every structure is built from exact-resting primitives so
// nothing settles or jitters on load.
//
// Design rule for this set: no two levels present the same problem. Each one
// has a distinct silhouette and a different physical idea — a glass jaw, a
// pre-loaded lever, a sheltered vault, a cantilever on a hidden link, a tied
// pair — so the player cannot repeat one shot through the campaign.
export const WORLD_W = 1920;
export const WORLD_H = 1080;
export const GROUND_Y = 936;
export const SLING = { x: 250, y: 730 };
import { extensionLevels } from './levels-extended.js';
const ASPECT = 9 / 16; // the stage is locked 16:9

const G = GROUND_Y;

// column: exact resting position on baseY
export function col(x, baseY, w, h, material, extra = {}) {
  return { x, y: baseY - h / 2, w, h, material, angle: 0, ...extra };
}
// beam centered at (x, y); extra carries decoration hints (e.g. pattern)
export function beam(x, y, w, h, material, extra = {}) {
  return { x, y, w, h, material, angle: 0, ...extra };
}
// target resting on floorY
export function perch(x, floorY, r) {
  return { x, y: floorY - r, r };
}

/* ---------------- monument builders ---------------- */
// Both bonus levels are assembled by code so their many pieces stay exactly
// stacked no matter how the numbers are tuned.

// One tapering truss storey: posts on `baseY`, a deck spanning them.
// Returns the deck's top surface so the next storey can stand on it.
function trussStorey(out, cx, baseY, offsets, postW, postH, deckW, deckH, postMat, deckMat) {
  for (const o of offsets) out.push(col(cx + o, baseY, postW, postH, postMat));
  const top = baseY - postH;
  out.push(beam(cx, top - deckH / 2, deckW, deckH, deckMat));
  return top - deckH;
}

// LATTICE: a tapering mast 910 units from the dirt to the finial, with flared
// stone haunches around its feet.
//
// The structural pattern here is dictated by what the solver can actually
// hold, which was measured rather than assumed (tools/validate-levels.mjs):
//
//   * A stack of single columns, each centred on the one below, is stable to
//     well past 900 units — the contact face is wide, centred and has no
//     lever arm.
//   * Inserting a beam between two columns destabilises the stack, even a
//     plate no wider than the column itself. Every extra joint slows impulse
//     convergence, and an 8-iteration solver without warm-starting runs out
//     of road. Open post-beam-post trusswork and decks on four posts (which
//     are statically indeterminate) collapse on their own at any height.
//   * Heavy stone in a tall stack self-destructs: penetration builds, the
//     positional correction over-shoots because it divides by the inverse-mass
//     sum, and the resulting bounce damages the blocks. Stone belongs at the
//     bottom or in short stacks.
//
// So the mast is stacked columns of wood over one stone footing, and the open
// lattice read comes from the glyph pattern the renderer draws inside each
// section rather than from shaving posts until they fall over unprompted.
// The upside is a collapse of seven big connected pieces instead of sixty
// specks, which is what actually reads as a monument coming down.
function buildLattice() {
  const cx = 1180;
  const blocks = [];
  // the mast — one stone footing, then wood all the way up
  let y = G;
  const segs = [[46, 170, 'stone'], [42, 155, 'wood'], [38, 140, 'wood'], [34, 125, 'wood'],
                [30, 110, 'wood'], [26, 95, 'wood'], [22, 70, 'wood'], [14, 45, 'wood']];
  for (const seg of segs) { blocks.push(col(cx, y, seg[0], seg[1], seg[2])); y -= seg[1]; }
  const summit = y;
  // ground tie bars flanking the mast; the left one is the only floor a shot
  // can reach, by threading two 40-47px gaps between the haunches
  blocks.push(beam(cx - 75, G - 8, 88, 16, 'wood'));
  blocks.push(beam(cx + 75, G - 8, 88, 16, 'wood'));
  // haunches: short independent stacks, each plate centred on its own leg.
  // The east haunch carries a third storey — the silhouette is asymmetric.
  blocks.push(col(cx - 215, G, 30, 130, 'stone'));
  blocks.push(col(cx - 215, G - 130, 26, 105, 'stone'));
  blocks.push(beam(cx - 215, G - 241, 56, 12, 'wood'));
  blocks.push(col(cx + 215, G, 30, 130, 'stone'));
  blocks.push(col(cx + 215, G - 130, 26, 105, 'stone'));
  blocks.push(col(cx + 215, G - 235, 22, 90, 'wood'));
  blocks.push(beam(cx + 215, G - 331, 50, 12, 'wood'));
  // inner haunches: no cores, pure chain-reaction fuel at the mast's feet
  blocks.push(col(cx - 140, G, 26, 115, 'stone'));
  blocks.push(col(cx - 140, G - 115, 22, 90, 'wood'));
  blocks.push(col(cx + 140, G, 26, 115, 'stone'));
  blocks.push(col(cx + 140, G - 115, 22, 90, 'wood'));
  return {
    blocks,
    targets: [
      perch(cx - 75, G - 16, 12),    // on the west tie bar: thread the haunches
      perch(cx - 215, G - 247, 12),
      perch(cx + 215, G - 337, 12),
      perch(cx, summit, 11),         // no shot reaches it — the mast has to come down
    ],
  };
}

// CATHEDRAL: a nave of piers carrying bay beams, the roof held up on eight
// slender glass clerestory columns, a heavy stone ridge on top of that, and
// two unequal spires. The glass pier and the clerestory are the real answers.
function buildCathedral() {
  const blocks = [];
  const pierX = [1060, 1170, 1280, 1390, 1500];
  const PIER_H = 170, pierTop = G - PIER_H;
  pierX.forEach((x, i) => blocks.push(col(x, G, 28, PIER_H, i === 1 ? 'glass' : 'stone')));
  // Bay beams bridging adjacent piers: 106 wide leaves 12px of bearing on each
  // pier top and a 4px gap to its neighbour. Each bay is a two-support span,
  // so losing one pier really does drop that bay — a continuous architrave
  // would just stay up on the remaining piers.
  const bayX = [1115, 1225, 1335, 1445];
  const bayTop = pierTop - 16;
  for (const x of bayX) blocks.push(beam(x, pierTop - 8, 106, 16, 'wood'));
  // clerestory: two glass columns per bay carry the entire roof
  const clTop = bayTop - 40;
  for (const x of bayX) {
    blocks.push(col(x - 34, bayTop, 14, 40, 'glass'));
    blocks.push(col(x + 34, bayTop, 14, 40, 'glass'));
  }
  // roof slab, gallery posts, stone ridge — the heavy mass sits up top
  blocks.push(beam(1280, clTop - 9, 420, 18, 'wood'));
  const roofTop = clTop - 18;
  blocks.push(col(1180, roofTop, 16, 64, 'wood'));
  blocks.push(col(1380, roofTop, 16, 64, 'wood'));
  const galTop = roofTop - 64;
  blocks.push(beam(1280, galTop - 8, 300, 16, 'stone'));
  const ridgeTop = galTop - 16;
  // west spire: tall, stepped, stone into wood
  let y = G;
  for (const seg of [[28, 200, 'stone'], [24, 170, 'stone'], [20, 140, 'stone'], [16, 115, 'wood'], [13, 90, 'wood']]) {
    blocks.push(col(985, y, seg[0], seg[1], seg[2])); y -= seg[1];
  }
  blocks.push(beam(985, y - 7, 40, 14, 'stone')); y -= 14;
  blocks.push(col(985, y, 9, 40, 'stone'));
  const westTop = y - 40;
  // east spire: deliberately shorter — the silhouette is asymmetric
  y = G;
  for (const seg of [[28, 190, 'stone'], [22, 150, 'stone'], [17, 120, 'wood']]) {
    blocks.push(col(1575, y, seg[0], seg[1], seg[2])); y -= seg[1];
  }
  blocks.push(beam(1575, y - 7, 36, 14, 'stone')); y -= 14;
  blocks.push(col(1575, y, 10, 46, 'wood'));
  const eastTop = y - 46;
  // stepped pilasters with glass pinnacles, outside the nave
  for (const x of [1022, 1538]) {
    blocks.push(col(x, G, 22, 100, 'stone'));
    blocks.push(col(x, G - 100, 18, 80, 'stone'));
    blocks.push(col(x, G - 180, 14, 50, 'glass'));
  }
  return {
    blocks,
    targets: [
      perch(1335, G, 13),        // in the nave: thread a pier gap, or drop the roof on it
      perch(1280, ridgeTop, 12),
      perch(1575, eastTop, 11),
      perch(985, westTop, 11),
    ],
  };
}

const LATTICE = buildLattice();
const CATHEDRAL = buildCathedral();

export const LEVELS = [
  {
    name: 'First Contact',
    hint: 'Drag back from the sling and release. The cap is set off-centre — a side hit spins it.',
    shots: ['rock', 'rock', 'bouncy'], par: 2,
    blocks: [
      // derelict shed: free points, and proof that everything here breaks
      col(1180, G, 14, 56, 'wood'),
      col(1240, G, 14, 56, 'wood'),
      beam(1210, G - 56 - 7, 96, 14, 'wood'),
      // the frame, with its load pushed toward the right post
      col(1380, G, 16, 90, 'wood'),
      col(1460, G, 16, 90, 'wood'),
      beam(1434, G - 90 - 9, 150, 18, 'wood'),
    ],
    targets: [perch(1420, G - 90 - 18, 13)],
    platforms: [],
  },
  {
    name: 'Glass Jaw',
    hint: 'Two glass legs are holding a stone slab. Take a leg and let the slab do the work.',
    shots: ['rock', 'splitter', 'rock'], par: 2,
    blocks: [
      col(1330, G, 16, 96, 'glass'),
      col(1470, G, 16, 96, 'glass'),
      beam(1400, G - 96 - 13, 200, 26, 'stone'),   // ~5x the mass of a wood beam
      col(1364, G - 122, 14, 54, 'wood'),
      col(1436, G - 122, 14, 54, 'wood'),
      beam(1400, G - 176 - 8, 130, 16, 'wood'),
    ],
    targets: [
      perch(1400, G, 13),            // directly under the slab
      perch(1400, G - 192, 12),
    ],
    platforms: [],
  },
  {
    name: 'The Lever',
    hint: 'A loaded see-saw. That stone weight holds it down — shift it and the far end throws.',
    shots: ['rock', 'rock', 'splitter', 'bouncy'], par: 3,
    blocks: [
      col(1400, G, 30, 130, 'stone'),              // fulcrum
      col(1230, G, 18, 130, 'glass'),              // glass props: level at rest, one hit from a swing
      col(1570, G, 18, 130, 'glass'),
      beam(1400, G - 130 - 9, 440, 18, 'wood'),    // the plank, flat on all three
      col(1560, G - 148, 40, 60, 'stone'),         // the pre-load, far out on the right arm
    ],
    targets: [
      perch(1300, G - 148, 12),
      perch(1500, G - 148, 12),
    ],
    platforms: [],
  },
  {
    name: 'The Vault',
    hint: 'Stone shell, glass skylight. The upper floor stands on that glass — and a core sits underneath.',
    shots: ['rock', 'rock', 'splitter', 'bouncy'], par: 3,
    blocks: [
      col(1320, G, 20, 86, 'stone'),
      col(1480, G, 20, 86, 'stone'),
      beam(1400, G - 86 - 12, 250, 24, 'stone'),
      beam(1400, G - 110 - 8, 86, 16, 'glass'),    // skylight: the only load path upward
      col(1366, G - 126, 14, 50, 'wood'),
      col(1434, G - 126, 14, 50, 'wood'),
      beam(1400, G - 176 - 7, 110, 14, 'wood'),
      // derelict annex: no cores, pure chain-reaction fuel
      col(1180, G, 14, 70, 'wood'),
      col(1250, G, 14, 70, 'glass'),
      beam(1215, G - 70 - 7, 110, 14, 'wood'),
      col(1215, G - 84, 13, 48, 'glass'),
      beam(1215, G - 132 - 6, 86, 12, 'wood'),
    ],
    targets: [
      perch(1400, G, 13),
      perch(1400, G - 190, 12),
    ],
    platforms: [],
  },
  {
    name: 'Cantilever',
    hint: 'A stone span on two legs — but the right leg ends in a short glass link. Find it.',
    shots: ['rock', 'splitter', 'rock', 'bouncy'], par: 3,
    blocks: [
      col(1200, G, 30, 210, 'stone'),              // pier
      col(1540, G, 28, 140, 'stone'),              // footing
      col(1540, G - 140, 16, 70, 'glass'),         // the link, low and easy to miss
      beam(1370, G - 210 - 10, 400, 20, 'stone'),  // ~7.7 mass, waiting to rotate
      col(1420, G - 230, 15, 60, 'wood'),
      col(1510, G - 230, 15, 60, 'wood'),
      beam(1465, G - 290 - 8, 120, 16, 'wood'),
      col(1440, G - 306, 13, 44, 'glass'),         // paired: a single post here only wobbles
      col(1490, G - 306, 13, 44, 'glass'),
      beam(1465, G - 350 - 6, 70, 12, 'wood'),
    ],
    targets: [
      perch(1465, G - 362, 11),
      perch(1465, G - 230, 12),
      // On the dirt at the foot of the pier. When the link goes the span
      // rotates about the pier and its left end rises, so the cascade cannot
      // reach this one — it always costs a second, separate shot.
      perch(1150, G, 12),
    ],
    platforms: [],
  },
  {
    name: 'Skybridge',
    hint: 'Glass-footed tower on the left, stone on the right, one long bridge tying them together.',
    shots: ['rock', 'splitter', 'rock', 'bouncy', 'rock'], par: 4,
    blocks: [
      // west tower: fragile feet, light frame
      col(1150, G, 15, 88, 'glass'),
      col(1230, G, 15, 88, 'glass'),
      beam(1190, G - 88 - 9, 130, 18, 'wood'),
      col(1155, G - 106, 14, 66, 'wood'),
      col(1225, G - 106, 14, 66, 'wood'),
      beam(1190, G - 172 - 8, 120, 16, 'wood'),
      // east tower: stone footings, stone cap — a rock to the base does nothing
      col(1520, G, 20, 92, 'stone'),
      col(1610, G, 20, 92, 'stone'),
      beam(1565, G - 92 - 12, 150, 24, 'stone'),
      col(1528, G - 116, 15, 56, 'wood'),
      col(1602, G - 116, 15, 56, 'wood'),
      beam(1565, G - 172 - 8, 130, 16, 'wood'),
      // the tie
      beam(1377, G - 188 - 8, 420, 16, 'wood'),
    ],
    targets: [
      perch(1190, G - 106, 12),
      perch(1565, G - 116, 12),
      perch(1300, G - 204, 11),                    // riding the bridge
      perch(1450, G - 204, 11),
    ],
    platforms: [],
  },
  // ---- campaign extension: eight handcrafted levels (see levels-extended.js) ----
  ...extensionLevels(),
  {
    name: 'Lattice',
    tier: 'bonus',
    hint: 'Nine hundred units of open truss. Every storey stands on the one below — start at the feet.',
    shots: ['rock', 'rock', 'splitter', 'rock', 'bouncy'], par: 4,
    blocks: LATTICE.blocks,
    targets: LATTICE.targets,
    platforms: [],
    view: { cx: 790, w: 3400 },
  },
  {
    name: 'Cathedral',
    tier: 'bonus',
    hint: 'The whole roof rests on eight glass columns. One pier is glass too. The nave core is sheltered.',
    shots: ['rock', 'splitter', 'rock', 'rock', 'bouncy'], par: 4,
    blocks: CATHEDRAL.blocks,
    targets: CATHEDRAL.targets,
    platforms: [],
    view: { cx: 830, w: 3300 },
  },
];

// Default camera framing for a level: wide enough that the structure reads as
// a small object inside a large world, with the ground low in frame so the sky
// above carries the sense of scale.
//
// `w` is what the composition wants and `minW` is what the level needs to be
// visible at all. The camera resolves the two against the actual viewport, so
// a small window tightens toward legibility instead of rendering the tower as
// a handful of pixels.
export function levelView(def) {
  let x0 = Infinity, x1 = -Infinity, yTop = Infinity;
  const add = (l, r, t) => { if (l < x0) x0 = l; if (r > x1) x1 = r; if (t < yTop) yTop = t; };
  for (const b of def.blocks || []) add(b.x - b.w / 2, b.x + b.w / 2, b.y - b.h / 2);
  for (const p of def.platforms || []) add(p.x - p.w / 2, p.x + p.w / 2, p.y - p.h / 2);
  for (const t of def.targets || []) add(t.x - t.r, t.x + t.r, t.y - t.r);
  if (!isFinite(x0)) return { cx: 900, w: 2600, minW: 1600, anchorGround: true };
  add(SLING.x - 130, SLING.x + 130, SLING.y - 150);
  // the ground sits at ~76% of frame height, so viewH must cover what is above it
  const needH = (G + 90 - yTop) / 0.76;
  const minW = Math.max(needH / ASPECT, (x1 - x0) * 1.08);
  const w = Math.max((x1 - x0) * 1.42, minW, 2300);
  if (def.view) return { ...def.view, minW, anchorGround: def.view.cy === undefined };
  return { cx: (x0 + x1) / 2, w, minW, anchorGround: true };
}
