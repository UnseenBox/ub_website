import type { Chain } from '../core/types';
import type { Game } from '../core/Game';
import type { InputFrame } from '../input/InputManager';
import { angleDiff, clamp, lerp } from '../core/math';
import { Layer, RigidBody } from '../physics/RigidBody';
import { startChain } from '../gameplay/Chain';
import { RAGE_CHARGE, RAGE_SPEED, RAGE_THROW, absorbHit, consumePickup } from '../gameplay/Pickups';
import type { PhysicsObject } from './PhysicsObject';

export const PLAYER_RADIUS = 15;
const MOVE_SPEED = 252;
const DASH_SPEED = 640;
const DASH_TIME = 0.16;
const DASH_COOLDOWN = 0.65;
const GRAB_RANGE = 148;
const AUTO_GRAB_RANGE = 94;
const LOSE_GRIP_DISTANCE = 195;
export const FULL_CHARGE_SECONDS = 0.5;
const THROW_SPEED_MIN = 820;
const THROW_SPEED_MAX = 1520;
/** Mass at which throw speed is halved. */
const THROW_MASS_HALF = 16;
const SHOVE_IMPULSE = 17500;
const CARRY_HEIGHT = 14;

export class Player {
  readonly kind = 'player' as const;
  readonly uid = 1;
  readonly tags = new Set<string>(['player', 'creature', 'solid']);
  readonly label = 'YOU';
  readonly body: RigidBody;
  chain: Chain | null = null;
  chainAt = -999;

  hp = 5;
  readonly maxHp = 5;
  alive = true;

  aimX = 1;
  aimY = 0;
  cursorX = 0;
  cursorY = 0;

  held: PhysicsObject | null = null;
  hover: PhysicsObject | null = null;
  charging = false;
  chargeTime = 0;

  dashTime = 0;
  dashCooldown = 0;
  private dashX = 1;
  private dashY = 0;

  invulnerable = 0;
  /** Seconds of ghost-pepper rage left: faster, stronger, and walking into movers hurts them. */
  rage = 0;
  /** Hits the bubble wrap will still take. */
  armor = 0;
  slip = 0;
  slowTimer = 0;
  slowFactor = 1;
  hurtFlash = 0;
  /** Squash-and-stretch pop, same convention as enemies and objects: 0..1, decays. */
  squash = 0;
  walkPhase = 0;
  throwAnim = 0;
  /** True once the current throw has reached full charge. */
  fullyCharged = false;
  private chargeNotes = 0;
  private stepTimer = 0;

  constructor(x: number, y: number) {
    this.body = new RigidBody({
      shape: { kind: 'circle', r: PLAYER_RADIUS },
      x,
      y,
      mass: 55,
      friction: 0.1,
      restitution: 0,
      groundFriction: 0,
      linearDrag: 0,
      layer: Layer.Player,
      mask: Layer.Wall | Layer.Object | Layer.Enemy,
      fixedRotation: true,
      canSleep: false,
    });
    this.body.owner = this;
  }

  /** 0..1 throw charge. */
  get charge(): number {
    return this.charging ? clamp(this.chargeTime / FULL_CHARGE_SECONDS, 0, 1) : 0;
  }

  /** Launch speed for the held object at the current charge. Also used by the aim preview. */
  throwSpeed(object: PhysicsObject, charge: number): number {
    const speed = (lerp(THROW_SPEED_MIN, THROW_SPEED_MAX, charge) * THROW_MASS_HALF) / (THROW_MASS_HALF + object.body.mass);
    return this.rage > 0 ? speed * RAGE_THROW : speed;
  }

