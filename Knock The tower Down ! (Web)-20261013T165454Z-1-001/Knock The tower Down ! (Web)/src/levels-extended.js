// Handcrafted level set — the campaign extension.
//
// Eight new towers, each a distinct structural idea and silhouette, registered
// into the main LEVELS list just before the two monuments (levels.js spreads
// this array in, so the monuments remain the campaign finale).
//
// These builders obey the same measured solver rules as the rest of the game
// (documented at levels.js above buildLattice): stacked single columns hold to
// great heights, decks on two posts with wide bearing hold, long spans hold
// when both ends rest on solid tops, and stone belongs low or in short stacks.
// There are NO free-floating braces: every member rests exactly on the surface
// below it, and the lattice/braced read of tall columns comes from the glyph
// pattern the renderer draws inside the physical block (opt-in via `pattern`),
// exactly like the Lattice monument.
import { WORLD_W, GROUND_Y, SLING, col, beam, perch } from './levels.js';

// A short 2-post derelict shed: no cores, pure chain-reaction fuel and
// silhouette filler, the same device the campaign uses beside The Vault.
function shed(blocks, x, G, h = 64, m2 = 'glass') {
  blocks.push(col(x - 60, G, 14, h, 'wood'));
  blocks.push(col(x + 60, G, 14, h, m2));
  blocks.push(beam(x, G - h - 7, 96, 14, 'wood'));
}

/* ---- 1. BUTTRESS YARD ------------------------------------------------
   Three independent constructions: two low buttress towers and one tall
   centre mast. Nothing surports anything else — the puzzle is that each
   belongs to itself, and the core under the west deck only falls when the
   deck above it does. */
function buildButtressYard(G) {
  const blocks = [];
  // west buttress
  blocks.push(col(1080, G, 26, 96, 'stone'));
  blocks.push(col(1180, G, 26, 96, 'stone'));
  blocks.push(beam(1130, G - 96 - 8, 170, 16, 'stone'));
  blocks.push(col(1096, G - 96 - 16, 12, 60, 'wood'));
  blocks.push(col(1164, G - 96 - 16, 12, 60, 'wood'));
  blocks.push(beam(1130, G - 96 - 16 - 60 - 7, 104, 14, 'wood'));
  // the mast: one stone footing, wood above
  blocks.push(col(1380, G, 24, 120, 'stone'));
  blocks.push(col(1380, G - 120, 18, 150, 'wood', { pattern: 'braced' }));
  blocks.push(col(1380, G - 270, 14, 110, 'wood'));
  // east buttress: stone footings, cage above, one storey taller than west
  blocks.push(col(1560, G, 26, 110, 'stone'));
  blocks.push(col(1660, G, 26, 110, 'stone'));
  blocks.push(beam(1610, G - 110 - 8, 170, 16, 'stone'));
  blocks.push(col(1576, G - 110 - 16, 12, 70, 'wood'));
  blocks.push(col(1644, G - 110 - 16, 12, 70, 'wood'));
  blocks.push(beam(1610, G - 110 - 16 - 70 - 7, 104, 14, 'wood'));
  // fuel well east of the east buttress — nothing that could catch a fall
  shed(blocks, 1800, G, 50, 'glass');
  return {
    blocks,
    targets: [
      perch(1130, G, 12),                    // sheltered under the west deck
      perch(1130, G - 96 - 16 - 60 - 14, 11), // on the west cap
      perch(1610, G - 110 - 16 - 70 - 14, 11), // on the east cap
      perch(1380, G - 380, 11),              // finial: the mast must come down
    ],
  };
}

/* ---- 2. OFFSET HOLD ---------------------------------------------------
   One continuous five-post deck (bay beams bearing 10px on each pier, the
   proven nave technique), with a light turret west, a glass turret at the
   centre and the heavy stone mass pushed east off the centreline. The upper
   mass is deliberately NOT centred over the foundation: break the east pair
   and the load walks west across the deck. */
function buildOffsetHold(G) {
  const blocks = [];
  const pierX = [1090, 1200, 1310, 1420, 1530];
  pierX.forEach((x, i) => blocks.push(col(x, G, 24, 120, i === 0 || i === 4 ? 'stone' : 'wood', { pattern: 'braced' })));
  for (const x of [1145, 1255, 1365, 1475]) blocks.push(beam(x, G - 120 - 8, 106, 16, 'wood')); // deck top 800
  // west light turret on bay 1
  blocks.push(col(1120, 800, 14, 60, 'wood'));
  blocks.push(col(1170, 800, 14, 60, 'wood'));
  blocks.push(beam(1145, 800 - 60 - 7, 104, 14, 'wood'));
  // centre glass turret with a stone cap on bay 2
  blocks.push(col(1215, 800, 14, 70, 'glass'));
  blocks.push(col(1295, 800, 14, 70, 'glass'));
  blocks.push(beam(1255, 800 - 70 - 9, 110, 18, 'stone'));
  // east heavy mass, straddling bays 3-4, clearly off-centre
  blocks.push(col(1375, 800, 20, 80, 'stone', { pattern: 'braced' }));
  blocks.push(col(1455, 800, 20, 80, 'stone', { pattern: 'braced' }));
  blocks.push(beam(1415, 800 - 80 - 11, 150, 22, 'stone', { pattern: 'braced' }));
  return {
    blocks,
    targets: [
      perch(1255, G, 13),          // inside the deck, under the glass turret
      perch(1365, G, 13),          // inside the deck, under the heavy mass
      perch(1145, 800 - 60 - 14, 11), // light cap
      perch(1415, 800 - 80 - 22, 12), // crown: sittings on the off-centre mass
    ],
  };
}

