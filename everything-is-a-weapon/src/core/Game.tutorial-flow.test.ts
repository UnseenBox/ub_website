// @vitest-environment happy-dom
import { beforeEach, expect, it, vi } from 'vitest';
import { FIXED_DT } from './constants';
import { FINAL_ROOM_INDEX } from '../gameplay/Campaign';
import { nextDoorIndices } from '../gameplay/NightShift';
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
  // Action first: the opening lesson is the throw, and the pan is already in hand.
  expect(game.tutorial.step).toBe('throw');
  expect(game.player.held?.def.id).toBe('pan');
  // It must survive the first carry step, not snap back out of reach.
  game.tick(FIXED_DT);
  expect(game.player.held?.def.id).toBe('pan');

  // The throw lesson lets its mover in; defeating it moves on (the plan's own rule).
  waitFor(game, () => game.enemies.length > 0, 8);
  sweep(game);
  waitFor(game, () => game.tutorial.step === 'power', 8);
  expect(game.tutorial.step).toBe('power');
  // The power lesson hands over the BIG RED BUTTON, ready to fire.
  expect(game.save.data.abilities).toContain('blast');
  expect(game.abilities.ready('blast')).toBe(true);
});

it('only the first knockout gets the FIRST BONK! treatment', () => {
  const game = new Game(fakeCanvas());
  vi.spyOn(game.loop, 'start').mockImplementation(() => {});
  game.start();
  const burst = vi.spyOn(game.fx, 'burst');
  const first = () => burst.mock.calls.filter((c) => c[0] === 'FIRST BONK!').length;

  waitFor(game, () => game.enemies.length > 0, 8);
  sweep(game);
  expect(first()).toBe(1);

  // Every later knockout in the lesson plan is an ordinary one. Clearing the
  // power lesson opens the free brawl and ends the staged plan in the same tick.
  waitFor(game, () => game.tutorial.step === 'power', 8);
  waitFor(game, () => { sweep(game); return !game.tutorial.active; }, 20);
  expect(first()).toBe(1);
});

it('a player who does nothing still gets the first mover within ~2s', () => {
  const game = new Game(fakeCanvas());
  vi.spyOn(game.loop, 'start').mockImplementation(() => {});
  game.start();
  expect(game.tutorial.step).toBe('throw');
  expect(game.enemies.length).toBe(0);

  // The first door is already rattling: no walk, no grab lesson.
  waitFor(game, () => game.enemies.length > 0, 3);
  expect(game.tutorial.step).toBe('throw');
});

it('tutorial → clear → results with ledger claim → door choice → chosen room', async () => {
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

  // Clears open doors instead of a fixed next room. No draft offer is written.
  const summary = shown.mock.calls[shown.mock.calls.length - 1]?.[0];
  expect(summary?.doorChoice).toBe(true);
  expect(game.save.data.runOffer).toHaveLength(0);
  expect(game.save.data.runDoors.length).toBeGreaterThan(0);
  expect(summary?.nextRoom?.number).toBe(game.save.data.runDoors[0]! + 1);
  // The first choice after the starting room is schedule step 0, not 1.
  expect(game.save.data.runDoors).toEqual(
    nextDoorIndices(0, 0, [0], FINAL_ROOM_INDEX, game.save.data.runSeed),
  );

  await game.nextRoom();
  expect(game.state, 'nextRoom opens the door choice').toBe('cleared');
  expect(game.save.data.runDoors.length).toBeGreaterThan(0);

  const door = game.save.data.runDoors[0]!;
  game.chooseDoor(door);
  expect(game.state).toBe('playing');
  expect(game.room.index).toBe(door);

  // The chosen room runs: five seconds of sim keep the state machine moving, no crash.
  advance(game, 2);
  expect(game.state).toBe('playing');
  advance(game, 3);
  expect(['playing', 'failed']).toContain(game.state);
}, 40000);

it('a first visit to a later room spotlights its new toys and teaches one line', async () => {
  const game = new Game(fakeCanvas());
  vi.spyOn(game.loop, 'start').mockImplementation(() => {});
  game.start();
  game.tutorial.skip();
  // Room 1 clears instantly so we can step into room 2, which has a spotlight.
  {
    const limit = Math.round(40 / FIXED_DT);
    for (let i = 0; i < limit; i++) {
      if (game.room.pending.length === 0) break;
      game.tick(FIXED_DT);
      frameOf(game)(1, FIXED_DT);
      sweep(game);
    }
  }
  sweep(game);
  waitFor(game, () => game.state === 'cleared', 8);
  // Force the office (room 2, 0-based index 1) as the only door: it has a spotlight.
  game.save.data.runDoors = [1];
  game.save.data.runPath = [0];
  game.save.data.deepest = 1;
  game.save.write();
  await game.nextRoom();
  game.chooseDoor(1);
  // Room 2 is a first visit with a spotlight: the teaser rides under the guide.
  expect(game.room.index).toBe(1);
  expect(game.tutorial.spotStep).toBe(true);
  expect(game.tutorial.spot.length).toBeGreaterThan(0);
  expect(game.tutorial.guide.caption.length).toBeGreaterThan(0);
  // Picking up a highlighted toy ends the beat and the room is just a room.
  const toy = game.objects.find((o) => o.alive && game.tutorial.spot.includes(o.def.id))!;
  game.bus.emit({ type: 'OBJECT_GRABBED', object: toy });
  expect(game.tutorial.spotStep).toBe(false);
  expect(game.tutorial.spot).toHaveLength(0);
  expect(game.tutorial.guide.caption).toBe('');
});

it('results screen builds the simple victory DOM and wires PICK A DOOR', async () => {
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

  // The real results screen: no draft cards, just the three plain actions.
  expect(document.querySelector('.screen.results.victory'), 'victory card').toBeTruthy();
  expect(document.querySelectorAll('button.b2-edge')).toHaveLength(0);
  expect(document.querySelector('.b2-report__side'), 'no draft side').toBeNull();
  const labels = [...document.querySelectorAll<HTMLElement>('.b2-results__actionlabel')]
    .map((node) => node.textContent);
  expect(labels).toEqual(['PICK A DOOR', 'REPLAY ROOM', 'HOME']);

  const nextButton = document.querySelector<HTMLButtonElement>('.b2-results__action.primary')!;
  expect(nextButton.disabled).toBe(false);
  expect(nextButton.textContent).toContain('PICK A DOOR');
  nextButton.click();
  await awaitFlush(50);
  expect(game.state, 'PICK A DOOR opens the choice').toBe('cleared');

  // Three real doors, each showing the room and the honest reward/risk lines.
  const cards = [...document.querySelectorAll<HTMLButtonElement>('.b2-door')];
  expect(cards).toHaveLength(3);
  const chosen = Number(cards[0]!.dataset.index);
  expect(game.save.data.runDoors).toContain(chosen);
  cards[0]!.click();
  expect(game.state, 'taking a door enters its room').toBe('playing');
  expect(game.room.index).toBe(chosen);
}, 40000);

function awaitFlush(millis = 12): Promise<void> {
  // nextRoom awaits the ad manager; drain real timer turns so its async chain settles.
  return new Promise((resolve) => setTimeout(resolve, millis));
}
