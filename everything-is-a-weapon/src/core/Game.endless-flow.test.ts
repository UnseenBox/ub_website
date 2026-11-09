// @vitest-environment happy-dom
import { beforeEach, expect, it, vi } from 'vitest';
import { FIXED_DT } from './constants';
import { Game } from './Game';
import type { DamageCause } from './types';
import { todayKey } from '../gameplay/Campaign';

/**
 * Endless mode, headless. Same harness as the tutorial flow test —
 * "the game is crashing after the tutorial room is finished". Builds the real
 * Game (stub canvas, happy-dom document), advances the fixed-step simulation
 * the same way the loop does, and walks it through clear → results → next room.
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

const PUSH: DamageCause = {
  type: 'impact',
  source: null,
  chain: null,
  label: 'thrown',
  dirX: 1,
  dirY: 0,
};

/** Game.frame drives the display-frame path (hud + renderer). */
function frameOf(game: Game): (alpha: number, frameDt: number) => void {
  return (game as unknown as { frame(alpha: number, frameDt: number): void }).frame.bind(game);
}

/** Kills every live enemy the honest way (through the damage pipeline). */
function sweep(game: Game): void {
  for (const enemy of [...game.enemies]) {
    if (!enemy.defeated) enemy.damage(game, 10_000, PUSH);
  }
}

beforeEach(() => {
  localStorage.clear();
  document.body.className = '';
  document.body.innerHTML = '<div id="hud"></div><div id="screens"></div>';
  // The simulation must be fully manual: no background rAF running mid-test.
  window.requestAnimationFrame = (() => 0) as typeof window.requestAnimationFrame;
  window.cancelAnimationFrame = () => {};
});


/** Runs sim time, killing whatever walks in, until the goal holds. */
function clearUntil(game: Game, goal: () => boolean, cap = 90): void {
  const limit = Math.round(cap / FIXED_DT);
  for (let i = 0; i < limit; i++) {
    if (goal()) return;
    game.tick(FIXED_DT);
    frameOf(game)(1, FIXED_DT);
    sweep(game);
  }
  expect(goal(), `condition not reached within ${cap}s of sim time`).toBe(true);
}

const tick = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));

/** Clears the current floor and lets the (async) hand-over to the next one finish. */
async function clearFloor(game: Game): Promise<void> {
  const target = (game.endless?.floor ?? 0) + 1;
  clearUntil(game, () => game.endless?.floor === target);
  await tick();
  await tick();
}

function boot(): Game {
  const game = new Game(fakeCanvas());
  vi.spyOn(game.loop, 'start').mockImplementation(() => {});
  game.start();
  return game;
}

it('endless: a cleared floor goes straight to the next one, banks progress and carries hearts', { timeout: 120_000 }, async () => {
  const game = boot();
  game.playEndless();
  expect(game.endless?.floor).toBe(1);
  expect(game.room.daily).toBe(true);
  expect(game.state).toBe('playing');
  const firstRoom = game.room.def.id;

  // Wounded going in: one heart left, so the heal-on-clear is visible.
  game.player.hp = 2;
  await clearFloor(game);

  expect(game.state).toBe('playing');
  expect(game.room.def.id).not.toBe(firstRoom);
  expect(game.endless?.floor).toBe(2);
  expect(game.player.hp).toBe(3);
  expect(game.save.data.endlessBestFloor).toBe(1);
  expect(game.save.data.endlessRuns).toBe(1);
  expect(game.score.score).toBeGreaterThan(0);
  // The campaign is untouched by endless play.
  expect(game.save.data.deepest).toBe(0);
  expect(game.save.data.roomsCleared).toBe(0);
});

it('endless: dying ends the run with a result card and a saved best', { timeout: 120_000 }, async () => {
  const game = boot();
  const shown = vi.spyOn(game.hud, 'showEndless');
  game.playEndless();
  await clearFloor(game);
  await clearFloor(game);

  game.player.hurt(game, 99, 'test');
  // Let the fail timer run out; nobody is there to hurt, so no sweeping needed.
  const limit = Math.round(4 / FIXED_DT);
  for (let i = 0; i < limit && game.state === 'playing'; i++) {
    game.tick(FIXED_DT);
    frameOf(game)(1, FIXED_DT);
  }
  expect(game.state).toBe('failed');
  const summary = shown.mock.calls[shown.mock.calls.length - 1]?.[0];
  expect(summary?.floor).toBe(3);
  expect(summary?.bestFloor).toBe(2);
  expect(summary?.newBestFloor).toBe(true);
  expect(summary?.score).toBeGreaterThan(0);
  expect(game.save.data.endlessBestFloor).toBe(2);

  // Restarting an endless run is a new run, not a retry of the floor.
  game.restartRoom();
  expect(game.endless?.floor).toBe(1);
  expect(game.save.data.endlessRuns).toBe(2);

  game.toMenu();
  expect(game.endless).toBeNull();
});