  update(game: Game, input: InputFrame, dt: number): void {
    const b = this.body;
    this.invulnerable -= dt;
    this.dashCooldown -= dt;
    this.slip -= dt;
    this.slowTimer -= dt;
    this.hurtFlash = Math.max(0, this.hurtFlash - dt * 3);
    this.squash = Math.max(0, this.squash - dt * 5);
    this.throwAnim = Math.max(0, this.throwAnim - dt * 5);

    if (!this.alive) {
      b.vx *= Math.exp(-6 * dt);
      b.vy *= Math.exp(-6 * dt);
      return;
    }

    this.cursorX = input.aimX;
    this.cursorY = input.aimY;
    const ax = input.aimX - b.x;
    const ay = input.aimY - b.y;
    const al = Math.hypot(ax, ay);
    if (al > 4) {
      this.aimX = ax / al;
      this.aimY = ay / al;
    }
    if (input.aimAssist && this.held) this.assistAim(game);

    let mx = input.moveX;
    let my = input.moveY;
    const ml = Math.hypot(mx, my);
    if (ml > 1) {
      mx /= ml;
      my /= ml;
    }

    let speed = MOVE_SPEED;
    if (this.rage > 0) speed *= RAGE_SPEED;
    const held = this.held;
    if (held) speed *= held.def.throwable ? 1 / (1 + held.body.mass / 55) : 0.5;
    if (this.charging) speed *= 0.85;
    if (this.slowTimer > 0) speed *= this.slowFactor;

    if (input.dodgePressed && this.dashCooldown <= 0) {
      this.dashX = ml > 0.1 ? mx : this.aimX;
      this.dashY = ml > 0.1 ? my : this.aimY;
      this.dashTime = DASH_TIME;
      this.dashCooldown = this.rage > 0 ? DASH_COOLDOWN * 0.5 : DASH_COOLDOWN;
      this.invulnerable = Math.max(this.invulnerable, 0.3);
      this.squash = 1;
      game.particles.burst('dust', b.x, b.y, 8, 90, { dirX: -this.dashX, dirY: -this.dashY, spread: 0.8 });
      game.fx.ring(b.x, b.y, 8, 40, 0.25, 'rgba(255,255,255,0.6)', 2);
      game.audio.play('dash', 0.5);
    }

    // Bought abilities: 1/2/3 on desktop, the POWER button on touch.
    if (input.abilitySlot !== 0) game.abilities.tryUse(input.abilitySlot);

    if (this.dashTime > 0) {
      this.dashTime -= dt;
      b.vx = this.dashX * DASH_SPEED;
      b.vy = this.dashY * DASH_SPEED;
    } else {
      // Low traction on wet floor: you keep sliding the way you were going.
      const k = Math.min(1, (this.slip > 0 ? 1.6 : 16) * dt);
      b.vx += (mx * speed - b.vx) * k;
      b.vy += (my * speed - b.vy) * k;
    }
    if (ml > 0.1) {
      this.walkPhase += dt * 11;
      // a puff of dust (or a splash) with every other step
      this.stepTimer -= dt;
      if (this.stepTimer <= 0 && this.dashTime <= 0) {
        this.stepTimer = 0.24;
        game.particles.burst(this.slip > 0 ? 'water' : 'dust', b.x - mx * 6, b.y + 5, this.slip > 0 ? 3 : 1, this.slip > 0 ? 90 : 26);
      }
    }

    if (held && !held.alive) this.release();

    if (!this.held) {
      this.hover = this.findHover(game, input.autoTarget);
      if (input.primaryPressed && this.hover) this.grab(game, this.hover);
    } else {
      this.hover = null;
      if (input.secondaryPressed) {
        this.release();
        game.audio.play('drop', 0.4);
      } else {
        if (input.primaryPressed) {
          this.charging = true;
          this.chargeTime = 0;
          this.fullyCharged = false;
          this.chargeNotes = 0;
          game.audio.chargeStart(FULL_CHARGE_SECONDS);
        }
        if (this.charging) {
          if (input.primaryDown) this.chargeTime += this.rage > 0 ? dt * RAGE_CHARGE : dt;
          // a rising note at each quarter of charge
          const due = Math.min(4, Math.floor((this.chargeTime / FULL_CHARGE_SECONDS) * 4) + 1);
          if (!this.fullyCharged && this.chargeNotes < due) game.audio.chargeStep(this.chargeNotes++);
          if (!this.fullyCharged && this.chargeTime >= FULL_CHARGE_SECONDS) {
            this.fullyCharged = true;
            game.audio.play('chargeFull', 1);
            game.fx.ring(b.x, b.y, 30, 12, 0.22, 'rgba(255,90,78,0.9)', 3);
          }
          if (this.fullyCharged && Math.random() < dt * 20) {
            game.particles.burst('spark', this.held.body.x, this.held.body.y - 14, 1, 90, { color: '#ff7a5c' });
          }
          if (input.primaryReleased || !input.primaryDown) this.throwHeld(game);
        }
      }
      if (this.held) this.carry(dt);
    }
  }

  /** Touch play: with the aim stick idle, face the nearest intruder so a quick tap throws at it. */
  private assistAim(game: Game): void {
    const b = this.body;
    let bestD = Infinity;
    for (const enemy of game.enemies) {
      if (enemy.defeated) continue;
      const dx = enemy.body.x + enemy.body.vx * 0.2 - b.x;
      const dy = enemy.body.y + enemy.body.vy * 0.2 - b.y;
      const d = Math.hypot(dx, dy);
      if (d < bestD && d > 1) {
        bestD = d;
        this.aimX = dx / d;
        this.aimY = dy / d;
      }
    }
  }

