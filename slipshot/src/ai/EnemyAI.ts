import type { Arena } from '../game/Arena';
import type { Ragdoll } from '../physics/Ragdoll';
import { randNormal, randRange } from '../util/math';
import { solveLowArc, type Vec2 } from './ballistics';

export type FireFn = (owner: Ragdoll, muzzle: Vec2, dir: Vec2, speed: number) => void;

interface Plan {
  dir: Vec2;
  speed: number;
}

/** Base enemy launch speed (m/s). The solver also tries faster speeds if needed. */
const BASE_SPEED = 13.5;

/**
 * Basic enemy AI with no pathfinding. The enemy tracks the player with its
 * front arm, solves a low-arc shot with the same integrator as the aim preview,
 * then fires after a short windup. Aim error and reload speed depend on the wave.
 */
export class EnemyAI {
  private reload: number;
  private windup = 0;
  private retarget = 0;
  private plan: Plan | null = null;
  private aimNoise = 0;
  private speedNoise = 1;

  constructor(
    private readonly body: Ragdoll,
    private readonly arena: Arena,
    firstDelay: number,
  ) {
    this.reload = firstDelay;
  }

  update(dt: number, target: Ragdoll | null, wave: number, fire: FireFn): void {
    if (!this.body.alive || !target || !target.alive || !this.body.isStanding()) {
      this.body.setAim(null);
      this.windup = 0;
      return;
    }

    if (this.windup <= 0) {
      this.reload -= dt;
      if (this.reload <= 0) {
        this.windup = Math.max(0.5, 0.85 - 0.03 * wave);
        // Fresh aim noise per shot; it shrinks as the waves go on.
        this.aimNoise = randNormal() * Math.max(0.03, 0.13 - 0.012 * (wave - 1));
        this.speedNoise = 1 + randNormal() * 0.04;
        this.retarget = 0;
      }
    }

    this.retarget -= dt;
    if (this.retarget <= 0) {
      this.retarget = 0.2;
      this.plan = this.solve(target, wave);
    }

    if (!this.plan) {
      this.body.setAim(null);
      return;
    }

    // Apply the windup's aim noise on top of the solved direction.
    const baseAngle = Math.atan2(this.plan.dir.y, this.plan.dir.x);
    const noisy = this.windup > 0 ? baseAngle + this.aimNoise : baseAngle;
    const dir = { x: Math.cos(noisy), y: Math.sin(noisy) };
    this.body.setAim(aimBodyAngle(dir));

    if (this.windup > 0) {
      this.windup -= dt;
      if (this.windup <= 0) {
        this.windup = 0;
        const muzzle = this.body.muzzle(dir);
        fire(this.body, muzzle, dir, this.plan.speed * this.speedNoise);
        this.reload = Math.max(1.7, 3.6 - 0.22 * (wave - 1)) + randRange(0, 0.8);
        this.plan = null;
      }
    }
  }

  private solve(target: Ragdoll, wave: number): Plan | null {
    const torso = target.torsoPosition();
    const aimAt = { x: torso.x, y: torso.y + 0.1 };
    const from = this.body.torsoPosition();
    const gx = aimAt.x - from.x;
    const gy = aimAt.y - from.y;
    const glen = Math.hypot(gx, gy) || 1;
    const origin = this.body.muzzle({ x: gx / glen, y: gy / glen });

    const base = BASE_SPEED + 0.25 * Math.min(wave, 10);
    for (const mult of [1, 1.12, 0.92, 1.25]) {
      const speed = base * mult;
      const dir = solveLowArc(this.arena, origin, aimAt, speed);
      if (dir) return { dir, speed };
    }
    return null;
  }
}

/** Body angle that points the front arm along a world direction. The arm's zero points straight down. */
function aimBodyAngle(dir: Vec2): number {
  return Math.atan2(dir.x, -dir.y);
}
