import { newUid, type Chain, type DamageCause, type Thing } from '../core/types';
import type { Game } from '../core/Game';
import { angleDiff, clamp } from '../core/math';
import { Layer, RigidBody } from '../physics/RigidBody';
import type { Zone } from '../hazards/Zone';
import { extendChain } from '../gameplay/Chain';
import type { EnemyType } from './EnemyTypes';
import type { PhysicsObject } from './PhysicsObject';

type AiState = 'entering' | 'idle' | 'investigate' | 'chase' | 'windup' | 'lunge' | 'recover';

const WINDUP_TIME = 0.42;
const LUNGE_TIME = 0.18;
const LUNGE_SPEED = 430;
const RECOVER_TIME = 0.65;
const BURN_TICK = 0.4;
const BURN_DAMAGE = 7;

const scratch = { x: 0, y: 0 };

export class Enemy {
  readonly kind = 'enemy' as const;
  readonly uid = newUid();
  readonly tags = new Set<string>(['enemy', 'creature', 'solid']);
  readonly label: string;
  readonly body: RigidBody;
  readonly seed = Math.random() * 100;

  hp: number;
  /** False once the body has been removed from the room. */
  alive = true;
  /** True from the killing blow onwards; the body keeps tumbling for a moment. */
  defeated = false;
  removeIn = 0;

  chain: Chain | null = null;
  chainAt = -999;

  ai: AiState = 'entering';
  aiTimer = 0.6;
  aware = false;
  facing = Math.PI;
  private targetX = 0;
  private targetY = 0;
  private lungeLanded = false;
  private lungeX = 0;
  private lungeY = 0;

  stun = 0;
  shockTimer = 0;
  private shockCooldown = 0;
  burn = 0;
  private burnTick = 0;
  slip = 0;
  slowTimer = 0;
  slowFactor = 1;
  confuse = 0;
  private panicX = 1;
  private panicY = 0;
  private panicTimer = 0;

  helmetHp: number;
  fireZone: Zone | null = null;

  hitFlash = 0;
  squash = 0;
  walkPhase = 0;
  spin = 0;
  blockFlash = 0;
  /** Seconds left of flailing after slipping on something. */
  tumble = 0;
  private tripCooldown = 0;
  /** Seconds something stays stuck to its face or over its head. */
  plunged = 0;
  /** Object id of whatever that is: a plunger, a bin, a bucket, a teddy bear. */
  wearing = 'plunger';
  /** Distracted by a decoy rather than merely curious. */
  lured = false;

  constructor(readonly type: EnemyType, x: number, y: number, entryDirX: number, entryDirY: number) {
    this.label = type.name.toUpperCase();
    this.hp = type.hp;
    this.helmetHp = type.helmetHp ?? 0;
    this.tags.add(type.id);
    if (type.shockImmune) this.tags.add('shock_immune');
    if (type.electric) this.tags.add('electric_enemy');
    this.body = new RigidBody({
      shape: { kind: 'circle', r: type.radius },
      x,
      y,
      mass: type.mass,
      friction: 0.2,
      restitution: 0.15,
      groundFriction: 0,
      linearDrag: 0,
      layer: Layer.Enemy,
      mask: Layer.Wall | Layer.Object | Layer.Player | Layer.Enemy,
      fixedRotation: true,
      canSleep: false,
    });
    this.body.owner = this;
    this.targetX = entryDirX;
    this.targetY = entryDirY;
    this.facing = Math.atan2(entryDirY, entryDirX);
  }

  get windupProgress(): number {
    return this.ai === 'windup' ? 1 - this.aiTimer / (this.type.windup ?? WINDUP_TIME) : 0;
  }