  private findHover(game: Game, auto: boolean): PhysicsObject | null {
    const b = this.body;
    let best: PhysicsObject | null = null;
    let bestScore = Infinity;
    for (const object of game.objects) {
      if (!object.alive || object.tipProgress >= 0 || object.def.fixed) continue;
      const ob = object.body;
      const toPlayer = Math.hypot(ob.x - b.x, ob.y - b.y);
      if (auto) {
        // No cursor: the nearest thing wins, with a nudge towards whatever you are facing.
        if (toPlayer > AUTO_GRAB_RANGE + ob.boundR) continue;
        const facing = toPlayer > 0.01 ? ((ob.x - b.x) * this.aimX + (ob.y - b.y) * this.aimY) / toPlayer : 0;
        const score = toPlayer - ob.boundR - facing * 26;
        if (score < bestScore) {
          bestScore = score;
          best = object;
        }
        continue;
      }
      if (toPlayer > GRAB_RANGE + ob.boundR) continue;
      const toCursor = Math.hypot(ob.x - this.cursorX, ob.y - ob.z - this.cursorY);
      if (toCursor < ob.boundR + 24) {
        if (toCursor < bestScore) {
          bestScore = toCursor;
          best = object;
        }
        continue;
      }
      // Fallback: something roughly in front of you, even if the cursor is not exactly on it.
      const reach = PLAYER_RADIUS + ob.boundR + 44;
      if (toPlayer < reach && toPlayer > 0.01) {
        const facing = ((ob.x - b.x) * this.aimX + (ob.y - b.y) * this.aimY) / toPlayer;
        if (facing > 0.1) {
          const score = 1000 + toPlayer;
          if (score < bestScore) {
            bestScore = score;
            best = object;
          }
        }
      }
    }
    return best;
  }

  private grab(game: Game, object: PhysicsObject): void {
    if (object.def.consume && consumePickup(game, object)) return;
    if (object.def.throwable) object.layDown();
    if (object.restingOn) object.leaveSurface();
    object.fellFrom = null;
    object.held = true;
    object.tags.add('held');
    object.squash = 0.6;
    object.body.wake();
    object.body.ignoreId = this.body.id;
    object.body.ignoreTimer = 9999;
    this.held = object;
    this.charging = false;
    this.squash = Math.max(this.squash, 0.4);
    game.audio.play('pickup', 0.6, 1.2 - Math.min(0.6, object.body.mass / 60));
    game.audio.impact(object.material.sound, 0.14, object.body.mass);
    game.fx.ring(object.body.x, object.body.y, object.body.boundR + 12, object.body.boundR, 0.18, 'rgba(255,255,255,0.8)', 2);
    game.particles.burst('spark', object.body.x, object.body.y - 10, 3, 130);
    game.bus.emit({ type: 'OBJECT_GRABBED', object });
  }

  /** Something flew back into an empty hand (a boomerang). */
  catchObject(game: Game, object: PhysicsObject): void {
    if (this.held || !this.alive || !object.alive) return;
    this.grab(game, object);
  }

  /** Lets go without throwing. The object keeps whatever momentum it had. */
  release(): void {
    const object = this.held;
    if (!object) return;
    object.held = false;
    object.tags.delete('held');
    object.body.ignoreTimer = 0.2;
    this.held = null;
    this.charging = false;
    this.chargeTime = 0;
  }

  private carry(dt: number): void {
    const object = this.held;
    if (!object) return;
    const b = this.body;
    const ob = object.body;
    const pullBack = this.charge * 10;
    const reach = PLAYER_RADIUS + ob.boundR * 0.75 + 8 - pullBack;
    const tx = b.x + this.aimX * reach;
    const ty = b.y + this.aimY * reach;
    const ex = tx - ob.x;
    const ey = ty - ob.y;
    if (Math.hypot(ex, ey) > LOSE_GRIP_DISTANCE) {
      this.release();
      return;
    }

    // Critically-damped style follow: stiff for a shoe, sluggish for a table.
    const stiffness = 22 / (1 + ob.mass / 22);
    let dvx = ex * stiffness + b.vx;
    let dvy = ey * stiffness + b.vy;
    const dl = Math.hypot(dvx, dvy);
    if (dl > 900) {
      dvx = (dvx / dl) * 900;
      dvy = (dvy / dl) * 900;
    }
    const blend = Math.min(1, 50 * dt);
    ob.vx += (dvx - ob.vx) * blend;
    ob.vy += (dvy - ob.vy) * blend;
    // Lifted off the floor while carried: reads as "held" and clears table tops.
    ob.z += (CARRY_HEIGHT - ob.z) * Math.min(1, 14 * dt);
    ob.vz = 0;
    ob.wake();

    if (object.def.throwable && ob.shape.kind === 'box') {
      ob.w = angleDiff(ob.angle, Math.atan2(this.aimY, this.aimX)) * 12;
    } else if (object.def.throwable) {
      ob.w *= 0.9;
    }
  }

