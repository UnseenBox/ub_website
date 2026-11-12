// @vitest-environment happy-dom
import { beforeEach, expect, it, vi } from 'vitest';
import { Game } from '../core/Game';
import { installTestHooks } from '../debug/TestHooks';
import { EDGES, EDGE_STACK_CAP, offerEdges } from './Edges';
import { sanitizeRun } from './Run';
import { Rng } from '../core/Random';

/** RICOCHET, SHOCKWAVE and BOOMERANG, each with a control run without the Edge. */
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

type Hooks = { step(n: number): void; throwAt(x: number, y: number, c?: number): void; fetch(id: string): boolean; drop(): void };

/** An empty room 2 with the Edge stacks given, the hero holding a pan. */
function arena(edges: string[]): { game: Game; t: Hooks } {
  const game = new Game(fakeCanvas());
  vi.spyOn(game.loop, 'start').mockImplementation(() => {});
  game.start();
  installTestHooks(game);
  game.tutorial.skip();
  game.playFrom(1);
  game.save.data.runBoosts = edges;
  game.edges.setActive(true);
  game.room.pending = [];
  for (const e of [...game.enemies]) e.alive = false;
  game.enemies.length = 0;
  for (const o of [...game.objects]) if (!o.held) o.destroy(game);
  const t = (window as unknown as { __t: Hooks }).__t;
  // Somebody stays in the room, far from every throw below, or the room clears itself and time stops.
  const far = game.spawnEnemy('basic', game.room.def.width - 90, 70, -1, 0);
  far.ai = 'idle';
  far.aware = false;
  return { game, t };
}

/** A mover that stands still until something happens to it. */
function sleeper(game: Game, x: number, y: number) {
  const e = game.spawnEnemy('basic', x, y, -1, 0);
  e.ai = 'idle';
  e.aware = false;
  return e;
}

function armed(game: Game, t: Hooks): void {
  game.spawnObject('pan', game.player.body.x + 40, game.player.body.y, 0);
  expect(t.fetch('pan')).toBe(true);
}

function ricochetRun(edges: string[]): { secondHit: boolean; secondHp: number } {
  const { game, t } = arena(edges);
  armed(game, t);
  const p = game.player.body;
  const a = sleeper(game, p.x + 190, p.y);
  const b = sleeper(game, p.x + 190, p.y + 130);
  let secondHit = false;
  game.bus.on('ENEMY_HIT', (e) => {
    if (e.enemy === b && e.cause.type === 'impact' && e.cause.source?.kind === 'object') secondHit = true;
  });
  t.throwAt(a.body.x, a.body.y, 30);
  t.step(240);
  return { secondHit, secondHp: b.hp };
}

it('RICOCHET: a thrown hit carries on to the next mover; without the Edge it does not', () => {
  const without = ricochetRun([]);
  expect(without.secondHit).toBe(false);
  const withEdge = ricochetRun(['ricochet']);
  expect(withEdge.secondHit, 'the second mover is hit').toBe(true);
  expect(withEdge.secondHp).toBeLessThan(without.secondHp);
});

it('SHOCKWAVE: a full-charge throw staggers a mover next to the landing without hurting it', () => {
  // First learn where a full throw at that spot lands.
  const probe = arena(['shockwave']);
  armed(probe.game, probe.t);
  let land: { x: number; y: number } | null = null;
  probe.game.bus.on('OBJECT_LANDED', (e) => { land ??= { x: e.object.body.x, y: e.object.body.y }; });
  const p0 = probe.game.player.body;
  probe.t.throwAt(p0.x + 260, p0.y, 90);
  probe.t.step(240);
  expect(land).not.toBeNull();
  const where = land as unknown as { x: number; y: number };

  const run = (edges: string[]): { stun: number; hp: number } => {
    const { game, t } = arena(edges);
    armed(game, t);
    // Beside the landing, off the line the sliding pan takes.
    const e = sleeper(game, where.x, where.y - 80);
    const hp0 = e.hp;
    const p = game.player.body;
    t.throwAt(p.x + 260, p.y, 90);
    let peak = 0;
    for (let i = 0; i < 80; i++) { t.step(3); peak = Math.max(peak, e.stun); }
    return { stun: peak, hp: hp0 - e.hp };
  };
  const without = run([]);
  const withEdge = run(['shockwave']);
  expect(withEdge.stun, 'staggered').toBeGreaterThan(without.stun + 0.5);
  expect(withEdge.hp, 'the ring does no damage').toBe(0);
});

it('BOOMERANG: the first throw of a room that hits nothing comes back to the hand', () => {
  const run = (edges: string[]): boolean => {
    const { game, t } = arena(edges);
    armed(game, t);
    const p = game.player.body;
    t.throwAt(p.x + 200, p.y, 40);
    expect(game.player.held).toBeNull();
    t.step(600);
    return game.player.held?.def.id === 'pan';
  };
  expect(run([]), 'no Edge: it stays where it landed').toBe(false);
  expect(run(['boomerang']), 'with the Edge it is back').toBe(true);
});

it('BOOMERANG: only the first throw of a room, and not after it hit something', () => {
  const { game, t } = arena(['boomerang']);
  armed(game, t);
  const p = game.player.body;
  const target = sleeper(game, p.x + 150, p.y);
  t.throwAt(target.body.x, target.body.y, 40);
  t.step(600);
  expect(game.player.held, 'it hit the mover, so it stays').toBeNull();
});

it('new Edges obey the stack cap, are offered at most 3 times, and have short card text', () => {
  const ids = ['ricochet', 'shockwave', 'boomerang'];
  for (const id of ids) {
    const def = EDGES.find((e) => e.id === id)!;
    expect(def.effect.length, id).toBeLessThanOrEqual(60);
    const owned = Array(EDGE_STACK_CAP).fill(id) as string[];
    for (let s = 0; s < 40; s++) {
      expect(offerEdges(new Rng(s), s % 2 === 0, false, owned).map((e) => e.id)).not.toContain(id);
    }
  }
  const save = {
    runActive: true, runFloor: 0, runStreak: 0, runScore: 0, runInsuranceUsed: false, runSeed: 0, runArmor: 0,
    runOffer: [], runPath: [], runDoors: [],
    runBoosts: ['ricochet', 'ricochet', 'ricochet', 'ricochet', 'made_up_edge', 'boomerang'],
  };
  sanitizeRun(save, 0, 0);
  expect(save.runBoosts).toEqual(['ricochet', 'ricochet', 'ricochet', 'boomerang']);
});
