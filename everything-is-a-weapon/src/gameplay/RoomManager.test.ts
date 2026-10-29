// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EnemyTypeId } from '../entities/EnemyTypes';
import { CAMPAIGN_ROOMS, FINAL_ROOM_INDEX } from '../gameplay/Campaign';
import { Game } from '../core/Game';
import { headlinerSpec } from '../gameplay/Incidents';
import { bossSpecFor, campaignBossSlots, campaignBossType, RoomManager } from './RoomManager';

const ALL_BOSSES: readonly EnemyTypeId[] = [
  'chairman',
  'flusher',
  'kraken',
  'fridgezilla',
  'piano',
  'mower',
  'mom',
  'house',
  'vacuumasaurus',
  'hydra',
  'fan',
  'popcorn',
  'cables',
  'cooker',
  'train',
  'junk',
  'clock',
  'toybox',
  'dishwasher',
  'cardboard',
];

function stub2d(): CanvasRenderingContext2D {
  const ctx: CanvasRenderingContext2D = new Proxy(function noop() {}, {
    get(_target, prop) {
      if (prop === 'canvas') return null;
      if (prop === 'measureText') return () => ({ width: 10, actualBoundingBoxAscent: 8, actualBoundingBoxDescent: 2 });
      if (prop === 'getImageData') return (_x: number, _y: number, w: number, h: number) => ({
        data: new Uint8ClampedArray(w * h * 4),
        width: w,
        height: h,
        colorSpace: 'srgb',
      });
      if (prop === Symbol.toPrimitive) return () => 0;
      if (prop === 'valueOf' || prop === 'toString') return () => 0;
      return ctx;
    },
    apply: () => ctx,
    set: () => true,
  }) as unknown as CanvasRenderingContext2D;
  return ctx;
}

function fakeCanvas(): HTMLCanvasElement {
  const canvas = {
    width: 1280,
    height: 720,
    style: {},
    addEventListener: () => {},
    removeEventListener: () => {},
    getBoundingClientRect: () => ({
      left: 0, top: 0, width: 1280, height: 720, right: 1280, bottom: 720, x: 0, y: 0, toJSON: () => {},
    }),
    getContext: () => stub2d(),
  };
  return canvas as unknown as HTMLCanvasElement;
}

function freshGame(): Game {
  localStorage.clear();
  document.body.innerHTML = '<div id="hud"></div><div id="screens"></div>';
  window.requestAnimationFrame = (() => 0) as typeof window.requestAnimationFrame;
  window.cancelAnimationFrame = () => {};
  const game = new Game(fakeCanvas());
  vi.spyOn(game.loop, 'start').mockImplementation(() => {});
  game.start();
  return game;
}

describe('the 50-room campaign', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('has fifty stable room definitions and a final door', () => {
    const rooms = new RoomManager();
    expect(CAMPAIGN_ROOMS).toBe(50);
    expect(FINAL_ROOM_INDEX).toBe(49);
    expect(rooms.roomCount).toBe(50);

    const defs = Array.from({ length: CAMPAIGN_ROOMS }, (_, index) => rooms.definition(index));
    expect(new Set(defs.map((def) => def.id)).size).toBe(CAMPAIGN_ROOMS);
    expect(defs[FINAL_ROOM_INDEX]).toMatchObject({
      id: 'final-49',
      name: 'THE LAST DOOR',
      boss: 'cardboard',
    });
  });

  it('generates the same campaign layouts in every session', () => {
    const first = new RoomManager();
    const second = new RoomManager();
    for (const index of [9, 10, 15, 27, 42]) {
      const a = first.definition(index);
      const b = second.definition(index);
      expect(a.id).toBe(b.id);
      expect(a.seed).toBe(b.seed);
      expect(a.name).toBe(b.name);
    }
  });

  it('schedules all twenty bosses exactly once', () => {
    const rooms = new RoomManager();
    const scheduled = campaignBossSlots();
    expect(scheduled).toHaveLength(ALL_BOSSES.length);
    expect(new Set(scheduled.map((slot) => slot.type))).toEqual(new Set(ALL_BOSSES));

    const defs = Array.from({ length: CAMPAIGN_ROOMS }, (_, index) => rooms.definition(index));
    const specs = defs
      .map((def, index) => bossSpecFor(index, false, def))
      .filter((spec): spec is NonNullable<typeof spec> => spec !== null);
    expect(specs).toHaveLength(ALL_BOSSES.length);
    expect(new Set(specs.map((spec) => spec.type))).toEqual(new Set(ALL_BOSSES));
  });

  it('puts the King of Cardboard in room 50', () => {
    const rooms = new RoomManager();
    const final = rooms.definition(FINAL_ROOM_INDEX);
    expect(bossSpecFor(FINAL_ROOM_INDEX, false, final)?.type).toBe('cardboard');
  });

  it('keeps boss rooms one-on-one: no regulars walk in before the Headliner', () => {
    const game = freshGame();
    const rooms = game.rooms;
    const defs = Array.from({ length: CAMPAIGN_ROOMS }, (_, index) => rooms.definition(index));
    for (let index = 0; index < CAMPAIGN_ROOMS; index++) {
      const def = defs[index]!;
      const boss = campaignBossType(index, def);
      if (!boss) continue;
      const incident = headlinerSpec(boss);
      const runtime = rooms.build(game, def, index, false, incident);
      // The boss is the only pending intruder; the regular crew stays outside.
      expect(runtime.pending).toHaveLength(1);
      expect(runtime.pending[0]?.incident?.kind).toBe('headliner');
      expect(runtime.totalEnemies).toBe(1);
    }
  });

  it('varies door sides and furniture placement across the campaign', () => {
    const rooms = new RoomManager();
    const defs = Array.from({ length: CAMPAIGN_ROOMS }, (_, index) => rooms.definition(index));
    // The entrance and exit are never on the same side, and the campaign uses
    // more than one side — so the floor plan is not always a right-to-left corridor.
    const sides = new Set<string>();
    for (const def of defs) {
      expect(def.entrance.side).not.toBe(def.exit.side);
      sides.add(def.entrance.side);
    }
    expect(sides.size).toBeGreaterThan(1);
    // The player always starts on the side opposite the entrance, facing the door.
    for (const def of defs) {
      const oppositeEntrance =
        (def.entrance.side === 'left' && def.playerStart.x > def.width / 2) ||
        (def.entrance.side === 'right' && def.playerStart.x < def.width / 2) ||
        (def.entrance.side === 'top' && def.playerStart.y > def.height / 2) ||
        (def.entrance.side === 'bottom' && def.playerStart.y < def.height / 2);
      expect(oppositeEntrance).toBe(true);
    }
  });
});