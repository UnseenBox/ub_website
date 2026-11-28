// What sets each monster apart: the Hound's leaps and pounce, the Stalker's vanishing, the
// Brute's roar, the Wraith's spell, the Crimson Brute's rush, the Lurker's dive. This is the
// timing and movement only; what the player sees and hears of it is in systems/GimmickFx.ts.

import { FIELD } from '../game/config';
import { windowHalfWidth } from '../game/perspective';
import type { Zombie } from './Zombie';

/** Where a trick has got to. `phase` is '' when nothing is going on. */
export interface Trick {
  phase: '' | 'crouch' | 'leap' | 'ready' | 'pounce' | 'flicker' | 'gone' | 'appear' | 'dig' | 'under';
  /** Seconds into the phase. */
  t: number;
  from: number;
  to: number;
  fromX: number;
  toX: number;
  /** Seconds until the next leap, roar or spell. */
  wait: number;
  /** Uses left (vanishings, spells). */
  left: number;
  /** The distance at which the next vanishing starts. */
  at: number;
  /** Which way the next leap goes. */
  side: number;
  /** Done once only: the pounce, the rush, the dive. */
  done: boolean;
}

export const newTrick = (): Trick => ({
  phase: '', t: 0, from: 0, to: 0, fromX: 0, toX: 0, wait: 0, left: 0, at: 0, side: 1, done: false,
});

/** Timings the player has to read, in seconds. */
export const TELL = { crouch: 0.16, ready: 0.34, pounce: 0.46, flicker: 0.75, appear: 0.6, dig: 0.4 } as const;
/** How high a side leap and a pounce carry a hound, in metres. */
export const LEAP_HEIGHT = 0.9;
export const POUNCE_HEIGHT = 1.5;

const between = (a: number, b: number, r: number): number => a + (b - a) * r;
const smooth = (k: number): number => k * k * (3 - 2 * k);
const clampTo = (v: number, lim: number): number => Math.max(-lim, Math.min(lim, v));

/** Sets a freshly spawned monster's tricks going. */
export function startTricks(z: Zombie, rng: () => number): void {
  const s = z.def.special;
  const tr = z.trick;
  Object.assign(tr, newTrick());
  tr.side = rng() < 0.5 ? -1 : 1;
  if (s?.leap) tr.wait = between(s.leap.every[0], s.leap.every[1], rng());
  if (s?.vanish) {
    tr.left = s.vanish.times;
    tr.at = between(s.vanish.at[0], s.vanish.at[1], rng());
  }
  if (s?.roar) tr.wait = s.roar.first + rng();
  if (s?.gloom) {
    tr.left = s.gloom.casts;
    tr.wait = 0;
  }
}

const walking = (z: Zombie): boolean => z.state === 'walk' && z.channelLeft <= 0 && z.staggerLeft <= 0;

function begin(tr: Trick, phase: Trick['phase']): void {
  tr.phase = phase;
  tr.t = 0;
}

/**
 * Runs the tricks for `dt` seconds. Returns true while a trick is doing the moving, so the
 * ordinary walk must wait.
 */
export function runTricks(z: Zombie, dt: number, rng: () => number): boolean {
  const s = z.def.special;
  if (!s || z.state === 'dying' || z.state === 'dead' || z.state === 'down' || z.state === 'emerge') return false;
  const tr = z.trick;
  tr.t += dt;
  let busy = false;

  if (s.leap) busy = leap(z, dt, rng) || busy;
  if (s.vanish) busy = vanish(z, rng) || busy;
  if (s.dive) busy = dive(z, rng) || busy;

  // The Brute roars where it stands, walking in or already at the wall.
  if (s.roar && z.channelLeft <= 0 && z.staggerLeft <= 0 && z.z <= 48 && (z.state === 'walk' || z.state === 'attack')) {
    tr.wait -= dt;
    if (tr.wait <= 0) {
      tr.wait = s.roar.every;
      z.windUp('roar', s.roar.seconds);
    }
  }
  // The Wraith's spell, once it is close; the lamp holds it off.
  if (s.gloom && tr.left > 0 && z.channelLeft <= 0 && z.revealLeft <= 0 && z.z <= s.gloom.castAt && (z.state === 'walk' || z.state === 'attack')) {
    tr.wait -= dt;
    if (tr.wait <= 0) {
      tr.wait = s.gloom.cooldown;
      tr.left--;
      z.windUp('veil', s.gloom.windup);
    }
  }
  // The Crimson Brute's rush: one long warning, then it runs.
  if (s.rush && !tr.done && walking(z) && !z.goal && z.z <= s.rush.from && z.z > z.stopZ + 4) {
    tr.done = true;
    z.windUp('rush', s.rush.windup);
  }
  return busy;
}