/* ---- 3. TIE & SPAN ----------------------------------------------------
   Two unequal towers tied by a long deck at banner height. The tie is the
   only thing holding the two cores walking its length, and it rests on both
   tower decks — a real two-support span. The east tower's cage is glass. */
function buildTieSpan(G) {
  const blocks = [];
  // west tower: stone footing, stone crown
  blocks.push(col(1060, G, 26, 78, 'stone'));
  blocks.push(col(1180, G, 26, 78, 'stone'));
  blocks.push(beam(1120, G - 78 - 8, 150, 16, 'stone'));
  blocks.push(col(1090, G - 94, 14, 110, 'wood'));
  blocks.push(col(1150, G - 94, 14, 110, 'wood'));
  blocks.push(beam(1120, G - 94 - 110 - 7, 100, 14, 'stone', { pattern: 'braced' }));
  // east tower: wood footing, glass cage
  blocks.push(col(1490, G, 26, 78, 'wood'));
  blocks.push(col(1630, G, 26, 78, 'wood'));
  blocks.push(beam(1560, G - 78 - 8, 150, 16, 'wood'));
  blocks.push(col(1520, G - 94, 14, 90, 'glass'));
  blocks.push(col(1600, G - 94, 14, 90, 'glass'));
  blocks.push(beam(1560, G - 94 - 90 - 7, 90, 14, 'wood'));
  // the tie: 320 units from the west deck to the east deck, 15px bearing each end
  blocks.push(beam(1340, G - 94 - 7, 320, 14, 'wood', { pattern: 'braced' }));
  return {
    blocks,
    targets: [
      perch(1120, G - 94 - 110 - 14, 11), // west finial
      perch(1560, G - 94 - 90 - 14, 11),  // east finial
      perch(1280, G - 94 - 14, 11),        // riding the tie, west
      perch(1410, G - 94 - 14, 11),        // riding the tie, east
    ],
  };
}

/* ---- 4. THE NEST ------------------------------------------------------
   A rectangular stone frame over a small inner mass, with the sheltered core
   on the dirt inside it. Four attack routes: either cap, the tie over the
   top, or pull the frame apart and drop everything on the core. */
function buildNest(G) {
  const blocks = [];
  // the frame: left and right wall pairs, stone decks, tie over the top
  blocks.push(col(1300, G, 24, 110, 'stone'));
  blocks.push(col(1350, G, 24, 110, 'stone'));
  blocks.push(col(1410, G, 24, 110, 'stone'));
  blocks.push(col(1460, G, 24, 110, 'stone'));
  const capY = G - 110 - 7;
  blocks.push(beam(1325, capY, 100, 14, 'stone', { pattern: 'braced' }));  // left deck, top capY-7
  blocks.push(beam(1435, capY, 100, 14, 'stone', { pattern: 'braced' }));  // right deck, top capY-7
  blocks.push(beam(1375, capY - 14, 70, 14, 'wood'));                     // the tie, top capY-21
  shed(blocks, 1620, G, 64, 'wood');
  return {
    blocks,
    targets: [
      perch(1380, G, 12),          // inside the frame, on the dirt
      perch(1375, capY - 21, 11),  // on the tie
      perch(1325, capY - 7, 11),   // on the left deck
      perch(1435, capY - 7, 11),   // on the right deck
    ],
  };
}

/* ---- 5. CROWNWEIGHT ---------------------------------------------------
   A deliberately broad, heavy stone crown on four short legs — two of them
   glass. Only 73 units off the ground, the crown is the weight and the legs
   are the puzzle. */
