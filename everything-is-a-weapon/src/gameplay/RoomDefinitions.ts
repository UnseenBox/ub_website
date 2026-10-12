import type { RoomDefinition } from './Room';

/**
 * The handcrafted tour of the flat. Every room has its own floor plan, silhouette
 * and gimmick — partitions to hide behind, narrow gaps to funnel movers through,
 * machinery that changes the fight, and a set piece per room. `walls` are interior
 * partitions (static, or sliding machinery); coordinates are interior space and every
 * gap between walls, furniture and doors is wide enough to walk through.
 */
export const HANDCRAFTED_ROOMS: readonly RoomDefinition[] = [
  // 1 — bedroom: throwing. You start mid-room with a chair an arm's length away,
  // a bouncy ball / book / shoe all within one step, and the first mover already
  // hammering on the door. A second mover arrives ~9s in so the first minute is
  // "grab, BONK, experiment" with no waiting and no overwhelm.
  {
    id: 'room-1', name: 'THE BEDROOM', theme: 'bedroom', width: 860, height: 500, seed: 101, tutorial: true,
    playerStart: { x: 520, y: 262 },
    entrance: { side: 'right', pos: 250 },
    exit: { side: 'top', pos: 480 },
    rug: { x: 520, y: 280, w: 320, h: 200, color: '#c96f5a' },
    objects: [
      { type: 'bed', x: 100, y: 92 },
      { type: 'pillow', x: 82, y: 50, angle: 0.2, on: 0 },
      { type: 'pillow', x: 120, y: 54, angle: -0.3, on: 0 },
      // The opening arsenal: heavy (chair), bouncy (ball), fast (book), funny (shoe),
      // all inside grab range of the spawn point and on the mover's walk-in line.
      { type: 'chair', x: 435, y: 258 },
      { type: 'ball', x: 585, y: 322, angle: 0.4 },
      { type: 'book', x: 468, y: 348, angle: -0.3 },
      { type: 'shoe', x: 598, y: 198, angle: 0.5 },
      // Chaos ingredients slightly further out: a bottle that spills, a teddy to
      // throw at a face, and the alarm clock as the "movers come to look" demo.
      { type: 'bottle', x: 380, y: 180 },
      { type: 'teddy', x: 660, y: 330 },
      { type: 'alarmclock', x: 350, y: 120 },
    ],
    zones: [],
    enemies: [
      { type: 'basic', delay: 0.2 },
      { type: 'basic', delay: 9 },
    ],
  },

  // 2 — CUBICLE FARM: partition maze. Three cubicles with loaded desks; shove a
  // table and everything on it goes sliding down the aisles. Movers funnel through
  // the gaps, so one good throw can catch two of them.
  {
    id: 'room-2', name: 'CUBICLE FARM', theme: 'office', width: 960, height: 540, seed: 202, challenge: 'no_chair',
    playerStart: { x: 130, y: 420 },
    entrance: { side: 'right', pos: 270 },
    exit: { side: 'top', pos: 480 },
    rug: { x: 480, y: 420, w: 380, h: 150, color: '#5a8fa8' },
    walls: [
      // two hanging partitions make three cubicles; wide aisles all round
      { x: 400, y: 125, hw: 10, hh: 115 },
      { x: 640, y: 125, hw: 10, hh: 115 },
      // a low divider shielding the player's corner
      { x: 150, y: 300, hw: 110, hh: 10 },
    ],
    objects: [
      { type: 'table', x: 280, y: 130 },
      { type: 'computer', x: 262, y: 124, angle: 0.1, on: 0 },
      { type: 'book', x: 322, y: 146, angle: 0.4, on: 0 },
      { type: 'table', x: 520, y: 130 },
      { type: 'candle', x: 520, y: 128, on: 3 },
      { type: 'book', x: 560, y: 140, angle: -0.5, on: 3 },
      { type: 'table', x: 770, y: 130 },
      { type: 'flowerpot', x: 770, y: 126, on: 6 },
      { type: 'chair', x: 280, y: 280 },
      { type: 'chair', x: 520, y: 280 },
      { type: 'chair', x: 770, y: 280, angle: 0.6 },
      { type: 'lamp', x: 880, y: 420 },
      { type: 'shoe', x: 200, y: 470, angle: -0.4 },
      { type: 'trashcan', x: 880, y: 100 },
      { type: 'officechair', x: 640, y: 420, angle: 1.2 },
      { type: 'ball', x: 420, y: 460 },
    ],
    zones: [],
    enemies: [
      { type: 'basic', delay: 1.6 },
      { type: 'fast', delay: 6 },
    ],
  },

  // 3 — FLOODED LAUNDRY: a partition splits the wet room; two gaps, one big puddle,
  // a wall socket, and standing water everywhere it matters. Then THE HOOVER walks
  // in and starts eating the room. Feed it something explosive.
  {
    id: 'room-3', name: 'FLOODED LAUNDRY', theme: 'bathroom', width: 1000, height: 560, seed: 303, challenge: 'environment_only',
    playerStart: { x: 170, y: 300 },
    entrance: { side: 'right', pos: 290 },
    exit: { side: 'top', pos: 520 },
    rug: { x: 280, y: 110, w: 150, h: 64, color: '#f2c14e' },
    walls: [
      // the laundry partition: cross through either gap, never around
      { x: 520, y: 125, hw: 12, hh: 115 },
      { x: 520, y: 455, hw: 12, hh: 95 },
    ],
    objects: [
      { type: 'bathtub', x: 280, y: 29 },
      { type: 'toilet', x: 890, y: 22 },
      { type: 'lamp', x: 560, y: 300 },
      { type: 'hairdryer', x: 420, y: 170, angle: 0.6 },
      { type: 'chair', x: 330, y: 400 },
      { type: 'soap', x: 240, y: 230, angle: 0.4 },
      { type: 'duck', x: 420, y: 100, angle: 0.8 },
      { type: 'plunger', x: 820, y: 110 },
      { type: 'mirror', x: 130, y: 440, angle: 0.3 },
      { type: 'bottle', x: 250, y: 470 },
      { type: 'bottle', x: 430, y: 480 },
      { type: 'bucket', x: 620, y: 420 },
      { type: 'broom', x: 700, y: 480, angle: 0.3 },
      { type: 'spraycan', x: 760, y: 200 },
      { type: 'shoe', x: 180, y: 380, angle: 1.1 },
    ],
    zones: [
      { kind: 'water', x: 340, y: 300, r: 86 },
      { kind: 'electric', x: 760, y: 12, r: 18, outlet: true },
    ],
    enemies: [
      { type: 'basic', delay: 1.8 },
      { type: 'fast', delay: 6 },
    ],
    boss: 'hoover',
  },

  // 4 — EMBER LOUNGE: one lit fireplace, one extinguisher, and a swarm of gnats.
  // Everything flammable is fuel, everything fast is hard to hit, and the fire
  // does not care which side you are on.
  {
    id: 'room-4', name: 'EMBER LOUNGE', theme: 'living', width: 1000, height: 560, seed: 404, challenge: 'one_throw_two',
    playerStart: { x: 150, y: 400 },
    entrance: { side: 'right', pos: 300 },
    exit: { side: 'left', pos: 130 },
    rug: { x: 500, y: 380, w: 360, h: 190, color: '#8a6fb0' },
    walls: [
      // two seating nooks flanking the hearth
      { x: 250, y: 200, hw: 90, hh: 10 },
      { x: 750, y: 200, hw: 90, hh: 10 },
    ],
    objects: [
      { type: 'sofa', x: 500, y: 420 },
      { type: 'pillow', x: 465, y: 426, angle: 0.3, on: 0 },
      { type: 'pillow', x: 540, y: 428, angle: -0.2, on: 0 },
      { type: 'table', x: 250, y: 320 },
      { type: 'book', x: 230, y: 326, angle: 0.5, on: 3 },
      { type: 'candle', x: 272, y: 318, on: 3 },
      { type: 'chair', x: 380, y: 420 },
      { type: 'chair', x: 620, y: 420 },
      { type: 'bookshelf', x: 240, y: 20 },
      { type: 'tv', x: 800, y: 110 },
      { type: 'vase', x: 150, y: 190 },
      { type: 'spraycan', x: 660, y: 480 },
      { type: 'bottle', x: 200, y: 480 },
      { type: 'extinguisher', x: 110, y: 280 },
      { type: 'shoe', x: 330, y: 480, angle: 2 },
      { type: 'boomerang', x: 850, y: 450, angle: 0.4 },
      { type: 'ball', x: 500, y: 250 },
    ],
    zones: [
      // the hearth: a permanent fireplace. Mind the rug.
      { kind: 'fire', x: 500, y: 60, r: 26 },
    ],
    enemies: [
      { type: 'gnat', delay: 1.8 },
      { type: 'gnat', delay: 2.6 },
      { type: 'gnat', delay: 3.4 },
      { type: 'fragile', delay: 7.5 },
    ],
  },

  // 5 — GREASE TRAP: a kitchen of islands and slicks. The Chucker debuts here and
  // throws your own pans back at you — keep moving, keep it interrupted, and never
  // stand still next to the flour.
  {
    id: 'room-5', name: 'GREASE TRAP', theme: 'kitchen', width: 1000, height: 560, seed: 515, challenge: 'no_direct_hits',
    playerStart: { x: 150, y: 320 },
    entrance: { side: 'right', pos: 320 },
    exit: { side: 'left', pos: 470 },
    walls: [
      // kitchen islands with a wide middle lane
      { x: 350, y: 300, hw: 80, hh: 12 },
      { x: 650, y: 300, hw: 80, hh: 12 },
    ],
    objects: [
      { type: 'counter', x: 250, y: 25 },
      { type: 'stove', x: 354, y: 25 },
      { type: 'counter', x: 458, y: 25 },
      { type: 'toaster', x: 215, y: 26, on: 0 },
      { type: 'flour', x: 285, y: 24, on: 0 },
      { type: 'pan', x: 430, y: 26, angle: 0.4, on: 2 },
      { type: 'plate', x: 480, y: 22, on: 2 },
      { type: 'plate', x: 502, y: 30, on: 2 },
      { type: 'fridge', x: 640, y: 26 },
      { type: 'table', x: 500, y: 470 },
      { type: 'plate', x: 478, y: 462, on: 9 },
      { type: 'bottle', x: 528, y: 478, on: 9 },
      { type: 'chair', x: 410, y: 470 },
      { type: 'chair', x: 590, y: 470 },
      { type: 'banana', x: 500, y: 300, angle: 0.7 },
      { type: 'oilbottle', x: 770, y: 200 },
      { type: 'flour', x: 190, y: 450 },
      { type: 'trashcan', x: 870, y: 480 },
      { type: 'extinguisher', x: 110, y: 200 },
      { type: 'book', x: 700, y: 470, angle: 0.3 },
      { type: 'cooker', x: 372, y: 27, on: 1 },
      { type: 'mousetrap', x: 840, y: 330, angle: 0.2 },
      { type: 'broom', x: 130, y: 110, angle: 1.3 },
      { type: 'spraycan', x: 620, y: 180 },
    ],
    zones: [
      { kind: 'oil', x: 300, y: 420, r: 55 },
      { kind: 'oil', x: 700, y: 420, r: 55 },
    ],
    enemies: [
      { type: 'hurler', delay: 2.2 },
      { type: 'kaboom', delay: 6 },
      { type: 'helmet', delay: 9.5 },
    ],
  },

  // 6 — SHOWROOM: the display furniture is the encounter. The Sofa King wakes up
  // at the back of the shop with a Nested Box and an Express for company. Burn it.
  {
    id: 'room-6', name: 'SHOWROOM', theme: 'living', width: 1040, height: 580, seed: 505, challenge: 'chain_4',
    playerStart: { x: 150, y: 300 },
    entrance: { side: 'right', pos: 300 },
    exit: { side: 'top', pos: 380 },
    rug: { x: 520, y: 300, w: 420, h: 240, color: '#8a6fb0' },
    walls: [
      // display plinths splitting the showroom into aisles
      { x: 400, y: 150, hw: 90, hh: 12 },
      { x: 660, y: 430, hw: 90, hh: 12 },
    ],
    objects: [
      { type: 'sofa', x: 520, y: 120 },
      { type: 'pillow', x: 488, y: 126, angle: 0.3, on: 0 },
      { type: 'pillow', x: 552, y: 128, angle: -0.2, on: 0 },
      { type: 'table', x: 250, y: 420 },
      { type: 'candle', x: 250, y: 416, on: 3 },
      { type: 'book', x: 290, y: 428, on: 3 },
      { type: 'lamp', x: 880, y: 150 },
      { type: 'fan', x: 150, y: 480, angle: -0.15 },
      { type: 'shoe', x: 215, y: 500, angle: 0.3 },
      { type: 'chair', x: 400, y: 320 },
      { type: 'chair', x: 660, y: 250, angle: 0.4 },
      { type: 'bottle', x: 380, y: 500 },
      { type: 'spraycan', x: 760, y: 150 },
      { type: 'bookshelf', x: 880, y: 20 },
      { type: 'trashcan', x: 920, y: 500 },
      { type: 'flowerpot', x: 110, y: 200 },
      { type: 'extinguisher', x: 960, y: 90 },
      { type: 'alarmclock', x: 760, y: 470 },
      { type: 'watercooler', x: 200, y: 120 },
      { type: 'officechair', x: 520, y: 480 },
      { type: 'magnet', x: 320, y: 180 },
      { type: 'teeth', x: 600, y: 520 },
      { type: 'oilbottle', x: 830, y: 330 },
    ],
    zones: [
      { kind: 'water', x: 790, y: 480, r: 52 },
      { kind: 'electric', x: 790, y: 12, r: 18, outlet: true },
    ],
    enemies: [
      { type: 'basic', delay: 1.8 },
      { type: 'fast', delay: 5.5 },
      { type: 'nested', delay: 8.5 },
    ],
    boss: 'sofa',
  },

  // 7 — THE COMPACTOR: a warehouse with a moving wall. Crates lane the floor, oil
  // pools where the forklift bled out, and the Bulwark walks the lanes daring you
  // to throw things at its front. Don't. Burn it, shock it, or go around.
  {
    id: 'room-7', name: 'THE COMPACTOR', theme: 'garage', width: 1040, height: 580, seed: 707, challenge: 'untouched',
    playerStart: { x: 150, y: 300 },
    entrance: { side: 'right', pos: 300 },
    exit: { side: 'left', pos: 480 },
    walls: [
      // the compactor: slides east-west forever, never sealing the room
      { x: 700, y: 290, hw: 14, hh: 170, slide: { axis: 'x', range: 60, period: 9 } },
    ],
    objects: [
      { type: 'bookshelf', x: 320, y: 60 },
      { type: 'bookshelf', x: 320, y: 520 },
      { type: 'tire', x: 480, y: 150 },
      { type: 'tire', x: 522, y: 192 },
      { type: 'skateboard', x: 420, y: 380, angle: 0.2 },
      { type: 'jerrycan', x: 900, y: 140 },
      { type: 'paintcan', x: 480, y: 480 },
      { type: 'paintcan', x: 200, y: 480 },
      { type: 'wrench', x: 380, y: 200, angle: 0.8 },
      { type: 'extinguisher', x: 960, y: 500 },
      { type: 'trashcan', x: 920, y: 90 },
      { type: 'lamp', x: 470, y: 250 },
      { type: 'plank', x: 250, y: 200, angle: 1.2 },
      { type: 'ball', x: 560, y: 520 },
      { type: 'shoe', x: 330, y: 420, angle: 0.6 },
      { type: 'chair', x: 150, y: 420 },
      { type: 'rake', x: 900, y: 300 },
      { type: 'battery', x: 850, y: 450 },
      { type: 'firework', x: 250, y: 350, angle: -0.3 },
      { type: 'bowlingball', x: 340, y: 300 },
      { type: 'magnet', x: 520, y: 110 },
      { type: 'book', x: 600, y: 420, angle: 0.5 },
    ],
    zones: [
      { kind: 'oil', x: 450, y: 320, r: 60 },
      { kind: 'water', x: 880, y: 480, r: 50 },
      { kind: 'electric', x: 900, y: 12, r: 18, outlet: true },
    ],
    enemies: [
      { type: 'bulwark', delay: 2 },
      { type: 'trolley', delay: 6 },
      { type: 'shield', delay: 10 },
    ],
  },

  // 8 — PENTHOUSE: the Landlord himself, phased and furious, with the whole crew.
  // Everything you have learned, all at once, on expensive carpet.
  {
    id: 'room-8', name: 'PENTHOUSE', theme: 'living', width: 1040, height: 580, seed: 606, challenge: 'kill_with_book',
    playerStart: { x: 150, y: 290 },
    entrance: { side: 'right', pos: 290 },
    exit: { side: 'left', pos: 460 },
    rug: { x: 520, y: 300, w: 420, h: 240, color: '#6fa37a' },
    walls: [
      // foyer fins by the door: drama on entry, never in the way
      { x: 880, y: 120, hw: 10, hh: 80 },
      { x: 880, y: 460, hw: 10, hh: 80 },
    ],
    objects: [
      { type: 'table', x: 520, y: 300 },
      { type: 'bottle', x: 490, y: 290, on: 0 },
      { type: 'plate', x: 545, y: 312, on: 0 },
      { type: 'flowerpot', x: 520, y: 285, on: 0 },
      { type: 'chair', x: 420, y: 300 },
      { type: 'chair', x: 620, y: 300 },
      { type: 'chair', x: 520, y: 390 },
      { type: 'counter', x: 300, y: 25 },
      { type: 'toaster', x: 270, y: 26, on: 7 },
      { type: 'pan', x: 330, y: 24, on: 7 },
      { type: 'fridge', x: 760, y: 26 },
      { type: 'book', x: 250, y: 160, angle: 0.4 },
      { type: 'book', x: 285, y: 180, angle: -0.6 },
      { type: 'ball', x: 200, y: 460 },
      { type: 'lamp', x: 330, y: 480 },
      { type: 'computer', x: 880, y: 300, angle: 0.3 },
      { type: 'trashcan', x: 140, y: 130 },
      { type: 'fan', x: 900, y: 200, angle: 2.4 },
      { type: 'spraycan', x: 700, y: 480 },
      { type: 'banana', x: 640, y: 180 },
      { type: 'shoe', x: 440, y: 150, angle: 1.4 },
      { type: 'boombox', x: 300, y: 420, angle: 0.1 },
      { type: 'teeth', x: 660, y: 430 },
      { type: 'boomerang', x: 200, y: 250, angle: 0.7 },
      { type: 'bucket', x: 900, y: 420 },
      { type: 'candle', x: 560, y: 288, on: 0 },
      { type: 'extinguisher', x: 120, y: 480 },
    ],
    zones: [{ kind: 'water', x: 780, y: 320, r: 62 }],
    enemies: [
      { type: 'fragile', delay: 1.8 },
      { type: 'kaboom', delay: 5 },
      { type: 'fast', delay: 8.5 },
    ],
    boss: 'boss',
  },
];
