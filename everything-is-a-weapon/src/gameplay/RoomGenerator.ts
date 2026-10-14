import { Rng, hashString } from '../core/Random';
import type { EnemyTypeId } from '../entities/EnemyTypes';
import { ObjectRegistry } from '../objects/ObjectRegistry';
import { GENERIC_CHALLENGES } from './ChallengeSystem';
import type { RoomDefinition, RoomEnemySpec, RoomObjectSpec, RoomTheme, RoomZoneSpec, WallSpec } from './Room';

interface Placed {
  x: number;
  y: number;
  r: number;
}

type Weighted = ReadonlyArray<readonly [string, number]>;

interface ThemeKit {
  readonly names: readonly string[];
  /** Loose objects scattered round the room, with relative odds. */
  readonly filler: Weighted;
  /** Things that may sit on a table in this kind of room. */
  readonly tabletop: readonly string[];
  readonly rugs: readonly string[];
  /** Chance of each extra puddle (up to two). */
  readonly puddleChance: number;
}

const KITS: Readonly<Record<RoomTheme, ThemeKit>> = {
  bedroom: {
    names: ['BOX ROOM', 'GUEST ROOM', 'ATTIC ROOM'],
    filler: [['pillow', 3], ['alarmclock', 2], ['teddy', 2], ['lamp', 3], ['book', 3], ['shoe', 3], ['vase', 2], ['mirror', 1.5], ['bottle', 2], ['chair', 1.5], ['ball', 1], ['boomerang', 1.5], ['teeth', 1.5], ['mousetrap', 1.5], ['iron', 1.5], ['boombox', 1]],
    tabletop: ['alarmclock', 'book', 'vase', 'candle', 'bottle'],
    rugs: ['#c96f5a', '#8a6fb0', '#5a8fa8'],
    puddleChance: 0.2,
  },
  office: {
    names: ['SUBLET', 'COPY ROOM', 'BACK OFFICE', 'WAITING ROOM'],
    filler: [['lamp', 3], ['bottle', 4], ['trashcan', 2], ['spraycan', 2], ['extinguisher', 1], ['fan', 1.5], ['flowerpot', 2], ['ball', 1.5], ['computer', 2], ['plank', 1.5], ['candle', 1.5], ['chair', 2], ['book', 2], ['alarmclock', 1], ['officechair', 2.5], ['hoover', 1.5], ['magnet', 1], ['mousetrap', 1.2], ['boombox', 1], ['teeth', 1]],
    tabletop: ['computer', 'bottle', 'candle', 'flowerpot', 'book'],
    rugs: ['#5a8fa8', '#6fa37a', '#c9a24f'],
    puddleChance: 0.5,
  },
  bathroom: {
    names: ['WET ROOM', 'EN SUITE', 'UTILITY ROOM'],
    filler: [['soap', 3], ['duck', 3], ['plunger', 2], ['hairdryer', 2.5], ['mirror', 2], ['bottle', 4], ['trashcan', 1.5], ['vase', 1], ['lamp', 1.5], ['extinguisher', 0.5], ['bucket', 3], ['broom', 1.5], ['iron', 1]],
    tabletop: ['hairdryer', 'bottle', 'vase', 'soap'],
    rugs: ['#f2c14e', '#6d9dc5'],
    puddleChance: 0.9,
  },
  living: {
    names: ['FRONT ROOM', 'DEN', 'SNUG'],
    filler: [['pillow', 3], ['vase', 2.5], ['lamp', 3], ['candle', 2], ['book', 3], ['flowerpot', 2], ['ball', 1.5], ['chair', 2], ['spraycan', 1.5], ['tv', 1.5], ['bottle', 2], ['teddy', 1], ['boombox', 1.5], ['hoover', 1.5], ['boomerang', 1], ['firework', 1.2], ['bowlingball', 1], ['teeth', 1]],
    tabletop: ['candle', 'vase', 'book', 'bottle', 'flowerpot', 'fishtank'],
    rugs: ['#8a6fb0', '#c96f5a', '#6fa37a'],
    puddleChance: 0.25,
  },
  kitchen: {
    names: ['KITCHENETTE', 'GALLEY', 'SCULLERY'],
    filler: [['pan', 3], ['plate', 4], ['toaster', 2], ['banana', 3], ['oilbottle', 2.5], ['flour', 2.5], ['bottle', 3], ['trashcan', 1.5], ['chair', 2], ['extinguisher', 1], ['candle', 1], ['cooker', 2], ['broom', 1.5], ['bucket', 1.5], ['mousetrap', 1.5]],
    tabletop: ['plate', 'bottle', 'toaster', 'flour', 'pan', 'cooker'],
    rugs: ['#6fa37a', '#c9a24f'],
    puddleChance: 0.35,
  },
  garage: {
    names: ['LOCK-UP', 'WORKSHOP', 'STORAGE UNIT'],
    filler: [['tire', 3], ['skateboard', 2], ['paintcan', 2.5], ['jerrycan', 1.5], ['toolbox', 2], ['wrench', 3], ['spraycan', 2], ['plank', 2.5], ['extinguisher', 1], ['trashcan', 1.5], ['ball', 1.5], ['lamp', 1.5], ['rake', 2.5], ['battery', 2], ['magnet', 1.5], ['firework', 2], ['bucket', 1.5], ['bowlingball', 1.5], ['broom', 1], ['boomerang', 1]],
    tabletop: ['toolbox', 'spraycan', 'paintcan', 'wrench', 'bottle'],
    rugs: [],
    puddleChance: 0.4,
  },
};