  update(game: Game, dt: number): void {
    const b = this.body;
    this.hitFlash = Math.max(0, this.hitFlash - dt * 5);
    this.squash = Math.max(0, this.squash - dt * 4);
    this.blockFlash = Math.max(0, this.blockFlash - dt * 4);
    this.shockCooldown -= dt;
    this.slip -= dt;
    this.slowTimer -= dt;
    this.confuse -= dt;
    this.tumble -= dt;
    this.tripCooldown -= dt;
    if (this.plunged > 0) {
      this.plunged -= dt;
      if (this.plunged <= 0 || this.defeated) this.dropPlunger(game);
    }

    if (this.defeated) {
      this.removeIn -= dt;
      this.spin += dt * (6 + b.speed() * 0.03);
      this.decelerate(520, dt);
      if (this.removeIn <= 0) {
        this.alive = false;
        game.particles.burst('star', b.x, b.y, 8, 160);
        game.particles.burst('smoke', b.x, b.y - 6, 5, 70);
        game.particles.burst('peanut', b.x, b.y - 10, 18, 230);
        game.particles.burst('scrap', b.x, b.y - 10, 6, 180, { color: '#c9a070' });
        game.fx.ring(b.x, b.y, 6, 44, 0.3, 'rgba(255,255,255,0.8)', 3);
        game.audio.play('poof', 0.7);
      }
      return;
    }

    if (this.burn > 0) this.updateBurn(game, dt);
    if (this.defeated) return;

    if (this.shockTimer > 0) {
      this.shockTimer -= dt;
      this.decelerate(900, dt);
      if (Math.random() < dt * 30) game.particles.burst('spark', b.x, b.y - 10, 1, 160);
      return;
    }
    if (this.stun > 0) {
      this.stun -= dt;
      // skidding backwards kicks up dust
      if (b.speed() > 150 && Math.random() < dt * 26) game.particles.burst('dust', b.x, b.y + 4, 1, 40);
      this.decelerate(this.slip > 0 ? 160 : 560, dt);
      return;
    }

    const player = game.player;
    const dx = player.body.x - b.x;
    const dy = player.body.y - b.y;
    const dist = Math.hypot(dx, dy) || 1;
    let speed = this.type.speed * (this.slowTimer > 0 ? this.slowFactor : 1);

    if (this.burn > 0) {
      // On fire: forget the plan, run around.
      this.panicTimer -= dt;
      if (this.panicTimer <= 0) {
        const a = game.rng.range(0, Math.PI * 2);
        this.panicX = Math.cos(a);
        this.panicY = Math.sin(a);
        this.panicTimer = game.rng.range(0.25, 0.55);
      }
      this.steer(this.panicX, this.panicY, speed * 1.7, dt);
      this.turnTowards(Math.atan2(this.panicY, this.panicX), dt);
      this.walkPhase += dt * 18;
      return;
    }

    this.aiTimer -= dt;
    switch (this.ai) {
      case 'entering':
        this.steer(this.targetX, this.targetY, speed, dt);
        this.walkPhase += dt * 10;
        if (this.aiTimer <= 0) {
          // They broke in looking for you: no need to spot the player first.
          this.aware = true;
          this.setState('idle', this.type.reaction);
        }
        break;

      case 'idle':
        this.steer(0, 0, 0, dt);
        if (dist < this.type.awareness || this.aware) {
          this.aware = true;
          if (this.aiTimer <= 0) this.setState('chase', 0);
        }
        break;

      case 'investigate': {
        const tx = this.targetX - b.x;
        const ty = this.targetY - b.y;
        const td = Math.hypot(tx, ty) || 1;
        this.steer(tx / td, ty / td, speed * 0.8, dt);
        this.turnTowards(Math.atan2(ty, tx), dt);
        this.walkPhase += dt * 9;
        if (td < 30 || this.aiTimer <= 0 || (!this.lured && dist < this.type.awareness)) {
          this.aware = true;
          this.lured = false;
          this.setState('chase', 0);
        }
        break;
      }

      case 'chase': {
        if (!player.alive) {
          this.steer(0, 0, 0, dt);
          break;
        }
        let mx: number;
        let my: number;
        if (this.confuse > 0) {
          mx = Math.cos(this.seed + game.time * 3);
          my = Math.sin(this.seed * 2 + game.time * 2.3);
        } else if (dist < 90 || !game.nav.direction(b.x, b.y, scratch)) {
          mx = dx / dist;
          my = dy / dist;
        } else {
          mx = scratch.x;
          my = scratch.y;
        }
        if (this.type.weave && dist > 70) {
          const wave = Math.sin(game.time * 5 + this.seed) * 0.7;
          mx += -my * wave;
          my += mx * wave;
        }
        // Keep a little personal space so a pack does not collapse into one blob.
        for (const other of game.enemies) {
          if (other === this || other.defeated) continue;
          const ox = b.x - other.body.x;
          const oy = b.y - other.body.y;
          const od = Math.hypot(ox, oy);
          const reach = (this.type.radius + other.type.radius) * 1.5;
          if (od > 0.01 && od < reach) {
            const push = (1 - od / reach) * 0.9;
            mx += (ox / od) * push;
            my += (oy / od) * push;
          }
        }
        const ml = Math.hypot(mx, my) || 1;
        this.steer(mx / ml, my / ml, speed, dt);
        this.turnTowards(Math.atan2(dy, dx), dt);
        this.walkPhase += dt * (6 + speed * 0.06);
        if (dist < this.type.radius + player.body.boundR + (this.type.lungeRange ?? 14) && this.confuse <= 0) {
          this.setState('windup', this.type.windup ?? WINDUP_TIME);
        }
        break;
      }

      case 'windup':
        this.steer(0, 0, 0, dt);
        this.turnTowards(Math.atan2(dy, dx), dt);
        if (this.aiTimer <= 0) {
          this.lungeX = Math.cos(this.facing);
          this.lungeY = Math.sin(this.facing);
          this.lungeLanded = false;
          this.setState('lunge', this.type.lungeTime ?? LUNGE_TIME);
          game.audio.play('swipe', 0.5);
          game.audio.voice('attack', this.type.voice);
        }
        break;

      case 'lunge':
        b.vx = this.lungeX * (this.type.lungeSpeed ?? LUNGE_SPEED);
        b.vy = this.lungeY * (this.type.lungeSpeed ?? LUNGE_SPEED);
        if (this.type.lungeSpeed && Math.random() < dt * 40) game.particles.burst('dust', b.x - this.lungeX * 14, b.y + 6, 1, 60);
        if (!this.lungeLanded && dist < this.type.radius + player.body.boundR + 7) {
          this.lungeLanded = true;
          const guard = player.held;
          if (guard && guard.tags.has('guard') && player.aimX * -this.lungeX + player.aimY * -this.lungeY > 0.3) {
            // Lunged straight into a raised frying pan.
            this.stun = Math.max(this.stun, 1.2 * this.type.staggerFactor + 0.3);
            this.squash = 1;
            b.vx = -this.lungeX * 360 * this.type.staggerFactor;
            b.vy = -this.lungeY * 360 * this.type.staggerFactor;
            guard.squash = 1;
            this.setState('recover', 0.5);
            game.audio.play('gong', 1, 1.1);
            game.fx.burst('PARRY!', b.x - this.lungeX * 10, b.y - 44, 1.05, '#cfd8ea', true);
            game.particles.burst('spark', guard.body.x, guard.body.y - 14, 10, 260);
            game.camera.addShake(0.3);
            game.hitStop(0.06);
            game.discoveries.unlock('parry');
            game.bus.emit({ type: 'ENEMY_STUNNED', enemy: this });
            break;
          }
          if (player.hurt(game, 1, this.type.name)) {
            player.body.applyImpulse(this.lungeX * 260 * player.body.mass, this.lungeY * 260 * player.body.mass);
          }
        }
        if (this.aiTimer <= 0) this.setState('recover', this.type.recover ?? RECOVER_TIME);
        break;

      case 'recover':
        this.steer(0, 0, 0, dt);
        if (this.aiTimer <= 0) this.setState('chase', 0);
        break;
    }
  }

