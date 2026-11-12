import { BALL_TUNING } from '../ball/Ball';
import { speedForPower } from '../ball/ShotController';
import type { MechEventKind } from '../mechanics/Mechanic';
import { circle, Layer, type Surface } from '../physics/Collider';
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
}

/**
 * Fires every angle at every power at private copies of a level and lists the shots that score.
 * Headless (no canvas, no DOM): `__cg.sweep(n)` calls it in the browser and the level validation
 * test calls it in Node. `delay` lets the street run for that many seconds first (scooters, the cat).
 */
export function sweepLevel(def: LevelDefinition, index: number, stepDeg = 1, powers: readonly number[] = [0.4, 0.55, 0.7, 0.85, 1], delay = 0): SweepResult[] {
  const hits: SweepResult[] = [];
  for (const power of powers) {
      for (let angle = -180; angle < 180; angle += stepDeg) {
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
        ghost.vx = Math.cos(a) * speedForPower(power);
        ghost.vy = Math.sin(a) * speedForPower(power);
        const goal = level.goal;
        const gx = goal.cx - ghost.x;
        const gy = goal.lineY - ghost.y;
        const boomerang = (Math.cos(a) * gx + Math.sin(a) * gy) / (Math.hypot(gx, gy) || 1) < -0.2;
        let bounces = 0;
        let distance = 0;
        let time = 0;
        let minGoalDist = goal.distanceToMouth(ghost.x, ghost.y);
        let lastBody = -1;
        let lastTime = -1;
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
          const d = goal.distanceToMouth(ghost.x, ghost.y);
          if (d < minGoalDist) minGoalDist = d;
          if (goal.contains(ghost.x, ghost.y)) {
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
              },
              0,
              def.stars,
            );
            hits.push({ angle, power, bounces, did: [...did].join('+'), seconds: +time.toFixed(2), total: card.total, stars: card.stars, lines: card.lines.map((l) => l.label).join(', ') });
            break;
          }
          if (Math.hypot(ghost.vx, ghost.vy) < 4 && i > 30) break;
        }
      }
    }
    return hits;

  return hits;
}

/**
 * How many distinct routes a sweep found: shots count as one route when they touched the same
 * things (same bounce count and same street tricks) within six degrees of each other.
 */
export function countRoutes(hits: readonly SweepResult[]): number {
  const bySignature = new Map<string, Set<number>>();
  for (const h of hits) {
    const key = `${h.bounces}|${h.did}`;
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
