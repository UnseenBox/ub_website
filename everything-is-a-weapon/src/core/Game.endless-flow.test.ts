// @vitest-environment happy-dom
import { beforeEach, expect, it, vi } from 'vitest';
import { FIXED_DT } from './constants';
import { Game } from './Game';
import type { DamageCause } from './types';
import { todayKey } from '../gameplay/Campaign';
import { VacuumScript, PLUGGED_ARMOUR, UNPLUGGED_BONUS } from '../entities/bossScripts/VacuumScript';
import { MomScript, GUARD_CHIP, OPEN_BONUS } from '../entities/bossScripts/MomScript';
import { MowerScript, STALL_BONUS } from '../entities/bossScripts/MowerScript';
import { PianoScript, BEAT_WINDOW, ON_BEAT_BONUS, OFF_BEAT_FACTOR } from '../entities/bossScripts/PianoScript';
import { KrakenScript, COZY_CHIP, EXPOSED_BONUS as KRAKEN_EXPOSED } from '../entities/bossScripts/KrakenScript';
import { FridgeScript, FRONT_CHIP, BACK_BONUS } from '../entities/bossScripts/FridgeScript';
import { FlusherScript, LID_ARMOUR } from '../entities/bossScripts/FlusherScript';
import { BLOCKED_CHIP, COPIERS, ChairmanScript, EXPOSED_BONUS, INTERRUPT_DAMAGE, RAM_DAMAGE } from '../entities/bossScripts/ChairmanScript';

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
  expect(game.player.hp).toBe(4); // 2 left + the early heal of 2
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

it('ease-in: the first boss is softer than designed; the daily is full strength', { timeout: 60_000 }, () => {
  const game = boot();
  game.playFrom(1);
  expect(game.pacingStep()).toBe(2);
  for (let i = 0; i < Math.round(30 / FIXED_DT) && !game.enemies.some((e) => e.type.boss); i++) game.tick(FIXED_DT);
  const boss = game.enemies.find((e) => e.type.boss)!;
  expect(boss.type.id).toBe('chairman');
  expect(boss.hp).toBeLessThan(boss.type.hp * 0.6);

  game.toMenu();
  game.playDaily();
  expect(game.pacingStep()).toBe(Infinity);
  expect(game.enemyDamage).toBe(game.difficultyMods.enemyDamage);
});

function chairmanFight(): { game: Game; boss: Game['enemies'][number]; script: ChairmanScript } {
  const game = boot();
  game.playFrom(1);
  for (let i = 0; i < Math.round(40 / FIXED_DT); i++) {
    game.tick(FIXED_DT);
    const boss = game.enemies.find((e) => e.type.id === 'chairman');
    if (boss && boss.script instanceof ChairmanScript && boss.script.copier) {
      boss.script.finishIntro(game, boss, false);
      return { game, boss, script: boss.script };
    }
  }
  throw new Error('the Chairman never arrived');
}

const run = (game: Game, seconds: number): void => {
  for (let i = 0; i < Math.round(seconds / FIXED_DT); i++) game.tick(FIXED_DT);
};

it('chairman: memos soak light hits and tear on real ones; the last one leaves him out of office', { timeout: 60_000 }, () => {
  const { game, boss, script } = chairmanFight();
  expect(script.memos).toBe(2);
  expect(script.copier?.def.id).toBe('photocopier');
  expect(boss.maxHp).toBeLessThan(boss.type.hp); // ease-in made him softer, and his bar knows it
  const hp0 = boss.hp;

  boss.damage(game, 2, PUSH); // a paper ball: filed
  expect(script.memos).toBe(2);
  expect(boss.hp).toBe(hp0);

  boss.damage(game, 20, PUSH); // a real hit tears one away; a sliver gets through
  expect(script.memos).toBe(1);
  expect(boss.hp).toBeCloseTo(hp0 - 20 * BLOCKED_CHIP);

  run(game, 0.4);
  boss.damage(game, 20, PUSH);
  expect(script.memos).toBe(0);
  expect(script.exposed).toBe(true);
  expect(boss.stun).toBeGreaterThan(0);

  const hp1 = boss.hp;
  boss.damage(game, 20, PUSH); // out of office: he takes the full hit and more
  expect(hp1 - boss.hp).toBeCloseTo(20 * EXPOSED_BONUS);
});

it('chairman: the copier reloads him, jams when hit, and wrecking it ends the reloads', { timeout: 120_000 }, () => {
  const { game, boss, script } = chairmanFight();
  const copier = script.copier!;
  const tear = (): void => {
    for (let k = 0; k < 4 && script.memos > 0; k++) {
      boss.damage(game, 20, PUSH);
      run(game, 0.3);
    }
  };
  tear();
  expect(script.exposed).toBe(true);
  run(game, 3);
  expect(COPIERS.get(copier)!.progress).toBeGreaterThan(0.2);

  // hit the machine mid-print: it jams and the run starts over
  copier.applyDamage(game, 6);
  run(game, 0.1);
  expect(COPIERS.get(copier)!.jammed).toBe(true);
  expect(script.exposed).toBe(true);
  run(game, 8 + 7);
  expect(script.memos).toBe(script.maxMemos); // jam cleared, print finished, memos back
  expect(script.exposed).toBe(false);

  // wreck it: out of toner, he is enraged and stays bare once the memos are gone
  copier.breakApart(game);
  run(game, 0.1);
  expect(script.copierDown).toBe(true);
  expect(boss.rageMult).toBeGreaterThanOrEqual(1.25);
  tear();
  run(game, 12);
  expect(script.exposed).toBe(true);
  expect(script.memos).toBe(0);
});

it('chairman: paper burns, so fire strips every memo at once', { timeout: 60_000 }, () => {
  const { game, boss, script } = chairmanFight();
  boss.damage(game, 6, { ...PUSH, type: 'fire' });
  expect(script.memos).toBe(0);
  expect(script.exposed).toBe(true);
});

/** Starts a Chairman fight with his attack timer parked, so a test can start exactly the move it wants. */
function calmChairman(): ReturnType<typeof chairmanFight> {
  const fight = chairmanFight();
  (fight.script as unknown as { gap: number }).gap = 9999;
  fight.game.player.hp = 99;
  return fight;
}

it('chairman QUICK REVIEW: spins up, locks a lane, drifts across the room and runs you over', { timeout: 60_000 }, () => {
  const { game, boss, script } = calmChairman();
  const b = boss.body;
  b.vx = b.vy = 0;
  // put the player straight down the lane
  game.player.body.x = b.x - 220;
  game.player.body.y = b.y;
  game.player.invulnerable = 0;
  const hp = game.player.hp;
  const x0 = b.x;
  script.beginAttack(game, boss, 'drift', false);
  expect(script.busy).toBe(true);
  run(game, 0.9);
  expect(Math.abs(b.x - x0)).toBeLessThan(5); // still winding up
  run(game, 0.9);
  expect(script.stage === 'go' || script.stage === 'recover').toBe(true);
  expect(game.player.hp).toBeLessThan(hp);
  run(game, 3);
  expect(script.busy).toBe(false);
});

