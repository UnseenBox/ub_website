import type { Shot } from '../ball/ShotController';
import type { Goal } from '../goal/Goal';
import type { MechEventKind } from '../mechanics/Mechanic';
import type { Surface } from '../physics/Collider';
import type { RigidBody } from '../physics/RigidBody';

/** Touches softer than this are the ball leaning on something, not a bounce. */
const MIN_BOUNCE_IMPACT = 60;
/** Repeat contacts with the same body inside this window are one bounce. */
const SAME_BODY_WINDOW = 0.08;

/** The facts of one shot. Scoring and style labels are derived from this and nothing else. */
export interface ShotResult {
  goal: boolean;
  /** Counted touches on anything solid except the net. */
  bounces: number;
  /** How many of those touches were on each kind of surface. */
  touched: Readonly<Partial<Record<Surface, number>>>;
  /** What the mechanics did during the shot. */
  did: ReadonlySet<MechEventKind>;
  /** There was a goalkeeper on this level. */
  keeper: boolean;
  /** Path length in world units. */
  distance: number;
  /** Seconds from launch. */
  time: number;
  power: number;
  /** Speed as the ball crossed the line (0 on a miss). */
  entrySpeed: number;
  /** Where it crossed: -1 at the left post, 0 dead centre, 1 at the right post. */
  entryOffset: number;
  /** The shot was struck away from the goal and came back. */
  boomerang: boolean;
  /** Closest the ball came to the open goal mouth. */
  minGoalDist: number;
}

/** Watches a shot from launch to finish and reports what happened. */
export class ShotAnalyzer {
  private count = 0;
  private touched: Partial<Record<Surface, number>> = {};
  private did = new Set<MechEventKind>();
  private distance = 0;
  private time = 0;
  private power = 0;
  private boomerang = false;
  private minGoalDist = Infinity;
  private lastBody = -1;
  private lastTime = -1;

  get bounces(): number {
    return this.count;
  }

  begin(shot: Shot, goal: Goal): void {
    this.count = 0;
    this.touched = {};
    this.did = new Set();
    this.distance = 0;
    this.time = 0;
    this.power = shot.power;
    this.minGoalDist = goal.distanceToMouth(shot.launchX, shot.launchY);
    this.lastBody = -1;
    this.lastTime = -1;
    const gx = goal.cx - shot.launchX;
    const gy = goal.lineY - shot.launchY;
    const cos = (shot.dirX * gx + shot.dirY * gy) / (Math.hypot(gx, gy) || 1);
    this.boomerang = cos < -0.2;
  }

  /** Returns the running bounce count if this contact counted as a bounce, otherwise 0. */
  registerContact(surface: Surface, bodyId: number, impact: number): number {
    if (surface === 'net' || surface === 'ball' || impact < MIN_BOUNCE_IMPACT) return 0;
    if (bodyId === this.lastBody && this.time - this.lastTime < SAME_BODY_WINDOW) return 0;
    this.lastBody = bodyId;
    this.lastTime = this.time;
    this.touched[surface] = (this.touched[surface] ?? 0) + 1;
    return ++this.count;
  }

  registerMechanic(kind: MechEventKind): void {
    this.did.add(kind);
  }

  track(ball: RigidBody, dt: number, goal: Goal): void {
    this.time += dt;
    this.distance += Math.hypot(ball.vx, ball.vy) * dt;
    const d = goal.distanceToMouth(ball.x, ball.y);
    if (d < this.minGoalDist) this.minGoalDist = d;
  }

  finish(scored: boolean, ball: RigidBody, goal: Goal, keeper: boolean): ShotResult {
    return {
      goal: scored,
      bounces: this.count,
      touched: this.touched,
      did: this.did,
      keeper,
      distance: this.distance,
      time: this.time,
      power: this.power,
      entrySpeed: scored ? Math.hypot(ball.vx, ball.vy) : 0,
      entryOffset: scored ? (ball.x - goal.cx) / (goal.width / 2) : 0,
      boomerang: this.boomerang,
      minGoalDist: this.minGoalDist,
    };
  }
}