/** Side leaps all the way in, then a crouch and a pounce onto the wire. */
function leap(z: Zombie, dt: number, rng: () => number): boolean {
  const c = z.def.special!.leap!;
  const tr = z.trick;
  const free = walking(z) && !z.goal && z.slowLeft <= 0;
  if (tr.phase === '') {
    if (!free) return false;
    if (!tr.done && z.z <= c.pounceAt && z.z > z.stopZ + 0.5) {
      begin(tr, 'ready');
      return true;
    }
    tr.wait -= dt;
    if (tr.wait <= 0 && z.z > c.pounceAt + 2 && z.z < 55) begin(tr, 'crouch');
    return false;
  }
  if (tr.phase === 'crouch') {
    z.squash = Math.min(1, tr.t / TELL.crouch);
    if (tr.t < TELL.crouch) return false;
    // To the other side; if the window's frame is there, back again.
    const lim = windowHalfWidth(z.z) - 0.4;
    const far = between(c.distance[0], c.distance[1], rng());
    let to = z.swerve + tr.side * far;
    if (Math.abs(z.laneX + to) > lim) to = z.swerve - tr.side * far;
    tr.side = -tr.side;
    tr.fromX = z.swerve;
    tr.toX = clampTo(to, 6);
    z.squash = 0;
    z.action = 'leap';
    begin(tr, 'leap');
    return false;
  }
  if (tr.phase === 'leap') {
    const k = Math.min(1, tr.t / c.seconds);
    z.swerve = tr.fromX + (tr.toX - tr.fromX) * smooth(k);
    z.lift = Math.sin(Math.PI * k) * LEAP_HEIGHT;
    if (k >= 1) {
      z.lift = 0;
      tr.wait = between(c.every[0], c.every[1], rng());
      begin(tr, '');
    }
    return false;
  }
  if (tr.phase === 'ready') {
    // The crouch before the pounce: the moment to shoot it.
    z.squash = Math.min(1, tr.t / (TELL.ready * 0.6));
    if (tr.t >= TELL.ready) {
      z.squash = 0;
      tr.from = z.z;
      tr.to = z.stopZ;
      z.action = 'leap';
      begin(tr, 'pounce');
    }
    return true;
  }
  if (tr.phase === 'pounce') {
    const k = Math.min(1, tr.t / TELL.pounce);
    z.z = tr.from + (tr.to - tr.from) * k;
    z.lift = Math.sin(Math.PI * k) * POUNCE_HEIGHT;
    if (k >= 1) {
      z.lift = 0;
      tr.done = true;
      z.bite();
      begin(tr, '');
    }
    return true;
  }
  return false;
}

/** Flickers, is gone, and is suddenly close. */
function vanish(z: Zombie, rng: () => number): boolean {
  const c = z.def.special!.vanish!;
  const tr = z.trick;
  if (tr.phase === '') {
    if (tr.left > 0 && walking(z) && !z.goal && z.revealLeft <= 0 && z.z <= tr.at && z.z > c.back[1] + 3) {
      z.action = 'vanish';
      begin(tr, 'flicker');
    }
    return false;
  }
  if (tr.phase === 'flicker') {
    z.veil = Math.max(0.12, 1 - tr.t / TELL.flicker) * (Math.sin(tr.t * 48) > -0.2 ? 1 : 0.35);
    if (tr.t >= TELL.flicker) {
      z.hidden = true;
      z.veil = 0;
      tr.from = z.z;
      tr.to = between(c.back[0], c.back[1], rng());
      tr.fromX = z.x;
      tr.toX = (rng() * 2 - 1) * Math.max(0.4, windowHalfWidth(tr.to) - 0.7);
      begin(tr, 'gone');
    }
    return true;
  }
  if (tr.phase === 'gone') {
    const k = Math.min(1, tr.t / c.gone);
    z.z = tr.from + (tr.to - tr.from) * k;
    z.moveLane(tr.fromX + (tr.toX - tr.fromX) * smooth(k));
    z.veil = 0;
    // Caught in the lamp it cannot stay unseen, and it comes out where it is.
    if (k >= 1 || z.revealLeft > 0) {
      z.hidden = false;
      z.action = 'ambush';
      begin(tr, 'appear');
    }
    return true;
  }
  if (tr.phase === 'appear') {
    z.veil = Math.min(1, tr.t / 0.09);
    z.pop = Math.max(0, 1 - tr.t / 0.3);
    if (tr.t >= TELL.appear) {
      z.veil = 1;
      z.pop = 0;
      tr.left--;
      tr.at = Math.min(tr.at, z.z - 3);
      begin(tr, '');
      return false;
    }
    return true;
  }
  return false;
}

/** Hurt, it goes under the mud and comes up closer. */
function dive(z: Zombie, rng: () => number): boolean {
  const c = z.def.special!.dive!;
  const tr = z.trick;
  if (tr.phase === '') {
    if (!tr.done && walking(z) && z.hp < z.maxHp * c.below && z.z > z.stopZ + 4) {
      tr.done = true;
      z.action = 'burrow';
      begin(tr, 'dig');
    }
    return false;
  }
  if (tr.phase === 'dig') {
    z.squash = Math.min(1, tr.t / TELL.dig);
    z.veil = 1 - 0.8 * Math.min(1, tr.t / TELL.dig);
    if (tr.t >= TELL.dig) {
      z.hidden = true;
      z.veil = 0;
      z.squash = 0;
      tr.to = Math.max(Math.max(FIELD.attackZ + 2, z.stopZ + 1.5), z.z - c.closer);
      tr.from = z.z;
      tr.fromX = z.x;
      tr.toX = z.x + (rng() * 2 - 1) * 2.5;
      begin(tr, 'under');
    }
    return true;
  }
  if (tr.phase === 'under') {
    const k = Math.min(1, tr.t / c.seconds);
    z.z = tr.from + (tr.to - tr.from) * k;
    z.moveLane(tr.fromX + (tr.toX - tr.fromX) * k);
    if (k >= 1) {
      z.hidden = false;
      z.veil = 1;
      z.surface(0.6);
      z.action = 'ambush';
      begin(tr, '');
    }
    return true;
  }
  return false;
}

/** Drops any trick in progress, leaving the monster in plain sight where it is. */
export function breakTricks(z: Zombie): void {
  const tr = z.trick;
  if (tr.phase === '') return;
  if (tr.phase === 'flicker' || tr.phase === 'gone') tr.left = Math.max(0, tr.left - 1);
  if (tr.phase === 'ready' || tr.phase === 'pounce') tr.done = true;
  begin(tr, '');
  tr.wait = Math.max(tr.wait, 1);
  z.hidden = false;
  z.veil = 1;
  z.lift = 0;
  z.squash = 0;
  z.pop = 0;
}