it('heroes: locked ones cannot be picked, goals unlock them for good, perks apply', async () => {
  const game = boot();
  game.toMenu();
  expect(game.isHeroUnlocked('flatmate')).toBe(false);
  game.setHero('flatmate');
  expect(game.hero).toBe('tenant');

  const unlock = vi.spyOn(game.hud, 'unlock');
  game.save.data.deepest = 3;
  game.checkHeroUnlocks();
  expect(game.isHeroUnlocked('flatmate')).toBe(true);
  expect(unlock).toHaveBeenCalledTimes(1);
  game.checkHeroUnlocks(); // already banked: no second announcement
  expect(unlock).toHaveBeenCalledTimes(1);

  game.setHero('flatmate');
  expect(game.hero).toBe('flatmate');

  // Gran is sturdier: one heart more than everyone else.
  game.save.data.endlessBestFloor = 5;
  game.checkHeroUnlocks();
  game.setHero('gran');
  game.playEndless();
  expect(game.player.maxHp).toBe(game.difficultyMods.playerHp + 1);
});

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return todayKey(d);
}

it('daily streak: day 3 pays scrap and opens a hero; replaying the same day is practice', { timeout: 120_000 }, () => {
  const game = boot();
  const shown = vi.spyOn(game.hud, 'showSummary');
  game.save.data.lastDaily = daysAgo(1);
  game.save.data.dailyStreak = 2;
  const scrap = game.save.data.scrap;
  expect(game.dailyView()).toMatchObject({ doneToday: false, streak: 2, nextDay: 3 });

  game.playDaily();
  clearUntil(game, () => game.state === 'cleared', 150);
  const first = shown.mock.calls[shown.mock.calls.length - 1]![0];
  expect(first.daily).toBe(true);
  expect(first.dailyBonus).toBe(40);
  expect(first.dailyGift).toContain('NEW HERO');
  expect(game.save.data.dailyStreak).toBe(3);
  expect(game.save.data.heroesUnlocked).toContain('flatmate');
  expect(game.save.data.scrap).toBeGreaterThanOrEqual(scrap + 40);
  expect(game.dailyView()).toMatchObject({ doneToday: true, streak: 3, nextDay: 4 });

  game.toMenu();
  game.playDaily();
  clearUntil(game, () => game.state === 'cleared', 150);
  const again = shown.mock.calls[shown.mock.calls.length - 1]![0];
  expect(again.dailyReplay).toBe(true);
  expect(again.dailyBonus).toBe(0);
  expect(game.save.data.dailyStreak).toBe(3);
});

it('daily streak: a freeze forgives one missed day, and day 7 earns the next one', { timeout: 120_000 }, () => {
  const game = boot();
  const shown = vi.spyOn(game.hud, 'showSummary');
  game.save.data.lastDaily = daysAgo(2);
  game.save.data.dailyStreak = 6;
  game.save.data.dailyFreezes = 1;
  game.playDaily();
  clearUntil(game, () => game.state === 'cleared', 150);
  const summary = shown.mock.calls[shown.mock.calls.length - 1]![0];
  expect(game.save.data.dailyStreak).toBe(7);
  expect(summary.dailyFreezeUsed).toBe(true);
  expect(summary.dailyFreezeEarned).toBe(true);
  expect(summary.dailyBonus).toBe(150);
  expect(game.save.data.dailyFreezes).toBe(1);
});

it('daily streak: a long gap resets to day 1', { timeout: 120_000 }, () => {
  const game = boot();
  game.save.data.lastDaily = daysAgo(5);
  game.save.data.dailyStreak = 6;
  expect(game.dailyView()).toMatchObject({ streak: 0, nextDay: 1 });
  game.playDaily();
  clearUntil(game, () => game.state === 'cleared', 150);
  expect(game.save.data.dailyStreak).toBe(1);
});
