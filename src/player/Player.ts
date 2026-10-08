import { PLAYER } from '../core/Tuning';
import { approach, clamp01, type Rect } from '../core/Mathx';
import type { ActionState } from '../input/InputManager';
import { moveBody, type Body } from '../world/Collision';

export type PlayerPose = 'IDLE' | 'WALK' | 'SNEAK' | 'HIDE' | 'PANIC' | 'DEAD' | 'ESCAPED';

export interface PlayerFootstep {
  x: number;
  y: number;
  level: number;
}

/**
 * The body.
 *
 * Deliberately unremarkable: it walks, it sneaks, it hides, and nothing hunts it
 * directly. All the tension lives in the cursor, so the character stays quiet,
 * both visually and mechanically.
 */
export class Player {
  x = 0;
  y = 0;
  vx = 0;
  vy = 0;
  readonly radius = PLAYER.radius;

  /** Facing is cosmetic: it is the direction of travel, not a sight line. */
  facing = Math.PI * 0.5;
  pose: PlayerPose = 'IDLE';

  sneaking = false;
  /** Id of the hiding spot currently occupied, or null. */
  hiddenIn: string | null = null;
  dead = false;
  escaped = false;

  /** Items picked up this attempt. Rooms query this for their objectives. */
  readonly inventory = new Set<string>();

  /** 0..1 cosmetic agitation, driven by how much danger the room is in. */
  panic = 0;

  walkPhase = 0;
  breathPhase = 0;
  private stepTimer = 0;
  private readonly body: Body = { x: 0, y: 0, radius: PLAYER.radius };

  reset(x: number, y: number): void {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.facing = Math.PI * 0.5;
    this.pose = 'IDLE';
    this.sneaking = false;
    this.hiddenIn = null;
    this.dead = false;
    this.escaped = false;
    this.inventory.clear();
    this.panic = 0;
    this.walkPhase = 0;
    this.breathPhase = 0;
    this.stepTimer = 0;
  }

  get hidden(): boolean {
    return this.hiddenIn !== null;
  }

  update(
    dt: number,
    actions: ActionState,
    solids: readonly Rect[],
    danger: number,
    onFootstep: (step: PlayerFootstep) => void,
  ): void {
    this.breathPhase += dt * (1.1 + this.panic * 2.2);
    this.panic = approach(this.panic, clamp01(danger), 2.4, dt);

    if (this.dead) {
      this.pose = 'DEAD';
      this.vx = 0;
      this.vy = 0;
      return;
    }
    if (this.escaped) {
      this.pose = 'ESCAPED';
      return;
    }

    if (this.hidden) {
      // Pinned in place. Leaving is a deliberate act, not a drift.
      this.pose = 'HIDE';
      this.vx = 0;
      this.vy = 0;
      this.walkPhase = 0;
      return;
    }

    this.sneaking = actions.sneak;
    const target = this.sneaking ? PLAYER.sneakSpeed : PLAYER.walkSpeed;
    const desiredX = actions.moveX * target;
    const desiredY = actions.moveY * target;

    this.vx = approach(this.vx, desiredX, PLAYER.accel, dt);
    this.vy = approach(this.vy, desiredY, PLAYER.accel, dt);

    const speed = Math.hypot(this.vx, this.vy);
    if (speed > 2) {
      this.facing = Math.atan2(this.vy, this.vx);
      this.walkPhase += dt * (this.sneaking ? 4.2 : 8.4);
    } else {
      this.walkPhase = approach(this.walkPhase, Math.round(this.walkPhase / Math.PI) * Math.PI, 6, dt);
    }

    this.body.x = this.x;
    this.body.y = this.y;
    moveBody(this.body, this.vx * dt, this.vy * dt, solids);
    const movedX = this.body.x - this.x;
    const movedY = this.body.y - this.y;
    this.x = this.body.x;
    this.y = this.body.y;

    // Kill residual velocity into a wall so we do not keep pressing.
    if (Math.abs(movedX) < Math.abs(this.vx * dt) * 0.4) this.vx *= 0.3;
    if (Math.abs(movedY) < Math.abs(this.vy * dt) * 0.4) this.vy *= 0.3;

    const moved = Math.hypot(movedX, movedY);
    if (moved > 0.08) {
      this.pose = this.panic > 0.72 ? 'PANIC' : this.sneaking ? 'SNEAK' : 'WALK';
      this.stepTimer += dt;
      const interval = this.sneaking ? PLAYER.stepInterval * 1.9 : PLAYER.stepInterval;
      if (this.stepTimer >= interval) {
        this.stepTimer = 0;
        onFootstep({
          x: this.x,
          y: this.y,
          level: this.sneaking ? PLAYER.sneakFootstepNoise : PLAYER.footstepNoise,
        });
      }
    } else {
      this.pose = 'IDLE';
      this.stepTimer = PLAYER.stepInterval * 0.6;
    }
  }

  enterHiding(spotId: string): void {
    this.hiddenIn = spotId;
    this.vx = 0;
    this.vy = 0;
  }

  leaveHiding(): void {
    this.hiddenIn = null;
  }

  kill(): void {
    this.dead = true;
    this.pose = 'DEAD';
  }

  /** Distance test used by every proximity-gated interaction. */
  canReach(x: number, y: number, extra = 0): boolean {
    return Math.hypot(x - this.x, y - this.y) <= PLAYER.reach + extra;
  }
}