function buildCrownweight(G) {
  const blocks = [];
  // four short glass legs: any two broken lets the crown come down flat
  blocks.push(col(1290, G, 20, 80, 'glass'));
  blocks.push(col(1370, G, 20, 80, 'glass'));
  blocks.push(col(1430, G, 20, 80, 'glass'));
  blocks.push(col(1510, G, 20, 80, 'glass'));
  blocks.push(beam(1400, G - 80 - 13, 270, 26, 'stone', { pattern: 'braced' }));
  blocks.push(col(1360, G - 80 - 26, 14, 45, 'wood'));
  blocks.push(col(1440, G - 80 - 26, 14, 45, 'wood'));
  blocks.push(beam(1400, G - 80 - 26 - 45 - 7, 110, 14, 'wood'));
  // fuel far west of the crown, where it cannot catch a tipping slab
  shed(blocks, 1090, G, 56, 'glass');
  return {
    blocks,
    targets: [
      perch(1400, G, 13),                    // sheltered under the crown
      perch(1320, G - 80 - 26, 11),          // standing on the crown, west
      perch(1400, G - 80 - 26 - 45 - 14, 11), // top of the tier
    ],
  };
}

/* ---- 6. TWIN SPIRES ---------------------------------------------------
   Two unequal towers, each a two-post group carrying a wide stone shelf at
   the same height, tied by one beam between the shelf centres. The tie's
   weight lands on the shelves, which hand it to the post pairs — no single
   column carries an off-axis load. Above each shelf a tapered stack. */
function buildTwinSpires(G) {
  const blocks = [];
  // west tower: stout, stone shelf
  blocks.push(col(1195, G, 26, 100, 'stone'));
  blocks.push(col(1285, G, 26, 100, 'stone'));
  blocks.push(beam(1240, G - 100 - 8, 130, 16, 'stone', { pattern: 'braced' }));  // shelf, top 820
  blocks.push(col(1240, G - 116, 22, 150, 'wood', { pattern: 'braced' }));
  blocks.push(col(1240, G - 266, 18, 120, 'wood'));
  blocks.push(beam(1240, G - 392 - 6, 44, 12, 'stone'));                         // cap, top 532
  // east tower: slimmer, wood shelf, deliberately less mass
  blocks.push(col(1495, G, 24, 100, 'wood'));
  blocks.push(col(1585, G, 24, 100, 'wood'));
  blocks.push(beam(1540, G - 100 - 8, 110, 16, 'wood'));                          // shelf, top 820
  blocks.push(col(1540, G - 116, 18, 150, 'wood', { pattern: 'braced' }));
  blocks.push(col(1540, G - 266, 14, 110, 'wood'));
  blocks.push(beam(1540, G - 382 - 6, 40, 12, 'wood'));                           // cap, top 548
  // the tie: 220 units between the shelves, bearing on both
  blocks.push(beam(1395, G - 116 - 7, 220, 14, 'wood', { pattern: 'braced' }));
  shed(blocks, 1090, G, 56, 'glass');
  return {
    blocks,
    targets: [
      perch(1240, G - 392 - 12, 11), // west finial
      perch(1540, G - 382 - 12, 11), // east finial
      perch(1330, G - 116 - 14, 11), // on the tie, west
      perch(1460, G - 116 - 14, 11), // on the tie, east
    ],
  };
}

/* ---- 7. GALLOWS -------------------------------------------------------
   The asymmetric one. A two-post pier tower carries a 290-unit stone span;
   a heavy short counterweight stack holds the west arm down while a light
   glass cage stands far out on the east arm. The whole assembly's centre of
   mass sits over the pier's cap beam — that is what the counterweight is
   for. Pull it and everything above walks east. */
function buildGallows(G) {
  const blocks = [];
  // the pier tower: the span's two supports
  blocks.push(col(1255, G, 30, 190, 'stone'));
  blocks.push(col(1335, G, 30, 190, 'stone'));
  // the span itself, resting directly on both pier tops (post tops 746)
  blocks.push(beam(1295, G - 201, 290, 22, 'stone', { pattern: 'braced' })); // span, top 724
  // counterweight: a short, heavy stack on the west arm
  blocks.push(col(1225, G - 212, 26, 80, 'stone'));
  blocks.push(col(1225, G - 292, 20, 60, 'stone'));
  // the east cage standing on the long arm
  blocks.push(col(1355, G - 212, 14, 62, 'wood'));
  blocks.push(col(1415, G - 212, 14, 62, 'wood'));
  blocks.push(beam(1385, G - 274 - 7, 126, 14, 'wood'));
  blocks.push(col(1373, G - 288, 12, 34, 'glass'));
  blocks.push(col(1397, G - 288, 12, 34, 'glass'));
  blocks.push(beam(1385, G - 322 - 6, 86, 12, 'glass'));
  shed(blocks, 1580, G, 64, 'wood');
  return {
    blocks,
    targets: [
      perch(1225, G - 352, 11),        // the counterweight's crown
      perch(1185, G - 212, 11),        // on the span itself, west of the weight
      perch(1385, G - 334, 11),  // the cage cap, far out on the east arm
    ],
  };
}

