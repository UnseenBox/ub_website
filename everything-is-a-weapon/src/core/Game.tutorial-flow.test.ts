// @vitest-environment happy-dom
import { beforeEach, expect, it, vi } from 'vitest';
import { FIXED_DT } from './constants';
import { installTestHooks } from '../debug/TestHooks';
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

const boot = (): Game => {
  const game = new Game(fakeCanvas());
  vi.spyOn(game.loop, 'start').mockImplementation(() => {});
  game.start();
  return game;
};

const throwAtNearest = (game: Game): boolean => {
  const t = (window as unknown as { __t: { throwAt(x: number, y: number, c?: number): void } }).__t;
  const enemy = game.enemies.find((e) => !e.defeated);
  if (!enemy) return false;
  t.throwAt(enemy.body.x + enemy.body.vx * 0.25, enemy.body.y + enemy.body.vy * 0.25, 40);
  return true;
};

type Hooks = {
  step(n: number): void;
  fetch(id: string): boolean;
  throwAt(x: number, y: number, c?: number): void;
  aim(x: number, y: number): void;
  press(): void;
  release(): void;
  dodge(): void;
  walkTo(x: number, y: number, m?: number, tol?: number): number;
};
const hooks = (): Hooks => (window as unknown as { __t: Hooks }).__t;

it('first sight: an empty room, the hero, one pan, one sleeping box, one line of text', () => {
  const game = boot();
  expect(game.state).toBe('playing');
  expect(game.room.index).toBe(0);
  expect(game.room.def.id).toBe('lesson-throw');
  expect(game.tutorial.step).toBe('throw');
  // Exactly one object and one enemy, and nobody else on the way.
  expect(game.objects.filter((o) => o.alive).map((o) => o.def.id)).toEqual(['pan']);
  expect(game.enemies.length).toBe(1);
  expect(game.room.pending.length).toBe(0);
  expect(game.player.held).toBeNull();
  game.tick(FIXED_DT);
  expect(game.tutorial.card?.text).toMatch(/PICK IT UP/);
  // It stays asleep until you are armed.
  advance(game, 3);
  expect(game.enemies[0]!.ai).toBe('idle');
  expect(game.player.hp).toBe(game.player.maxHp);
});

it('lesson 1: grabbing the pan wakes the box; one throw clears the room and opens lesson 2', () => {
  const game = boot();
  installTestHooks(game);
  const t = hooks();
  expect(t.fetch('pan')).toBe(true);
  t.step(10);
  expect(game.tutorial.card?.text).toMatch(/HOLD, AIM/);
  for (let i = 0; i < 400; i++) {
    t.step(2);
    const e = game.enemies.find((x) => !x.defeated);
    if (e && Math.hypot(e.body.x - game.player.body.x, e.body.y - game.player.body.y) < 230) break;
  }
  throwAtNearest(game);
  waitFor(game, () => game.room.def.id === 'lesson-zap', 12);
  expect(game.tutorial.step).toBe('zap');
  expect(game.save.data.tutorial).toBe('zap');
  expect(game.state, 'no results screen between lessons').toBe('playing');
});

it('a player who walks up to the pan and throws it does so within 10 s of control', () => {
  const game = boot();
  installTestHooks(game);
  const t = hooks();
  t.fetch('pan');
  let thrownAt = -1;
  game.bus.on('OBJECT_THROWN', () => {
    if (thrownAt < 0) thrownAt = game.time;
  });
  for (let i = 0; i < 600 && thrownAt < 0; i++) {
    t.step(2);
    const e = game.enemies.find((x) => !x.defeated);
    if (e && Math.hypot(e.body.x - game.player.body.x, e.body.y - game.player.body.y) < 230) throwAtNearest(game);
  }
  expect(thrownAt).toBeGreaterThan(0);
  expect(thrownAt).toBeLessThan(10);
});

it('every lesson room loads, shows its own card, and cannot knock the hero out', () => {
  const game = boot();
  const lessons = ['throw', 'zap', 'dash', 'power', 'pet'] as const;
  for (const lesson of lessons) {
    game.playLesson(lesson);
    expect(game.room.def.id).toBe(`lesson-${lesson}`);
    expect(game.tutorial.step).toBe(lesson);
    game.player.hp = 1;
    advance(game, 0.5);
    expect(game.tutorial.card?.n).toBe(lessons.indexOf(lesson) + 1);
  }
});

