import { Rng, hashString } from '../core/Mathx';
import { Enemy } from '../enemies/Enemy';
import type { Room } from '../world/Room';

export type ModifierId =
  | 'NO_CLICKING'
  | 'JUMPY_CURSOR'
  | 'LONG_MEMORY'
  | 'NO_LIGHT'
  | 'EXTRA_WATCHER'
  | 'NO_HIDING'
  | 'ONE_LIFE'
  | 'ALWAYS_VISIBLE';

export interface ModifierDef {
  readonly id: ModifierId;
  readonly name: string;
  readonly note: string;
  /** Multiplier on the room's score, because some of these are much harder. */
  readonly scoreScale: number;
}

export const MODIFIERS: readonly ModifierDef[] = [
  { id: 'NO_CLICKING', name: 'No Clicking', note: 'Mouse clicks end the run. Throw with Q, use with E.', scoreScale: 1.5 },
  { id: 'JUMPY_CURSOR', name: 'Nerves', note: 'Your body reads as far more exposed than it is.', scoreScale: 1.35 },
  { id: 'LONG_MEMORY', name: 'Long Memory', note: 'Creatures forget half as quickly.', scoreScale: 1.4 },
  { id: 'NO_LIGHT', name: 'Lights Out', note: 'The room starts dark and stays dark.', scoreScale: 1.3 },
  { id: 'EXTRA_WATCHER', name: 'One More', note: 'An additional Watcher is posted in the room.', scoreScale: 1.45 },
  { id: 'NO_HIDING', name: 'Nowhere To Go', note: 'Hiding spots are welded shut.', scoreScale: 1.25 },
  { id: 'ONE_LIFE', name: 'One Life', note: 'A single detection ends the run.', scoreScale: 1.6 },
  { id: 'ALWAYS_VISIBLE', name: 'Lit Up', note: 'Darkness no longer hides your body.', scoreScale: 1.2 },
];

const BY_ID = new Map(MODIFIERS.map((m) => [m.id, m]));

/** Runtime flags the rest of the game consults. Kept flat and boring on purpose. */
export interface ActiveModifiers {
  noClicking: boolean;
  jumpyCursor: boolean;
  noHiding: boolean;
  oneLife: boolean;
  alwaysVisible: boolean;
  scoreScale: number;
  readonly ids: readonly ModifierId[];
}

export function noModifiers(): ActiveModifiers {
  return {
    noClicking: false,
    jumpyCursor: false,
    noHiding: false,
    oneLife: false,
    alwaysVisible: false,
    scoreScale: 1,
    ids: [],
  };
}

export function resolveModifiers(ids: readonly ModifierId[]): ActiveModifiers {
  let scoreScale = 1;
  for (const id of ids) scoreScale *= BY_ID.get(id)?.scoreScale ?? 1;
  return {
    noClicking: ids.includes('NO_CLICKING'),
    jumpyCursor: ids.includes('JUMPY_CURSOR'),
    noHiding: ids.includes('NO_HIDING'),
    oneLife: ids.includes('ONE_LIFE'),
    alwaysVisible: ids.includes('ALWAYS_VISIBLE'),
    scoreScale,
    ids: [...ids],
  };
}

/**
 * Apply the structural modifiers to a freshly built room. Anything that changes
 * the world happens here; anything that changes a rule stays a runtime flag.
 */
export function applyModifiersToRoom(room: Room, mods: ActiveModifiers, seed: number): void {
  const rng = new Rng(seed);

  if (mods.ids.includes('NO_LIGHT')) {
    for (const l of room.lights) l.on = false;
  }

  if (mods.ids.includes('LONG_MEMORY')) {
    for (const e of room.enemies) e.decayScale = 0.5;
  }

  if (mods.ids.includes('NO_HIDING')) {
    for (const o of room.objects) {
      if (o.kind === 'LOCKER') o.setState('closed');
    }
    room.markGeometryDirty();
  }

  if (mods.ids.includes('EXTRA_WATCHER')) {
    // Put it somewhere the player is not, and somewhere not already occupied.
    const spots = [
      { x: 150, y: 120 },
      { x: 810, y: 420 },
      { x: 480, y: 110 },
      { x: 480, y: 440 },
    ];
    const start = rng.int(0, spots.length);
    for (let i = 0; i < spots.length; i++) {
      const spot = spots[(start + i) % spots.length];
      const clear =
        room.enemies.every((e) => Math.hypot(e.x - spot.x, e.y - spot.y) > 120) &&
        Math.hypot(room.def.playerSpawn.x - spot.x, room.def.playerSpawn.y - spot.y) > 170;
      if (!clear) continue;
      room.enemies.push(
        new Enemy({
          kind: 'WATCHER',
          x: spot.x,
          y: spot.y,
          facing: Math.atan2(270 - spot.y, 480 - spot.x),
        }),
      );
      break;
    }
  }
}

export function modifierById(id: ModifierId): ModifierDef | undefined {
  return BY_ID.get(id);
}

/** Deterministic daily challenge: everyone gets the same room and the same rules. */
export function dailyChallenge(
  date: Date,
  roomCount: number,
): { seed: number; roomIndex: number; modifiers: ModifierId[]; label: string } {
  const key = `${date.getUTCFullYear()}-${date.getUTCMonth() + 1}-${date.getUTCDate()}`;
  const seed = hashString(`dontletitseeyou:${key}`);
  const rng = new Rng(seed);
  const roomIndex = rng.int(0, roomCount);
  const pool = MODIFIERS.map((m) => m.id);
  const modifiers: ModifierId[] = [];
  const count = 1 + rng.int(0, 2);
  while (modifiers.length < count && pool.length > 0) {
    const pick = pool.splice(rng.int(0, pool.length), 1)[0];
    // One Life plus No Clicking at the same time is miserable rather than hard.
    if (pick === 'ONE_LIFE' && modifiers.includes('NO_CLICKING')) continue;
    if (pick === 'NO_CLICKING' && modifiers.includes('ONE_LIFE')) continue;
    modifiers.push(pick);
  }
  return { seed, roomIndex, modifiers, label: key };
}