it('chairman REPLY ALL: two rings of paper planes, the second one aimed to catch a player who stands still', { timeout: 60_000 }, () => {
  const { game, boss, script } = calmChairman();
  const b = boss.body;
  b.vx = b.vy = 0;
  game.player.body.x = b.x + 200;
  game.player.body.y = b.y;
  script.beginAttack(game, boss, 'replyAll', false);
  run(game, 1.0);
  expect(script.planes.length).toBeGreaterThanOrEqual(10);
  const hp = game.player.hp;
  run(game, 2.5);
  expect(game.player.hp).toBeLessThan(hp);
  run(game, 6);
  expect(script.busy).toBe(false);
  expect(script.planes.length).toBe(0); // they all flew off or hit something
});

it('chairman Q3 PROJECTIONS: the slices hurt, the gaps are safe', { timeout: 60_000 }, () => {
  const { game, boss, script } = calmChairman();
  boss.body.vx = boss.body.vy = 0;
  script.beginAttack(game, boss, 'pie', true);
  run(game, 1.6); // past the warning: the wheel is live
  expect(script.stage).toBe('go');
  const bx = boss.body.x;
  const by = boss.body.y;
  // find the exact middle of a gap and of a slice, 200px out (the wheel starts at a random angle)
  const insideAt = (a: number): boolean => script.inPie(boss, bx + Math.cos(a) * 200, by + Math.sin(a) * 200);
  const middleOf = (want: boolean): number => {
    let start = -1;
    let prev = insideAt(0);
    for (let a = 0.02; a < Math.PI * 4; a += 0.02) {
      const now = insideAt(a);
      if (start < 0 && now === want && prev !== want) start = a;
      else if (start >= 0 && now !== want) return (start + a) / 2;
      prev = now;
    }
    throw new Error('no such sector');
  };
  const gapMid = middleOf(false);
  const sliceMid = middleOf(true);
  game.player.body.x = bx + Math.cos(gapMid) * 200;
  game.player.body.y = by + Math.sin(gapMid) * 200;
  game.player.invulnerable = 0;
  const hp = game.player.hp;
  run(game, 0.2);
  expect(game.player.hp).toBe(hp);
  game.player.body.x = bx + Math.cos(sliceMid) * 200;
  game.player.body.y = by + Math.sin(sliceMid) * 200;
  game.player.body.vx = game.player.body.vy = 0;
  run(game, 0.3);
  expect(game.player.hp).toBeLessThan(hp);
});

it('chairman FORECLOSURE: SOLD things vanish unless you are holding them', { timeout: 60_000 }, () => {
  const { game, boss, script } = calmChairman();
  boss.body.vx = boss.body.vy = 0;
  script.beginAttack(game, boss, 'foreclose', false);
  run(game, 1.0);
  expect(script.claims.length).toBeGreaterThan(0);
  const claimed = script.claims.map((c) => c.object);
  const kept = claimed[0]!;
  game.player.body.x = kept.body.x;
  game.player.body.y = kept.body.y;
  (game.player as unknown as { grab(g: Game, o: unknown): void }).grab(game, kept);
  expect(game.player.held).toBe(kept);
  run(game, 3.5);
  expect(kept.alive).toBe(true);
  for (const o of claimed.slice(1)) expect(o.alive).toBe(false);
  expect(script.claims.length).toBe(0);
});

it('chairman: a stun interrupts whatever number he is doing', { timeout: 60_000 }, () => {
  const { game, boss, script } = calmChairman();
  script.beginAttack(game, boss, 'drift', false);
  run(game, 0.3);
  expect(script.busy).toBe(true);
  boss.stun = 1;
  run(game, 0.1);
  expect(script.busy).toBe(false);
});

it('chairman: a heavy hit during a wind-up interrupts the move and stuns him; a light one does not', { timeout: 60_000 }, () => {
  const { game, boss, script } = calmChairman();
  script.beginAttack(game, boss, 'replyAll', false);
  run(game, 0.2);
  const hp = boss.hp;
  boss.damage(game, 3, PUSH); // too light to matter, and the memos filed it
  expect(script.busy).toBe(true);
  boss.damage(game, INTERRUPT_DAMAGE + 4, PUSH);
  expect(script.busy).toBe(false);
  expect(boss.stun).toBeGreaterThan(1);
  expect(hp - boss.hp).toBeCloseTo((INTERRUPT_DAMAGE + 4) * 0.6);
  expect(script.memos).toBe(script.maxMemos); // it got past them, it did not tear one

  // mid-drift he cannot be interrupted, only hurt
  boss.stun = 0;
  script.beginAttack(game, boss, 'drift', false);
  run(game, 1.2);
  expect(script.stage).toBe('go');
  boss.damage(game, 30, PUSH);
  expect(script.busy).toBe(true);
});

it('chairman: lure the drift through his own photocopier and he rams it', { timeout: 60_000 }, () => {
  const { game, boss, script } = calmChairman();
  const copier = script.copier!;
  boss.body.x = 380;
  boss.body.y = 300;
  boss.body.vx = boss.body.vy = 0;
  copier.body.x = 560;
  copier.body.y = 300;
  game.player.body.x = 760;
  game.player.body.y = 300;
  const hp = boss.hp;
  const copierHealth = copier.health;
  script.beginAttack(game, boss, 'drift', false);
  run(game, 2.4);
  run(game, 0.1);
  expect(copier.health).toBeLessThan(copierHealth);
  expect(boss.stun).toBeGreaterThan(0.5);
  expect(hp - boss.hp).toBeGreaterThanOrEqual(boss.maxHp * RAM_DAMAGE * 0.95);
  expect(script.busy).toBe(false);
});

it('chairman: things you throw shred his paper planes', { timeout: 60_000 }, () => {
  const { game, script } = calmChairman();
  const ball = game.spawnObject('ball', 300, 300)!;
  ball.thrownByPlayer = true;
  ball.body.vx = 400;
  ball.body.vy = 0;
  script.planes.push({ x: 310, y: 300, vx: 0, vy: 0, life: 4 }, { x: 900, y: 500, vx: 0, vy: 0, life: 4 });
  run(game, 0.05);
  expect(script.planes.length).toBe(1);
});

it('chairman: below a quarter health it is the FINAL QUARTER', { timeout: 60_000 }, () => {
  const { game, boss, script } = chairmanFight();
  expect(script.finale).toBe(false);
  boss.hp = boss.maxHp * 0.2;
  run(game, 0.1);
  expect(script.finale).toBe(true);
  expect(boss.rageMult).toBeGreaterThanOrEqual(1.2);
  expect(script.maxMemos).toBe(3);
});

