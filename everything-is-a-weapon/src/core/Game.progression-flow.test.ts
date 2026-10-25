// @vitest-environment happy-dom
import { beforeEach, expect, it, vi } from 'vitest';
import { Game } from './Game';

function fakeCanvas(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 1280; c.height = 720;
  const ctx = c.getContext('2d')!;
  (ctx as unknown) = {
    ...ctx,
    beginPath: () => ctx,
    moveTo: () => ctx,
    lineTo: () => ctx,
    stroke: () => ctx,
    fill: () => ctx,
    arc: () => ctx,
    fillRect: () => ctx,
    clearRect: () => ctx,
    getImageData: () => ({ data: [] }),
    putImageData: () => {},
    drawImage: () => {},
    save: () => {}, restore: () => {},
    translate: () => {}, scale: () => {}, rotate: () => {},
    measureText: () => ({ width: 10 }),
    fillText: () => {}, strokeText: () => {},
  };
  return c;
}

function stub2d(): CanvasRenderingContext2D {
  return (fakeCanvas().getContext('2d') as unknown) as CanvasRenderingContext2D;
}

beforeEach(() => {
  localStorage.clear();
  document.body.innerHTML = '<div id="hud"></div><div id="screens"></div>';
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
  game.playFrom(9);
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
  expect(game.save.data.scrap).toBe(before.scrap);
  expect(game.save.data.highScore).toBe(before.highScore);
  expect(game.save.data.roomsCleared).toBe(before.cleared);
  expect(game.save.data.totalKills).toBe(before.kills);
  expect(game.save.data.runActive).toBe(true);
});
