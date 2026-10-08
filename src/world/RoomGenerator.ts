import { VIEW } from '../core/Tuning';
import { Rng, type Rect } from '../core/Mathx';
import type { EnemyKind } from '../enemies/EnemyDefinition';
import type { EnemySpawn } from '../enemies/Enemy';
import type { LightSpec, RoomDefinition } from './Room';
import type { ObjectSpawn } from './WorldObject';
import { validateRoom } from './RoomValidator';

const T = 28;

const CREATURE_POOL: readonly EnemyKind[] = [
  'WATCHER',
  'WATCHER',
  'HOUND',
  'SLEEPER',
  'MIRROR',
  'SCOUT',
  'LIAR',
  'ANALYST',
  'PARASITE',
];

const TOOL_POOL = ['PHONE', 'RADIO', 'BOTTLE', 'PROJECTOR', 'COMPUTER', 'FAN'] as const;

/**
 * Seeded room generation, used by the endless and daily modes.
 *
 * It generates, validates, and regenerates on failure rather than trying to be
 * clever enough never to fail. After a budget of attempts it falls back to a
 * layout that is known to be sound, so the player is never handed a dead room.
 */
export function generateRoom(seed: number, difficulty: number, idSuffix = ''): RoomDefinition {
  for (let attempt = 0; attempt < 24; attempt++) {
    const candidate = attemptGenerate(seed + attempt * 7919, difficulty, idSuffix);
    if (validateRoom(candidate).ok) return candidate;
  }
  // Open box with one creature. Always valid, and still a real room.
  return attemptGenerate(seed, 0, idSuffix, true);
}

function attemptGenerate(
  seed: number,
  difficulty: number,
  idSuffix: string,
  minimal = false,
): RoomDefinition {
  const rng = new Rng(seed);
  const walls: Rect[] = [
    { x: 0, y: 0, w: VIEW.width, h: T },
    { x: 0, y: VIEW.height - T, w: VIEW.width, h: T },
    { x: 0, y: 0, w: T, h: VIEW.height },
    { x: VIEW.width - T, y: 0, w: T, h: VIEW.height },
  ];

  // Partitions: vertical slabs with a gap, so the room always stays connected.
  const partitions = minimal ? 0 : 1 + rng.int(0, Math.min(3, 1 + Math.floor(difficulty / 3)));
  for (let i = 0; i < partitions; i++) {
    const x = Math.round(rng.range(0.22, 0.78) * VIEW.width);
    const gapCentre = rng.range(0.25, 0.75) * VIEW.height;
    const gapHalf = rng.range(46, 70);
    const topH = Math.max(0, gapCentre - gapHalf - T);
    const bottomY = gapCentre + gapHalf;
    if (topH > 30) walls.push({ x, y: T, w: 18, h: topH });
    if (VIEW.height - T - bottomY > 30) {
      walls.push({ x, y: bottomY, w: 18, h: VIEW.height - T - bottomY });
    }
  }

  const playerSpawn = { x: 92, y: rng.range(120, 440) };

  const objects: ObjectSpawn[] = [];
  const lights: LightSpec[] = [
    {
      id: 'main',
      x: VIEW.width * 0.5,
      y: VIEW.height * 0.45,
      radius: rng.range(380, 500),
      intensity: rng.range(0.42, 0.6),
      tint: '#c4daf5',
      flicker: rng.range(0, 0.07),
    },
  ];

  objects.push({ kind: 'EXIT', id: 'exit-1', x: VIEW.width - 55, y: rng.range(110, 430), requires: 'key' });
  objects.push({ kind: 'KEY', id: 'key-1', x: rng.range(620, 880), y: rng.range(80, 460) });
  objects.push({ kind: 'LIGHT_SWITCH', id: 'switch-1', x: 50, y: rng.range(100, 440), lights: ['main'] });

  const toolCount = minimal ? 1 : 2 + rng.int(0, 2);
  for (let i = 0; i < toolCount; i++) {
    const kind = rng.pick(TOOL_POOL);
    objects.push({
      kind,
      id: `tool-${i}`,
      x: rng.range(140, 820),
      y: rng.range(80, 460),
    });
  }

  const coverCount = minimal ? 1 : 2 + rng.int(0, 3);
  for (let i = 0; i < coverCount; i++) {
    objects.push({
      kind: rng.chance(0.5) ? 'TABLE' : 'LOCKER',
      id: `cover-${i}`,
      x: rng.range(170, 820),
      y: rng.range(90, 450),
      state: 'open',
    });
  }
  if (rng.chance(0.6)) {
    objects.push({ kind: 'BOOK', id: 'book-1', x: rng.range(150, 850), y: rng.range(80, 460) });
  }

  const creatureCount = minimal ? 1 : 1 + Math.min(3, Math.floor(difficulty / 2.5) + rng.int(0, 2));
  const enemies: EnemySpawn[] = [];
  for (let i = 0; i < creatureCount; i++) {
    const kind = minimal ? 'WATCHER' : rng.pick(CREATURE_POOL);
    const x = rng.range(300, 860);
    const y = rng.range(90, 450);
    const facing = rng.range(-Math.PI, Math.PI);
    const spawn: EnemySpawn = { kind, x, y, facing, tag: `gen-${i}` };
    if (!minimal && rng.chance(0.4)) {
      spawn.patrol = [
        { x, y, pause: rng.range(0.6, 1.6) },
        { x: Math.max(200, Math.min(880, x + rng.range(-150, 150))), y: Math.max(70, Math.min(470, y + rng.range(-130, 130))), pause: rng.range(0.6, 1.6) },
      ];
    }
    if (kind === 'SLEEPER' && rng.chance(0.3)) spawn.fakeAsleep = true;
    enemies.push(spawn);
  }

  return {
    id: `generated-${seed}${idSuffix}`,
    name: 'Unmapped Room',
    teaches: 'Nobody drew this one.',
    brief: 'TAKE THE KEY. GET OUT.',
    ambient: rng.range(0.13, 0.24),
    parTime: 45 + creatureCount * 18,
    playerSpawn,
    walls,
    lights,
    objects,
    enemies,
    objective: { kind: 'STEAL_AND_EXIT', label: 'TAKE THE KEY', items: ['key'], exitId: 'exit-1' },
    secrets: objects.some((o) => o.kind === 'BOOK') ? ['book-1'] : [],
  };
}