it('chairman entrance: untouchable while spinning in, a gavel bang, then the meeting starts with a drift', { timeout: 90_000 }, () => {
  const game = boot();
  game.playFrom(1);
  let boss: Game['enemies'][number] | undefined;
  for (let i = 0; i < Math.round(30 / FIXED_DT) && !boss; i++) {
    game.tick(FIXED_DT);
    boss = game.enemies.find((e) => e.type.id === 'chairman');
  }
  const script = boss!.script as ChairmanScript;
  expect(script.busy).toBe(true);
  expect(script.pose).toBe('spin');
  const hp = boss!.hp;
  boss!.damage(game, 60, PUSH); // spinning in: nothing touches him
  expect(boss!.hp).toBe(hp);

  for (let i = 0; i < Math.round(8 / FIXED_DT) && script.intro === 'spin'; i++) game.tick(FIXED_DT);
  expect(script.intro).toBe('order');
  expect(script.copier).not.toBeNull(); // delivered
  const b = boss!.body;
  expect(Math.hypot(b.vx, b.vy)).toBeLessThan(5);

  // stand close enough to feel the gavel
  const player = game.player.body;
  player.x = b.x + 120;
  player.y = b.y;
  player.vx = player.vy = 0;
  const hurtBefore = game.player.hp;
  for (let i = 0; i < Math.round(0.8 / FIXED_DT); i++) game.tick(FIXED_DT);
  expect(player.x).toBeGreaterThan(b.x + 120 + 10); // shoved away from him
  expect(game.player.hp).toBe(hurtBefore); // but not hurt

  for (let i = 0; i < Math.round(1.5 / FIXED_DT) && script.intro !== 'done'; i++) game.tick(FIXED_DT);
  expect(script.intro).toBe('done');
  expect(boss!.aware).toBe(true);
  // the meeting opens with a drift, straight after the gavel
  expect(script.attack).toBe('drift');
});

function flusherFight(): { game: Game; boss: Game['enemies'][number]; script: FlusherScript } {
  const game = boot();
  game.playFrom(2);
  for (let i = 0; i < Math.round(40 / FIXED_DT); i++) {
    game.tick(FIXED_DT);
    const boss = game.enemies.find((e) => e.type.id === 'flusher');
    if (boss && boss.script instanceof FlusherScript) {
      boss.script.finishIntro(game, boss, false);
      (boss.script as unknown as { gap: number }).gap = 9999;
      game.player.hp = 99;
      return { game, boss, script: boss.script };
    }
  }
  throw new Error('the Flusher never arrived');
}

it('flusher: the lid shrugs hits off; things swallowed by the whirlpool hurt him and lift it', { timeout: 90_000 }, () => {
  const { game, boss, script } = flusherFight();
  const hp = boss.hp;
  boss.damage(game, 10, PUSH);
  expect(hp - boss.hp).toBeCloseTo(10 * LID_ARMOUR);
  expect(script.lidClosed).toBe(true);

  // throw the furniture in
  boss.body.vx = boss.body.vy = 0;
  const chair = game.spawnObject('chair', boss.body.x + 140, boss.body.y)!;
  script.beginAttack(game, boss, 'vortex');
  run(game, 1.3);
  expect(script.stage).toBe('go');
  const hp2 = boss.hp;
  run(game, 2.2);
  expect(chair.alive).toBe(false); // swallowed
  expect(boss.hp).toBeLessThan(hp2);
  expect(script.lidClosed).toBe(false);
  const hp3 = boss.hp;
  boss.damage(game, 10, PUSH); // lid up: full damage
  expect(hp3 - boss.hp).toBeCloseTo(10);
});

it('flusher: the whirlpool drags you in', { timeout: 90_000 }, () => {
  const { game, boss, script } = flusherFight();
  const bounds = game.world.bounds;
  boss.body.x = (bounds.x0 + bounds.x1) / 2;
  boss.body.y = (bounds.y0 + bounds.y1) / 2;
  boss.body.vx = boss.body.vy = 0;
  game.player.body.x = boss.body.x - 230;
  game.player.body.y = boss.body.y;
  game.player.body.vx = game.player.body.vy = 0;
  script.beginAttack(game, boss, 'vortex');
  run(game, 1.15);
  expect(script.stage).toBe('go');
  const d0 = Math.hypot(game.player.body.x - boss.body.x, game.player.body.y - boss.body.y);
  run(game, 0.8);
  const d1 = Math.hypot(game.player.body.x - boss.body.x, game.player.body.y - boss.body.y);
  expect(d1).toBeLessThan(d0 - 10);
});

it('flusher: geysers erupt on the circles they marked and hurt only those standing in them', { timeout: 90_000 }, () => {
  const { game, boss, script } = flusherFight();
  game.player.body.x = 400;
  game.player.body.y = 300;
  script.beginAttack(game, boss, 'geysers');
  expect(script.geysers.length).toBeGreaterThanOrEqual(4);
  // one is always right under you, and you do not move: it hurts
  const hp = game.player.hp;
  game.player.invulnerable = 0;
  run(game, 1.7);
  expect(game.player.hp).toBeLessThan(hp);

  // a second time, step away from every circle before it fires
  script.beginAttack(game, boss, 'geysers');
  run(game, 0.2);
  const spot = { x: 0, y: 0 };
  const bounds = game.world.bounds;
  let best = -1;
  for (let x = bounds.x0 + 60; x < bounds.x1 - 60; x += 40) {
    for (let y = bounds.y0 + 60; y < bounds.y1 - 60; y += 40) {
      const clear = Math.min(...script.geysers.map((g) => Math.hypot(g.x - x, g.y - y)));
      if (clear > best) {
        best = clear;
        spot.x = x;
        spot.y = y;
      }
    }
  }
  game.player.body.x = spot.x;
  game.player.body.y = spot.y;
  game.player.invulnerable = 0;
  const hp2 = game.player.hp;
  run(game, 1.6);
  expect(game.player.hp).toBe(hp2);
});

it('flusher: plungers hit and slow you; the tidal wave has one safe gap', { timeout: 90_000 }, () => {
  const { game, boss, script } = flusherFight();
  game.player.body.x = boss.body.x - 300;
  game.player.body.y = boss.body.y;
  game.player.invulnerable = 0;
  script.beginAttack(game, boss, 'plungers');
  run(game, 3.2);
  expect(game.player.slowTimer > 0 || game.player.hp < 99).toBe(true);

  // wave: stand in the gap, nothing happens; stand outside it and you are hit
  script.beginAttack(game, boss, 'wave');
  const horiz = script.waveHoriz;
  const gapAt = script.waveGapAt;
  const bounds = game.world.bounds;
  const px = horiz ? (bounds.x0 + bounds.x1) / 2 : gapAt;
  const py = horiz ? gapAt : (bounds.y0 + bounds.y1) / 2;
  game.player.body.x = px;
  game.player.body.y = py;
  game.player.invulnerable = 0;
  const hp = game.player.hp;
  run(game, 4.5);
  expect(game.player.hp).toBe(hp);
});

