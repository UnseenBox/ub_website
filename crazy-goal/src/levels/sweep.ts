import type { Boost } from '../abilities/Cards';
import { BALL_TUNING } from '../ball/Ball';
import { speedForPower } from '../ball/ShotController';
import type { MechEventKind } from '../mechanics/Mechanic';
import { circle, Layer, type Surface } from '../physics/Collider';
import { airSpeed, KICK, launchVz } from '../physics/Flight';
import { FIXED_DT } from '../physics/PhysicsWorld';
import { createBody } from '../physics/RigidBody';
import { scoreShot } from '../scoring/ScoreSystem';
import { Level } from './Level';
import type { LevelDefinition } from './LevelDefinition';

/** One shot of a sweep that scored. */
export interface SweepResult {
  angle: number;
  power: number;
  bounces: number;
  did: string;
  seconds: number;
  /** The Crazy Score the same shot would earn, and the stars it would win. */
  total: number;
  stars: number;
  lines: string;
  /** How the ball was kicked: lofted (air) and its bend, -1 to 1. */
  air: boolean;
  bend: number;
  /** The ball passed through the level's coin on the way in. */
  coin: boolean;
}

/** How the ball is struck: along the ground or lofted, and with how much bend. */
export interface Kick {
  air: boolean;
  bend: number;
  /** An ability riding on the shot (fire, magnet, rubber). */
  boost?: Boost | null;
}

/**
 * Fires every angle at every power at private copies of a level and lists the shots that score.
 * Headless (no canvas, no DOM): `__cg.sweep(n)` calls it in the browser and the level validation
 * test calls it in Node. `delay` lets the street run for that many seconds first (scooters, the cat).
 * `kick` strikes every shot the same way (ground, or lofted, with a bend).
 */
export function sweepLevel(
  def: LevelDefinition,
  index: number,
  stepDeg = 1,
  powers: readonly number[] = [0.4, 0.55, 0.7, 0.85, 1],
  delay = 0,
  kick: Kick = { air: false, bend: 0 },
): SweepResult[] {
  const hits: SweepResult[] = [];
  for (const power of powers) {
    for (let angle = -180; angle < 180; angle += stepDeg) {
      const hit = fireShot(def, index, angle, power, delay, kick);
      if (hit) hits.push(hit);
    }
  }
  return hits;
}

/** One shot at `angle` degrees (-90 is straight up) and `power` on a private copy of the level; null when it does not score. */
export function fireShot(def: LevelDefinition, index: number, angle: number, power: number, delay = 0, kick: Kick = { air: false, bend: 0 }): SweepResult | null {
  // A fresh level per shot: nothing a previous shot broke or rang carries over.
  const level = new Level(def, index);
  const ghost = createBody({
    shape: circle(BALL_TUNING.radius),
    surface: 'ball',
    x: def.ballStart.x,
    y: def.ballStart.y,
    isStatic: false,
    layer: Layer.Ball,
    mask: Layer.Solid | Layer.Net,
    restitution: 1,
    drag: BALL_TUNING.drag,
    rollResistance: BALL_TUNING.rollResistance,
    spinDrag: BALL_TUNING.spinDrag,
    maxSpeed: BALL_TUNING.maxSpeed,
  });
  for (let t = 0; t < delay; t += FIXED_DT) level.step(ghost, FIXED_DT, false, null, null);
  const a = (angle * Math.PI) / 180;
  const speed = kick.air ? airSpeed(power) : speedForPower(power);
  ghost.vx = Math.cos(a) * speed;
  ghost.vy = Math.sin(a) * speed;
  ghost.z = kick.air ? 0.01 : 0;
  ghost.vz = kick.air ? launchVz(power) : 0;
  ghost.bend = kick.bend;
  level.arm(kick.boost ?? null, ghost);
  const goal = level.goal;
  const gx = goal.cx - ghost.x;
  const gy = goal.lineY - ghost.y;
  const boomerang = (Math.cos(a) * gx + Math.sin(a) * gy) / (Math.hypot(gx, gy) || 1) < -0.2;
  let bounces = 0;
  let distance = 0;
  let time = 0;
  let maxHeight = 0;
  let minGoalDist = goal.distanceToMouth(ghost.x, ghost.y);
  let lastBody = -1;
  let lastTime = -1;
  let coin = false;
  const touched: Partial<Record<Surface, number>> = {};
  const did = new Set<MechEventKind>();
  for (let i = 0; i < 240 * 9; i++) {
    level.step(
      ghost,
      FIXED_DT,
      true,
      (_b, other, _c, impact) => {
        if (other.surface === 'net' || other.surface === 'ball' || impact < 60) return;
        // The real analyzer folds repeat contacts with one body into a single bounce.
        if (other.id === lastBody && time - lastTime < 0.08) return;
        lastBody = other.id;
        lastTime = time;
        touched[other.surface] = (touched[other.surface] ?? 0) + 1;
        bounces++;
      },
      (e) => did.add(e.kind),
    );
    distance += Math.hypot(ghost.vx, ghost.vy) * FIXED_DT;
    time += FIXED_DT;
    if (ghost.z > maxHeight) maxHeight = ghost.z;
    const d = goal.distanceToMouth(ghost.x, ghost.y);
    if (d < minGoalDist) minGoalDist = d;
    // The game picks a coin up when the ball's centre comes within 36 of it.
    if (!coin && Math.hypot(ghost.x - level.coin.x, ghost.y - level.coin.y) < 36) coin = true;
    if (goal.contains(ghost.x, ghost.y)) {
      // Over the bar is not a goal.
      if (ghost.z > KICK.barZ) return null;
      const card = scoreShot(
        {
          goal: true,
          bounces,
          touched,
          did,
          keeper: level.hasKeeper,
          distance,
          time,
          power,
          entrySpeed: Math.hypot(ghost.vx, ghost.vy),
          entryOffset: (ghost.x - goal.cx) / (goal.width / 2),
          boomerang,
          minGoalDist,
          maxHeight,
          turned: ghost.turned,
        },
        0,
        def.stars,
      );
      return { angle, power, bounces, did: [...did].join('+'), seconds: +time.toFixed(2), total: card.total, stars: card.stars, lines: card.lines.map((l) => l.label).join(', '), air: kick.air, bend: kick.bend, coin };
    }
    if (Math.hypot(ghost.vx, ghost.vy) < 4 && i > 30 && ghost.z <= 0) return null;
  }
  return null;
}