  private throwHeld(game: Game): void {
    const object = this.held;
    if (!object) return;
    const charge = clamp(this.chargeTime / FULL_CHARGE_SECONDS, 0, 1);
    const b = this.body;
    const ob = object.body;
    this.release();
    this.throwAnim = 1;
    this.squash = Math.max(this.squash, 0.5 + charge * 0.5);

    if (object.def.throwable) {
      const speed = this.throwSpeed(object, charge);
      ob.vx = this.aimX * speed + b.vx * 0.5;
      ob.vy = this.aimY * speed + b.vy * 0.5;
      ob.z = Math.max(ob.z, 10);
      ob.vz = 110 + 210 * charge;
      ob.w = (game.rng.sign() * (7 + 14 * charge)) / (1 + ob.mass / 7);
      ob.ignoreId = b.id;
      ob.ignoreTimer = 0.25;
      b.vx -= this.aimX * 30 * charge;
      b.vy -= this.aimY * 30 * charge;
    } else {
      // Too heavy to throw: put your shoulder into it instead.
      const impulse = SHOVE_IMPULSE * (0.35 + 0.65 * charge);
      ob.applyImpulse(this.aimX * impulse, this.aimY * impulse);
      ob.ignoreTimer = 0.15;
    }

    object.onThrown(game);
    object.chain = startChain(game.time, object.uid, object.label);
    object.chainAt = game.time;
    object.squash = 0.8;

    game.camera.kick(-this.aimX * (2 + charge * 4), -this.aimY * (2 + charge * 4));
    game.audio.play('throw', 0.4 + charge * 0.6, 1.3 - Math.min(0.7, ob.mass / 30));
    // Ridiculous projectiles get a slide whistle; heavy ones get a grunt.
    if (object.def.funny && charge > 0.3) game.audio.play('whistle', charge);
    if (ob.mass >= 8 && charge > 0.4) game.audio.voice('hup', 230);
    game.fx.ring(b.x, b.y, 10, 26 + charge * 30, 0.22, 'rgba(255,255,255,0.7)', 2 + charge * 2);
    // Back-blast of dust plus white-hot streaks off the release point; a full
    // charge earns a second, hotter ring and a pop of stars.
    game.particles.burst('dust', b.x, b.y + 4, 3 + Math.floor(charge * 5), 70, { dirX: -this.aimX, dirY: -this.aimY, spread: 0.9 });
    game.particles.burst('spark', ob.x, ob.y - 8, 2 + Math.floor(charge * 6), 240 + charge * 340, {
      dirX: this.aimX, dirY: this.aimY, spread: 0.32, color: '#ffffff',
    });
    game.particles.burst('dust', ob.x, ob.y, 2 + Math.floor(charge * 3), 60 + charge * 60, {
      dirX: this.aimX, dirY: this.aimY, spread: 1.1,
    });
    if (charge >= 1) {
      game.fx.ring(b.x, b.y, 20, 52 + charge * 30, 0.3, 'rgba(255,210,63,0.9)', 3);
      game.particles.burst('star', ob.x, ob.y - 12, 6, 220);
    }
    game.bus.emit({ type: 'OBJECT_THROWN', object, charge });
  }

  hurt(game: Game, amount: number, cause: string): boolean {
    if (!this.alive || this.invulnerable > 0 || this.dashTime > 0) return false;
    if (absorbHit(game)) return false;
    this.hp -= amount;
    this.invulnerable = 1.1;
    this.hurtFlash = 1;
    this.squash = 1;
    game.camera.addShake(0.45);
    game.audio.play('hurt', 1);
    game.audio.voice('ow', 300);
    game.impactSpark(this.body.x, this.body.y - 10, 0.55);
    game.fx.burst('OW!', this.body.x, this.body.y - 58, 0.9, '#ff5a4e', true);
    game.hitStop(0.07);
    game.bus.emit({ type: 'PLAYER_HIT', cause });
    if (this.hp <= 0) {
      this.hp = 0;
      this.alive = false;
      this.release();
      game.bus.emit({ type: 'PLAYER_DEFEATED' });
    }
    return true;
  }

  revive(): void {
    this.hp = this.maxHp;
    this.alive = true;
    this.invulnerable = 2;
  }
}
