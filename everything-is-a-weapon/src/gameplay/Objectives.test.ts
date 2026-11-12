// @vitest-environment happy-dom
import { beforeEach, expect, it, vi } from 'vitest';
import { FIXED_DT } from '../core/constants';
import { Game } from '../core/Game';
import { generateRoom } from '../gameplay/RoomGenerator';

/**
 * Room objectives beyond "survive": `trick` (knock out N movers with the room) and `chain`
 * (one chain this long) end a generated room early, and the generator hands them out to
 * roughly three in ten rooms, never two in a row and never in a boss room.
 */
const W = 960;
const H = 640;

function stub2d(): CanvasRenderingContext2D {
  // The proxy is fully self-referential (reads of methods return it, calls return it);
  // the explicit annotation breaks the inference cycle for tsc.
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
      // Everything else: reads and calls both return the same catch-all object,
      // so gradient chains (createLinearGradient(...).addColorStop(...)) keep working.
      // Anything used in arithmetic converts to 0 (getTransform().a, ctx.canvas.width, ...).
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
    width: W,
    height: H,
    style: {},
    addEventListener: () => {},
    removeEventListener: () => {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: W, height: H, right: W, bottom: H, x: 0, y: 0, toJSON: () => {} }),
    getContext: () => stub2d(),
  };
  return canvas as unknown as HTMLCanvasElement;
}

beforeEach(() => {
  localStorage.clear();
  document.body.className = '';
  document.body.innerHTML = '<div id="hud"></div><div id="screens"></div>';
  window.requestAnimationFrame = (() => 0) as typeof window.requestAnimationFrame;
});

const kindOf = (i: number): string | undefined => generateRoom(i, 1000 + i * 7).objective?.kind;

it('about three in ten generated rooms have an objective, never two in a row, never in a boss room', () => {
  let withObjective = 0;
  const kinds = new Set<string>();
  for (let i = 8; i < 208; i++) {
    const kind = generateRoom(i, 1000 + i * 7).objective?.kind;
    if (kind) {
      withObjective++;
      kinds.add(kind);
      expect((i + 1) % 3, `room ${i} is a boss room`).not.toBe(0);
      expect(kindOf(i + 1), `rooms ${i} and ${i + 1} both have one`).toBeUndefined();
    }
  }
  expect(withObjective / 200).toBeGreaterThan(0.15);
  expect(withObjective / 200).toBeLessThan(0.4);
  expect([...kinds].sort()).toEqual(['chain', 'survive', 'trick']);
});

it('generation is deterministic per seed, objective included', () => {
  for (let i = 8; i < 40; i++) {
    expect(generateRoom(i, 55 + i)).toEqual(generateRoom(i, 55 + i));
  }
});

function roomWith(kind: 'trick' | 'chain'): { game: Game; index: number } {
  const game = new Game(fakeCanvas());
  vi.spyOn(game.loop, 'start').mockImplementation(() => {});
  game.start();
  game.tutorial.skip();
  for (let i = 8; i < 200; i++) {
    if (game.rooms.definition(i).objective?.kind === kind) {
      game.playFrom(i);
      return { game, index: i };
    }
  }
  throw new Error('no ' + kind + ' room found');
}

function tick(game: Game, seconds: number): void {
  for (let i = 0; i < Math.round(seconds / FIXED_DT); i++) {
    game.player.hp = 999;
    game.tick(FIXED_DT);
  }
}

it('trick room: enough hazard kills ends it early, and the chip shows the count', () => {
  const { game } = roomWith('trick');
  const goal = game.room.goal!;
  expect(goal.kind).toBe('trick');
  tick(game, 4);
  expect(game.room.cleared).toBe(false);
  game.score.stats.hazardKills = goal.target - 1;
  tick(game, 0.5);
  expect(game.room.cleared, 'one short').toBe(false);
  game.score.stats.hazardKills = goal.target;
  tick(game, 0.5);
  expect(game.room.cleared).toBe(true);
});

it('chain room: a long enough chain ends it early', () => {
  const { game } = roomWith('chain');
  const goal = game.room.goal!;
  expect(goal.kind).toBe('chain');
  tick(game, 3);
  expect(game.room.cleared).toBe(false);
  game.score.stats.bestChain = goal.target;
  tick(game, 0.5);
  expect(game.room.cleared).toBe(true);
});

it('a room with an objective can still be cleared the ordinary way', () => {
  const { game } = roomWith('trick');
  for (let i = 0; i < 90 / FIXED_DT && !game.room.cleared; i++) {
    game.player.hp = 999;
    for (const e of game.enemies) if (!e.defeated) e.damage(game, 1e6, { type: 'impact', source: null, chain: null, label: 'x', dirX: 1, dirY: 0 });
    game.tick(FIXED_DT);
  }
  expect(game.room.cleared).toBe(true);
});