const THEMES = Object.keys(KITS) as RoomTheme[];

const ENEMY_COST: ReadonlyArray<readonly [EnemyTypeId, number]> = [
  ['basic', 1], ['gnat', 1], ['fragile', 1.2], ['fast', 1.5], ['helmet', 2], ['shield', 2], ['kaboom', 2],
  ['electric', 2.5], ['nested', 2.5], ['trolley', 2.5], ['hurler', 2.5], ['heavy', 3], ['bulwark', 3],
];

function weighted<T>(rng: Rng, items: ReadonlyArray<readonly [T, number]>): T {
  let total = 0;
  for (const [, w] of items) total += w;
  let roll = rng.next() * total;
  for (const [item, w] of items) {
    roll -= w;
    if (roll <= 0) return item;
  }
  return items[items.length - 1]![0];
}

function radiusOf(type: string): number {
  const shape = ObjectRegistry.get(type)?.shape;
  if (!shape) return 16;
  return shape.kind === 'circle' ? shape.r : Math.hypot(shape.hw, shape.hh);
}

/**
 * Controlled randomness: the kind of room, its furniture and its clutter vary, the guarantees
 * do not. Every generated room contains unbreakable throwables (shoe, book), a chair, clear
 * space around the player and the door, and a crew whose size scales with depth — so it is
 * always winnable.
 */