it('lesson 2: a thrown bottle at the socket makes the floor live and the movers walk into it', () => {
  const game = boot();
  installTestHooks(game);
  const t = hooks();
  game.playLesson('zap');
  const socket = game.zones.zones.find((z) => z.tags.has('outlet'))!;
  expect(socket).toBeTruthy();
  expect(game.room.pending.every((p) => p.delay === Infinity), 'they wait outside').toBe(true);
  t.fetch('bottle');
  t.step(15);
  expect(game.tutorial.card?.text).toMatch(/SOCKET/);
  t.throwAt(socket.x + 16, socket.y + 22, 60);
  t.step(40);
  expect(game.zones.zones.some((z) => z.zone === 'water' && z.tags.has('energized'))).toBe(true);
  const kills: string[] = [];
  game.bus.on('ENEMY_DEFEATED', (e) => kills.push(e.cause.type));
  t.step(240);
  expect(kills).toContain('shock');
});

it('lesson 2 never soft-locks: nobody does anything and the movers come in anyway', () => {
  const game = boot();
  game.playLesson('zap');
  advance(game, 31);
  advance(game, 6);
  expect(game.enemies.length + game.room.pending.length).toBeGreaterThan(0);
  expect(game.room.pending.every((p) => p.delay !== Infinity), 'released by the fallback').toBe(true);
});

it('lesson 3: dashing is noticed, then the room says to throw', () => {
  const game = boot();
  installTestHooks(game);
  const t = hooks();
  game.playLesson('dash');
  game.tick(FIXED_DT);
  expect(game.tutorial.card?.text).toMatch(/DASH/);
  let dashed = false;
  for (let i = 0; i < 900 && !dashed; i++) {
    t.step(2);
    const e = game.enemies.find((x) => !x.defeated);
    if (e && (e as unknown as { ai: string }).ai === 'windup') {
      t.dodge();
      dashed = true;
    }
  }
  expect(dashed, 'the mover charges at you').toBe(true);
  t.step(10);
  expect(game.tutorial.card?.text).toMatch(/DASHED/);
});

it('lesson 3: the charger is a Trolley, and after the dash any hit finishes it', () => {
  const game = boot();
  installTestHooks(game);
  const t = hooks();
  game.playLesson('dash');
  game.tick(FIXED_DT);
  let seen = '';
  let dashed = false;
  for (let i = 0; i < 1500 && game.tutorial.step === 'dash'; i++) {
    t.step(2);
    const e = game.enemies.find((x) => !x.defeated);
    if (!e) continue;
    seen = e.type.id;
    if (!dashed && (e as unknown as { ai: string }).ai === 'windup') {
      t.dodge();
      dashed = true;
    }
    if (dashed && !game.player.held && game.player.dashTime <= 0) (t.fetch('chair') || t.fetch('plank') || t.fetch('shoe'));
    // A player waits for the charge to end before lining the throw up.
    if (dashed && game.player.held && (e as unknown as { ai: string }).ai !== 'lunge') t.throwAt(e.body.x, e.body.y, 50);
  }
  expect(seen).toBe('trolley');
  expect(game.tutorial.step, 'any hit after the dash clears the lesson').toBe('power');
});

it('a tap straight after a throw does not catch the thing you just threw', () => {
  const game = boot();
  installTestHooks(game);
  const t = hooks();
  game.playLesson('throw');
  t.step(30);
  expect(t.fetch('pan')).toBe(true);
  const pan = game.player.held!;
  expect(pan.def.id).toBe('pan');
  // touch play: aim with the stick, hold and release, then tap again at once
  const raw = game.input.raw;
  raw.directional = true;
  raw.aimDirX = 1;
  raw.aimDirY = 0;
  raw.aimIdle = false;
  t.press();
  t.step(40);
  t.release();
  t.step(1);
  expect(game.player.held).toBeNull();
  t.press();
  t.step(2);
  t.release();
  t.step(1);
  expect(game.player.held).toBeNull();
  expect(pan.body.speed()).toBeGreaterThan(200);
});