it('flusher entrance: untouchable while surfing in, then FLUSH! and the first geysers', { timeout: 90_000 }, () => {
  const game = boot();
  game.playFrom(2);
  let boss: Game['enemies'][number] | undefined;
  for (let i = 0; i < Math.round(30 / FIXED_DT) && !boss; i++) {
    game.tick(FIXED_DT);
    boss = game.enemies.find((e) => e.type.id === 'flusher');
  }
  const script = boss!.script as FlusherScript;
  expect(script.pose).toBe('surf');
  const hp = boss!.hp;
  boss!.damage(game, 80, PUSH);
  expect(boss!.hp).toBe(hp);
  for (let i = 0; i < Math.round(10 / FIXED_DT) && script.intro !== 'done'; i++) game.tick(FIXED_DT);
  expect(script.intro).toBe('done');
  expect(script.attack).toBe('geysers');
});

function fridgeFight(): { game: Game; boss: Game['enemies'][number]; script: FridgeScript } {
  const game = boot();
  game.playFrom(4);
  for (let i = 0; i < Math.round(40 / FIXED_DT); i++) {
    game.tick(FIXED_DT);
    const boss = game.enemies.find((e) => e.type.id === 'fridgezilla');
    if (boss && boss.script instanceof FridgeScript) {
      boss.script.finishIntro(game, boss, false);
      (boss.script as unknown as { gap: number }).gap = 9999;
      game.player.hp = 99;
      const b = game.world.bounds;
      boss.body.x = (b.x0 + b.x1) / 2;
      boss.body.y = (b.y0 + b.y1) / 2;
      boss.body.vx = boss.body.vy = 0;
      // clear the furniture so teleporting him cannot bump anything (a bump stuns him)
      for (const o of [...game.objects]) o.destroy(game);
      boss.facing = 0; // facing +x: his back is at -x
      boss.stun = 0;
      return { game, boss, script: boss.script };
    }
  }
  throw new Error('Fridgezilla never arrived');
}

it('fridgezilla: front hits crack frost plates; a hit from behind goes straight in; thaw leaves him open', { timeout: 90_000 }, () => {
  const { game, boss, script } = fridgeFight();
  expect(script.plates).toBe(3);
  const hp = boss.hp;
  // from the front: he faces +x, so something flying -x hits his face
  boss.damage(game, 10, { ...PUSH, dirX: -1, dirY: 0 });
  expect(hp - boss.hp).toBeCloseTo(10 * FRONT_CHIP);
  boss.damage(game, 10, { ...PUSH, dirX: -1, dirY: 0 });
  expect(script.plates).toBe(2);

  // from behind: flying +x
  const hp2 = boss.hp;
  boss.damage(game, 10, { ...PUSH, dirX: 1, dirY: 0 });
  expect(hp2 - boss.hp).toBeCloseTo(10 * BACK_BONUS);
  expect(script.plates).toBe(2);

  // a heavy front hit cracks a plate in one go; fire melts what is left and thaws him
  boss.damage(game, 20, { ...PUSH, dirX: -1, dirY: 0 });
  expect(script.plates).toBe(1);
  boss.damage(game, 6, { ...PUSH, type: 'fire', dirX: 0, dirY: 0 });
  expect(script.plates).toBe(0);
  expect(script.thaw).toBeGreaterThan(0);
  expect(boss.stun).toBeGreaterThan(0);
  run(game, 6);
  expect(script.plates).toBe(3); // frosted over again
});

it('fridgezilla: the cone freezes you if you stand in it and misses if you flank', { timeout: 90_000 }, () => {
  const { game, boss, script } = fridgeFight();
  const b = boss.body;
  game.player.body.x = b.x + 220;
  game.player.body.y = b.y;
  game.player.invulnerable = 0;
  const hp = game.player.hp;
  boss.stun = 0;
  script.beginAttack(game, boss, 'cone');
  run(game, 1.3);
  expect(game.player.hp).toBeLessThan(hp);
  expect(game.player.slowTimer).toBeGreaterThan(0);

  // second time: slip round behind during the wind-up
  boss.stun = 0;
  script.beginAttack(game, boss, 'cone');
  game.player.body.x = b.x - 220;
  game.player.body.y = b.y;
  game.player.invulnerable = 0;
  game.player.slowTimer = 0;
  const hp2 = game.player.hp;
  run(game, 1.8);
  expect(game.player.hp).toBe(hp2);
});

it('fridgezilla: cubes ricochet, fish land on their circles, cold snap makes the floor slippery outside the ring', { timeout: 90_000 }, () => {
  const { game, boss, script } = fridgeFight();
  // the director would start the next number by itself; keep it parked so each check sees only its own
  const runParked = (seconds: number): void => {
    for (let k = 0; k < Math.round(seconds / 0.25); k++) {
      (script as unknown as { gap: number }).gap = 9999;
      run(game, 0.25);
    }
  };
  boss.stun = 0;
  script.beginAttack(game, boss, 'cubes');
  runParked(2.0);
  expect(script.cubes.length).toBeGreaterThan(0);
  runParked(8);
  expect(script.cubes.length).toBe(0);

  game.player.body.x = boss.body.x + 200;
  game.player.body.y = boss.body.y + 100;
  game.player.invulnerable = 0;
  const hp = game.player.hp;
  boss.stun = 0;
  script.beginAttack(game, boss, 'fish');
  expect(script.fish.length).toBeGreaterThanOrEqual(3);
  runParked(1.6);
  expect(game.player.hp).toBeLessThan(hp); // one lands right under you
  runParked(3);

  boss.stun = 0;
  script.beginAttack(game, boss, 'snap');
  runParked(1.7);
  expect(script.iceLeft).toBeGreaterThan(0);
  // outside the safe ring you slide; inside you do not
  game.player.body.x = script.safeX;
  game.player.body.y = script.safeY;
  game.player.slip = 0;
  run(game, 0.05); // (inside the ring nothing adds slip; other sources can leave a trace, so only the outside is asserted)
  game.player.body.x = script.safeX + 400 > game.world.bounds.x1 - 20 ? script.safeX - 400 : script.safeX + 400;
  game.player.body.y = script.safeY;
  run(game, 0.2);
  expect(game.player.slip).toBeGreaterThan(0);
});

