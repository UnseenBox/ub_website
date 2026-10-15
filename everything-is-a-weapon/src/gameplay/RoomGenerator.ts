import { Rng, hashString } from '../core/Random';
import type { EnemyTypeId } from '../entities/EnemyTypes';
import { ObjectRegistry } from '../objects/ObjectRegistry';
import { GENERIC_CHALLENGES } from './ChallengeSystem';
import type { RoomDefinition, RoomEnemySpec, RoomObjectSpec, RoomTheme, RoomZoneSpec, WallSpec } from './Room';

interface Placed {
  x: number;
  y: number;
  r: number;
  /** Smaller clearance ring used only by wall masses (movers just need to slip past). */
  wr?: number;
  /** Masses of one silhouette never exclude each other — only doors and furniture stop them. */
  wall?: boolean;
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
  garden: {
    names: ['BACKYARD', 'GREENHOUSE', 'ALLOTMENT'],
    filler: [['flowerpot', 4], ['rake', 2.5], ['cactus', 2], ['bucket', 2.5], ['broom', 2], ['ball', 1.5], ['bottle', 1.5], ['lamp', 1], ['chair', 1.5], ['teeth', 1], ['boombox', 1], ['shoe', 1]],
    tabletop: ['flowerpot', 'bottle', 'book'],
    rugs: [],
    puddleChance: 0.45,
  },
  pool: {
    names: ['DEEP END', 'SPLASH ZONE', 'LIDO'],
    filler: [['duck', 3], ['ball', 2.5], ['bucket', 2], ['bottle', 2], ['pillow', 2], ['chair', 2], ['shoe', 1.5], ['spraycan', 1], ['soap', 1.5], ['lamp', 1]],
    tabletop: ['bottle', 'duck', 'soap'],
    rugs: [],
    puddleChance: 0.3,
  },
  jail: {
    names: ['HOLDING CELL', 'CELL BLOCK', 'THE CLINK'],
    filler: [['ball', 2], ['plank', 3], ['chair', 2], ['book', 2], ['bottle', 1.5], ['pillow', 1.5], ['lamp', 1], ['trashcan', 1.5], ['shoe', 2], ['dumbbell', 2]],
    tabletop: ['book', 'bottle', 'plate'],
    rugs: [],
    puddleChance: 0.3,
  },
  porch: {
    names: ['FRONT PORCH', 'VERANDA', 'STOOP'],
    filler: [['chair', 3], ['lamp', 3], ['flowerpot', 3], ['ball', 1.5], ['book', 2], ['bottle', 1.5], ['shoe', 2], ['boombox', 1.5], ['pillow', 1.5], ['candle', 1.5]],
    tabletop: ['book', 'candle', 'flowerpot'],
    rugs: ['#c96f5a', '#c9a24f'],
    puddleChance: 0.25,
  },
  basement: {
    names: ['CELLAR', 'BOILER ROOM', 'DOWNSTAIRS'],
    filler: [['tire', 3], ['toolbox', 2.5], ['paintcan', 2.5], ['wrench', 2.5], ['bucket', 2], ['bottle', 2], ['plank', 2], ['chair', 1.5], ['lamp', 1.5], ['paperball', 1], ['ball', 1]],
    tabletop: ['toolbox', 'paintcan', 'bottle'],
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
export function depthFor(index: number): number {
  return Math.max(1, index - 7);
}

export function generateRoom(index: number, seed: number, challengeOverride?: string): RoomDefinition {
  const rng = new Rng(seed);
  const depth = depthFor(index);
  const theme = rng.pick(THEMES);
  const kit = KITS[theme];
  // ── dimensions: verandahs run long, cells run small, pools run grand ──
  let width = 40 * rng.int(24, 27);
  let height = 20 * rng.int(27, 30);
  const sizeRoll = rng.next();
  if (theme === 'porch') {
    width = 1300; height = 430;
  } else if (theme === 'pool' && sizeRoll < 0.6) {
    width = 1150; height = 620;
  } else if (theme === 'garden' && sizeRoll < 0.5) {
    width = 1140; height = 620;
  } else if (theme === 'jail' && sizeRoll < 0.4) {
    width = 720; height = 520;
  } else if (theme === 'basement' && sizeRoll < 0.4) {
    width = 860; height = 640;
  } else if (sizeRoll < 0.1) {
    width = 1140; height = 620;
  } else if (sizeRoll < 0.18) {
    width = 860; height = 640;
  }
  const playerStart = { x: 150, y: height / 2 };
  const entrancePos = rng.range(height * 0.3, height * 0.7);

  const placed: Placed[] = [
    { x: playerStart.x, y: playerStart.y, r: 80, wr: 20 },
    { x: width - 20, y: entrancePos, r: 100, wr: 40 },
    // Exits are walked out of nowhere, but nothing may pile up on the door.
    { x: 20, y: height * 0.82, r: 70, wr: 30 },
  ];
  const objects: RoomObjectSpec[] = [];
  const zones: RoomZoneSpec[] = [];
  // Declared up here: the placer avoids walls, which are laid down later.
  const walls: WallSpec[] = [];

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
      // Walls are long: test the rect itself, not just its reserved circle.
      if (ok) {
        for (const w of walls) {
          const dx = Math.max(0, Math.abs(x - w.x) - w.hw);
          const dy = Math.max(0, Math.abs(y - w.y) - w.hh);
          if (Math.hypot(dx, dy) < r + 12) {
            ok = false;
            break;
          }
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
    if (hitsWall(x, halfDepth + 3, halfWidth + 6)) return -1;
    objects.push({ type, x, y: halfDepth + 3 });
    placed.push({ x, y: halfDepth + 3, r: halfWidth + 6 });
    return objects.length - 1;
  };

  /** True when a fixed furniture spot would land inside a silhouette mass. */
  const hitsWall = (x: number, y: number, r: number): boolean => {
    for (const w of walls) {
      const dx = Math.max(0, Math.abs(x - w.x) - w.hw);
      const dy = Math.max(0, Math.abs(y - w.y) - w.hh);
      if (Math.hypot(dx, dy) < r + 10) return true;
    }
    return false;
  };

  /** Back-wall sleeper (bed, tub, sofa): retries along the wall, skips on failure. */
  const sleeper = (type: string, y: number, r: number): number => {
    for (let attempt = 0; attempt < 12; attempt++) {
      const x = rng.range(110, width - 110 - r);
      if (hitsWall(x, y, r)) continue;
      let clash = false;
      for (const p of placed) {
        if (Math.hypot(p.x - x, p.y - y) < p.r + r + 14) {
          clash = true;
          break;
        }
      }
      if (clash) continue;
      objects.push({ type, x, y });
      placed.push({ x, y, r });
      return objects.length - 1;
    }
    return -1;
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

  // ── silhouette first: room-shaping masses claim space before furniture ──
  // Masses may sit near-flush to the outer walls (narrow edge) to truly carve
  // the silhouette; interior partitions keep wide margins instead.
  const wallAt = (x: number, y: number, hw: number, hh: number, edge = 70, solo = false): boolean => {
    if (x - hw < edge || x + hw > width - edge || y - hh < edge || y + hh > height - edge) return false;
    for (const p of placed) {
      if (solo && p.wall) continue;
      const dx = Math.max(0, Math.abs(p.x - x) - hw);
      const dy = Math.max(0, Math.abs(p.y - y) - hh);
      if (Math.hypot(dx, dy) < (p.wr ?? p.r) + 46) return false;
    }
    walls.push({ x, y, hw, hh });
    placed.push({ x, y, r: Math.min(90, Math.max(hw, hh)), wall: true });
    return true;
  };
  const cx = width / 2;
  const cy = height / 2;
  // Bold silhouettes first: big room-defining masses that always land.
  // Low corridors skip them (nothing tall fits) and dress the interior instead.
  const sil = theme === 'pool' || height < 470 ? null : rng.chance(0.4) ? rng.pick(['bigL', 'chambers', 'donut', 'gate', 'plus', 'snake'] as const) : null;
  if (sil === 'bigL') {
    // a whole quadrant of collapsed offices: the room bends hard around it
    wallAt(width * 0.3, height * 0.22, width * 0.17, height * 0.14, 24, true);
  } else if (sil === 'chambers') {
    // two full dividers with single offset doorways: three rooms in one
    const dx = width * 0.55;
    const gapY = height * 0.32;
    wallAt(dx, (24 + gapY - 60) / 2, 10, (gapY - 60 - 24) / 2, 24, true);
    wallAt(dx, (gapY + 60 + height - 24) / 2, 10, (height - 24 - gapY - 60) / 2, 24, true);
    const dy = height * 0.68;
    const gapX = width * 0.3;
    wallAt((24 + gapX - 60) / 2, dy, (gapX - 60 - 24) / 2, 10, 24, true);
    wallAt((gapX + 60 + width - 24) / 2, dy, (width - 24 - gapX - 60) / 2, 10, 24, true);
  } else if (sil === 'donut') {
    // a ring of rubble around the middle: fight around it, or on it
    const R = Math.min(width, height) * 0.24;
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 + 0.26;
      const horizontal = Math.abs(Math.cos(a)) >= Math.abs(Math.sin(a));
      wallAt(cx + Math.cos(a) * R, cy + Math.sin(a) * R * 0.8, horizontal ? 62 : 40, horizontal ? 40 : 62, 24, true);
    }
  } else if (sil === 'plus') {
    // four corner bastions: a plus-sign arena
    wallAt(140, 120, 95, 75, 24, true);
    wallAt(width - 140, 120, 95, 75, 24, true);
    wallAt(140, height - 120, 95, 75, 24, true);
    wallAt(width - 140, height - 120, 95, 75, 24, true);
  } else if (sil === 'snake') {
    // two long dividers with doorways at opposite ends: snake flow
    wallAt(width * 0.42, height * 0.36, width * 0.26, 10, 24, true);
    wallAt(width * 0.78, height * 0.36, width * 0.1, 10, 24, true);
    wallAt(width * 0.22, height * 0.68, width * 0.1, 10, 24, true);
    wallAt(width * 0.58, height * 0.68, width * 0.26, 10, 24, true);
  } else if (sil === 'gate') {
    // gatehouse: two slabs leave a grand central lane at player height
    wallAt(cx, height * 0.2, width * 0.28, height * 0.1, 24, true);
    wallAt(cx, height * 0.8, width * 0.28, height * 0.1, 24, true);
  }
  const shaped = sil !== null;

  // ── the furniture that makes it this kind of room ──
  switch (theme) {
    case 'bedroom': {
      const bed = sleeper('bed', 92, 84);
      if (bed >= 0) {
        onTop(bed, 'pillow', -18, -42);
        onTop(bed, 'pillow', 20, -38);
      }
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
      let sofa = -1;
      if (!hitsWall(x, 150, 70)) {
        objects.push({ type: 'sofa', x, y: 150 });
        placed.push({ x, y: 150, r: 66 });
        sofa = objects.length - 1;
        onTop(sofa, 'pillow', -30, 6);
        onTop(sofa, 'pillow', 34, 8);
      } else {
        const retry = sleeper('sofa', 150, 66);
        if (retry >= 0) {
          onTop(retry, 'pillow', -30, 6);
          onTop(retry, 'pillow', 34, 8);
          sofa = retry;
        }
      }
      table();
      if (rng.chance(0.6)) againstWall('bookshelf', x < width / 2 ? x + 240 : x - 240, 46, 13);
      break;
    }
    case 'kitchen': {
      const x = rng.range(190, width - 420);
      const left = againstWall('counter', x, 70, 23);
      againstWall('stove', x + 104, 32, 23);
      const right = againstWall('counter', x + 208, 70, 23);
      if (left >= 0) onTop(left, rng.pick(['toaster', 'flour', 'plate']), -30, 1);
      if (right >= 0) onTop(right, rng.pick(['pan', 'plate', 'bottle']), 26, 0);
      if (x + 330 < width - 90) againstWall('fridge', x + 320, 26, 22);
      table();
      break;
    }
    case 'garage': {
      table();
      if (rng.chance(0.7)) againstWall('bookshelf', rng.range(180, width - 180), 46, 13);
      break;
    }
    case 'garden': {
      // potting bench with seedlings
      const bench = againstWall('bookshelf', rng.range(220, width - 220), 46, 13);
      if (bench >= 0) {
        onTop(bench, 'flowerpot', -20, 0);
        onTop(bench, 'flowerpot', 22, 2);
      }
      break;
    }
    case 'pool': {
      // deck loungers facing the water
      sleeper('bed', 67, 80);
      break;
    }
    case 'jail': {
      // bunks along the back wall
      sleeper('bed', 67, 80);
      table();
      break;
    }
    case 'porch': {
      // rocking chairs facing the street, lamp between them
      table();
      if (rng.chance(0.7)) place('lamp', 70);
      break;
    }
    case 'basement': {
      // furnace row plus shelves of paint
      againstWall('stove', rng.range(200, width - 320), 32, 23);
      againstWall('bookshelf', rng.range(220, width - 220), 46, 13);
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
    for (const w of walls) {
      const dx = Math.max(0, Math.abs(x - w.x) - w.hw);
      const dy = Math.max(0, Math.abs(y - w.y) - w.hh);
      if (Math.hypot(dx, dy) < r + 12) return -1;
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
    case 'garden': {
      // flower beds flanking the lawn
      tryPlace('flowerpot', width * 0.4, height * 0.35);
      tryPlace('flowerpot', width * 0.6, height * 0.35);
      tryPlace('flowerpot', width * 0.5, height * 0.68);
      tryPlace('rake', width * 0.62, height * 0.55, 0.5);
      tryPlace('bucket', width * 0.36, height * 0.6);
      break;
    }
    case 'pool': {
      // beachhead: loungers' litter at the shallow end
      tryPlace('pillow', width * 0.32, height * 0.62, 0.2);
      tryPlace('pillow', width * 0.68, height * 0.62, -0.3);
      tryPlace('ball', width * 0.5, height * 0.72);
      tryPlace('duck', width * 0.56, height * 0.4, 0.7);
      tryPlace('chair', width * 0.3, height * 0.3, 1.1);
      break;
    }
    case 'jail': {
      // yard time: weights, lines and a ball to chain
      tryPlace('dumbbell', width * 0.42, height * 0.55);
      tryPlace('bowlingball', width * 0.58, height * 0.55);
      tryPlace('plank', width * 0.5, height * 0.68, 0.2);
      tryPlace('book', width * 0.36, height * 0.4, -0.4);
      break;
    }
    case 'porch': {
      // sweet tea for two
      const t = tryPlace('table', width * 0.5, height * 0.5);
      if (t >= 0) {
        onTop(t, 'candle', -20, 0);
        onTop(t, 'book', 22, 0);
      }
      tryPlace('chair', width * 0.5 - 120, height * 0.5, 1.4);
      tryPlace('chair', width * 0.5 + 120, height * 0.5, -1.4);
      tryPlace('flowerpot', width * 0.32, height * 0.66);
      break;
    }
    case 'basement': {
      // workbench corner that never got finished
      tryPlace('toolbox', width * 0.4, height * 0.4);
      tryPlace('paintcan', width * 0.6, height * 0.42);
      tryPlace('wrench', width * 0.5, height * 0.58, 0.7);
      tryPlace('tire', width * 0.64, height * 0.62);
      break;
    }
  }

  // ── interior plan, unless the silhouette already shaped the room ──
  if (!shaped) {
  // Some rooms insist on their own shape: pools circle a platform, jails run cells.
  const shapes = theme === 'pool'
    ? (['court'] as const)
    : theme === 'jail'
      ? (['split', 'lanes', 'cells'] as const)
      : theme === 'garden'
        ? (['court', 'pockets', 'pillars', 'maze'] as const)
        : theme === 'porch'
          ? (['lanes', 'pockets'] as const)
          : theme === 'basement'
            ? (['cross', 'pillars', 'ring', 'cells'] as const)
            : (['cross', 'pillars', 'lanes', 'pockets', 'ring', 'split', 'ell', 'court', 'maze'] as const);
  switch (rng.pick(shapes)) {
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
    case 'ell':
      // collapsed corner: the room bends around it
      wallAt(width - 185, 155, 105, 80);
      break;
    case 'court':
      // courtyard block: run the ring around it
      wallAt(cx, cy, 95, 68);
      break;
    case 'maze':
      // hedge zigzag: four blocks, slalom through
      wallAt(width * 0.35, height * 0.35, 52, 52);
      wallAt(width * 0.65, height * 0.4, 52, 52);
      wallAt(width * 0.38, height * 0.68, 52, 52);
      wallAt(width * 0.66, height * 0.72, 52, 52);
      break;
    case 'cells':
      // two cells, open at the bottom: choose your cell
      wallAt(width * 0.4, height * 0.24, 10, height * 0.15);
      wallAt(width * 0.6, height * 0.24, 10, height * 0.15);
      wallAt(width * 0.5, height * 0.52, width * 0.2, 10);
      break;
  }
  }

  // ── guaranteed ammunition, then clutter (deeper rooms are lived-in warzones) ──
  const guaranteed = new Set<number>();
  for (const type of ['chair', 'shoe', 'book']) {
    const placed1 = place(type);
    if (placed1 >= 0) guaranteed.add(placed1);
  }
  const fillerCount = rng.int(8, 11) + Math.min(6, depth);
  for (let i = 0; i < fillerCount; i++) place(weighted(rng, kit.filler));

  // ── hazards already in the room (thicker the deeper you go) ──
  for (let i = 0; i < 2; i++) {
    if (!rng.chance(Math.min(0.95, kit.puddleChance + depth * 0.03))) continue;
    zones.push({ kind: 'water', x: rng.range(width * 0.35, width * 0.8), y: rng.range(120, height - 110), r: rng.range(50, 80) });
  }
  if (theme === 'garage' && rng.chance(0.6)) {
    zones.push({ kind: 'oil', x: rng.range(width * 0.4, width * 0.75), y: rng.range(140, height - 120), r: rng.range(46, 62) });
  }
  if (theme === 'pool') {
    // the pool itself: deep water around the platform
    zones.push({ kind: 'water', x: cx, y: cy, r: rng.range(105, 135) });
  }
  if (theme === 'basement') {
    if (rng.chance(0.5)) {
      zones.push({ kind: 'oil', x: rng.range(width * 0.4, width * 0.75), y: rng.range(140, height - 120), r: rng.range(46, 62) });
    }
    // the furnace is still lit
    if (rng.chance(0.35)) {
      zones.push({ kind: 'fire', x: rng.range(width * 0.3, width * 0.7), y: rng.range(100, 160), r: rng.range(20, 28) });
    }
  }
  if (theme === 'garden' && rng.chance(0.35)) {
    // duck pond
    zones.push({ kind: 'water', x: rng.range(width * 0.55, width * 0.8), y: rng.range(height * 0.5, height - 120), r: rng.range(48, 64) });
  }
  if (rng.chance(0.5)) zones.push({ kind: 'electric', x: rng.range(200, width - 200), y: 12, r: 18, outlet: true });

  // ── the crew: tougher mixes the deeper you go, sized to the room ──
  const enemies: RoomEnemySpec[] = [];
  const areaFactor = Math.min(1.3, Math.max(0.55, (width * height) / 560000));
  let budget = (4.5 + depth * 1.1) * areaFactor;
  // A third of depths rooms are survival: outlast the clock, killing is optional.
  const hasBoss = (index + 1) % 3 === 0;
  const survive = !hasBoss && rng.chance(0.35) ? Math.min(90, 45 + depth * 5) : null;
  let delay = 1.8;
  while (budget >= 1 && enemies.length < 6) {
    const affordable = ENEMY_COST.filter(([, cost]) => cost <= budget);
    const [type, cost] = rng.pick(affordable);
    budget -= cost;
    // Survival rooms trickle in across the whole clock.
    enemies.push({ type, delay: survive ? 1.8 + rng.next() * Math.max(4, survive - 8) : delay });
    delay += rng.range(2.6, 3.8);
  }
  // From depth 3 the crew always brings at least one heavyweight.
  const costOf = (t: EnemyTypeId): number => ENEMY_COST.find(([id]) => id === t)?.[1] ?? 1;
  if (depth >= 3 && !enemies.some((e) => costOf(e.type) >= 2) && enemies.length > 0) {
    const heavy = rng.pick(['helmet', 'kaboom', 'hurler'] as const);
    enemies[enemies.length - 1] = { type: heavy, delay: enemies[enemies.length - 1]!.delay };
  }

  // ── settle: nudge anything a silhouette mass swallowed out into the open ──
  // (placeOn reseats tabletop stacks from final positions, so stacks ride along)
  for (let i = 0; i < objects.length; i++) {
    const spec = objects[i]!;
    const r = radiusOf(spec.type);
    const spots: ReadonlyArray<readonly [number, number]> = [
      [0, 0], [60, 0], [-60, 0], [0, 60], [0, -60],
      [110, 0], [-110, 0], [0, 110], [0, -110],
      [170, 0], [-170, 0], [0, 170], [0, -170],
    ];
    for (const [ox, oy] of spots) {
      const nx = spec.x + ox;
      const ny = spec.y + oy;
      if (nx < 30 + r || nx > width - 30 - r || ny < 30 + r || ny > height - 30 - r) continue;
      let clear = true;
      for (const w of walls) {
        const dx = Math.max(0, Math.abs(nx - w.x) - w.hw);
        const dy = Math.max(0, Math.abs(ny - w.y) - w.hh);
        if (Math.hypot(dx, dy) < r * 0.6) {
          clear = false;
          break;
        }
      }
      if (!clear) continue;
      if (ox !== 0 || oy !== 0) {
        objects[i] = { ...spec, x: nx, y: ny };
        const moveStack = (s: number): void => {
          for (let j = s + 1; j < objects.length; j++) {
            const child = objects[j]!;
            if (child.on === s) {
              objects[j] = { ...child, x: child.x + ox, y: child.y + oy };
              moveStack(j);
            }
          }
        };
        moveStack(i);
      }
      break;
    }
  }

  // ── prune: sealed pockets behind the masses drop their filler, and any
  // guaranteed throwable stuck in one is rehoused next to the player ──
  {
    const CELL = 20;
    const cols = Math.ceil(width / CELL);
    const rows = Math.ceil(height / CELL);
    const blocked = (x: number, y: number): boolean => {
      if (x < 12 || x > width - 12 || y < 12 || y > height - 12) return true;
      for (const w of walls) {
        if (Math.abs(x - w.x) < w.hw + 26 && Math.abs(y - w.y) < w.hh + 26) return true;
      }
      return false;
    };
    const seen = new Uint8Array(cols * rows);
    const queue: Array<[number, number]> = [[Math.floor(playerStart.x / CELL), Math.floor(playerStart.y / CELL)]];
    seen[queue[0]![1] * cols + queue[0]![0]] = 1;
    while (queue.length > 0) {
      const [c, r] = queue.pop()!;
      const neighbours: ReadonlyArray<readonly [number, number]> = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      for (const [dc, dr] of neighbours) {
        const nc = c + dc;
        const nr = r + dr;
        if (nc < 0 || nr < 0 || nc >= cols || nr >= rows || seen[nr * cols + nc]) continue;
        if (blocked(nc * CELL + CELL / 2, nr * CELL + CELL / 2)) continue;
        seen[nr * cols + nc] = 1;
        queue.push([nc, nr]);
      }
    }
    const near = (x: number, y: number, range: number): boolean => {
      const n = Math.ceil(range / CELL);
      const cc = Math.floor(x / CELL);
      const cr = Math.floor(y / CELL);
      for (let dr = -n; dr <= n; dr++) {
        for (let dc = -n; dc <= n; dc++) {
          const nc = cc + dc;
          const nr = cr + dr;
          if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
          if (seen[nr * cols + nc] === 1) return true;
        }
      }
      return false;
    };
    const hasChild = (i: number): boolean => objects.some((o) => o.on === i);
    const drop = new Set<number>();
    let changed = true;
    while (changed) {
      changed = false;
      objects.forEach((o, i) => {
        if (drop.has(i) || guaranteed.has(i) || hasChild(i)) return;
        if (o.on !== undefined && drop.has(o.on)) {
          drop.add(i);
          changed = true;
        } else if (!near(o.x, o.y, 130)) {
          drop.add(i);
          changed = true;
        }
      });
    }
    // Guarantees are rehoused by the player, never dropped.
    guaranteed.forEach((i) => {
      const o = objects[i];
      if (!o || near(o.x, o.y, 130)) return;
      const ring: ReadonlyArray<readonly [number, number]> = [[90, 0], [-90, 0], [0, 90], [0, -90], [150, 60], [-150, 60], [150, -60], [-150, -60]];
      for (const [dx, dy] of ring) {
        const nx = playerStart.x + dx;
        const ny = playerStart.y + dy;
        if (nx > 40 && nx < width - 40 && ny > 40 && ny < height - 40 && near(nx, ny, 20)) {
          objects[i] = { ...o, x: nx, y: ny };
          return;
        }
      }
    });
    if (drop.size > 0) {
      const remap = new Map<number, number>();
      const next: RoomObjectSpec[] = [];
      objects.forEach((o, i) => {
        if (!drop.has(i)) {
          remap.set(i, next.length);
          next.push(o);
        }
      });
      objects.length = 0;
      for (const o of next) {
        objects.push(o.on === undefined ? o : { ...o, on: remap.get(o.on) ?? 0 });
      }
    }
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
    objective: survive ? { kind: 'survive', seconds: Math.round(survive) } : undefined,
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
