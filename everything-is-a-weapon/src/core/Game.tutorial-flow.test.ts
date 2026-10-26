// @vitest-environment happy-dom
import { beforeEach, expect, it, vi } from 'vitest';
import { FIXED_DT } from './constants';
import { Game } from './Game';
import type { DamageCause } from './types';

/**
 * Headless run-through of room 1: the very flow the crash report described —
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

/** Drive the sim + the frame path together, like the real rAF loop. */
function advance(game: Game, seconds: number): void {
  const steps = Math.round(seconds / FIXED_DT);
  const frame = frameOf(game);
  for (let i = 0; i < steps; i++) {
    game.tick(FIXED_DT);
    frame(1, FIXED_DT);
  }
}

/** Runs ticks while `goal` is still false; gives up after `cap` seconds of sim time. */
function waitFor(game: Game, goal: () => boolean, cap = 30): void {
  const limit = Math.round(cap / FIXED_DT);
  for (let i = 0; i < limit; i++) {
    if (goal()) return;
    game.tick(FIXED_DT);
    frameOf(game)(1, FIXED_DT);
  }
  expect(goal(), `condition not reached within ${cap}s of sim time`).toBe(true);
}

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

it('boot → first visit → tutorial room lives and advances lessons honestly', () => {
  const game = new Game(fakeCanvas());
  vi.spyOn(game.loop, 'start').mockImplementation(() => {});
  game.start();

  expect(game.state).toBe('playing');
  expect(game.room.index).toBe(0);
  expect(game.tutorial.step).toBe('move');

  // A first lesson: grabbing anything throwable moves the plan to "throw".
  const grabbable = game.objects.find((o) => o.alive && o.def.throwable && !o.def.consume)!;
  game.bus.emit({ type: 'OBJECT_GRABBED', object: grabbable });
  expect(game.tutorial.step).toBe('throw');

  // The throw lesson lets its mover in; defeating it moves on (the plan's own rule).
  waitFor(game, () => game.enemies.length > 0, 8);
  sweep(game);
  waitFor(game, () => game.tutorial.step === 'power', 8);
  expect(game.tutorial.step).toBe('power');
});

it('tutorial → clear → results with ledger claim → room 2', async () => {
  const game = new Game(fakeCanvas());
  vi.spyOn(game.loop, 'start').mockImplementation(() => {});
  game.start();
  const shown = vi.spyOn(game.hud, 'showSummary');

  // Preset three stars on room 1 so this clear crosses the first ledger milestone.
  game.save.data.roomStars['room-1'] = 3;
  game.save.write();

  // The player's real route into the brawl: skip straight to the flooded room.
  game.tutorial.skip();
  expect(game.save.data.tutorial).toBe('done');

  // The SKIP chip sends everything still waiting in at once, staggered.
  // The player is defenceless, so the flood must be swept the tick it enters.
  {
    const limit = Math.round(40 / FIXED_DT);
    for (let i = 0; i < limit; i++) {
      if (game.room.pending.length === 0) break;
      game.tick(FIXED_DT);
      frameOf(game)(1, FIXED_DT);
      sweep(game);
    }
    expect(game.room.pending.length, 'the flood fully entered within 40s').toBe(0);
  }
  sweep(game);
  waitFor(game, () => game.room.cleared, 8);
  expect(game.room.cleared).toBe(true);
  waitFor(game, () => game.state === 'cleared', 8);
  expect(game.state).toBe('cleared');

  const claims = game.save.data.starRewardsClaimed;
  expect(claims, 'the clear must claim its ledger milestone').toContain('scrap_3');

  // Room 1 is a draft room: three cards offered, and the pending ids persisted.
  const summary = shown.mock.calls[shown.mock.calls.length - 1]?.[0];
  expect(summary?.offer).toHaveLength(3);
  expect(game.save.data.runOffer).toHaveLength(3);
  expect(game.pendingDraft?.offer).toHaveLength(3);
  expect(game.save.data.runOffer).toEqual(game.pendingDraft!.offer.map((edge) => edge.id));

  // NEXT ROOM waits for the draft to be resolved.
  await game.nextRoom();
  expect(game.state).toBe('cleared');
  expect(game.room.index).toBe(0);

  const chosen = game.pendingDraft!.offer[0]!;
  expect(game.chooseEdge(chosen.id)).toBe('');
  expect(game.save.data.runBoosts).toContain(chosen.id);
  expect(game.save.data.runOffer).toEqual([]);
  expect(game.pendingDraft).toBeNull();
  expect(game.chooseEdge(chosen.id)).toBe('NO EDGE OFFER');

  await game.nextRoom();
  expect(game.state).toBe('playing');
  expect(game.room.index).toBe(1);

  // The next room runs: five seconds of sim keep the state machine moving, no crash.
  advance(game, 2);
  expect(game.state).toBe('playing');
  advance(game, 3);
  expect(['playing', 'failed']).toContain(game.state);
}, 40000);

it('results screen builds the simple victory DOM and wires NEXT ROOM', async () => {
  const game = new Game(fakeCanvas());
  vi.spyOn(game.loop, 'start').mockImplementation(() => {});
  // The real UI must be attached before the clear completes, so that
  // completeRoom()'s showSummary() lands in the happy-dom document.
  const { UI } = await import('../ui/UI');
  const hudRoot = document.getElementById('hud')!;
  const screens = document.getElementById('screens')!;
  game.hud = new UI(game, hudRoot, screens);
  game.start();
  game.save.data.roomStars['room-1'] = 3;
  game.save.write();
  game.tutorial.skip();
  {
    const limit = Math.round(40 / FIXED_DT);
    for (let i = 0; i < limit; i++) {
      if (game.room.pending.length === 0) break;
      game.tick(FIXED_DT);
      frameOf(game)(1, FIXED_DT);
      sweep(game);
    }
    expect(game.room.pending.length, 'the flood fully entered within 40s').toBe(0);
  }
  sweep(game);
  waitFor(game, () => game.state === 'cleared', 10);
  expect(game.state).toBe('cleared');

  // The real results screen: simple, and no clickable cards to the next room.
  expect(document.querySelector('.screen.results.victory'), 'victory card').toBeTruthy();
  expect(document.querySelector('button.edge-card'), 'no Edge cards').toBeNull();
  expect(document.querySelector('.b2-report__offer'), 'no power offer').toBeNull();
  expect(document.querySelector('.b2-report__next'), 'no clickable next-room card').toBeNull();
  const labels = [...document.querySelectorAll<HTMLElement>('.b2-results__actionlabel')]
    .map((node) => node.textContent);
  expect(labels, 'only the three simple actions').toEqual(['NEXT ROOM', 'REPLAY ROOM', 'HOME']);

  // The draft is resolved from the panel in Task 11; advance directly for now.
  expect(game.chooseEdge(game.pendingDraft!.offer[0]!.id)).toBe('');
  const nextButton = document.querySelector<HTMLButtonElement>('.b2-results__action.primary')!;
  nextButton.click();
  await awaitFlush(50);
  expect(game.state, 'NEXT ROOM advances to the next floor').toBe('playing');
  expect(game.room.index).toBe(1);
}, 40000);

function awaitFlush(millis = 12): Promise<void> {
  // nextRoom awaits the ad manager; drain real timer turns so its async chain settles.
  return new Promise((resolve) => setTimeout(resolve, millis));
}