it('fridgezilla entrance: untouchable while skidding in, then the door opens and the fight starts with the cone', { timeout: 90_000 }, () => {
  const game = boot();
  game.playFrom(4);
  let boss: Game['enemies'][number] | undefined;
  for (let i = 0; i < Math.round(30 / FIXED_DT) && !boss; i++) {
    game.tick(FIXED_DT);
    boss = game.enemies.find((e) => e.type.id === 'fridgezilla');
  }
  const script = boss!.script as FridgeScript;
  expect(script.pose).toBe('skid');
  const hp = boss!.hp;
  boss!.damage(game, 80, PUSH);
  expect(boss!.hp).toBe(hp);
  for (let i = 0; i < Math.round(10 / FIXED_DT) && script.intro !== 'done'; i++) game.tick(FIXED_DT);
  expect(script.intro).toBe('done');
  expect(script.attack).toBe('cone');
});

function krakenFight(): { game: Game; boss: Game['enemies'][number]; script: KrakenScript } {
  const game = boot();
  game.playFrom(3);
  for (let i = 0; i < Math.round(40 / FIXED_DT); i++) {
    game.tick(FIXED_DT);
    const boss = game.enemies.find((e) => e.type.id === 'kraken');
    if (boss && boss.script instanceof KrakenScript) {
      for (const o of [...game.objects]) o.destroy(game);
      const b = game.world.bounds;
      boss.body.x = (b.x0 + b.x1) / 2;
      boss.body.y = (b.y0 + b.y1) / 2;
      boss.body.vx = boss.body.vy = 0;
      boss.script.finishIntro(game, boss, false);
      (boss.script as unknown as { gap: number }).gap = 9999;
      game.player.hp = 99;
      game.player.body.x = boss.body.x - 400;
      game.player.body.y = boss.body.y;
      return { game, boss, script: boss.script };
    }
  }
  throw new Error('the Kraken never arrived');
}

/** Throws a fast object through a tentacle's tip. */
function lob(game: Game, t: { px: number; py: number }): void {
  const o = game.spawnObject('chair', t.px, t.py)!;
  o.thrownByPlayer = true;
  o.body.vx = 420;
  o.body.vy = 0;
}

it('kraken: the sofa is cozy until every tentacle is down; thrown things cut tentacles; then he is bare', { timeout: 90_000 }, () => {
  const { game, boss, script } = krakenFight();
  expect(script.tentacles.length).toBe(4);
  expect(script.alive).toBe(4);
  const hp = boss.hp;
  boss.damage(game, 20, PUSH);
  expect(hp - boss.hp).toBeCloseTo(20 * COZY_CHIP);

  // a thrown chair through a tentacle hurts it
  const t0 = script.tentacles[0]!;
  const before = t0.hp;
  lob(game, t0);
  run(game, 0.05);
  expect(t0.hp).toBeLessThan(before);

  // cut them all down
  for (const t of script.tentacles) {
    for (let k = 0; k < 12 && t.state !== 'dead'; k++) {
      lob(game, t);
      run(game, 0.4);
    }
    expect(t.state).toBe('dead');
  }
  expect(script.exposed).toBeGreaterThan(0);
  const hp2 = boss.hp;
  boss.damage(game, 20, PUSH);
  expect(hp2 - boss.hp).toBeCloseTo(20 * KRAKEN_EXPOSED);

  // and they grow back
  run(game, 6);
  expect(script.alive).toBe(4);
  expect(script.regrowths).toBe(1);
});

it('kraken: a slam lands where its ring said, a grab holds you until you cut the tentacle', { timeout: 90_000 }, () => {
  const { game, boss, script } = krakenFight();
  const t = script.tentacles[0]!;
  game.player.body.x = t.rx + 120;
  game.player.body.y = t.ry;
  game.player.invulnerable = 0;
  const hp = game.player.hp;
  (script as unknown as { startAttack(g: Game, b: unknown, t: unknown, o: boolean, k: string): void }).startAttack(game, boss, t, false, 'slam');
  run(game, 1.4);
  expect(game.player.hp).toBeLessThan(hp);

  // a grab: the player stands inside reach and does not move
  run(game, 2);
  const t2 = script.tentacles[1]!;
  game.player.body.x = t2.rx + 150;
  game.player.body.y = t2.ry;
  game.player.invulnerable = 0;
  (script as unknown as { startAttack(g: Game, b: unknown, t: unknown, o: boolean, k: string): void }).startAttack(game, boss, t2, false, 'grab');
  run(game, 1.3);
  expect((script as unknown as { heldBy: unknown }).heldBy).toBe(t2);
  // hitting the tentacle breaks the hold
  lob(game, t2);
  run(game, 0.1);
  expect((script as unknown as { heldBy: unknown }).heldBy).toBeNull();
});

it('kraken entrance: untouchable while crawling in, then tentacles burst up one by one', { timeout: 90_000 }, () => {
  const game = boot();
  game.playFrom(3);
  let boss: Game['enemies'][number] | undefined;
  for (let i = 0; i < Math.round(30 / FIXED_DT) && !boss; i++) {
    game.tick(FIXED_DT);
    boss = game.enemies.find((e) => e.type.id === 'kraken');
  }
  const script = boss!.script as KrakenScript;
  const hp = boss!.hp;
  boss!.damage(game, 80, PUSH);
  expect(boss!.hp).toBe(hp);
  for (let i = 0; i < Math.round(10 / FIXED_DT) && script.intro !== 'done'; i++) game.tick(FIXED_DT);
  expect(script.intro).toBe('done');
  expect(script.alive).toBe(4);
});

function pianoFight(): { game: Game; boss: Game['enemies'][number]; script: PianoScript } {
  const game = boot();
  game.playFrom(5);
  for (let i = 0; i < Math.round(40 / FIXED_DT); i++) {
    game.tick(FIXED_DT);
    const boss = game.enemies.find((e) => e.type.id === 'piano');
    if (boss && boss.script instanceof PianoScript) {
      for (const o of [...game.objects]) o.destroy(game);
      const b = game.world.bounds;
      boss.body.x = (b.x0 + b.x1) / 2;
      boss.body.y = (b.y0 + b.y1) / 2;
      boss.body.vx = boss.body.vy = 0;
      boss.script.finishIntro(game, boss, false);
      (boss.script as unknown as { gap: number }).gap = 9999;
      game.player.hp = 99;
      game.player.body.x = boss.body.x - 330;
      game.player.body.y = boss.body.y;
      boss.stun = 0;
      return { game, boss, script: boss.script };
    }
  }
  throw new Error('the Piano Spider never arrived');
}

/** Runs ticks until the beat clock sits `offset` seconds after a beat. */
function atBeatOffset(game: Game, script: PianoScript, offset: number): void {
  for (let i = 0; i < 4000; i++) {
    if (Math.abs(script.beatT - offset) < 0.004) return;
    game.tick(FIXED_DT);
  }
  throw new Error('beat never reached');
}

