// @vitest-environment happy-dom
import { beforeEach, expect, it, vi } from 'vitest';
import { todayKey, yesterdayKey } from '../gameplay/Campaign';
import { Game } from './Game';

function stub2d(): CanvasRenderingContext2D {
  // Self-referential proxy: any method returns the stub, any property read is the stub,
  // and arithmetic coercion yields 0. Same approach as Game.tutorial-flow.test.ts.
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

beforeEach(() => {
  localStorage.clear();
  document.body.className = '';
  document.body.innerHTML = '<div id="hud"></div><div id="screens"></div>';
  window.requestAnimationFrame = (() => 0) as typeof window.requestAnimationFrame;
  window.cancelAnimationFrame = () => {};
});

function summarize(game: Game, cleared: boolean, bonus = 0): import('./Game').RoomSummary {
  return (game as unknown as { summarize(c: boolean, b: number): import('./Game').RoomSummary }).summarize(cleared, bonus);
}

function setRoomStart(game: Game, score: number): void {
  (game as unknown as { scoreAtRoomStart: number }).scoreAtRoomStart = score;
}

it('pays no salvage, high score, room best, stars or counters on failure', () => {
  const game = new Game(fakeCanvas());
  vi.spyOn(game.loop, 'start').mockImplementation(() => {});
  game.start();
  game.playFrom(9); // room 10, non-draft
  const before = {
    scrap: game.save.data.scrap,
    highScore: game.save.data.highScore,
    cleared: game.save.data.roomsCleared,
    kills: game.save.data.totalKills,
  };
  game.score.score = 500;
  game.score.stats.scrap = 25;
  game.score.stats.kills = 4;
  game.score.stats.bestChain = 3;
  const summary = summarize(game, false);
  expect(summary.noSalvage).toBe(true);
  expect(summary.run.score).toBe(0);
  expect(game.save.data.scrap).toBe(before.scrap);
  expect(game.save.data.highScore).toBe(before.highScore);
  expect(game.save.data.roomBests).toEqual({});
  expect(game.save.data.roomsCleared).toBe(before.cleared);
  expect(game.save.data.totalKills).toBe(before.kills);
  expect(game.save.data.runActive).toBe(true);
  expect(game.save.data.runScore).toBe(0);
});

it('stores the room delta, not the carried run total, as the room best', () => {
  const game = new Game(fakeCanvas());
  vi.spyOn(game.loop, 'start').mockImplementation(() => {});
  game.start();
  game.playFrom(9);
  setRoomStart(game, 4000);
  game.save.data.runScore = 4000;
  game.score.score = 4500;
  game.score.stats.scrap = 25;
  const summary = summarize(game, true);
  expect(summary.roomScore).toBe(500);
  expect(summary.isNewRoomBest).toBe(true);
  expect(game.save.data.roomBests[game.room.def.id]?.score).toBe(500);
  expect(game.save.data.highScore).toBe(4500);
  expect(summary.run.score).toBe(4500);
  expect(summary.offer).toEqual([]);
  expect(summary.nextEdge).toEqual({ number: 11, boss: false });
});

it('pays a daily first clear once and counts it', () => {
  const game = new Game(fakeCanvas());
  vi.spyOn(game.loop, 'start').mockImplementation(() => {});
  game.start();
  game.save.data.dailyStreak = 2;
  game.save.data.lastDaily = yesterdayKey();
  const scrap = game.save.data.scrap;
  const cleared = game.save.data.roomsCleared;
  const kills = game.save.data.totalKills;
  game.playDaily();
  game.score.score = 300;
  game.score.stats.scrap = 30;
  game.score.stats.kills = 2;
  const summary = summarize(game, true);
  expect(summary.dailyReplay).toBe(false);
  expect(summary.dailyBonus).toBe(40); // streak 3: 10 + 3 × 10
  expect(summary.run.ended).toBe(false);
  expect(game.save.data.scrap).toBe(scrap + 70); // 30 in-room + 40 bonus
  expect(game.save.data.roomsCleared).toBe(cleared + 1);
  expect(game.save.data.totalKills).toBe(kills + 2);
});

it('makes a daily replay pure practice', () => {
  const game = new Game(fakeCanvas());
  vi.spyOn(game.loop, 'start').mockImplementation(() => {});
  game.start();
  game.save.data.lastDaily = todayKey();
  game.playDaily();
  const scrap = game.save.data.scrap;
  const cleared = game.save.data.roomsCleared;
  const kills = game.save.data.totalKills;
  game.score.score = 300;
  game.score.stats.scrap = 30;
  game.score.stats.kills = 2;
  const summary = summarize(game, true);
  expect(summary.dailyReplay).toBe(true);
  expect(summary.dailyBonus).toBe(0);
  expect(summary.noSalvage).toBe(true);
  expect(game.save.data.scrap).toBe(scrap);
  expect(game.save.data.roomsCleared).toBe(cleared);
  expect(game.save.data.totalKills).toBe(kills);
});

it('grants the day-7 legendary and consumes it on the next campaign draft', () => {
  const game = new Game(fakeCanvas());
  vi.spyOn(game.loop, 'start').mockImplementation(() => {});
  game.start();
  game.save.data.dailyStreak = 6;
  game.save.data.lastDaily = yesterdayKey();
  game.playDaily();
  game.score.score = 100;
  const daily = summarize(game, true);
  expect(daily.dailyRareEdgeGranted).toBe(true);
  expect(game.save.data.dailyRareEdge).toBe(true);

  game.playFrom(0);
  game.score.score = 100;
  const draft = summarize(game, true);
  expect(draft.offer.some((edge) => edge.rarity === 'legendary')).toBe(true);
  expect(game.save.data.dailyRareEdge).toBe(false);
});