/* ---- 8. TWO-STAGE FALL ------------------------------------------------
   The finale puzzle. A stone hut shelters a core on the dirt; a pair of
   glass legs carries a heavy stone cube above it, with a deck core beside.
   The intended play is in two movements: drop the cube, then drop the deck —
   the second stage only opens after the first. */
function buildTwoStage(G) {
  const blocks = [];
  // lower stage: the hut with a stone deck
  blocks.push(col(1310, G, 24, 110, 'wood', { pattern: 'braced' }));
  blocks.push(col(1450, G, 24, 110, 'wood', { pattern: 'braced' }));
  blocks.push(beam(1380, G - 110 - 8, 170, 16, 'stone', { pattern: 'braced' })); // deck, top 810
  // the waist: two short stone legs, 70 units tall
  blocks.push(col(1332, G - 126, 20, 70, 'stone'));
  blocks.push(col(1392, G - 126, 20, 70, 'stone'));
  // the heavy cube on top (legs top 740)
  blocks.push(col(1362, G - 196, 90, 60, 'stone', { pattern: 'braced' }));
  shed(blocks, 1180, G, 64, 'glass');
  shed(blocks, 1580, G, 64, 'wood');
  return {
    blocks,
    targets: [
      perch(1380, G, 13),          // sheltered inside the hut
      perch(1440, G - 126, 12),    // on the stone deck, beside the waist
      perch(1362, G - 256, 12),    // on top of the cube
    ],
  };
}

// Built lazily: levels.js imports this module (so it evaluates first), which
// means the primitives and GROUND_Y it needs are not initialised until
// levels.js has run its own declarations — the builders must therefore run
// when asked, not at module evaluation.
export function extensionLevels() {
  return [
    {
      name: 'Buttress Yard',
      hint: 'Nothing here supports anything else. Three buildings, three separate problems — and one core under the deck.',
      shots: ['rock', 'rock', 'splitter', 'bouncy'], par: 3,
      blocks: buildButtressYard(GROUND_Y).blocks,
      targets: buildButtressYard(GROUND_Y).targets,
      platforms: [],
    },
    {
      name: 'Offset Hold',
      hint: 'One deck, several sections, the weight pushed east of the foundation. Break the east pair and watch the load walk west.',
      shots: ['rock', 'rock', 'splitter', 'bouncy'], par: 3,
      blocks: buildOffsetHold(GROUND_Y).blocks,
      targets: buildOffsetHold(GROUND_Y).targets,
      platforms: [],
    },
    {
      name: 'Tie & Span',
      hint: 'Two towers, one long tie. The cores walking the tie only have that beam under them.',
      shots: ['rock', 'splitter', 'rock', 'bouncy', 'rock'], par: 4,
      blocks: buildTieSpan(GROUND_Y).blocks,
      targets: buildTieSpan(GROUND_Y).targets,
      platforms: [],
    },
    {
      name: 'The Nest',
      hint: 'A stone frame over a sheltered core. Take a deck, take the tie — or pull the frame apart.',
      shots: ['rock', 'splitter', 'rock', 'bouncy'], par: 3,
      blocks: buildNest(GROUND_Y).blocks,
      targets: buildNest(GROUND_Y).targets,
      platforms: [],
    },
    {
      name: 'Crownweight',
      hint: 'A broad stone crown on four short legs, two of them glass. The crown is the weight; the legs are the puzzle.',
      shots: ['rock', 'rock', 'splitter', 'bouncy'], par: 3,
      blocks: buildCrownweight(GROUND_Y).blocks,
      targets: buildCrownweight(GROUND_Y).targets,
      platforms: [],
    },
    {
      name: 'Twin Spires',
      hint: 'Stout west, slim east, one tie between. Drop the tie — or drop a finial onto its neighbour.',
      shots: ['rock', 'rock', 'splitter', 'rock', 'bouncy'], par: 3,
      blocks: buildTwinSpires(GROUND_Y).blocks,
      targets: buildTwinSpires(GROUND_Y).targets,
      platforms: [],
    },
    {
      name: 'The Gallows',
      hint: 'A pier, a long span, a heavy counterweight west and a light glass cage far out on the east arm.',
      shots: ['rock', 'splitter', 'rock', 'bouncy', 'rock'], par: 4,
      blocks: buildGallows(GROUND_Y).blocks,
      targets: buildGallows(GROUND_Y).targets,
      platforms: [],
    },
    {
      name: 'Two-Stage Fall',
      hint: 'A stone cube on glass legs over a stone hut. Drop the cube, then drop the deck — stage two opens after stage one.',
      shots: ['rock', 'rock', 'splitter', 'rock', 'bouncy'], par: 3,
      blocks: buildTwoStage(GROUND_Y).blocks,
      targets: buildTwoStage(GROUND_Y).targets,
      platforms: [],
    },
  ];
}