it('piano: throws on the beat do big damage and build a streak; off the beat they do little; five perfect hits stun him', { timeout: 90_000 }, () => {
  const { game, boss, script } = pianoFight();
  expect(script.beatLen).toBeCloseTo(0.6);
  atBeatOffset(game, script, 0.03);
  const hp = boss.hp;
  boss.damage(game, 10, PUSH);
  expect(hp - boss.hp).toBeCloseTo(10 * ON_BEAT_BONUS);
  expect(script.streak).toBe(1);

  atBeatOffset(game, script, script.beatLen / 2); // dead off the beat
  const hp2 = boss.hp;
  boss.damage(game, 10, PUSH);
  expect(hp2 - boss.hp).toBeCloseTo(10 * OFF_BEAT_FACTOR);
  expect(script.streak).toBe(0);

  // five on-beat hits in a row: crescendo
  for (let k = 0; k < 5; k++) {
    atBeatOffset(game, script, 0.02);
    boss.damage(game, 3, PUSH);
  }
  expect(boss.stun).toBeGreaterThan(0.5);
  expect(script.streak).toBe(0);
  expect(BEAT_WINDOW).toBeGreaterThan(0.05);
});

it('piano: the keyboard strikes the lit keys one bar after it lights them, and the dark keys are safe', { timeout: 90_000 }, () => {
  const { game, boss, script } = pianoFight();
  script.beginAttack(game, boss, 'keyboard');
  const lit = script.keyLit.findIndex((k) => k);
  const dark = script.keyLit.findIndex((k) => !k);
  const bounds = game.world.bounds;
  const place = (k: number): void => {
    const w = (bounds.x1 - bounds.x0) / 8;
    const h = (bounds.y1 - bounds.y0) / 8;
    game.player.body.x = script.keyHoriz ? bounds.x0 + k * w + w / 2 : script.keyCenter;
    game.player.body.y = script.keyHoriz ? script.keyCenter : bounds.y0 + k * h + h / 2;
    game.player.body.vx = game.player.body.vy = 0;
    game.player.invulnerable = 0;
  };
  place(dark);
  const hp = game.player.hp;
  run(game, 3.2); // through the strike on the fourth beat
  expect(script.keyPhase === 'strike' || script.attack === null || script.step >= 4).toBe(true);
  expect(game.player.hp).toBe(hp);

  script.beginAttack(game, boss, 'keyboard');
  const lit2 = script.keyLit.findIndex((k) => k);
  place(lit2);
  game.player.invulnerable = 0;
  run(game, 0.6 * 4 + 0.2);
  expect(game.player.hp).toBeLessThan(hp);
  expect(lit).toBeGreaterThanOrEqual(0);
});

it('piano: staccato lands where its circle was marked; notes fan out; crescendo rings roll out', { timeout: 90_000 }, () => {
  const { game, boss, script } = pianoFight();
  game.player.invulnerable = 0;
  const hp = game.player.hp;
  script.beginAttack(game, boss, 'staccato');
  expect(script.hopTarget).not.toBeNull();
  run(game, 0.65);
  expect(game.player.hp).toBeLessThan(hp);
  run(game, 4);
  expect(script.attack).toBeNull();

  boss.stun = 0;
  const wb = game.world.bounds;
  boss.body.x = (wb.x0 + wb.x1) / 2;
  boss.body.y = (wb.y0 + wb.y1) / 2;
  game.player.body.x = boss.body.x - 330;
  game.player.body.y = boss.body.y;
  script.beginAttack(game, boss, 'notes');
  run(game, 1.4);
  expect(script.notes.length).toBeGreaterThan(3);
  run(game, 8);

  boss.stun = 0;
  script.beginAttack(game, boss, 'crescendo');
  run(game, 0.6 * 3 + 0.4);
  expect(script.rings.length).toBeGreaterThan(0);
  run(game, 6);
  expect(script.attack).toBeNull();
});

it('piano entrance: lowered on a thread (untouchable), a crash, a four-beat count-in, then the keyboard', { timeout: 90_000 }, () => {
  const game = boot();
  game.playFrom(5);
  let boss: Game['enemies'][number] | undefined;
  for (let i = 0; i < Math.round(30 / FIXED_DT) && !boss; i++) {
    game.tick(FIXED_DT);
    boss = game.enemies.find((e) => e.type.id === 'piano');
  }
  const script = boss!.script as PianoScript;
  expect(script.pose).toBe('drop');
  const hp = boss!.hp;
  boss!.damage(game, 80, PUSH);
  expect(boss!.hp).toBe(hp);
  for (let i = 0; i < Math.round(12 / FIXED_DT) && script.intro !== 'done'; i++) game.tick(FIXED_DT);
  expect(script.intro).toBe('done');
  expect(script.attack).toBe('keyboard');
});

function mowerFight(): { game: Game; boss: Game['enemies'][number]; script: MowerScript } {
  const game = boot();
  game.playFrom(6);
  for (let i = 0; i < Math.round(40 / FIXED_DT); i++) {
    game.tick(FIXED_DT);
    const boss = game.enemies.find((e) => e.type.id === 'mower');
    if (boss && boss.script instanceof MowerScript) {
      for (const o of [...game.objects]) o.destroy(game);
      game.zones.clear(); // puddles would trip him mid-move
      const b = game.world.bounds;
      boss.body.x = (b.x0 + b.x1) / 2;
      boss.body.y = (b.y0 + b.y1) / 2;
      boss.body.vx = boss.body.vy = 0;
      boss.script.finishIntro(game, boss, false);
      (boss.script as unknown as { gap: number }).gap = 9999;
      game.player.hp = 99;
      game.player.body.x = boss.body.x - 300;
      game.player.body.y = boss.body.y;
      boss.stun = 0;
      return { game, boss, script: boss.script };
    }
  }
  throw new Error('the Mower never arrived');
}

it('mower: the tank drains and he stalls at zero (extra damage); an explosion empties it at once', { timeout: 90_000 }, () => {
  const { game, boss, script } = mowerFight();
  expect(script.cans.length).toBe(3);
  script.fuel = 0.3;
  run(game, 0.3);
  expect(script.stall).toBeGreaterThan(0);
  const hp = boss.hp;
  boss.damage(game, 10, PUSH);
  expect(hp - boss.hp).toBeCloseTo(10 * STALL_BONUS);
  run(game, 5);
  expect(script.stall).toBeLessThanOrEqual(0); // restarted

  script.fuel = 90;
  const hp2 = boss.hp;
  boss.damage(game, 10, { ...PUSH, type: 'explosion' });
  expect(script.stall).toBeGreaterThan(0);
  expect(script.fuel).toBe(0);
  expect(hp2 - boss.hp).toBeGreaterThan(10);
});

