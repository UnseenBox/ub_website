import { PLAYER } from '../core/Tuning';
import { approach, clamp01, type Rect } from '../core/Mathx';
import type { ActionState } from '../input/InputManager';
import { moveBody, type Body } from '../world/Collision';

export type PlayerPose =
  | 'IDLE'
  | 'WALK'
  | 'SPRINT'
  | 'SNEAK'
  | 'CROUCH'
  | 'JUMP'
  | 'FALL'
  | 'HIDE'
  | 'PANIC'
  | 'DEAD'
  | 'ESCAPED'
  | 'HURT';

export interface PlayerFootstep {
  x: number;
  y: number;
  level: number;
}

/**
 * THE BODY — side-view survivor.
 *
 * Monsters hunt THIS: your horizontal position, your noise, your light.
 * Gravity pulls you down. Platforms hold you up. Sprint is loud, sneak is quiet.
 * Health gives 3 hits so a chase is a scare, not an instant game over.
 */
export class Player {
  x = 0;
  y = 0;
  vx = 0;
  vy = 0;
  readonly radius = PLAYER.radius;

  facing = 1; // 1 = right, -1 = left
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
  /** True while standing on solid ground. */
  grounded = false;
  /** Coyote time: brief window after leaving ground where jump still works. */
  coyoteTimer = 0;
  /** Jump buffer: input pressed slightly before landing. */
  jumpBuffer = 0;

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
  private wasGrounded = false;
  private readonly body: Body = { x: 0, y: 0, radius: PLAYER.radius };

  /** Audio manager reference for jump/land sounds. */
  audio: { playAt: (name: string, x: number, opts: { gain: number }) => void } | null = null;

  reset(x: number, y: number): void {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.facing = 1;
    this.aimX = x + 60;
    this.aimY = y;
    this.flashlightOn = true;
    this.pose = 'IDLE';
    this.sneaking = false;
    this.sprinting = false;
    this.exhausted = false;
    this.moving = false;
    this.speedNorm = 0;
    this.grounded = false;
    this.coyoteTimer = 0;
    this.jumpBuffer = 0;
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
      this.grounded = true;
      this.coyoteTimer = 0.1;
      this.stamina = Math.min(PLAYER.staminaMax, this.stamina + PLAYER.staminaRecover * dt);
      return;
    }

    if (actions.flashlight) this.flashlightOn = !this.flashlightOn;

    const wantSneak = actions.sneak;
    const wantJump = actions.jump;
    const wantSprint =
      actions.sprint && !wantSneak && (actions.moveX !== 0) && !this.exhausted;

    this.sneaking = wantSneak;
    this.sprinting = wantSprint;

    // Coyote time & jump buffer
    this.coyoteTimer = this.grounded ? 0.12 : Math.max(0, this.coyoteTimer - dt);
    this.jumpBuffer = wantJump ? 0.12 : Math.max(0, this.jumpBuffer - dt);

    // Jump: ground or coyote time + buffer
    if (this.jumpBuffer > 0 && this.coyoteTimer > 0 && this.vy >= 0) {
      this.vy = PLAYER.jumpSpeed;
      this.grounded = false;
      this.coyoteTimer = 0;
      this.jumpBuffer = 0;
      onFootstep({ x: this.x, y: this.y + this.radius, level: 1.2 });
      this.audio?.playAt?.('jump', this.x, { gain: 0.15 });
    }

    // Horizontal movement
    let target = PLAYER.walkSpeed as number;
    if (this.sneaking) target = PLAYER.sneakSpeed as number;
    else if (this.sprinting) target = PLAYER.sprintSpeed as number;

    if (this.exhausted) target *= PLAYER.exhaustedSlow as number;

    const accel = this.grounded ? PLAYER.accel : PLAYER.airAccel;
    const desiredX = actions.moveX * target;

    this.vx = approach(this.vx, desiredX, accel, dt);

    // Gravity
    if (!this.grounded) {
      this.vy = Math.min(PLAYER.maxFallSpeed, this.vy + PLAYER.gravity * dt);
    } else {
      this.vy = 0;
    }

    // Stamina
    const speed = Math.abs(this.vx);
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

    // Facing direction
    if (this.vx > 2) this.facing = 1;
    else if (this.vx < -2) this.facing = -1;

    // Animation
    if (this.hurtTimer > 0) {
      this.pose = 'HURT';
    } else if (!this.grounded) {
      this.pose = this.vy < 0 ? 'JUMP' : 'FALL';
    } else if (this.sneaking) {
      this.pose = this.moving ? 'SNEAK' : 'CROUCH';
    } else if (this.sprinting) {
      this.pose = 'SPRINT';
    } else if (this.moving) {
      this.pose = 'WALK';
    } else {
      this.pose = 'IDLE';
    }

    if (this.moving && this.grounded) {
      this.walkPhase += dt * (this.sneaking ? 4.2 : this.sprinting ? 14 : 8.4);
    } else {
      this.walkPhase = approach(this.walkPhase, 0, 6, dt);
    }

    // Step sounds
    if (this.moving && this.grounded) {
      this.stepTimer += dt;
      const interval =
        this.sneaking
          ? PLAYER.stepInterval * 1.9
          : this.sprinting
            ? 0.18
            : PLAYER.stepInterval;
      if (this.stepTimer >= interval) {
        this.stepTimer = 0;
        onFootstep({
          x: this.x,
          y: this.y + this.radius,
          level: this.sneaking
            ? PLAYER.sneakFootstepNoise
            : this.sprinting
              ? PLAYER.sprintFootstepNoise
              : PLAYER.footstepNoise,
        });
      }
    } else {
      this.stepTimer = PLAYER.stepInterval * 0.6;
    }

    // Physics move
    this.body.x = this.x;
    this.body.y = this.y;
    this.grounded = false;

    // X move
    moveBody(this.body, this.vx * dt, 0, solids);
    const movedX = this.body.x - this.x;
    this.x = this.body.x;

    // Y move
    moveBody(this.body, 0, this.vy * dt, solids);
    const movedY = this.body.y - this.y;
    this.y = this.body.y;

    // Ground detection: if we moved down and hit something, we're grounded
    if (this.vy >= 0 && movedY < this.vy * dt * 0.5) {
      this.grounded = true;
      this.vy = 0;
      if (!this.wasGrounded) {
        this.audio?.playAt?.('land', this.x, { gain: 0.12 });
      }
    }
    this.wasGrounded = this.grounded;

    // Wall slide friction
    if (Math.abs(movedX) < Math.abs(this.vx * dt) * 0.4) this.vx *= 0.3;
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