  private setState(state: AiState, timer: number): void {
    this.ai = state;
    this.aiTimer = timer;
  }

  private steer(dirX: number, dirY: number, speed: number, dt: number): void {
    const k = Math.min(1, (this.slip > 0 ? 1.3 : 9) * dt);
    this.body.vx += (dirX * speed - this.body.vx) * k;
    this.body.vy += (dirY * speed - this.body.vy) * k;
  }

  private decelerate(amount: number, dt: number): void {
    const b = this.body;
    const speed = b.speed();
    if (speed <= 0) return;
    const next = Math.max(0, speed - amount * dt) / speed;
    b.vx *= next;
    b.vy *= next;
  }

  private turnTowards(angle: number, dt: number): void {
    const diff = angleDiff(this.facing, angle);
    const step = this.type.turnRate * dt;
    this.facing += clamp(diff, -step, step);
  }

  private updateBurn(game: Game, dt: number): void {
    this.burn -= dt;
    this.burnTick -= dt;
    if (this.burnTick <= 0) {
      this.burnTick = BURN_TICK;
      const zone = this.fireZone;
      this.damage(game, BURN_DAMAGE * this.type.burnFactor, {
        type: 'fire',
        source: zone,
        chain: zone?.chain ?? null,
        label: 'FIRE',
        dirX: 0,
        dirY: 0,
      });
    }
    if (this.burn <= 0) this.extinguish();
  }