it('mower: running low he drives to a jerry can and drinks it; a can the player grabs is no use to him', { timeout: 90_000 }, () => {
  const { game, boss, script } = mowerFight();
  script.fuel = 30;
  run(game, 0.2);
  expect(script.refuelTarget).not.toBeNull();
  const target = script.refuelTarget!;
  run(game, 6);
  expect(script.fuel).toBeGreaterThan(60);
  expect(target.alive).toBe(false);
  expect(script.cans.length).toBe(2);

  // take the cans away and he cannot refuel
  for (const c of [...script.cans]) c.destroy(game);
  script.fuel = 30;
  run(game, 0.5);
  expect(script.refuelTarget).toBeNull();
  expect(boss.hp).toBeGreaterThan(0);
});

it('mower: the pass runs you over only if you stay in its lane; spin and blow do their work', { timeout: 90_000 }, () => {
  const { game, boss, script } = mowerFight();
  const b = game.world.bounds;
  const reset = (): void => {
    script.fuel = 100;
    boss.stun = 0;
    boss.body.x = (b.x0 + b.x1) / 2;
    boss.body.y = (b.y0 + b.y1) / 2;
    boss.body.vx = boss.body.vy = 0;
  };
  // in the lane: hit. (The first lane is aimed at where the player is.)
  game.player.body.x = (b.x0 + b.x1) / 2 + 200;
  game.player.body.y = (b.y0 + b.y1) / 2;
  game.player.invulnerable = 0;
  const hp = game.player.hp;
  script.beginAttack(game, boss, 'pass');
  run(game, 3);
  expect(game.player.hp).toBeLessThan(hp);

  // step out of the lane before it goes: safe
  reset();
  script.beginAttack(game, boss, 'pass');
  game.player.body.y = script.laneY + 260 > b.y1 - 30 ? script.laneY - 260 : script.laneY + 260;
  game.player.body.x = (b.x0 + b.x1) / 2;
  game.player.invulnerable = 0;
  const hp2 = game.player.hp;
  run(game, 1.1);
  expect(game.player.hp).toBe(hp2);
});

it('mower: the blade ring hurts inside it, and the leaf blower shoves you away', { timeout: 90_000 }, () => {
  const spin = mowerFight();
  spin.game.player.body.x = spin.boss.body.x + 115;
  spin.game.player.body.y = spin.boss.body.y;
  spin.game.player.invulnerable = 0;
  const hp = spin.game.player.hp;
  spin.script.beginAttack(spin.game, spin.boss, 'spin');
  run(spin.game, 1.6);
  expect(spin.game.player.hp).toBeLessThan(hp);

  const blow = mowerFight();
  blow.game.player.body.x = blow.boss.body.x - 250;
  blow.game.player.body.y = blow.boss.body.y;
  const x0 = blow.game.player.body.x;
  blow.script.beginAttack(blow.game, blow.boss, 'blow');
  run(blow.game, 1.8);
  expect(blow.game.player.body.x).toBeLessThan(x0 - 20); // shoved away from him
});

it('mower entrance: untouchable while drifting in, the engine revs, then the first pass', { timeout: 90_000 }, () => {
  const game = boot();
  game.playFrom(6);
  let boss: Game['enemies'][number] | undefined;
  for (let i = 0; i < Math.round(30 / FIXED_DT) && !boss; i++) {
    game.tick(FIXED_DT);
    boss = game.enemies.find((e) => e.type.id === 'mower');
  }
  const script = boss!.script as MowerScript;
  expect(script.pose).toBe('drift');
  const hp = boss!.hp;
  boss!.damage(game, 80, PUSH);
  expect(boss!.hp).toBe(hp);
  for (let i = 0; i < Math.round(10 / FIXED_DT) && script.intro !== 'done'; i++) game.tick(FIXED_DT);
  expect(script.intro).toBe('done');
  expect(script.attack).toBe('pass');
  expect(script.cans.length).toBe(3);
});

function momFight(): { game: Game; boss: Game['enemies'][number]; script: MomScript } {
  const game = boot();
  game.playFrom(7);
  for (let i = 0; i < Math.round(40 / FIXED_DT); i++) {
    game.tick(FIXED_DT);
    const boss = game.enemies.find((e) => e.type.id === 'mom');
    if (boss && boss.script instanceof MomScript) {
      for (const o of [...game.objects]) o.destroy(game);
      game.zones.clear();
      const b = game.world.bounds;
      boss.body.x = (b.x0 + b.x1) / 2;
      boss.body.y = (b.y0 + b.y1) / 2;
      boss.body.vx = boss.body.vy = 0;
      boss.script.finishIntro(game, boss, false);
      (boss.script as unknown as { gap: number }).gap = 9999;
      game.player.hp = 99;
      game.player.body.x = boss.body.x - 320;
      game.player.body.y = boss.body.y;
      game.player.body.vx = game.player.body.vy = 0;
      boss.stun = 0;
      return { game, boss, script: boss.script };
    }
  }
  throw new Error('Mom never arrived');
}

it('mom: she catches and confiscates what you throw; obeying her rule drops her guard', { timeout: 90_000 }, () => {
  const { game, boss, script } = momFight();
  const chair = game.spawnObject('chair', boss.body.x - 150, boss.body.y)!;
  const hp = boss.hp;
  boss.damage(game, 20, { ...PUSH, source: chair });
  expect(hp - boss.hp).toBeCloseTo(20 * GUARD_CHIP);
  expect(chair.alive).toBe(false); // confiscated

  // stand perfectly still for NO RUNNING
  script.beginRule(game, boss, 'still');
  game.player.body.vx = game.player.body.vy = 0;
  run(game, 4.2);
  expect(script.open).toBeGreaterThan(0);
  const hp2 = boss.hp;
  boss.damage(game, 10, PUSH);
  expect(hp2 - boss.hp).toBeCloseTo(10 * OPEN_BONUS);
});

