// @vitest-environment happy-dom
import { beforeEach, expect, it } from 'vitest';
import { FIXED_DT } from '../core/constants';
import { Game } from '../core/Game';

/**
 * A mover must never lose health to its own furniture: the sofa it inhaled, the shoe it
 * wound up, the chair its shockwave launched. Furniture the *player* throws still hurts,
 * exactly as before.
 */
const W = 960;
const H = 640;

function stub2d(): CanvasRenderingContext2D {
  const ctx: CanvasRenderingContext2D = new Proxy(function noop() {}, {
    get(_target, prop) {
      if (prop === 'canvas') return null;
      if (prop === 'measureText') return () => ({ width: 10, actualBoundingBoxAscent: 8, actualBoundingBoxDescent: 2 });
      if (prop === 'getImageData') return (_x: number, _y: number, w: number, h: number) => ({
        data: new Uint8ClampedArray(w * h * 4), width: w, height: h, colorSpace: 'srgb',
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
  return {
    width: W, height: H, style: {},
    addEventListener: () => {}, removeEventListener: () => {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: W, height: H, right: W, bottom: H, x: 0, y: 0, toJSON: () => {} }),
    getContext: () => stub2d(),
  } as unknown as HTMLCanvasElement;
}

function boot(): Game {
  localStorage.clear();
  document.body.className = '';
  document.body.innerHTML = '<div id="hud"></div><div id="screens"></div>';
  const game = new Game(fakeCanvas());
  (game.loop as unknown as { start(): void }).start = () => {};
  game.start();
  game.tutorial.skip();
  return game;
}

/** Damage the boss took from an object, whatever the rules managed to convince it of. */
function objectDamageFrom(game: Game, victimId: number): () => number {
  let total = 0;
  game.bus.on('ENEMY_HIT', (e) => {
    if (e.enemy.uid === victimId && e.cause.source?.kind === 'object') total += e.damage;
  });
  return () => total;
}

function advance(game: Game, seconds: number): void {
  const steps = Math.round(seconds / FIXED_DT);
  for (let i = 0; i < steps; i++) {
    game.player.hp = 999;
    game.tick(FIXED_DT);
  }
}

beforeEach(() => {
  localStorage.clear();
  document.body.className = '';
  document.body.innerHTML = '<div id="hud"></div><div id="screens"></div>';
  window.requestAnimationFrame = (() => 0) as typeof window.requestAnimationFrame;
  window.cancelAnimationFrame = () => {};
});

it('is not hurt by the furniture it is inhaling', () => {
  const game = boot();
  const p = game.player.body;
  const boss = game.spawnEnemy('vacuumasaurus', p.x + 300, p.y);
  const dealt = objectDamageFrom(game, boss.uid);
  for (let i = 0; i < 6; i++) {
    game.spawnObject('book', boss.body.x - 120 - i * 12, boss.body.y + (i % 2 ? 18 : -18));
  }
  advance(game, 6);
  expect(dealt(), 'the Vacuumasaurus ate six books and lost no health doing it').toBe(0);
});

it('is not hurt by the object it is winding up to throw', () => {
  const game = boot();
  const p = game.player.body;
  const boss = game.spawnEnemy('junk', p.x + 260, p.y);
  const dealt = objectDamageFrom(game, boss.uid);
  game.spawnObject('plank', boss.body.x - 60, boss.body.y);
  advance(game, 5);
  expect(dealt(), 'the King of Junk hurls planks, not at itself').toBe(0);
});

it('is not hurt by the shockwave it slams into the floor', () => {
  const game = boot();
  const p = game.player.body;
  const boss = game.spawnEnemy('cooker', p.x + 300, p.y);
  const dealt = objectDamageFrom(game, boss.uid);
  // Place chairs then slam — shockwave owns them (handledByUid = boss.uid),
  // so the boss must not take damage from them.
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    game.spawnObject('chair', boss.body.x + Math.cos(a) * 90, boss.body.y + Math.sin(a) * 90);
  }
  boss.doShockwave(game, 160, 0);
  advance(game, 2);
  advance(game, 2);
  expect(dealt()).toBe(0);
});

it('is hurt by the same furniture once the player throws it', () => {
  const game = boot();
  const p = game.player.body;
  const boss = game.spawnEnemy('cooker', p.x + 220, p.y);
  const object = game.spawnObject('computer', boss.body.x - 40, boss.body.y)!;
  const dealt = objectDamageFrom(game, boss.uid);

  object.handledByUid = boss.uid;
  object.handledAt = game.time;
  expect(object.handledByUid, 'a mover-owned object cannot hurt its owner').toBe(boss.uid);

  game.player.body.x = boss.body.x - 150;
  game.player.body.y = boss.body.y;
  object.body.x = game.player.body.x + 20;
  object.body.y = game.player.body.y;
  object.onThrown(game);
  object.handledByUid = 0;
  object.body.vx = 700;
  object.body.vy = 0;
  object.body.vz = 0;
  object.body.z = 10;
  advance(game, 1);

  expect(dealt(), 'the player still wins the furniture fight').toBeGreaterThan(0);
});
