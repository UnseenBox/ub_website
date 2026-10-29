import { Rng, hashString } from '../core/Random';
import type { EnemyTypeId } from '../entities/EnemyTypes';
import { ObjectRegistry } from '../objects/ObjectRegistry';
import { GENERIC_CHALLENGES } from './ChallengeSystem';
import type { RoomDefinition, RoomEnemySpec, RoomObjectSpec, RoomTheme, RoomZoneSpec, Side } from './Room';

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

export function generateRoom(
  index: number,
  seed: number,
  challengeOverride?: string,
  themeOverride?: RoomTheme,
): RoomDefinition {
  const rng = new Rng(seed);
  const depth = depthFor(index);
  // The roll is consumed either way, so a theme override keeps the rest of the layout stable.
  const rolledTheme = rng.pick(THEMES);
  const theme = themeOverride ?? rolledTheme;
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
  const SIDES: readonly Side[] = ['left', 'right', 'top', 'bottom'];

  /** Picks a door layout from the seed: four sides, four pairings, so the same
     room never reads as the same shape twice. The player always starts near the
     entrance and the exit is always reachable. */
  const layoutRoll = rng.int(0, 15);
  const entranceSide: Side = SIDES[layoutRoll % 4];
  const exitSide: Side = SIDES[(layoutRoll + 2 + rng.int(0, 1)) % 4];
  const entranceSpan = entranceSide === 'top' || entranceSide === 'bottom' ? width : height;
  const exitSpan = exitSide === 'top' || exitSide === 'bottom' ? width : height;
  const entrancePos = rng.range(entranceSpan * 0.3, entranceSpan * 0.7);
  const exitPos = rng.range(exitSpan * 0.3, exitSpan * 0.7);
  // The same theme can still look like three different rooms: the set-pieces move
  // along the wall the entrance is NOT on, so a side-door room and a top-door room
  // of the same kind never share a silhouette.
  const layoutVariant = layoutRoll % 3;
  // Fractional spot biased away from the entrance wall, with a per-variant jitter
  // so two rooms of the same kind still differ.
  const spot = (fx: number, fy: number): { x: number; y: number } => {
    const j = (v: number) => v + (layoutVariant - 1) * 0.06;
    let x = width * j(fx);
    let y = height * j(fy);
    if (entranceSide === 'left') x = width - x;
    if (entranceSide === 'right') x = width * (1 - j(fx));
    if (entranceSide === 'top') y = height - y;
    if (entranceSide === 'bottom') y = height * (1 - j(fy));
    return { x, y };
  };
  const playerStart =
    entranceSide === 'right' ? { x: 150, y: height / 2 }
    : entranceSide === 'left' ? { x: width - 150, y: height / 2 }
    : entranceSide === 'top' ? { x: width / 2, y: height - 150 }
    : { x: width / 2, y: 150 };
  const entranceBlock =
    entranceSide === 'right' ? { x: width - 20, y: entrancePos, r: 100 }
    : entranceSide === 'left' ? { x: 20, y: entrancePos, r: 100 }
    : entranceSide === 'top' ? { x: entrancePos, y: 20, r: 100 }
    : { x: entrancePos, y: height - 20, r: 100 };
  const exitBlock =
    exitSide === 'right' ? { x: width - 20, y: exitPos, r: 70 }
    : exitSide === 'left' ? { x: 20, y: exitPos, r: 70 }
    : exitSide === 'top' ? { x: exitPos, y: 20, r: 70 }
    : { x: exitPos, y: height - 20, r: 70 };
  const placed: Placed[] = [
    { x: playerStart.x, y: playerStart.y, r: 80 },
    entranceBlock,
    // Exits are walked out of nowhere, but nothing may pile up on the door.
    exitBlock,
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

  /** Puts something flush against the wall opposite the entrance and reserves its footprint. */
  const againstWall = (type: string, along: number, halfWidth: number, halfDepth: number): number => {
    const onLeft = entranceSide === 'right';
    const onTop = entranceSide === 'bottom';
    const horizontal = entranceSide === 'left' || entranceSide === 'right';
    const x = horizontal ? along : (onLeft ? halfDepth + 3 : width - halfDepth - 3);
    const y = horizontal ? (onTop ? halfDepth + 3 : height - halfDepth - 3) : along;
    objects.push({ type, x, y });
    placed.push({ x, y, r: halfWidth + 6 });
    return objects.length - 1;
  };

  /** Back-wall sleeper (bed, tub, sofa): retries along the wall opposite the entrance. */
  const sleeper = (type: string, r: number): number => {
    // The sleeper sits on the wall the entrance is NOT on, 92px in from the edge.
    const onLeft = entranceSide === 'right';
    const onTop = entranceSide === 'bottom';
    const wallX = onLeft ? 92 : width - 92;
    const wallY = onTop ? 92 : height - 92;
    const horizontal = entranceSide === 'left' || entranceSide === 'right';
    for (let attempt = 0; attempt < 12; attempt++) {
      const along = rng.range(110, (horizontal ? width : height) - 110 - r);
      const x = horizontal ? along : wallX;
      const y = horizontal ? wallY : along;
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

  const cx = width / 2;
  const cy = height / 2;

  // ── the furniture that makes it this kind of room ──
  switch (theme) {
    case 'bedroom': {
      const bed = sleeper('bed', 84);
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
      const sofa = sleeper('sofa', 66);
      if (sofa >= 0) {
        onTop(sofa, 'pillow', -30, 6);
        onTop(sofa, 'pillow', 34, 8);
      }
      table();
      if (rng.chance(0.6)) againstWall('bookshelf', rng.range(180, width - 180), 46, 13);
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
      sleeper('bed', 80);
      break;
    }
    case 'jail': {
      // bunks along the back wall
      sleeper('bed', 80);
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
    placed.push({ x, y, r });
    objects.push({ type, x, y, angle });
    return objects.length - 1;
  };
  switch (theme) {
    case 'office': {
      // cubicle pair facing each other across an aisle, pushed to the far wall
      const a = spot(0.42, 0.32);
      const t1 = tryPlace('table', a.x, a.y);
      if (t1 >= 0) onTop(t1, 'computer', -14, 0);
      const b = spot(0.42, 0.68);
      const t2 = tryPlace('table', b.x, b.y);
      if (t2 >= 0) onTop(t2, 'book', 16, 0);
      const c = spot(0.3, 0.5);
      tryPlace('officechair', c.x, c.y, 1.2);
      break;
    }
    case 'kitchen': {
      // middle island, already laid for lunch
      const a = spot(0.5, 0.55);
      const t = tryPlace('table', a.x, a.y);
      if (t >= 0) {
        onTop(t, 'plate', -20, 0);
        onTop(t, 'pan', 22, 0);
      }
      break;
    }
    case 'garage': {
      // tyre pile with the toolbox on top of the job
      const a = spot(0.55, 0.4);
      tryPlace('tire', a.x, a.y);
      tryPlace('tire', a.x + 34, a.y + 20);
      const b = spot(0.55, 0.58);
      tryPlace('toolbox', b.x, b.y);
      break;
    }
    case 'living': {
      // sofa fort facing the door
      const a = spot(0.55, 0.4);
      const s = tryPlace('sofa', a.x, a.y);
      if (s >= 0) {
        onTop(s, 'pillow', -30, 6);
        onTop(s, 'pillow', 34, 8);
      }
      tryPlace('chair', a.x - 110, a.y + 2, 0.4);
      tryPlace('chair', a.x + 110, a.y + 2, -0.4);
      break;
    }
    case 'bathroom': {
      const a = spot(0.5, 0.6);
      tryPlace('bucket', a.x, a.y);
      const b = spot(0.42, 0.5);
      tryPlace('duck', b.x, b.y, 0.8);
      break;
    }
    case 'bedroom': {
      const a = spot(0.55, 0.6);
      const t = tryPlace('table', a.x, a.y);
      if (t >= 0) onTop(t, 'alarmclock', 0, 0);
      const b = spot(0.55, 0.42);
      tryPlace('chair', b.x, b.y);
      break;
    }
    case 'garden': {
      // flower beds flanking the lawn
      tryPlace('flowerpot', spot(0.4, 0.35).x, spot(0.4, 0.35).y);
      tryPlace('flowerpot', spot(0.6, 0.35).x, spot(0.6, 0.35).y);
      tryPlace('flowerpot', spot(0.5, 0.68).x, spot(0.5, 0.68).y);
      tryPlace('rake', spot(0.62, 0.55).x, spot(0.62, 0.55).y, 0.5);
      tryPlace('bucket', spot(0.36, 0.6).x, spot(0.36, 0.6).y);
      break;
    }
    case 'pool': {
      // beachhead: loungers' litter at the shallow end
      tryPlace('pillow', spot(0.32, 0.62).x, spot(0.32, 0.62).y, 0.2);
      tryPlace('pillow', spot(0.68, 0.62).x, spot(0.68, 0.62).y, -0.3);
      tryPlace('ball', spot(0.5, 0.72).x, spot(0.5, 0.72).y);
      tryPlace('duck', spot(0.56, 0.4).x, spot(0.56, 0.4).y, 0.7);
      tryPlace('chair', spot(0.3, 0.3).x, spot(0.3, 0.3).y, 1.1);
      break;
    }
    case 'jail': {
      // yard time: weights, lines and a ball to chain
      tryPlace('dumbbell', spot(0.42, 0.55).x, spot(0.42, 0.55).y);
      tryPlace('bowlingball', spot(0.58, 0.55).x, spot(0.58, 0.55).y);
      tryPlace('plank', spot(0.5, 0.68).x, spot(0.5, 0.68).y, 0.2);
      tryPlace('book', spot(0.36, 0.4).x, spot(0.36, 0.4).y, -0.4);
      break;
    }
    case 'porch': {
      // sweet tea for two
      const a = spot(0.5, 0.5);
      const t = tryPlace('table', a.x, a.y);
      if (t >= 0) {
        onTop(t, 'candle', -20, 0);
        onTop(t, 'book', 22, 0);
      }
      tryPlace('chair', a.x - 120, a.y, 1.4);
      tryPlace('chair', a.x + 120, a.y, -1.4);
      tryPlace('flowerpot', spot(0.32, 0.66).x, spot(0.32, 0.66).y);
      break;
    }
    case 'basement': {
      // workbench corner that never got finished
      tryPlace('toolbox', spot(0.4, 0.4).x, spot(0.4, 0.4).y);
      tryPlace('paintcan', spot(0.6, 0.42).x, spot(0.6, 0.42).y);
      tryPlace('wrench', spot(0.5, 0.58).x, spot(0.5, 0.58).y, 0.7);
      tryPlace('tire', spot(0.64, 0.62).x, spot(0.64, 0.62).y);
      break;
    }
  }

  // ── guaranteed ammunition, then clutter (deeper rooms are lived-in warzones) ──
  for (const type of ['chair', 'shoe', 'book']) place(type);
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

  // ── settle: nudge anything sitting outside the walkable margin back inside ──
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
    entrance: { side: entranceSide, pos: entrancePos },
    exit: { side: exitSide, pos: exitPos },
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
