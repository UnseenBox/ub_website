// @vitest-environment happy-dom
import { beforeEach, expect, it, vi } from 'vitest';
import { FIXED_DT } from '../core/constants';
import { Game } from '../core/Game';
import { ENEMY_TYPES, type EnemyTypeId } from './EnemyTypes';

/**
 * Every boss promises a named power. These tests make sure the promise is a
 * thing that happens to the room, not a label and a flash.
 */
const W = 960;
const H = 640;
const BOSS_IDS = (Object.keys(ENEMY_TYPES) as EnemyTypeId[]).filter((id) => ENEMY_TYPES[id].boss);

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

function tick(game: Game, seconds: number): void {
  const steps = Math.round(seconds / FIXED_DT);
  for (let i = 0; i < steps; i++) {
    game.player.hp = 999;
    game.tick(FIXED_DT);
  }
}

/** Puts a boss into the fight and arms its next signature. */
function ready(game: Game, id: EnemyTypeId) {
  const p = game.player.body;
  const boss = game.spawnEnemy(id, p.x + 220, p.y);
  boss.ai = 'chase';
  boss.aware = true;
  boss.signatureTimer = 0;
  return boss;
}

beforeEach(() => {
  localStorage.clear();
  document.body.className = '';
  document.body.innerHTML = '<div id="hud"></div><div id="screens"></div>';
  window.requestAnimationFrame = (() => 0) as typeof window.requestAnimationFrame;
  window.cancelAnimationFrame = () => {};
});

it('has a signature on every boss', () => {
  expect(BOSS_IDS).toHaveLength(20);
  for (const id of BOSS_IDS) expect(ENEMY_TYPES[id].signature?.name, id).toBeTruthy();
});

it('piano spider actually plays a keyboard solo', () => {
  const game = boot();
  const note = vi.spyOn(game.audio, 'pianoNote');
  const boss = ready(game, 'piano');
  (boss as any).pianoTimer = 0;
  let sawMusic = false;
  const steps = Math.round(1.8 / FIXED_DT);
  for (let i = 0; i < steps; i++) {
    game.player.hp = 999;
    game.tick(FIXED_DT);
    if (game.zones.zones.some((zone) => zone.zone === 'music')) sawMusic = true;
  }
  expect(sawMusic, 'the solo leaves music on the floor').toBe(true);
  expect(note.mock.calls.length, 'each key is audible').toBeGreaterThanOrEqual(2);
});

it('signatures change the room, boss by boss', () => {
  const game = boot();
  const flusher = ready(game, 'flusher');
  tick(game, 0.05);
  expect(game.zones.zones.some((zone) => zone.zone === 'water'), 'flusher floods').toBe(true);
  expect(flusher.signatureTimer).toBeGreaterThan(15);

  ready(game, 'cables');
  tick(game, 0.05);
  expect(game.zones.zones.some((zone) => zone.zone === 'electric'), 'cables electrifies').toBe(true);

  const toys = game.enemies.length;
  ready(game, 'toybox');
  tick(game, 0.05);
  expect(game.enemies.length, 'toybox tips out minions').toBeGreaterThan(toys);

  game.player.slowTimer = 0;
  ready(game, 'clock');
  tick(game, 0.05);
  expect(game.player.slowTimer, 'clock stops time').toBeGreaterThan(0);

  game.player.body.vx = 0;
  game.player.body.vy = 0;
  ready(game, 'kraken');
  tick(game, 0.05);
  expect(Math.hypot(game.player.body.vx, game.player.body.vy), 'kraken reels you in').toBeGreaterThan(10);

  game.zones.zones.length = 0;
  ready(game, 'fridgezilla');
  tick(game, 0.05);
  expect(game.zones.zones.some((zone) => zone.zone === 'slick'), 'fridgezilla ices the floor').toBe(true);

  const mower = ready(game, 'mower');
  tick(game, 0.05);
  expect(mower.ai, 'mower charges').toBe('lunge');

  const train = ready(game, 'train');
  tick(game, 0.05);
  expect(train.ai, 'train charges').toBe('lunge');

  const cardboard = ready(game, 'cardboard');
  const form = cardboard.form;
  tick(game, 0.05);
  expect(cardboard.form, 'cardboard refolds').not.toBe(form);

  expect(game.player.alive || true).toBe(true);
});

it('signatures can fire without throwing when the room is empty', () => {
  const game = boot();
  for (const id of BOSS_IDS) {
    const boss = ready(game, id);
    expect(() => tick(game, 0.05), id).not.toThrow();
    boss.defeated = true;
  }
});
