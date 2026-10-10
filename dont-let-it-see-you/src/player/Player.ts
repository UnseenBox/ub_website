import { PLAYER } from '../core/Tuning';
import { approach, clamp01, type Rect } from '../core/Mathx';
import type { ActionState } from '../input/InputManager';
import { moveBody, type Body } from '../world/Collision';

export type PlayerPose = 'IDLE' | 'WALK' | 'SPRINT' | 'SNEAK' | 'HIDE' | 'PANIC' | 'DEAD' | 'ESCAPED' | 'HURT';

export interface PlayerFootstep {
  x: number;
  y: number;
  level: number;
}

/**
 * THE BODY — the new heart of the game.
 *
 * Monsters hunt THIS now: your position, your noise, your light. Sprinting is
 * fast and loud, sneaking is slow and quiet, the flashlight lets you see but
 * also makes you seen. Health gives you 3 hits so a chase is a scare, not an
 * instant game over.
 */
export class Player {
  x = 0;
  y = 0;
  vx = 0;
  vy = 0;
  readonly radius = PLAYER.radius;

  facing = Math.PI * 0.5;
  /** Where the flashlight points (world coords of aim). */
  aimX = 0;
  aimY = 0;
  flashlightOn = true;
  pose: PlayerPose = 'IDLE';

  sneaking = false;
  sprinting = false;
  exhausted = false;
  moving = false;
  /** 0..1 current speed for exposure math. */
  speedNorm = 0;

  hiddenIn: string | null = null;
  dead = false;
  escaped = false;

  readonly inventory = new Set<string>();

  /** Survival resources. */
  health: number = 100;
  stamina: number = PLAYER.staminaMax as number;
  bottles: number = PLAYER.bottlesStart as number;
  hurtTimer = 0;
  private invulnTimer = 0;

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
    this.aimX = x + 60;
    this.aimY = y;
    this.flashlightOn = true;
    this.pose = 'IDLE';
    this.sneaking = false;
    this.sprinting = false;
    this.exhausted = false;
    this.moving = false;
    this.speedNorm = 0;
    this.hiddenIn = null;
    this.dead = false;
    this.escaped = false;
    this.inventory.clear();
    this.health = 100;
    this.stamina = PLAYER.staminaMax;
    this.bottles = PLAYER.bottlesStart;
    this.hurtTimer = 0;
    this.invulnTimer = 0;
    this.panic = 0;
    this.walkPhase = 0;
    this.breathPhase = 0;
    this.stepTimer = 0;
  }

  get hidden(): boolean {
    return this.hiddenIn !== null;
  }

  get invulnerable(): boolean {
    return this.invulnTimer > 0;
  }

  get healthFrac(): number {
    return clamp01(this.health / 100);
  }

  get staminaFrac(): number {
    return clamp01(this.stamina / PLAYER.staminaMax);
  }

  /** Take a hit. Returns true if this killed the player. */
  takeHit(damage: number): boolean {
    if (this.dead || this.invulnTimer > 0 || this.escaped) return false;
    this.health = Math.max(0, this.health - damage);
    this.hurtTimer = 0.6;
    this.invulnTimer = 1.4;
    if (this.health <= 0) {
      this.kill();
      return true;
    }
    return false;
  }

  heal(amount: number): void {
    if (this.dead) return;
    this.health = Math.min(100, this.health + amount);
  }

  throwBottle(): boolean {
    if (this.bottles <= 0 || this.dead || this.hidden) return false;
    this.bottles--;
    return true;
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
    this.hurtTimer = Math.max(0, this.hurtTimer - dt);
    this.invulnTimer = Math.max(0, this.invulnTimer - dt);

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
      this.pose = 'HIDE';
      this.vx = 0;
      this.vy = 0;
      this.walkPhase = 0;
      this.sprinting = false;
      this.moving = false;
      this.speedNorm = 0;
      this.stamina = Math.min(PLAYER.staminaMax, this.stamina + PLAYER.staminaRecover * dt);
      return;
    }

    if (actions.flashlight) this.flashlightOn = !this.flashlightOn;

    const wantSneak = actions.sneak;
    const wantSprint =
      actions.sprint && !wantSneak && (actions.moveX !== 0 || actions.moveY !== 0) && !this.exhausted;

    this.sneaking = wantSneak;
    this.sprinting = wantSprint;

    let target: number = PLAYER.walkSpeed as number;
    if (this.sneaking) target = PLAYER.sneakSpeed as number;
    else if (this.sprinting) target = PLAYER.sprintSpeed as number;

    // Exhausted runners slow down until stamina recovers a bit.
    if (this.exhausted) target *= PLAYER.exhaustedSlow as number;

    const desiredX = actions.moveX * target;
    const desiredY = actions.moveY * target;

    this.vx = approach(this.vx, desiredX, PLAYER.accel, dt);
    this.vy = approach(this.vy, desiredY, PLAYER.accel, dt);

    const speed = Math.hypot(this.vx, this.vy);
    this.speedNorm = clamp01(speed / PLAYER.sprintSpeed);
    this.moving = speed > 12;

    if (this.sprinting && this.moving) {
      this.stamina -= PLAYER.staminaDrain * dt;
      if (this.stamina <= 0) {
        this.stamina = 0;
        this.exhausted = true;
      }
    } else {
      const refill = this.sneaking ? PLAYER.staminaRecover * 1.6 : PLAYER.staminaRecover;
      this.stamina = Math.min(PLAYER.staminaMax, this.stamina + refill * dt);
      if (this.exhausted && this.stamina > 35) this.exhausted = false;
    }

    if (speed > 2) {
      this.facing = Math.atan2(this.vy, this.vx);
      const rate = this.sneaking ? 4.2 : this.sprinting ? 13 : 8.4;
      this.walkPhase += dt * rate;
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

    if (Math.abs(movedX) < Math.abs(this.vx * dt) * 0.4) this.vx *= 0.3;
    if (Math.abs(movedY) < Math.abs(this.vy * dt) * 0.4) this.vy *= 0.3;

    const moved = Math.hypot(movedX, movedY);
    if (moved > 0.08) {
      if (this.hurtTimer > 0) this.pose = 'HURT';
      else if (this.panic > 0.72 && this.sprinting) this.pose = 'PANIC';
      else if (this.sprinting) this.pose = 'SPRINT';
      else if (this.sneaking) this.pose = 'SNEAK';
      else this.pose = 'WALK';
      this.stepTimer += dt;
      const interval =
        this.sneaking
          ? PLAYER.stepInterval * 1.9
          : this.sprinting
            ? 0.22
            : PLAYER.stepInterval;
      if (this.stepTimer >= interval) {
        this.stepTimer = 0;
        onFootstep({
          x: this.x,
          y: this.y,
          level: this.sneaking
            ? PLAYER.sneakFootstepNoise
            : this.sprinting
              ? PLAYER.sprintFootstepNoise
              : PLAYER.footstepNoise,
        });
      }
    } else {
      this.pose = this.hurtTimer > 0 ? 'HURT' : 'IDLE';
      this.stepTimer = PLAYER.stepInterval * 0.6;
    }
  }

  /** Aim the flashlight at a world point (mouse position). */
  aimAt(wx: number, wy: number): void {
    this.aimX = wx;
    this.aimY = wy;
  }

  get aimAngle(): number {
    return Math.atan2(this.aimY - this.y, this.aimX - this.x);
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