  /** Something loud happened; unaware intruders walk over to look. */
  hearNoise(x: number, y: number): void {
    if (this.defeated || this.aware || this.ai !== 'idle') return;
    this.targetX = x;
    this.targetY = y;
    this.setState('investigate', 2.5);
  }

  /** A decoy (a ringing alarm clock) pulls a mover away from the player for a few seconds. */
  lure(x: number, y: number, seconds: number): boolean {
    if (this.defeated || this.stun > 0 || this.shockTimer > 0 || this.burn > 0) return false;
    if (this.ai === 'entering' || this.ai === 'windup' || this.ai === 'lunge') return false;
    this.targetX = x;
    this.targetY = y;
    this.lured = true;
    this.setState('investigate', seconds);
    return true;
  }

  /** Feet go out from under it: a helpless slide in whatever direction it was heading. */
  trip(game: Game, cause: DamageCause): boolean {
    if (this.defeated || this.tripCooldown > 0) return false;
    const b = this.body;
    this.tripCooldown = 1.8;
    this.tumble = 1;
    this.stun = Math.max(this.stun, 1 * this.type.staggerFactor + 0.35);
    this.slip = 1.3;
    const speed = b.speed();
    const dx = speed > 20 ? b.vx / speed : Math.cos(this.facing);
    const dy = speed > 20 ? b.vy / speed : Math.sin(this.facing);
    const slide = Math.max(speed * 1.9, 360);
    b.vx = dx * slide;
    b.vy = dy * slide;
    this.squash = 1;
    if (this.ai === 'windup' || this.ai === 'lunge') this.setState('recover', 0.4);
    game.audio.play('slide', 1, 0.8 + this.type.voice / 400);
    game.fx.burst('WHOOPS!', b.x, b.y - 40, 0.95, '#ffe36e');
    game.particles.burst('dust', b.x, b.y + 4, 6, 110, { dirX: -dx, dirY: -dy, spread: 0.8 });
    game.bus.emit({ type: 'ENEMY_STUNNED', enemy: this });
    this.damage(game, 5, cause);
    return true;
  }

  private dropPlunger(game: Game): void {
    this.plunged = 0;
    const plunger = game.spawnObject(this.wearing, this.body.x + Math.cos(this.facing) * 12, this.body.y + Math.sin(this.facing) * 12);
    if (!plunger) return;
    // A bucket comes off empty.
    plunger.tags.delete('full');
    plunger.body.vx = Math.cos(this.facing) * 150;
    plunger.body.vy = Math.sin(this.facing) * 150;
    plunger.body.z = 12;
    plunger.body.vz = 120;
    plunger.body.ignoreId = this.body.id;
    plunger.body.ignoreTimer = 0.4;
    game.audio.play('pickup', 0.8, 0.6);
  }