it('lesson 4: the Power is handed over on arrival and clears a crowd', () => {
  const game = boot();
  installTestHooks(game);
  const t = hooks();
  game.playLesson('power');
  expect(game.save.data.abilities).toContain('blast');
  expect(game.abilities.ready('blast')).toBe(true);
  t.step(100);
  const live = game.enemies.filter((e) => !e.defeated);
  expect(live.length).toBeGreaterThanOrEqual(2);
  const cx = live.reduce((a, e) => a + e.body.x, 0) / live.length;
  const cy = live.reduce((a, e) => a + e.body.y, 0) / live.length;
  t.aim(cx, cy);
  game.input.raw.abilitySlot = -1;
  t.step(8);
  expect(game.enemies.filter((e) => !e.defeated).length).toBeLessThan(live.length);
});

it('lesson 5: the pet food is on the floor, and grabbing it lets the movers in', () => {
  const game = boot();
  installTestHooks(game);
  const t = hooks();
  game.playLesson('pet');
  game.tick(FIXED_DT);
  const food = game.objects.find((o) => o.alive && o.def.id === game.pet!.treat)!;
  expect(food).toBeTruthy();
  expect(game.tutorial.card?.text).toMatch(/FEED YOUR PET/);
  expect(game.room.pending.every((p) => p.delay === Infinity)).toBe(true);
  t.walkTo(food.body.x, food.body.y, 600, 20);
  t.aim(food.body.x, food.body.y);
  t.press();
  t.step(3);
  t.release();
  t.step(20);
  expect(game.pet!.frenzy).toBeGreaterThan(0);
  expect(game.room.pending.some((p) => p.delay !== Infinity)).toBe(true);
});

it('clearing the five lessons ends in campaign room 1 with the tutorial done', () => {
  const game = boot();
  const seen: string[] = [];
  waitFor(game, () => {
    if (!seen.includes(game.room.def.id)) seen.push(game.room.def.id);
    sweep(game);
    return game.room.def.id === 'room-1';
  }, 240);
  expect(seen).toEqual(['lesson-throw', 'lesson-zap', 'lesson-dash', 'lesson-power', 'lesson-pet', 'room-1']);
  expect(game.save.data.tutorial).toBe('done');
  expect(game.tutorial.active).toBe(false);
  expect(game.save.data.abilities).toContain('blast');
  expect(game.room.index).toBe(0);
});

it('SKIP leaves the lessons: campaign room 1, tutorial done, Power in hand', () => {
  const game = boot();
  game.tutorial.skip();
  expect(game.room.def.id).toBe('room-1');
  expect(game.save.data.tutorial).toBe('done');
  expect(game.save.data.abilities).toContain('blast');
  expect(game.tutorial.active).toBe(false);
});

it('an old save that says it was mid-lesson starts the lessons from the top; a finished one never sees them', () => {
  const game = boot();
  expect(game.room.def.id).toBe('lesson-throw');
  game.save.data.tutorial = 'free';
  game.save.write();
  game.playFrom(0);
  expect(game.room.def.id).toBe('lesson-throw');
  game.save.data.tutorial = 'done';
  game.save.write();
  game.playFrom(0);
  expect(game.room.def.id).toBe('room-1');
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

  // The real results screen: no draft cards, the plain actions, and UPGRADE when coins can buy one.
  expect(document.querySelector('.screen.results.victory'), 'victory card').toBeTruthy();
  expect(document.querySelectorAll('button.b2-edge')).toHaveLength(0);
  expect(document.querySelector('.b2-report__side'), 'no draft side').toBeNull();
  const labels = [...document.querySelectorAll<HTMLElement>('.b2-results__actionlabel')]
    .map((node) => node.textContent);
  const ready = (game as unknown as { save: { data: { scrap: number } } }).save.data.scrap >= 100;
  expect(labels).toEqual(ready ? ['PICK A DOOR', expect.stringMatching(/^UPGRADE \(\d+\)$/), 'REPLAY ROOM', 'HOME'] : ['PICK A DOOR', 'REPLAY ROOM', 'HOME']);

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