it('mom: breaking a rule hurts and she heals; every rule can be obeyed', { timeout: 90_000 }, () => {
  const { game, boss, script } = momFight();
  // NO RUNNING, but you run
  script.beginRule(game, boss, 'still');
  run(game, 0.5);
  game.player.body.vx = 400;
  game.player.invulnerable = 0;
  const hp = game.player.hp;
  const mom = boss.hp;
  boss.hp = boss.maxHp * 0.5;
  run(game, 0.2);
  expect(game.player.hp).toBeLessThan(hp);
  expect(boss.hp).toBeGreaterThan(boss.maxHp * 0.5);
  expect(mom).toBeGreaterThan(0);
  run(game, 1.2);

  // CORNER: walk into the glowing corner in time
  boss.stun = 0;
  game.player.body.vx = game.player.body.vy = 0;
  script.beginRule(game, boss, 'corner');
  game.player.body.x = script.cornerX;
  game.player.body.y = script.cornerY;
  game.player.body.vx = game.player.body.vy = 0;
  run(game, 3.9);
  expect(script.open).toBeGreaterThan(0);

  // TIDY UP: pick something up (passes as soon as you are holding something)
  script.open = 0;
  boss.stun = 0;
  const thing = game.spawnObject('book', game.player.body.x + 40, game.player.body.y)!;
  script.beginRule(game, boss, 'tidy');
  (game.player as unknown as { grab(g: Game, o: unknown): void }).grab(game, thing);
  run(game, 0.3);
  expect(script.open).toBeGreaterThan(0);
});

it('mom: slippers fan out along the aim lines; the entrance dims the lights, clicks them on and demands WHO DID THIS', { timeout: 90_000 }, () => {
  const { game, boss, script } = momFight();
  const hp = game.player.hp;
  game.player.invulnerable = 0;
  (script as unknown as { beginSlippers(g: Game, b: unknown): void }).beginSlippers(game, boss);
  run(game, 1.3);
  expect(script.slippers.length).toBeGreaterThan(0);
  run(game, 3);
  expect(game.player.hp).toBeLessThan(hp);

  const fresh = boot();
  fresh.playFrom(7);
  let m: Game['enemies'][number] | undefined;
  for (let i = 0; i < Math.round(30 / FIXED_DT) && !m; i++) {
    fresh.tick(FIXED_DT);
    m = fresh.enemies.find((e) => e.type.id === 'mom');
  }
  const ms = m!.script as MomScript;
  const mhp = m!.hp;
  m!.damage(fresh, 80, PUSH);
  expect(m!.hp).toBe(mhp);
  for (let i = 0; i < Math.round(12 / FIXED_DT) && ms.intro !== 'done'; i++) fresh.tick(FIXED_DT);
  expect(ms.intro).toBe('done');
  expect(ms.attack).toBe('rule');
  expect(ms.rule).toBe('still');
});

function vacuumFight(): { game: Game; boss: Game['enemies'][number]; script: VacuumScript } {
  const game = boot();
  game.playFrom(11);
  for (let i = 0; i < Math.round(40 / FIXED_DT); i++) {
    game.tick(FIXED_DT);
    const boss = game.enemies.find((e) => e.type.id === 'vacuumasaurus');
    if (boss && boss.script instanceof VacuumScript) {
      for (const o of [...game.objects]) o.destroy(game);
      game.zones.clear();
      const b = game.world.bounds;
      boss.body.x = (b.x0 + b.x1) / 2;
      boss.body.y = (b.y0 + b.y1) / 2;
      boss.body.vx = boss.body.vy = 0;
      boss.script.finishIntro(game, boss, false);
      (boss.script as unknown as { gap: number }).gap = 9999;
      game.player.hp = 99;
      game.player.body.x = boss.body.x - 300;
      game.player.body.y = boss.body.y;
      game.player.body.vx = game.player.body.vy = 0;
      boss.stun = 0;
      return { game, boss, script: boss.script };
    }
  }
  throw new Error('the Vacuumasaurus never arrived');
}

it('vacuumasaurus: armoured while plugged in; a throw through the socket unplugs him and he crawls back', { timeout: 90_000 }, () => {
  const { game, boss, script } = vacuumFight();
  const hp = boss.hp;
  boss.damage(game, 10, PUSH);
  expect(hp - boss.hp).toBeCloseTo(10 * PLUGGED_ARMOUR);

  const chair = game.spawnObject('chair', script.socketX + 20, script.socketY)!;
  chair.thrownByPlayer = true;
  chair.body.vx = script.socketX < boss.body.x ? -300 : 300;
  run(game, 0.1);
  expect(script.plugged).toBe(false);
  const hp2 = boss.hp;
  boss.damage(game, 10, PUSH);
  expect(hp2 - boss.hp).toBeCloseTo(10 * UNPLUGGED_BONUS);

  // he drags himself back to the wall and plugs in again
  run(game, 12);
  expect(script.plugged).toBe(true);
});

it('vacuumasaurus: the inhale swallows small things into the bag, and the spit fires them at you', { timeout: 90_000 }, () => {
  const { game, boss, script } = vacuumFight();
  const b = boss.body;
  const book = game.spawnObject('book', b.x - 140, b.y)!;
  game.player.body.x = b.x - 300;
  game.player.body.y = b.y;
  script.beginAttack(game, boss, 'inhale');
  const d0 = Math.hypot(game.player.body.x - b.x, game.player.body.y - b.y);
  run(game, 4);
  expect(Math.hypot(game.player.body.x - b.x, game.player.body.y - b.y)).toBeLessThan(d0);
  expect(book.alive).toBe(false);
  expect(script.bag.length).toBe(1);

  boss.stun = 0;
  game.player.body.x = b.x - 300;
  game.player.body.y = b.y;
  game.player.body.vx = game.player.body.vy = 0;
  game.player.invulnerable = 0;
  const hp = game.player.hp;
  const before = game.objects.length;
  script.beginAttack(game, boss, 'spit');
  run(game, 1.2);
  expect(game.objects.length).toBeGreaterThan(before);
  run(game, 1.5);
  expect(game.player.hp).toBeLessThan(hp);
  expect(script.bag.length).toBe(0);
});

it('vacuumasaurus: the cord whip sweeps an arc that hurts', { timeout: 90_000 }, () => {
  const { game, boss, script } = vacuumFight();
  const b = boss.body;
  game.player.body.x = b.x + 150;
  game.player.body.y = b.y;
  game.player.invulnerable = 0;
  const hp = game.player.hp;
  script.beginAttack(game, boss, 'whip');
  run(game, 3.2);
  expect(game.player.hp).toBeLessThan(hp);
});

it('vacuumasaurus entrance: untouchable while rolling in, a whine, then an inhale', { timeout: 90_000 }, () => {
  const game = boot();
  game.playFrom(11);
  let boss: Game['enemies'][number] | undefined;
  for (let i = 0; i < Math.round(30 / FIXED_DT) && !boss; i++) {
    game.tick(FIXED_DT);
    boss = game.enemies.find((e) => e.type.id === 'vacuumasaurus');
  }
  const script = boss!.script as VacuumScript;
  const hp = boss!.hp;
  boss!.damage(game, 80, PUSH);
  expect(boss!.hp).toBe(hp);
  for (let i = 0; i < Math.round(12 / FIXED_DT) && script.intro !== 'done'; i++) game.tick(FIXED_DT);
  expect(script.intro).toBe('done');
  expect(script.attack).toBe('inhale');
});