  /**
   * Damage from a physical hit. `dirX/dirY` is the direction the blow travels (into the enemy).
   * Returns the damage actually dealt after shields, helmets and resistances.
   */
  takeImpact(game: Game, impulse: number, source: Thing, dirX: number, dirY: number, scale: number, chain: Chain | null): number {
    if (this.defeated) return 0;
    const b = this.body;
    let damage = impulse * scale * this.type.impactFactor;
    let label = source.label;
    if (source.kind === 'object') {
      damage *= source.material.hardness;
      if (source.def.mass < 3) damage *= this.type.lightObjectFactor;
      // A hit that connected is never a rounding error: even a tossed shoe chips
      // and staggers, so light taps read as "weak but real" instead of "broken".
      damage = Math.max(damage, 6);
      label = source.label;
    }

    if (this.type.shield) {
      const facingDot = Math.cos(this.facing) * -dirX + Math.sin(this.facing) * -dirY;
      if (facingDot > 0.3) {
        this.blockFlash = 1;
        game.particles.burst('spark', b.x + Math.cos(this.facing) * 16, b.y + Math.sin(this.facing) * 16, 8, 240);
        game.audio.impact('metal', 0.8, 3);
        game.fx.burst('CLANG!', b.x + Math.cos(this.facing) * 22, b.y - 30, 0.9, '#cfd8ea');
        game.discoveries.unlock('clang');
        this.aware = true;
        return 0;
      }
      damage *= 1.5;
      game.discoveries.unlock('backstab');
    }

    if (this.helmetHp > 0) {
      this.helmetHp -= damage;
      damage *= 0.3;
      game.audio.impact('metal', 0.7, 2);
      if (this.helmetHp <= 0) {
        this.loseHelmet(game, dirX, dirY);
        game.discoveries.unlock('hats_off');
      }
    }

    const stagger = clamp(impulse / 4200, 0.45, 1.5) * this.type.staggerFactor;
    this.stun = Math.max(this.stun, stagger);
    const kick = Math.min(impulse * b.invMass * 2.1 * this.type.staggerFactor, 850);
    b.vx += dirX * kick;
    b.vy += dirY * kick;
    this.squash = 1;
    if (this.ai === 'windup' || this.ai === 'lunge') this.setState('recover', 0.4);

    this.damage(game, damage, { type: 'impact', source, chain, label, dirX, dirY });
    return damage;
  }

  /** The saucepan comes off and flies away in the given direction. Returns the pan. */
  loseHelmet(game: Game, dirX: number, dirY: number): PhysicsObject | null {
    if (!this.tags.has('helmet')) return null;
    const b = this.body;
    this.helmetHp = 0;
    this.tags.delete('helmet');
    const helmet = game.spawnObject('helmet', b.x, b.y - 4);
    if (helmet) {
      helmet.body.vx = dirX * 320 + game.rng.range(-80, 80);
      helmet.body.vy = dirY * 320 + game.rng.range(-80, 80);
      helmet.body.vz = 260;
      helmet.body.z = 14;
      helmet.body.ignoreId = b.id;
      helmet.body.ignoreTimer = 0.3;
    }
    game.popup('HATS OFF', b.x, b.y - 34, '#ffd23f', 18);
    return helmet;
  }

  damage(game: Game, amount: number, cause: DamageCause): void {
    if (this.defeated || amount <= 0) return;
    this.hp -= amount;
    this.hitFlash = 1;
    this.aware = true;
    if (this.ai === 'idle' || this.ai === 'investigate') {
      this.lured = false;
      this.setState('chase', 0);
    }
    game.bus.emit({ type: 'ENEMY_HIT', enemy: this, damage: amount, cause });
    if (this.hp <= 0) this.defeat(game, cause);
  }