/**
 * How many distinct routes a sweep found: shots count as one route when they touched the same
 * things (same bounce count and same street tricks) within six degrees of each other.
 */
export function countRoutes(hits: readonly SweepResult[]): number {
  const bySignature = new Map<string, Set<number>>();
  for (const h of hits) {
    const key = `${h.bounces}|${h.did}|${h.air ? 'air' : 'ground'}|${Math.sign(h.bend)}`;
    const set = bySignature.get(key) ?? new Set<number>();
    set.add(h.angle);
    bySignature.set(key, set);
  }
  let routes = 0;
  for (const angles of bySignature.values()) {
    const sorted = [...angles].sort((a, b) => a - b);
    routes += 1;
    for (let i = 1; i < sorted.length; i++) if (sorted[i] - sorted[i - 1] > 6) routes++;
  }
  return routes;
}

/** Where a shot went, sampled for playing back as a ghost: what the ball did, and the moments worth marking. */
export interface Trace {
  /** x, y, height of the ball every 1/30 s, from the strike to the end. */
  pts: number[];
  /** True when the ball ended up in the goal (not over the bar). */
  scored: boolean;
  seconds: number;
  /** Moments: a bounce, the ball burning through something, the magnet taking hold. */
  marks: { t: number; x: number; y: number; kind: 'bounce' | 'burn' | 'magnet' | 'coin' }[];
}

/**
 * Plays one shot on a private copy of the level and records its whole flight. The lessons play two of them
 * side by side (without the ability, then with it) as a ghost on the real pitch.
 */
export function traceShot(def: LevelDefinition, index: number, angle: number, power: number, kick: Kick = { air: false, bend: 0 }, maxSeconds = 7): Trace {
  const level = new Level(def, index);
  const ghost = createBody({
    shape: circle(BALL_TUNING.radius),
    surface: 'ball',
    x: def.ballStart.x,
    y: def.ballStart.y,
    isStatic: false,
    layer: Layer.Ball,
    mask: Layer.Solid | Layer.Net,
    restitution: 1,
    drag: BALL_TUNING.drag,
    rollResistance: BALL_TUNING.rollResistance,
    spinDrag: BALL_TUNING.spinDrag,
    maxSpeed: BALL_TUNING.maxSpeed,
  });
  const a = (angle * Math.PI) / 180;
  const speed = kick.air ? airSpeed(power) : speedForPower(power);
  ghost.vx = Math.cos(a) * speed;
  ghost.vy = Math.sin(a) * speed;
  ghost.z = kick.air ? 0.01 : 0;
  ghost.vz = kick.air ? launchVz(power) : 0;
  ghost.bend = kick.bend;
  level.arm(kick.boost ?? null, ghost);
  const trace: Trace = { pts: [ghost.x, ghost.y, 0], scored: false, seconds: 0, marks: [] };
  let time = 0;
  let lastBody = -1;
  let lastTime = -1;
  let coin = false;
  for (let i = 1; i <= 240 * maxSeconds; i++) {
    level.step(
      ghost,
      FIXED_DT,
      true,
      (_b, other, _c, impact) => {
        if (other.surface === 'net' || other.surface === 'ball' || impact < 60) return;
        if (other.id === lastBody && time - lastTime < 0.08) return;
        lastBody = other.id;
        lastTime = time;
        trace.marks.push({ t: time, x: ghost.x, y: ghost.y, kind: 'bounce' });
      },
      (e) => {
        if (e.kind === 'burn') trace.marks.push({ t: time, x: e.x, y: e.y, kind: 'burn' });
        else if (e.kind === 'magnet') trace.marks.push({ t: time, x: e.x, y: e.y, kind: 'magnet' });
      },
    );
    time += FIXED_DT;
    if (!coin && Math.hypot(ghost.x - level.coin.x, ghost.y - level.coin.y) < 36) {
      coin = true;
      trace.marks.push({ t: time, x: level.coin.x, y: level.coin.y, kind: 'coin' });
    }
    if (i % 8 === 0) trace.pts.push(ghost.x, ghost.y, ghost.z);
    if (level.goal.contains(ghost.x, ghost.y)) {
      trace.scored = ghost.z <= KICK.barZ;
      break;
    }
    if (Math.hypot(ghost.vx, ghost.vy) < 4 && i > 30 && ghost.z <= 0) break;
  }
  trace.pts.push(ghost.x, ghost.y, ghost.z);
  trace.seconds = time;
  return trace;
}
