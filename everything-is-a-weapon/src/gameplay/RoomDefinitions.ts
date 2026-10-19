import type { RoomDefinition } from './Room';

/**
 * The handcrafted tour of the flat. Every room has its own layout and gimmick —
 * furniture to hide behind, open lanes to steer movers through, and a set piece
 * per room. Coordinates are interior space and every gap between furniture and
 * doors is wide enough to walk through.
 */
export const HANDCRAFTED_ROOMS: readonly RoomDefinition[] = [
  // 1 — bedroom: the lesson plan (gameplay/Tutorial.ts). The frying pan is a short walk
  // away, the door is in the top wall with a socket beside it, and the eight movers
  // wait outside until their lesson: 1 to throw at, 2 for the button, 1 for the pet,
  // 1 for the wet socket, 3 for the brawl. Replayed untaught, they arrive on the clock.
  {
    id: 'room-1', name: 'THE BEDROOM', theme: 'bedroom', width: 860, height: 500, seed: 101, tutorial: true,
    playerStart: { x: 470, y: 300 },
    entrance: { side: 'top', pos: 640 },
    exit: { side: 'left', pos: 300 },
    rug: { x: 450, y: 310, w: 320, h: 200, color: '#c96f5a' },
    objects: [
      { type: 'bed', x: 100, y: 92 },
      { type: 'pillow', x: 82, y: 50, angle: 0.2, on: 0 },
      { type: 'pillow', x: 120, y: 54, angle: -0.3, on: 0 },
      // The first weapon: far enough that getting it means walking.
      { type: 'pan', x: 250, y: 330, angle: 0.4 },
      { type: 'chair', x: 330, y: 190 },
      { type: 'ball', x: 600, y: 400, angle: 0.4 },
      { type: 'book', x: 420, y: 440, angle: -0.3 },
      { type: 'shoe', x: 690, y: 290, angle: 0.5 },
      { type: 'bottle', x: 170, y: 430 },
      { type: 'teddy', x: 740, y: 400 },
      { type: 'alarmclock', x: 300, y: 110 },
      // Not in any lesson: there to be knocked over by a throw that missed.
      { type: 'lamp', x: 790, y: 160 },
    ],
    zones: [{ kind: 'electric', x: 588, y: 12, r: 18, outlet: true }],
    enemies: [
      { type: 'basic', delay: 0.2 },
      { type: 'basic', delay: 8 },
      { type: 'basic', delay: 9 },
      { type: 'basic', delay: 16 },
      { type: 'basic', delay: 22 },
      { type: 'basic', delay: 28 },
      { type: 'basic', delay: 31 },
      { type: 'basic', delay: 34 },
    ],
  },

  // 2 — CUBICLE FARM: three cubicles, three loaded desks. Shove a table and
  // everything on it goes sliding across the open floor, where one good throw
  // can catch two movers.
  {
    id: 'room-2', name: 'CUBICLE FARM', theme: 'office', width: 960, height: 540, seed: 202, challenge: 'no_chair',
    teaser: 'shove a desk and everything on it goes too', spotlight: ['table', 'officechair'],
    playerStart: { x: 130, y: 420 },
    entrance: { side: 'right', pos: 270 },
    exit: { side: 'top', pos: 480 },
    rug: { x: 480, y: 420, w: 380, h: 150, color: '#5a8fa8' },
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
    boss: 'chairman',
  },

  // 3 — FLOODED LAUNDRY: the wet room — one big puddle, a wall socket and
  // standing water everywhere it matters. Then THE HOOVER walks in and starts
  // eating the room. Feed it something explosive.
  {
    id: 'room-3', name: 'FLOODED LAUNDRY', theme: 'bathroom', width: 1000, height: 560, seed: 303, challenge: 'environment_only',
    teaser: 'water, a socket, and something that eats the room', spotlight: ['bottle', 'bucket'],
    playerStart: { x: 170, y: 300 },
    entrance: { side: 'right', pos: 290 },
    exit: { side: 'top', pos: 520 },
    rug: { x: 280, y: 110, w: 150, h: 64, color: '#f2c14e' },
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
    boss: 'flusher',
  },

  // 4 — EMBER LOUNGE: one lit fireplace, one extinguisher, and a swarm of gnats.
  // Everything flammable is fuel, everything fast is hard to hit, and the fire
  // does not care which side you are on.
  {
    id: 'room-4', name: 'EMBER LOUNGE', theme: 'living', width: 1000, height: 560, seed: 404, challenge: 'one_throw_two',
    teaser: 'the fire is not on your side', spotlight: ['extinguisher', 'spraycan'],
    playerStart: { x: 150, y: 400 },
    entrance: { side: 'right', pos: 300 },
    exit: { side: 'left', pos: 130 },
    rug: { x: 500, y: 380, w: 360, h: 190, color: '#8a6fb0' },
    objects: [
      { type: 'sofa', x: 500, y: 420 },
      { type: 'pillow', x: 465, y: 426, angle: 0.3, on: 0 },
      { type: 'pillow', x: 540, y: 428, angle: -0.2, on: 0 },
      { type: 'table', x: 240, y: 320 },
      { type: 'book', x: 220, y: 326, angle: 0.5, on: 3 },
      { type: 'candle', x: 262, y: 318, on: 3 },
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
    boss: 'kraken',
  },

  // 5 — GREASE TRAP: a kitchen of islands and slicks. The Chucker debuts here and
  // throws your own pans back at you — keep moving, keep it interrupted, and never
  // stand still next to the flour.
  {
    id: 'room-5', name: 'GREASE TRAP', theme: 'kitchen', width: 1000, height: 560, seed: 515, challenge: 'no_direct_hits',
    teaser: 'slippery floor, and they throw things back', spotlight: ['oilbottle', 'banana'],
    playerStart: { x: 150, y: 320 },
    entrance: { side: 'right', pos: 320 },
    exit: { side: 'left', pos: 470 },
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
      { type: 'oilbottle', x: 790, y: 180 },
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
    boss: 'fridgezilla',
  },

  // 6 — SHOWROOM: the display furniture is the encounter. The Sofa King wakes up
  // at the back of the shop with a Nested Box and an Express for company. Burn it.
  {
    id: 'room-6', name: 'SHOWROOM', theme: 'living', width: 1040, height: 580, seed: 505, challenge: 'chain_4',
    teaser: 'the furniture in here bites', spotlight: ['magnet', 'fan'],
    playerStart: { x: 150, y: 300 },
    entrance: { side: 'right', pos: 300 },
    exit: { side: 'top', pos: 380 },
    rug: { x: 520, y: 300, w: 420, h: 240, color: '#8a6fb0' },
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
      { type: 'magnet', x: 180, y: 260 },
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
    boss: 'piano',
  },

  // 7 — THE COMPACTOR: the warehouse floor. Crates lane the aisles, oil pools
  // where the forklift bled out, and the Bulwark walks between them daring you
  // to throw things at its front. Don't. Burn it, shock it, or go around.
  {
    id: 'room-7', name: 'THE COMPACTOR', theme: 'garage', width: 1040, height: 580, seed: 707, challenge: 'untouched',
    teaser: 'oiled floor, armoured fronts', spotlight: ['battery', 'firework'],
    playerStart: { x: 150, y: 300 },
    entrance: { side: 'right', pos: 300 },
    exit: { side: 'left', pos: 480 },
    objects: [
      { type: 'bookshelf', x: 320, y: 60 },
      { type: 'bookshelf', x: 320, y: 520 },
      { type: 'tire', x: 480, y: 150 },
      { type: 'tire', x: 522, y: 192 },
      { type: 'skateboard', x: 420, y: 380, angle: 0.2 },
      { type: 'jerrycan', x: 950, y: 250 },
      { type: 'paintcan', x: 480, y: 480 },
      { type: 'paintcan', x: 200, y: 480 },
      { type: 'wrench', x: 380, y: 200, angle: 0.8 },
      { type: 'extinguisher', x: 960, y: 500 },
      { type: 'trashcan', x: 920, y: 90 },
      { type: 'lamp', x: 470, y: 250 },
      { type: 'plank', x: 250, y: 200, angle: 1.2 },
      { type: 'ball', x: 560, y: 520 },
      { type: 'shoe', x: 250, y: 470, angle: 0.6 },
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
    boss: 'mower',
  },

  // 8 — PENTHOUSE: the Landlord himself, phased and furious, with the whole crew.
  // Everything you have learned, all at once, on expensive carpet.
  {
    id: 'room-8', name: 'PENTHOUSE', theme: 'living', width: 1040, height: 580, seed: 606, challenge: 'kill_with_book',
    teaser: 'everything you know, all at once', spotlight: ['boombox', 'boomerang'],
    playerStart: { x: 150, y: 290 },
    entrance: { side: 'right', pos: 290 },
    exit: { side: 'left', pos: 460 },
    rug: { x: 520, y: 300, w: 420, h: 240, color: '#6fa37a' },
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
      { type: 'fan', x: 930, y: 230, angle: 2.4 },
      { type: 'spraycan', x: 700, y: 480 },
      { type: 'banana', x: 700, y: 140 },
      { type: 'shoe', x: 440, y: 130, angle: 1.4 },
      { type: 'boombox', x: 300, y: 420, angle: 0.1 },
      { type: 'teeth', x: 660, y: 430 },
      { type: 'boomerang', x: 200, y: 250, angle: 0.7 },
      { type: 'bucket', x: 930, y: 440 },
      { type: 'candle', x: 560, y: 288, on: 0 },
      { type: 'extinguisher', x: 120, y: 480 },
    ],
    zones: [{ kind: 'water', x: 780, y: 320, r: 62 }],
    enemies: [
      { type: 'fragile', delay: 1.8 },
      { type: 'kaboom', delay: 5 },
      { type: 'fast', delay: 8.5 },
    ],
    boss: 'mom',
  },

  // 9 — THE LEASE: the finale. Your own barricade splits the office: sofa,
  // shelves and fridge piled across the middle, movers pouring in from the
  // right and splitting around both ends. Behind you the last lamp is still
  // lit. Ahead, the building itself stands up. Evict it and the flat is yours.
  {
    id: 'room-9', name: 'THE LEASE', theme: 'office', width: 1080, height: 600, seed: 909, challenge: 'untouched',
    teaser: 'evict the house itself', spotlight: ['book', 'extinguisher'],
    playerStart: { x: 150, y: 300 },
    entrance: { side: 'right', pos: 300 },
    exit: { side: 'left', pos: 300 },
    rug: { x: 300, y: 320, w: 340, h: 220, color: '#c9a24f' },
    objects: [
      // the barricade: everything you own, piled across the middle
      { type: 'sofa', x: 560, y: 150 },
      { type: 'pillow', x: 532, y: 156, angle: 0.3, on: 0 },
      { type: 'pillow', x: 588, y: 158, angle: -0.2, on: 0 },
      { type: 'table', x: 560, y: 280 },
      { type: 'book', x: 538, y: 286, angle: 0.4, on: 3 },
      { type: 'candle', x: 584, y: 278, on: 3 },
      { type: 'bookshelf', x: 560, y: 390 },
      { type: 'fridge', x: 560, y: 480 },
      // your side of the pile
      { type: 'pan', x: 220, y: 200, angle: 0.3 },
      { type: 'book', x: 180, y: 380, angle: -0.4 },
      { type: 'book', x: 260, y: 420, angle: 0.7 },
      { type: 'shoe', x: 320, y: 250, angle: 1.1 },
      { type: 'extinguisher', x: 110, y: 220 },
      { type: 'lamp', x: 200, y: 120 },
      { type: 'chair', x: 330, y: 420 },
      { type: 'ball', x: 120, y: 420 },
      { type: 'boombox', x: 380, y: 180, angle: -0.2 },
      // their side of the pile
      { type: 'bottle', x: 700, y: 220 },
      { type: 'bottle', x: 940, y: 380 },
      { type: 'spraycan', x: 760, y: 480 },
      { type: 'battery', x: 920, y: 520 },
      { type: 'bucket', x: 680, y: 420 },
      { type: 'teeth', x: 880, y: 260 },
      { type: 'trashcan', x: 980, y: 200 },
      { type: 'chair', x: 760, y: 120, angle: 0.5 },
      { type: 'teddy', x: 250, y: 510 },
    ],
    zones: [
      { kind: 'water', x: 750, y: 300, r: 70 },
      { kind: 'electric', x: 760, y: 12, r: 18, outlet: true },
      { kind: 'oil', x: 880, y: 470, r: 52 },
    ],
    enemies: [
      { type: 'bulwark', delay: 2 },
      { type: 'hurler', delay: 6.5 },
      { type: 'kaboom', delay: 10 },
    ],
    boss: 'house',
  },
];

/**
 * Handcrafted set-pieces pinned to depths indices, so the endless floors keep
 * dealing signature rooms: a pool, a jail, a garden. Bosses arrive by the
 * every-third-room rule, on top of whatever the anchor holds.
 */
export const ANCHOR_ROOMS: Readonly<Record<number, RoomDefinition>> = {
  // 11 — THE DEEP END: one deep pool in the middle of the floor.
  11: {
    id: 'pool-11', name: 'THE DEEP END', theme: 'pool', width: 1000, height: 580, seed: 1111, challenge: 'one_throw_two',
    teaser: 'the water is the weapon', spotlight: ['ball', 'duck'],
    playerStart: { x: 150, y: 300 },
    entrance: { side: 'right', pos: 290 },
    exit: { side: 'left', pos: 470 },
    objects: [
      { type: 'duck', x: 420, y: 200, angle: 0.6 },
      { type: 'ball', x: 620, y: 400 },
      { type: 'bucket', x: 300, y: 450 },
      { type: 'bottle', x: 700, y: 150 },
      { type: 'bottle', x: 240, y: 180 },
      { type: 'chair', x: 200, y: 420, angle: 0.5 },
      { type: 'chair', x: 820, y: 420, angle: -0.5 },
      { type: 'pillow', x: 180, y: 480, angle: 0.2 },
      { type: 'shoe', x: 850, y: 250, angle: 1.2 },
      { type: 'book', x: 380, y: 480, angle: -0.3 },
      { type: 'spraycan', x: 760, y: 120 },
    ],
    zones: [
      { kind: 'water', x: 500, y: 290, r: 125 },
      { kind: 'electric', x: 500, y: 12, r: 18, outlet: true },
    ],
    enemies: [
      { type: 'basic', delay: 1.8 },
      { type: 'fast', delay: 5 },
      { type: 'fast', delay: 8 },
    ],
  },

  // 14 — THE CLINK: cot, table and a bowling ball in the open yard.
  14: {
    id: 'jail-14', name: 'THE CLINK', theme: 'jail', width: 960, height: 560, seed: 1414, challenge: 'no_direct_hits',
    teaser: 'do not drop the soap', spotlight: ['bowlingball', 'book'],
    playerStart: { x: 150, y: 400 },
    entrance: { side: 'right', pos: 280 },
    exit: { side: 'left', pos: 280 },
    objects: [
      { type: 'bed', x: 180, y: 90 },
      { type: 'table', x: 480, y: 420 },
      { type: 'book', x: 460, y: 426, angle: 0.4, on: 1 },
      { type: 'plate', x: 505, y: 414, on: 1 },
      { type: 'bowlingball', x: 700, y: 420 },
      { type: 'plank', x: 600, y: 250, angle: 0.2 },
      { type: 'chair', x: 380, y: 460, angle: -0.4 },
      { type: 'bottle', x: 820, y: 180 },
      { type: 'shoe', x: 250, y: 480, angle: 1 },
      { type: 'pillow', x: 150, y: 200, angle: 0.3 },
      { type: 'bucket', x: 600, y: 120 },
    ],
    zones: [
      { kind: 'water', x: 720, y: 420, r: 55 },
      { kind: 'electric', x: 760, y: 12, r: 18, outlet: true },
    ],
    enemies: [
      { type: 'helmet', delay: 2 },
      { type: 'shield', delay: 6.5 },
      { type: 'basic', delay: 9.5 },
    ],
  },

  // 17 — THE ALLOTMENT: planter pots, long-handled tools, and a duck pond.
  17: {
    id: 'garden-17', name: 'THE ALLOTMENT', theme: 'garden', width: 1040, height: 580, seed: 1717, challenge: 'one_throw_two',
    teaser: 'weed them out', spotlight: ['rake', 'flowerpot'],
    playerStart: { x: 150, y: 300 },
    entrance: { side: 'right', pos: 300 },
    exit: { side: 'left', pos: 300 },
    objects: [
      { type: 'table', x: 150, y: 120 },
      { type: 'toolbox', x: 132, y: 118, on: 0 },
      { type: 'flowerpot', x: 350, y: 210 },
      { type: 'flowerpot', x: 690, y: 370 },
      { type: 'flowerpot', x: 420, y: 380 },
      { type: 'rake', x: 540, y: 420, angle: 0.4 },
      { type: 'broom', x: 240, y: 420, angle: -0.3 },
      { type: 'bucket', x: 800, y: 380 },
      { type: 'duck', x: 860, y: 430, angle: 0.8 },
      { type: 'ball', x: 250, y: 200 },
      { type: 'bottle', x: 920, y: 180 },
      { type: 'shoe', x: 480, y: 480, angle: 1.1 },
      { type: 'chair', x: 150, y: 480, angle: 0.3 },
      { type: 'book', x: 760, y: 180, angle: -0.5 },
    ],
    zones: [
      { kind: 'water', x: 860, y: 430, r: 58 },
    ],
    enemies: [
      { type: 'basic', delay: 1.8 },
      { type: 'fast', delay: 5 },
      { type: 'gnat', delay: 7.5 },
      { type: 'gnat', delay: 9 },
    ],
  },

  // 19 — SUNPORCH: a long verandah, sweet tea for two, no boss. Breathe.
  19: {
    id: 'porch-19', name: 'SUNPORCH', theme: 'porch', width: 1240, height: 440, seed: 1919, challenge: 'one_throw_two',
    teaser: 'sweet tea for two', spotlight: ['chair', 'lamp'],
    playerStart: { x: 150, y: 220 },
    entrance: { side: 'right', pos: 220 },
    exit: { side: 'left', pos: 220 },
    rug: { x: 620, y: 230, w: 300, h: 150, color: '#c9a24f' },
    objects: [
      { type: 'table', x: 620, y: 220 },
      { type: 'candle', x: 600, y: 220, on: 0 },
      { type: 'book', x: 644, y: 222, angle: 0.4, on: 0 },
      { type: 'chair', x: 500, y: 220, angle: 1.4 },
      { type: 'chair', x: 740, y: 220, angle: -1.4 },
      { type: 'lamp', x: 620, y: 120 },
      { type: 'flowerpot', x: 320, y: 320 },
      { type: 'flowerpot', x: 920, y: 320 },
      { type: 'ball', x: 220, y: 320 },
      { type: 'bottle', x: 1020, y: 180 },
      { type: 'shoe', x: 1080, y: 320, angle: 0.9 },
      { type: 'boombox', x: 420, y: 250, angle: -0.2 },
      { type: 'book', x: 820, y: 160, angle: 0.6 },
    ],
    zones: [],
    enemies: [
      { type: 'fast', delay: 1.8 },
      { type: 'fast', delay: 5 },
      { type: 'basic', delay: 8 },
    ],
  },

  // 20 — BOILER ROOM: furnace lit, floor slick, vacuumasaurus on rotation.
  20: {
    id: 'basement-20', name: 'BOILER ROOM', theme: 'basement', width: 900, height: 620, seed: 2020, challenge: 'environment_only',
    teaser: 'the furnace is on', spotlight: ['extinguisher', 'bucket'],
    playerStart: { x: 150, y: 310 },
    entrance: { side: 'right', pos: 310 },
    exit: { side: 'left', pos: 310 },
    objects: [
      { type: 'stove', x: 450, y: 40 },
      { type: 'bookshelf', x: 250, y: 40 },
      { type: 'tire', x: 650, y: 520 },
      { type: 'tire', x: 690, y: 555 },
      { type: 'toolbox', x: 350, y: 320 },
      { type: 'paintcan', x: 560, y: 330 },
      { type: 'wrench', x: 450, y: 420, angle: 0.7 },
      { type: 'bucket', x: 250, y: 480 },
      { type: 'bottle', x: 700, y: 250 },
      { type: 'extinguisher', x: 120, y: 200 },
      { type: 'chair', x: 200, y: 380, angle: 0.4 },
      { type: 'lamp', x: 780, y: 150 },
      { type: 'shoe', x: 550, y: 550, angle: 1.3 },
    ],
    zones: [
      { kind: 'fire', x: 450, y: 110, r: 24 },
      { kind: 'oil', x: 620, y: 450, r: 55 },
      { kind: 'water', x: 250, y: 480, r: 50 },
      { kind: 'electric', x: 700, y: 12, r: 18, outlet: true },
    ],
    enemies: [
      { type: 'helmet', delay: 2 },
      { type: 'kaboom', delay: 6.5 },
      { type: 'trolley', delay: 10 },
    ],
  },
};