  shock(game: Game, amount: number, stunSeconds: number, cause: DamageCause): boolean {
    if (this.defeated || this.type.shockImmune || this.shockCooldown > 0) return false;
    this.shockCooldown = 0.8;
    this.shockTimer = stunSeconds;
    game.particles.burst('spark', this.body.x, this.body.y - 8, 14, 260);
    game.fx.ring(this.body.x, this.body.y, 8, 52, 0.3, 'rgba(255,242,122,0.9)', 3);
    game.audio.play('zap', 1);
    game.bus.emit({ type: 'ELECTRICITY_CONTACT', target: this });
    game.bus.emit({ type: 'ENEMY_STUNNED', enemy: this });
    this.damage(game, amount, cause);
    return true;
  }

  igniteFor(game: Game, seconds: number, chain: Chain | null): boolean {
    if (this.defeated) return false;
    if (this.burn > 0) {
      this.burn = Math.max(this.burn, seconds * 0.5);
      return false;
    }
    this.burn = seconds;
    this.burnTick = 0.15;
    if (chain) {
      this.chain = chain;
      this.chainAt = game.time;
    }
    this.fireZone = game.zones.spawn(game, 'fire', this.body.x, this.body.y, this.type.radius + 6, {
      attached: this,
      ttl: seconds,
      chain: chain ? extendChain(chain, 'FIRE') : null,
    });
    game.bus.emit({ type: 'FIRE_CONTACT', target: this });
    game.audio.play('ignite', 0.7);
    game.audio.voice('panic', this.type.voice);
    game.fx.burst('FWOOSH!', this.body.x, this.body.y - 34, 0.95, '#ff9f1c');
    return true;
  }

  extinguish(): void {
    this.burn = 0;
    if (this.fireZone) {
      this.fireZone.alive = false;
      this.fireZone = null;
    }
  }

  private defeat(game: Game, cause: DamageCause): void {
    if (this.defeated) return;
    this.defeated = true;
    this.removeIn = 1.35;
    this.hp = 0;
    this.tags.delete('enemy');
    this.tags.delete('creature');
    this.tags.add('corpse');
    this.extinguish();
    if (this.plunged > 0) this.dropPlunger(game);
    const b = this.body;
    b.mask &= ~Layer.Player;
    b.vx += cause.dirX * 330;
    b.vy += cause.dirY * 330;
    if (cause.chain) cause.chain.root.kills++;
    game.bus.emit({ type: 'ENEMY_DEFEATED', enemy: this, cause });
    this.leaveBehind(game, cause);
  }

  /** Some movers are carrying something that matters once the box gives way. */
  private leaveBehind(game: Game, cause: DamageCause): void {
    const b = this.body;
    switch (this.type.onDefeat) {
      case 'glass':
        game.zones.spawn(game, 'glass', b.x, b.y, 46, { ttl: 16, chain: cause.chain ? extendChain(cause.chain, 'BROKEN GLASS') : null });
        game.particles.burst('shard', b.x, b.y - 14, 24, 320);
        game.audio.play('glassBreak', 1);
        game.fx.burst('SMASH!', b.x, b.y - 46, 1.05, '#d9fbf0');
        game.discoveries.unlock('handle_with_care');
        break;
      case 'split':
        for (const side of [-1, 1]) {
          const px = -cause.dirY * side || side;
          const py = cause.dirX * side;
          const child = game.spawnEnemy('mini', b.x + px * 12, b.y + py * 12, px, py);
          child.body.vx = px * 260 + cause.dirX * 120;
          child.body.vy = py * 260 + cause.dirY * 120;
          child.squash = 1;
        }
        game.particles.burst('peanut', b.x, b.y - 14, 14, 260);
        game.fx.burst('POP!', b.x, b.y - 48, 1, '#ffd23f');
        game.audio.play('poof', 1);
        game.discoveries.unlock('russian_doll');
        break;
      case 'explode':
        game.explode(b.x, b.y, 128, 46, 1, cause.chain ? extendChain(cause.chain, this.label) : null, this, 'sparkle');
        game.discoveries.unlock('special_delivery');
        break;
    }
  }
}