export function generateRoom(index: number, seed: number, challengeOverride?: string): RoomDefinition {
  const rng = new Rng(seed);
  const depth = Math.max(1, index - 7);
  const theme = rng.pick(THEMES);
  const kit = KITS[theme];
  const width = 40 * rng.int(24, 27);
  const height = 20 * rng.int(27, 30);
  const playerStart = { x: 150, y: height / 2 };
  const entrancePos = rng.range(height * 0.3, height * 0.7);

  const placed: Placed[] = [
    { x: playerStart.x, y: playerStart.y, r: 80 },
    { x: width - 20, y: entrancePos, r: 100 },
  ];
  const objects: RoomObjectSpec[] = [];
  const zones: RoomZoneSpec[] = [];

  const findSpot = (r: number, margin: number): Placed | null => {
    for (let attempt = 0; attempt < 60; attempt++) {
      const x = rng.range(margin + r, width - margin - r);
      const y = rng.range(margin + r, height - margin - r);
      let ok = true;
      for (const p of placed) {
        if (Math.hypot(p.x - x, p.y - y) < p.r + r + 14) {
          ok = false;
          break;
        }
      }
      if (ok) return { x, y, r };
    }
    return null;
  };

  const place = (type: string, margin = 44): number => {
    const spot = findSpot(radiusOf(type), margin);
    if (!spot) return -1;
    placed.push(spot);
    objects.push({ type, x: spot.x, y: spot.y, angle: rng.range(0, Math.PI * 2) });
    return objects.length - 1;
  };

  /** Puts something flush against the back wall and reserves its footprint. */
  const againstWall = (type: string, x: number, halfWidth: number, halfDepth: number): number => {
    objects.push({ type, x, y: halfDepth + 3 });
    placed.push({ x, y: halfDepth + 3, r: halfWidth + 6 });
    return objects.length - 1;
  };

  const onTop = (surface: number, type: string, dx: number, dy: number): void => {
    const base = objects[surface]!;
    objects.push({ type, x: base.x + dx, y: base.y + dy, angle: rng.range(-0.5, 0.5), on: surface });
  };

  const table = (): void => {
    const spot = findSpot(78, 110);
    if (!spot) return;
    placed.push(spot);
    const index = objects.length;
    objects.push({ type: 'table', x: spot.x, y: spot.y, angle: rng.chance(0.3) ? Math.PI / 2 : 0 });
    const count = rng.int(1, 2);
    for (let i = 0; i < count; i++) onTop(index, rng.pick(kit.tabletop), i === 0 ? -20 : 22, rng.range(-10, 10));
  };

  // ── the furniture that makes it this kind of room ──
  switch (theme) {
    case 'bedroom': {
      const x = rng.range(110, width * 0.45);
      objects.push({ type: 'bed', x, y: 92 });
      placed.push({ x, y: 92, r: 84 });
      const bed = objects.length - 1;
      onTop(bed, 'pillow', -18, -42);
      onTop(bed, 'pillow', 20, -38);
      if (rng.chance(0.6)) table();
      break;
    }
    case 'bathroom': {
      againstWall('bathtub', rng.range(160, width * 0.45), 62, 27);
      againstWall('toilet', rng.range(width * 0.62, width - 140), 15, 20);
      break;
    }
    case 'living': {
      const x = rng.range(200, width - 260);
      objects.push({ type: 'sofa', x, y: 150 });
      placed.push({ x, y: 150, r: 66 });
      const sofa = objects.length - 1;
      onTop(sofa, 'pillow', -30, 6);
      onTop(sofa, 'pillow', 34, 8);
      table();
      if (rng.chance(0.6)) againstWall('bookshelf', x < width / 2 ? x + 240 : x - 240, 46, 13);
      break;
    }
    case 'kitchen': {
      const x = rng.range(190, width - 420);
      const left = againstWall('counter', x, 70, 23);
      againstWall('stove', x + 104, 32, 23);
      const right = againstWall('counter', x + 208, 70, 23);
      onTop(left, rng.pick(['toaster', 'flour', 'plate']), -30, 1);
      onTop(right, rng.pick(['pan', 'plate', 'bottle']), 26, 0);
      if (x + 330 < width - 90) againstWall('fridge', x + 320, 26, 22);
      table();
      break;
    }
    case 'garage': {
      table();
      if (rng.chance(0.7)) againstWall('bookshelf', rng.range(180, width - 180), 46, 13);
      break;
    }
    case 'office': {
      table();
      if (rng.chance(0.4)) table();
      if (rng.chance(0.6)) againstWall('bookshelf', rng.range(180, width - 180), 46, 13);
      if (rng.chance(0.65)) place('watercooler', 70);
      break;
    }
  }

  /** Fixed-spot set-piece per room kind: the room reads as a place, not a box. */
  const tryPlace = (type: string, x: number, y: number, angle = 0): number => {
    const r = radiusOf(type);
    if (x < 50 + r || x > width - 50 - r || y < 50 + r || y > height - 50 - r) return -1;
    for (const p of placed) {
      if (Math.hypot(p.x - x, p.y - y) < p.r + r + 14) return -1;
    }
    placed.push({ x, y, r });
    objects.push({ type, x, y, angle });
    return objects.length - 1;
  };
  switch (theme) {
    case 'office': {
      // cubicle pair facing each other across an aisle
      const t1 = tryPlace('table', width * 0.42, height * 0.32);
      if (t1 >= 0) onTop(t1, 'computer', -14, 0);
      const t2 = tryPlace('table', width * 0.42, height * 0.68);
      if (t2 >= 0) onTop(t2, 'book', 16, 0);
      tryPlace('officechair', width * 0.3, height * 0.5, 1.2);
      break;
    }
    case 'kitchen': {
      // middle island, already laid for lunch
      const t = tryPlace('table', width * 0.5, height * 0.55);
      if (t >= 0) {
        onTop(t, 'plate', -20, 0);
        onTop(t, 'pan', 22, 0);
      }
      break;
    }
    case 'garage': {
      // tyre pile with the toolbox on top of the job
      tryPlace('tire', width * 0.55, height * 0.4);
      tryPlace('tire', width * 0.55 + 34, height * 0.4 + 20);
      tryPlace('toolbox', width * 0.55, height * 0.58);
      break;
    }
    case 'living': {
      // sofa fort facing the door
      const s = tryPlace('sofa', width * 0.55, height * 0.4);
      if (s >= 0) {
        onTop(s, 'pillow', -30, 6);
        onTop(s, 'pillow', 34, 8);
      }
      tryPlace('chair', width * 0.55 - 110, height * 0.42, 0.4);
      tryPlace('chair', width * 0.55 + 110, height * 0.42, -0.4);
      break;
    }
    case 'bathroom': {
      tryPlace('bucket', width * 0.5, height * 0.6);
      tryPlace('duck', width * 0.42, height * 0.5, 0.8);
      break;
    }
    case 'bedroom': {
      const t = tryPlace('table', width * 0.55, height * 0.6);
      if (t >= 0) onTop(t, 'alarmclock', 0, 0);
      tryPlace('chair', width * 0.55, height * 0.42);
      break;
    }
  }

  // ── floor plan: six archetypes so the depths stop being empty rectangles ──
  const walls: WallSpec[] = [];
  const wallAt = (x: number, y: number, hw: number, hh: number): boolean => {
    if (x - hw < 70 || x + hw > width - 70 || y - hh < 70 || y + hh > height - 70) return false;
    for (const p of placed) {
      const dx = Math.max(0, Math.abs(p.x - x) - hw);
      const dy = Math.max(0, Math.abs(p.y - y) - hh);
      if (Math.hypot(dx, dy) < p.r + 46) return false;
    }
    walls.push({ x, y, hw, hh });
    placed.push({ x, y, r: Math.min(90, Math.max(hw, hh)) });
    return true;
  };
  const cx = width / 2;
  const cy = height / 2;
  switch (rng.pick(['cross', 'pillars', 'lanes', 'pockets', 'ring', 'split'] as const)) {
    case 'cross':
      // four stubs stopping short of the middle: a four-way intersection
      wallAt(cx - width * 0.16, cy, width * 0.09, 10);
      wallAt(cx + width * 0.16, cy, width * 0.09, 10);
      wallAt(cx, cy - height * 0.18, 10, height * 0.1);
      wallAt(cx, cy + height * 0.18, 10, height * 0.1);
      break;
    case 'pillars':
      // four pillars, lanes between them
      for (const [fx, fy] of [[0.4, 0.35], [0.6, 0.35], [0.4, 0.65], [0.6, 0.65]] as const) {
        wallAt(width * fx, height * fy, 24, 24);
      }
      break;
    case 'lanes':
      // staggered shelves force an S-path through the room
      wallAt(width * 0.52, height * 0.32, width * 0.2, 10);
      wallAt(width * 0.46, height * 0.68, width * 0.2, 10);
      break;
    case 'pockets':
      // corner nooks to hide in (or be cornered in)
      wallAt(width - 150, 150, 70, 56);
      wallAt(150, height - 150, 70, 56);
      break;
    case 'ring':
      // collapsed rubble island: everything goes around
      wallAt(cx, cy, 86, 64);
      break;
    case 'split':
      // a cracked divide with three crossings: pick yours
      wallAt(width * 0.6, height * 0.26, 10, height * 0.12);
      wallAt(width * 0.6, height * 0.76, 10, height * 0.11);
      break;
  }

  // ── guaranteed ammunition, then clutter ──
  for (const type of ['chair', 'shoe', 'book']) place(type);
  const fillerCount = rng.int(8, 11);
  for (let i = 0; i < fillerCount; i++) place(weighted(rng, kit.filler));

  // ── hazards already in the room ──
  for (let i = 0; i < 2; i++) {
    if (!rng.chance(kit.puddleChance)) continue;
    zones.push({ kind: 'water', x: rng.range(width * 0.35, width * 0.8), y: rng.range(120, height - 110), r: rng.range(50, 80) });
  }
  if (theme === 'garage' && rng.chance(0.6)) {
    zones.push({ kind: 'oil', x: rng.range(width * 0.4, width * 0.75), y: rng.range(140, height - 120), r: rng.range(46, 62) });
  }
  if (rng.chance(0.5)) zones.push({ kind: 'electric', x: rng.range(200, width - 200), y: 12, r: 18, outlet: true });

  // ── the crew ──
  const enemies: RoomEnemySpec[] = [];
  let budget = 4.5 + depth * 1.1;
  let delay = 1.8;
  while (budget >= 1 && enemies.length < 6) {
    const affordable = ENEMY_COST.filter(([, cost]) => cost <= budget);
    const [type, cost] = rng.pick(affordable);
    budget -= cost;
    enemies.push({ type, delay });
    delay += rng.range(2.6, 3.8);
  }

  return {
    id: `generated-${seed}`,
    name: rng.pick(kit.names),
    theme,
    width,
    height,
    seed,
    objects,
    zones,
    enemies,
    walls: walls.length > 0 ? walls : undefined,
    entrance: { side: 'right', pos: entrancePos },
    exit: { side: 'left', pos: height * 0.82 },
    playerStart,
    rug:
      kit.rugs.length > 0 && rng.chance(0.7)
        ? { x: width / 2, y: height / 2 + 30, w: rng.range(260, 380), h: rng.range(160, 220), color: rng.pick(kit.rugs) }
        : undefined,
    challenge: challengeOverride ?? rng.pick(GENERIC_CHALLENGES),
  };
}

export interface DailyChallenge {
  readonly dateKey: string;
  readonly room: RoomDefinition;
}

/** Same room and bonus objective for everyone on a given calendar day. */
export function dailyChallenge(date: Date): DailyChallenge {
  const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const seed = hashString(`daily:${dateKey}`);
  const pick = new Rng(seed ^ 0x9e3779b9);
  return { dateKey, room: generateRoom(10 + pick.int(0, 3), seed, pick.pick(GENERIC_CHALLENGES)) };
}
