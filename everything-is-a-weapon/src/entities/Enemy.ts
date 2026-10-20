import { newUid, type Chain, type DamageCause, type Thing } from '../core/types';
import type { Game } from '../core/Game';
import { angleDiff, clamp } from '../core/math';
import { Layer, RigidBody } from '../physics/RigidBody';
import type { Zone } from '../hazards/Zone';
import { extendChain, startChain } from '../gameplay/Chain';
import type { EnemyType } from './EnemyTypes';
import type { PhysicsObject } from './PhysicsObject';

type AiState = 'entering' | 'idle' | 'investigate' | 'chase' | 'windup' | 'lunge' | 'recover' | 'hurl' | 'slam' | 'lash';

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
  /** Campaign Headliner or Depths Enforcer tag; null for a regular. */
  incident: 'headliner' | 'enforcer' | null = null;
  /** Boss phase already crossed (indexes into type.phases). */
  phaseIndex = 0;
  /** Speed multiplier from crossed phases. */
  rageMult = 1;
  /** Furniture-throw attack state (the Chucker). */
  hurlCooldown = 2;
  hurlT = -1;
  hurled: PhysicsObject | null = null;
  /** Ground-slam attack state (the Sofa King, the Landlord). */
  slamCooldown = 3;
  /** Vacuum appetite state (the Hoover): cycles between sucking and resting. */
  suckTimer = 1.5;
  sucking = false;
  private suckSoundT = 0;
  /** Tentacle-lash attack state (the Sofa Kraken). */
  lashCooldown = 3;
  /** Sidestep timer (MOM). */
  dodgeCooldown = 1;
  /** Tidying timer (MOM). */
  rearrangeTimer = 8;
  /** Frost-aura timer (Fridgezilla). */
  frostTimer = 2;
  private trampleSoundT = 0;
  /** True for minions called in by a boss (counts towards spawner caps). */
  summoned = false;
  /** Blink timer (Popcorn Apocalypse). */
  teleportTimer = 5;
  /** Ooze timer (Dishwasher Demon). */
  seepTimer = 2;
  /** Time-freeze timer (Time-Thief). */
  stasisCooldown = 6;
  /** Toy timer + counter (Toybox Titan). */
  spawnTimer = 4;
  spawnCount = 0;
  /** Current shapeshifter form index (King of Cardboard). */
  form = 0;
  formTimer = 8;
  /** Crackle timer (Cable Kraken). */
  zapTimer = 2;
  /** Cyclone timer (Fan-tastic Nightmare). */
  windTimer = 2;
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

  get hurlProgress(): number {
    const windup = this.type.hurls?.windup ?? 0.7;
    return this.ai === 'hurl' ? 1 - this.aiTimer / windup : 0;
  }

  get lashProgress(): number {
    const windup = this.type.lashes?.windup ?? 0.6;
    return this.ai === 'lash' ? 1 - this.aiTimer / windup : 0;
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

    this.hurlCooldown -= dt;
    this.slamCooldown -= dt;
    this.lashCooldown -= dt;
    if (this.type.sucks) this.updateSuck(game, dt);
    if (this.type.dodges) this.updateDodge(game, dt);
    if (this.type.rearranges) this.updateRearrange(game, dt);
    if (this.type.frost) this.updateFrost(game, dt);
    if (this.type.teleports) this.updateTeleport(game, dt);
    if (this.type.seeps) this.updateSeep(game, dt);
    if (this.type.stasis) this.updateStasis(game, dt);
    if (this.type.spawns) this.updateSpawner(game, dt);
    if (this.type.forms) this.updateForms(game, dt);
    if (this.type.zaps) this.updateZap(game, dt);
    if (this.type.winds) this.updateWinds(game, dt);

    const player = game.player;
    const dx = player.body.x - b.x;
    const dy = player.body.y - b.y;
    const dist = Math.hypot(dx, dy) || 1;
    let speed = this.type.speed * this.rageMult * this.formSpeedMult() * (this.slowTimer > 0 ? this.slowFactor : 1);

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
        this.steer(this.targetX, this.targetY, this.type.speed * this.rageMult, dt);
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
        // Ranged troublemakers would rather throw the room at you than walk into it.
        if (this.type.hurls && this.allows('hurl') && this.hurlCooldown <= 0 && dist < this.type.hurls.range && dist > 130 && this.confuse <= 0) {
          if (this.startHurl(game)) break;
        }
        // Heavy sitters slam the floor instead of chasing forever.
        if (this.type.slams && this.allows('slam') && this.slamCooldown <= 0 && dist < this.type.slams.radius * 1.15 && this.confuse <= 0) {
          this.startSlam(game);
          break;
        }
        // Tentacles have longer arms than legs.
        if (this.type.lashes && this.lashCooldown <= 0 && dist < this.type.lashes.range && this.confuse <= 0) {
          this.startLash(game);
          break;
        }
        if (dist < this.type.radius + player.body.boundR + (this.formLungeRange() ?? this.type.lungeRange ?? 14) && this.confuse <= 0) {
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
          game.audio.voice('attack', this.type.voice, this.type.id);
        }
        break;

      case 'lunge':
        b.vx = this.lungeX * (this.type.lungeSpeed ?? LUNGE_SPEED);
        b.vy = this.lungeY * (this.type.lungeSpeed ?? LUNGE_SPEED);
        if (this.type.lungeSpeed && Math.random() < dt * 40) game.particles.burst('dust', b.x - this.lungeX * 14, b.y + 6, 1, 60);
        if (this.type.tramples) {
          // The Mower eats the room at speed: splinters, shake and engine snarl.
          if (Math.random() < dt * 30) {
            game.particles.burst('splinter', b.x + this.lungeX * 20, b.y, 3, 260);
            game.particles.burst('dust', b.x, b.y + 6, 4, 160);
          }
          if (Math.random() < dt * 6) game.camera.addShake(0.14);
          this.trampleSoundT -= dt;
          if (this.trampleSoundT <= 0) {
            this.trampleSoundT = 0.5;
            game.audio.play('slide', 0.4);
          }
        }
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
            game.impactSpark(guard.body.x, guard.body.y - 14, 0.5);
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

      case 'hurl': {
        this.steer(0, 0, 0, dt);
        this.turnTowards(Math.atan2(dy, dx), dt);
        const obj = this.hurled;
        if (!obj || !obj.alive || obj.held) {
          this.hurled = null;
          this.hurlT = -1;
          this.setState('chase', 0);
          break;
        }
        // Hold it overhead while aiming: readable, dodgeable, interruptible.
        const ob = obj.body;
        const hx = b.x + Math.cos(this.facing) * (this.type.radius + ob.boundR * 0.5);
        const hy = b.y + Math.sin(this.facing) * (this.type.radius + ob.boundR * 0.5) - 10;
        ob.vx = (hx - ob.x) * 14;
        ob.vy = (hy - ob.y) * 14;
        ob.vz = Math.max(ob.vz, 60);
        ob.z = Math.max(ob.z, 12);
        ob.wake();
        if (this.aiTimer <= 0) this.releaseHurl(game);
        break;
      }

      case 'slam':
        this.steer(0, 0, 0, dt);
        this.squash = Math.max(this.squash, 0.6);
        if (this.aiTimer <= 0) this.releaseSlam(game);
        break;

      case 'lash':
        this.steer(0, 0, 0, dt);
        this.turnTowards(Math.atan2(dy, dx), dt);
        if (this.aiTimer <= 0) this.releaseLash(game);
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

  /** The Chucker grabs the nearest loose thing and holds it overhead. */
  private startHurl(game: Game): boolean {
    const spec = this.type.hurls;
    if (!spec) return false;
    const b = this.body;
    let best: PhysicsObject | null = null;
    let bestD = 280;
    for (const object of game.objects) {
      if (!object.alive || object.held || !object.def.throwable) continue;
      if (object.body.type !== 'dynamic' || object.body.mass > 30) continue;
      const d = Math.hypot(object.body.x - b.x, object.body.y - b.y);
      if (d < bestD) {
        bestD = d;
        best = object;
      }
    }
    if (!best && spec.spawn) {
      // Conjured ammunition: MOM always has another shoe, the Fridgezilla
      // another frozen fish. (The object cap still applies, via spawnObject.)
      best = game.spawnObject(spec.spawn, b.x + Math.cos(this.facing) * 30, b.y + Math.sin(this.facing) * 30 - 10);
      if (best) {
        best.body.vz = 160;
        best.body.z = Math.max(best.body.z, 10);
      }
    }
    if (!best) {
      // Nothing to throw: don't stand around, try again soon.
      this.hurlCooldown = 1.2;
      return false;
    }
    this.hurled = best;
    this.hurlT = spec.windup;
    this.setState('hurl', spec.windup);
    game.audio.play('whistle', 0.7);
    game.audio.voice('attack', this.type.voice, this.type.id);
    return true;
  }

  /** The Chucker lets fly at the player. Dodge it, or knock it out of the air. */
  private releaseHurl(game: Game): void {
    const obj = this.hurled;
    this.hurled = null;
    this.hurlT = -1;
    this.hurlCooldown = (this.type.hurls?.cooldown ?? 4.5) * game.rng.range(0.85, 1.2);
    this.setState('recover', 0.5);
    if (!obj || !obj.alive || obj.held) return;
    const b = this.body;
    const target = game.player.body;
    const dx = target.x + target.vx * 0.25 - b.x;
    const dy = target.y + target.vy * 0.25 - b.y;
    const d = Math.hypot(dx, dy) || 1;
    const ob = obj.body;
    if (obj.restingOn) obj.leaveSurface();
    const speed = 760 / (1 + ob.mass / 14);
    ob.vx = (dx / d) * speed;
    ob.vy = (dy / d) * speed;
    ob.vz = 170;
    ob.z = Math.max(ob.z, 10);
    ob.w = game.rng.sign() * 9;
    ob.wake();
    obj.tags.add('hurled');
    obj.chain = startChain(game.time, obj.uid, obj.label);
    obj.chainAt = game.time;
    game.audio.play('throw', 0.8);
    game.fx.ring(b.x, b.y, 8, 40, 0.25, 'rgba(255,255,255,0.7)', 2);
  }

  /** The big sitters telegraph a floor slam: ring, crouch, and a beat to clear out. */
  private startSlam(game: Game): void {
    const spec = this.type.slams;
    if (!spec) return;
    this.setState('slam', 0.9);
    this.squash = 1;
    game.audio.play('alarm', 0.8);
    game.fx.ring(this.body.x, this.body.y, 10, spec.radius, 0.9, 'rgba(255,90,78,0.75)', 4);
  }

  private releaseSlam(game: Game): void {
    const spec = this.type.slams;
    this.slamCooldown = (spec?.cooldown ?? 7) * game.rng.range(0.9, 1.15);
    this.setState('recover', 0.6);
    if (!spec) return;
    this.doShockwave(game, spec.radius, spec.damage);
    if (spec.spawnZone) {
      const b = this.body;
      game.zones.spawn(game, spec.spawnZone.kind, b.x, b.y, spec.spawnZone.radius, { ttl: spec.spawnZone.ttl });
      game.particles.burst('water', b.x, b.y, 14, 220);
      game.audio.play('splash', 0.9);
    }
  }

  /** Cushion tentacles rear up: readable, sidesteppable, regrettable. */
  private startLash(game: Game): void {
    const spec = this.type.lashes;
    if (!spec) return;
    this.setState('lash', spec.windup);
    game.audio.play('whistle', 0.8);
    game.audio.voice('attack', this.type.voice, this.type.id);
  }

  private releaseLash(game: Game): void {
    const spec = this.type.lashes;
    this.lashCooldown = (spec?.cooldown ?? 5) * game.rng.range(0.9, 1.15);
    this.setState('recover', 0.6);
    if (!spec) return;
    const b = this.body;
    const fa = this.facing;
    const halfArc = spec.arc / 2;
    const inCone = (x: number, y: number): boolean => {
      const dx = x - b.x;
      const dy = y - b.y;
      const d = Math.hypot(dx, dy);
      if (d > spec.range || d < 1) return false;
      return Math.abs(angleDiff(fa, Math.atan2(dy, dx))) <= halfArc;
    };
    const player = game.player;
    if (player.alive && inCone(player.body.x, player.body.y)) {
      const dx = player.body.x - b.x;
      const dy = player.body.y - b.y;
      const d = Math.hypot(dx, dy) || 1;
      if (player.hurt(game, 1, this.label)) {
        // Slapped, then dragged a step towards the hug.
        player.body.vx -= (dx / d) * 220;
        player.body.vy -= (dy / d) * 220;
        game.discoveries.unlock('tentacled');
      }
    }
    game.world.queryCircle(b.x, b.y, spec.range, (body) => {
      const owner = body.owner;
      if (!owner || owner === this || owner.kind !== 'object' || body.type !== 'dynamic') return;
      if (!inCone(body.x, body.y)) return;
      if (owner.restingOn) owner.leaveSurface();
      const dx = b.x - body.x;
      const dy = b.y - body.y;
      const d = Math.hypot(dx, dy) || 1;
      body.applyImpulse((dx / d) * body.mass * 300, (dy / d) * body.mass * 300);
      body.vz = Math.max(body.vz, 160);
      body.z = Math.max(body.z, 3);
      body.wake();
    });
    game.particles.burst('dust', b.x + Math.cos(fa) * spec.range * 0.6, b.y + Math.sin(fa) * spec.range * 0.6, 12, 220);
    game.fx.burst('SLAP!', b.x + Math.cos(fa) * 40, b.y - 52, 1.1, '#ff7b54', true);
    game.audio.play('swipe', 1);
    game.camera.addShake(0.3);
  }

  /**
   * MOM sees it coming. Fast throws aimed at her get sidestepped with contempt;
   * slow floaters that reach her hands get confiscated.
   */
  private updateDodge(game: Game, dt: number): void {
    const spec = this.type.dodges;
    if (!spec || this.defeated) return;
    this.dodgeCooldown -= dt;
    const b = this.body;
    // Confiscation first: anything thrown that drifts into her hands is hers now.
    for (const object of game.objects) {
      if (!object.alive || object.held) continue;
      if (!object.tags.has('thrown') && !object.tags.has('hurled')) continue;
      const d = Math.hypot(object.body.x - b.x, object.body.y - b.y);
      if (d < this.type.radius + 18) {
        object.destroy(game);
        this.hp = Math.min(this.type.hp, this.hp + 5);
        this.squash = Math.max(this.squash, 0.5);
        game.audio.play('plop', 1);
        game.fx.burst('MINE.', b.x, b.y - 56, 1, '#ffd23f', true);
        game.discoveries.unlock('mine_now');
      }
    }
    if (this.dodgeCooldown > 0 || this.stun > 0 || this.shockTimer > 0) return;
    if (this.ai === 'entering' || this.ai === 'windup' || this.ai === 'lunge' ||
        this.ai === 'hurl' || this.ai === 'slam' || this.ai === 'lash') return;
    for (const object of game.objects) {
      if (!object.alive || object.held) continue;
      if (!object.tags.has('thrown') && !object.tags.has('hurled')) continue;
      const ob = object.body;
      const sp = ob.speed();
      if (sp < 400) continue;
      const dx = b.x - ob.x;
      const dy = b.y - ob.y;
      const d = Math.hypot(dx, dy);
      if (d > spec.radius || d < 1) continue;
      if ((ob.vx * dx + ob.vy * dy) / (sp * d) < 0.75) continue;
      // Sidestep, perpendicular to the incoming throw.
      const side = game.rng.sign();
      b.vx = (-dy / d) * side * 560;
      b.vy = (dx / d) * side * 560;
      b.wake();
      this.dodgeCooldown = spec.cooldown;
      game.audio.play('swipe', 0.7);
      game.fx.burst('MISS!', b.x, b.y - 56, 0.9, '#4ad6e8', true);
      game.particles.burst('dust', b.x, b.y + 4, 5, 120);
      game.discoveries.unlock('not_today');
      return;
    }
  }

  /**
   * MOM tidies mid-fight: loose furniture is relocated across the room, with
   * feeling. Held things are never touched — she is fair, not cruel.
   */
  private updateRearrange(game: Game, dt: number): void {
    const spec = this.type.rearranges;
    if (!spec || this.defeated) return;
    this.rearrangeTimer -= dt;
    if (this.rearrangeTimer > 0) return;
    this.rearrangeTimer = spec.cooldown;
    const def = game.room.def;
    const candidates = game.objects.filter((o) =>
      o.alive && !o.held && !o.restingOn && o.body.type === 'dynamic' && o.body.mass <= 60,
    );
    let moved = 0;
    while (moved < spec.count && candidates.length > 0) {
      const i = Math.floor(game.rng.next() * candidates.length);
      const object = candidates.splice(i, 1)[0]!;
      const ob = object.body;
      const nx = game.rng.range(60, def.width - 60);
      const ny = game.rng.range(60, def.height - 60);
      game.fx.ring(ob.x, ob.y, 6, 40, 0.3, 'rgba(255,255,255,0.8)', 3);
      game.fx.ring(nx, ny, 6, 40, 0.3, 'rgba(255,255,255,0.8)', 3);
      ob.teleport(nx, ny, ob.angle);
      ob.vx = game.rng.range(-60, 60);
      ob.vy = game.rng.range(-60, 60);
      ob.vz = 140;
      ob.z = Math.max(ob.z, 6);
      ob.wake();
      moved++;
    }
    if (moved > 0) {
      game.audio.play('poof', 0.9);
      game.fx.burst('CLEAN YOUR ROOM!', this.body.x, this.body.y - 60, 1.2, '#ffd23f', true);
      game.discoveries.unlock('clean_your_room');
    }
  }

  /** Shapeshifter plumbing: current form, its speed, and what it allows. */
  private currentForm(): { key: string; name: string; speedMult: number; slam?: boolean; hurl?: boolean; lungeRange?: number; announce: string } | null {
    const forms = this.type.forms;
    if (!forms || forms.length === 0) return null;
    return forms[this.form % forms.length]!;
  }

  private formSpeedMult(): number {
    return this.currentForm()?.speedMult ?? 1;
  }

  private allows(kind: 'slam' | 'hurl'): boolean {
    const form = this.currentForm();
    if (!form) return true;
    return form[kind] === true;
  }

  private formLungeRange(): number | undefined {
    return this.currentForm()?.lungeRange;
  }

  /** The King of Cardboard refolds itself on a timer, with announcements. */
  private updateForms(game: Game, dt: number): void {
    const forms = this.type.forms;
    if (!forms || this.defeated) return;
    this.formTimer -= dt;
    if (this.formTimer > 0) return;
    this.formTimer = this.type.formInterval ?? 11;
    this.form = (this.form + 1) % forms.length;
    const cur = forms[this.form]!;
    this.squash = 1;
    game.audio.play('click', 1);
    game.hud.banner(cur.announce, cur.name, 1.6);
    game.fx.ring(this.body.x, this.body.y, 8, 70, 0.4, 'rgba(255,210,63,0.9)', 4);
    game.particles.burst('scrap', this.body.x, this.body.y - 10, 10, 200);
    game.camera.addShake(0.2);
  }

  /** Blink-hunting: gone in a puff, back somewhere ruder. */
  private updateTeleport(game: Game, dt: number): void {
    const spec = this.type.teleports;
    if (!spec || this.defeated) return;
    this.teleportTimer -= dt;
    if (this.teleportTimer > 0) return;
    const player = game.player;
    const b = this.body;
    const d = Math.hypot(player.body.x - b.x, player.body.y - b.y);
    if (!player.alive || d < 200) {
      this.teleportTimer = 1;
      return;
    }
    this.teleportTimer = spec.cooldown * game.rng.range(0.9, 1.15);
    game.particles.burst('smoke', b.x, b.y, 12, 140);
    game.particles.burst('spark', b.x, b.y - 10, 8, 200);
    game.audio.play('poof', 1);
    const def = game.room.def;
    const a = game.rng.range(0, Math.PI * 2);
    const dist = game.rng.range(spec.minDist, spec.minDist + 140);
    const nx = clamp(player.body.x + Math.cos(a) * dist, 60, def.width - 60);
    const ny = clamp(player.body.y + Math.sin(a) * dist, 60, def.height - 60);
    b.teleport(nx, ny, b.angle);
    b.vx = 0;
    b.vy = 0;
    b.wake();
    game.fx.ring(nx, ny, 8, 60, 0.35, 'rgba(255,255,255,0.85)', 4);
    game.fx.burst('POP!', nx, ny - 52, 1, '#ff9f1c', true);
    game.particles.burst('smoke', nx, ny, 10, 120);
  }

  /** Oozing hazards wherever it stands. */
  private updateSeep(game: Game, dt: number): void {
    const spec = this.type.seeps;
    if (!spec || this.defeated) return;
    this.seepTimer -= dt;
    if (this.seepTimer > 0) return;
    this.seepTimer = spec.interval;
    const b = this.body;
    game.zones.spawn(game, spec.kind, b.x, b.y, spec.radius, { ttl: spec.ttl });
    game.particles.burst('water', b.x, b.y, 10, 160);
    game.audio.play('splash', 0.6);
  }

  /**
   * The Time-Thief rings: you crawl, the furniture rewinds and stampedes.
   * Dodge the bubble, or spend two seconds watching a chair undo itself at you.
   */
  private updateStasis(game: Game, dt: number): void {
    const spec = this.type.stasis;
    if (!spec || this.defeated) return;
    this.stasisCooldown -= dt;
    if (this.stasisCooldown > 0) return;
    this.stasisCooldown = spec.cooldown;
    const b = this.body;
    const player = game.player;
    if (player.alive && Math.hypot(player.body.x - b.x, player.body.y - b.y) < spec.radius) {
      player.slowTimer = spec.slowDuration;
      player.slowFactor = 0.25;
    }
    for (const object of game.objects) {
      if (!object.alive || object.held) continue;
      const ob = object.body;
      if (ob.type !== 'dynamic') continue;
      if (Math.hypot(ob.x - b.x, ob.y - b.y) > spec.radius) continue;
      if (object.restingOn) object.leaveSurface();
      ob.vx = -ob.vx * 1.4 + game.rng.range(-80, 80);
      ob.vy = -ob.vy * 1.4 + game.rng.range(-80, 80);
      ob.vz = Math.max(ob.vz, 150);
      ob.z = Math.max(ob.z, 4);
      ob.wake();
    }
    game.audio.play('alarm', 1);
    game.fx.burst('TIME OUT!', b.x, b.y - 60, 1.2, '#4ad6e8', true);
    game.fx.ring(b.x, b.y, 10, spec.radius, 0.6, 'rgba(74,214,232,0.8)', 4);
    game.hitStop(0.05);
    game.discoveries.unlock('time_out');
  }

  /** The Toybox dispenses playmates on a timer, escalating to bigger toys. */
  private updateSpawner(game: Game, dt: number): void {
    const spec = this.type.spawns;
    if (!spec || this.defeated) return;
    this.spawnTimer -= dt;
    if (this.spawnTimer > 0) return;
    this.spawnTimer = spec.interval;
    let alive = 0;
    for (const e of game.enemies) {
      if (e !== this && !e.defeated && e.summoned) alive++;
    }
    if (alive >= spec.maxAlive) return;
    this.spawnCount++;
    const escalated = spec.escalateEvery !== undefined && spec.escalateType !== undefined &&
      this.spawnCount % spec.escalateEvery === 0;
    const type = escalated ? spec.escalateType! : game.rng.pick(spec.pool);
    const b = this.body;
    const a = game.rng.range(0, Math.PI * 2);
    const child = game.spawnEnemy(
      type,
      b.x + Math.cos(a) * (this.type.radius + 30),
      b.y + Math.sin(a) * (this.type.radius + 30),
      Math.cos(a), Math.sin(a),
    );
    child.summoned = true;
    child.body.vx = Math.cos(a) * 300;
    child.body.vy = Math.sin(a) * 300;
    child.squash = 1;
    game.audio.play('poof', 0.9);
    game.particles.burst('dust', b.x, b.y, 10, 180);
    if (escalated) {
      game.fx.burst('BIGGER TOY!', b.x, b.y - 56, 1.1, '#ff9f1c', true);
      game.discoveries.unlock('jack_in_the_box');
    }
  }

  /** The Cable Kraken crackles: standing close is a billing event. */
  private updateZap(game: Game, dt: number): void {
    const spec = this.type.zaps;
    if (!spec || this.defeated) return;
    this.zapTimer -= dt;
    if (this.zapTimer > 0) return;
    this.zapTimer = spec.interval;
    const b = this.body;
    game.audio.play('zap', 1);
    game.particles.burst('spark', b.x, b.y - 10, 18, 320);
    game.fx.ring(b.x, b.y, 8, spec.radius, 0.35, 'rgba(255,242,122,0.9)', 4);
    const player = game.player;
    if (player.alive && Math.hypot(player.body.x - b.x, player.body.y - b.y) < spec.radius) {
      if (player.hurt(game, 1, 'ELECTRICITY')) {
        game.particles.burst('spark', player.body.x, player.body.y - 8, 12, 240);
        game.discoveries.unlock('high_voltage');
      }
    }
    // Friendly current: rival movers conduct too (bosses excepted).
    for (const other of game.enemies) {
      if (other === this || other.defeated || other.type.boss) continue;
      if (Math.hypot(other.body.x - b.x, other.body.y - b.y) > spec.radius) continue;
      other.shock(game, 8, 0.5, {
        type: 'shock', source: this, chain: null, label: this.label, dirX: 0, dirY: 0,
      });
    }
  }

  /** The Fan-tastic Nightmare seeds a cyclone that steals throws mid-air. */
  private updateWinds(game: Game, dt: number): void {
    const spec = this.type.winds;
    if (!spec || this.defeated) return;
    this.windTimer -= dt;
    if (this.windTimer > 0) return;
    this.windTimer = spec.interval;
    const b = this.body;
    const base = game.rng.range(0, Math.PI * 2);
    for (let k = 0; k < 4; k++) {
      const a = base + (k * Math.PI) / 2;
      const zone = game.zones.spawn(
        game, 'wind',
        b.x + Math.cos(a) * spec.radius * 0.5, b.y + Math.sin(a) * spec.radius * 0.5,
        spec.radius * 0.55, { ttl: spec.ttl },
      );
      zone.dirX = -Math.sin(a);
      zone.dirY = Math.cos(a);
    }
    game.audio.play('hiss', 0.7);
    game.particles.burst('dust', b.x, b.y, 8, 200);
    game.discoveries.unlock('cyclone');
  }

  /** Fridgezilla's halo: the floor keeps freezing wherever it has been. */
  private updateFrost(game: Game, dt: number): void {
    const spec = this.type.frost;
    if (!spec || this.defeated) return;
    this.frostTimer -= dt;
    if (this.frostTimer > 0) return;
    this.frostTimer = spec.interval;
    const b = this.body;
    game.zones.spawn(
      game, 'slick',
      b.x + game.rng.range(-30, 30), b.y + game.rng.range(-20, 20),
      spec.radius, { ttl: spec.ttl },
    );
    game.particles.burst('spark', b.x, b.y - 10, 8, 140, { color: '#cfe8ff' });
    game.audio.play('hiss', 0.5);
  }

  /**
   * Radial slam: the player gets hurt and launched, loose objects fly, and the
   * room notices. Bosses use it for phase turns as well as attacks.
   */
  doShockwave(game: Game, radius: number, damage: number): void {
    const b = this.body;
    game.world.queryCircle(b.x, b.y, radius, (body) => {
      const owner = body.owner;
      if (!owner || owner === this) return;
      const dx = body.x - b.x;
      const dy = body.y - b.y;
      const d = Math.hypot(dx, dy) || 1;
      const ux = dx / d;
      const uy = dy / d;
      if (owner.kind === 'player') {
        if (owner.hurt(game, damage, this.label)) {
          owner.body.vx += ux * 340;
          owner.body.vy += uy * 340;
          game.discoveries.unlock('down_to_earth');
        }
      } else if (owner.kind === 'object' && body.type === 'dynamic') {
        if (owner.restingOn) owner.leaveSurface();
        body.applyImpulse(ux * body.mass * 380, uy * body.mass * 380);
        body.vz = Math.max(body.vz, 240);
        body.z = Math.max(body.z, 4);
        body.wake();
      }
    });
    game.particles.burst('dust', b.x, b.y + 6, 22, 260);
    game.fx.ring(b.x, b.y, 12, radius * 1.15, 0.45, 'rgba(255,255,255,0.9)', 6);
    game.fx.burst('WHUMP!', b.x, b.y - 52, 1.25, '#ff9f1c', true);
    game.audio.play('explosion', 0.55);
    game.camera.addShake(0.55);
    game.camera.punchZoom(0.04);
    game.hitStop(0.09);
    game.noise(b.x, b.y, 1.4);
  }

  /** Vacuum appetites breathe in cycles: a few seconds of suction, then a breather. */
  private updateSuck(game: Game, dt: number): void {
    const spec = this.type.sucks;
    if (!spec || this.defeated) {
      this.sucking = false;
      return;
    }
    // Damage interrupts the appetite: getting hit knocks it out of the suck.
    if (this.stun > 0 || this.shockTimer > 0) this.sucking = false;
    this.suckTimer -= dt;
    if (this.suckTimer <= 0) {
      this.sucking = !this.sucking;
      this.suckTimer = this.sucking ? 2.6 : 2.2;
      if (this.sucking) game.audio.play('hiss', 0.8);
    }
    if (!this.sucking) return;
    const b = this.body;
    this.suckSoundT -= dt;
    if (this.suckSoundT <= 0) {
      this.suckSoundT = 0.45;
      game.audio.play('hiss', 0.35);
    }
    if (Math.random() < dt * 30) {
      const a = game.rng.range(0, Math.PI * 2);
      game.particles.burst(
        this.type.id === 'flusher' ? 'water' : 'dust',
        b.x + Math.cos(a) * spec.radius * 0.7, b.y + Math.sin(a) * spec.radius * 0.55, 1, 60,
      );
    }
    for (const object of game.objects) {
      if (!object.alive || object.held) continue;
      const ob = object.body;
      if (ob.type !== 'dynamic' || ob.mass > 60) continue;
      const dx = b.x - ob.x;
      const dy = b.y - ob.y;
      const d = Math.hypot(dx, dy);
      if (d > spec.radius + ob.boundR || d < 0.01) continue;
      ob.vx += (dx / d) * spec.pull * this.rageMult * dt;
      ob.vy += (dy / d) * spec.pull * this.rageMult * dt;
      const capped = 540;
      const sp = ob.speed();
      if (sp > capped) {
        ob.vx = (ob.vx / sp) * capped;
        ob.vy = (ob.vy / sp) * capped;
      }
      ob.wake();
      if (d < this.type.radius + 10) this.eatObject(game, object);
    }
    // The Vacuumasaurus also inhales rival movers. Crew is crew.
    if (this.type.voracious) {
      for (const other of game.enemies) {
        if (other === this || other.defeated || other.type.boss) continue;
        const ob = other.body;
        const dx = b.x - ob.x;
        const dy = b.y - ob.y;
        const d = Math.hypot(dx, dy);
        if (d > spec.radius * 0.65 || d < 0.01) continue;
        ob.vx += (dx / d) * spec.pull * 0.7 * dt;
        ob.vy += (dy / d) * spec.pull * 0.7 * dt;
        ob.wake();
        if (d < this.type.radius + 14) {
          other.damage(game, 999, {
            type: 'slam', source: this, chain: null, label: 'DIGESTED', dirX: 0, dirY: 0,
          });
          this.hp = Math.min(this.type.hp, this.hp + 15);
          game.audio.play('chomp', 1);
          game.fx.burst('TASTY!', b.x, b.y - 52, 1, '#9be564', true);
          game.particles.burst('dust', b.x, b.y - 10, 10, 200);
          game.discoveries.unlock('ate_the_crew');
        }
      }
    }
    // Standing too close in bare feet is a bad idea, but escapable.
    const player = game.player;
    if (player.alive) {
      const dx = b.x - player.body.x;
      const dy = b.y - player.body.y;
      const d = Math.hypot(dx, dy);
      if (d > 1 && d < spec.radius * 0.75) {
        player.body.vx += (dx / d) * 144 * dt;
        player.body.vy += (dy / d) * 144 * dt;
      }
    }
  }

  /**
   * Big mouths eat whatever reaches them. Explosives and lit things
   * disagree with them violently — that is the whole strategy.
   */
  private eatObject(game: Game, object: PhysicsObject): void {
    if (!object.alive || object.held) return;
    if (object.restingOn) object.leaveSurface();
    const b = this.body;
    game.audio.play('chomp', 1);
    game.particles.burst('dust', b.x, b.y - 10, 6, 140);
    if (object.def.explosive) {
      object.breakApart(game);
      this.stun = Math.max(this.stun, 2.2);
      this.squash = 1;
      game.fx.burst('INDIGESTION!', b.x, b.y - 52, 1.2, '#ff5a4e', true);
      this.damage(game, 70, {
        type: 'explosion', source: object, chain: object.chain,
        label: object.label, dirX: 0, dirY: 0,
      });
      game.discoveries.unlock('taste_test');
      return;
    }
    if (object.burning) {
      game.fx.burst('SPICY!', b.x, b.y - 52, 1, '#ff9f1c', true);
      object.destroy(game);
      this.igniteFor(game, 2.5, object.chain);
      return;
    }
    object.destroy(game);
    this.hp = Math.min(this.type.hp, this.hp + 5);
    this.squash = Math.max(this.squash, 0.5);
  }

  /** Crosses boss phases whose hp threshold has been reached. */
  private applyPhases(game: Game): void {
    const phases = this.type.phases;
    if (!phases) return;
    while (this.phaseIndex < phases.length && this.hp <= this.type.hp * phases[this.phaseIndex]!.below) {
      const phase = phases[this.phaseIndex]!;
      this.phaseIndex++;
      if (phase.enrage) this.rageMult *= phase.enrage;
      if (phase.announce) game.hud.banner(phase.announce, '', 2);
      game.audio.play('alarm', 1);
      game.audio.voice('attack', this.type.voice, this.type.id);
      this.squash = 1;
      game.fx.ring(this.body.x, this.body.y, 8, 90, 0.5, 'rgba(255,90,78,0.85)', 4);
      if (phase.summon) {
        for (let i = 0; i < phase.summon.count; i++) {
          const a = game.rng.range(0, Math.PI * 2);
          const child = game.spawnEnemy(
            phase.summon.type,
            this.body.x + Math.cos(a) * (this.type.radius + 26),
            this.body.y + Math.sin(a) * (this.type.radius + 26),
            Math.cos(a), Math.sin(a),
          );
          child.summoned = true;
          child.body.vx = Math.cos(a) * 320;
          child.body.vy = Math.sin(a) * 320;
          child.squash = 1;
        }
        game.particles.burst('dust', this.body.x, this.body.y, 16, 220);
      }
      if (phase.shockwave) this.doShockwave(game, phase.shockwave.radius, phase.shockwave.damage);
    }
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
    if (this.ai === 'windup' || this.ai === 'lunge' || this.ai === 'hurl' || this.ai === 'slam' || this.ai === 'lash') {
      this.hurled = null;
      this.hurlT = -1;
      this.setState('recover', 0.4);
    }
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
        const sx = b.x + Math.cos(this.facing) * 16;
        const sy = b.y + Math.sin(this.facing) * 16;
        game.particles.burst('spark', sx, sy, 8, 240);
        game.particles.burst('sparkle', sx, sy - 14, 10, 220);
        game.particles.burst('glint', sx, sy - 10, 2, 30);
        game.impactSpark(sx, sy - 10, 0.45);
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

    damage *= game.edges.impactDamageMultiplier(chain ? chain.steps.length : 0);

    const stagger = clamp(impulse / 4200, 0.45, 1.5) * this.type.staggerFactor;
    this.stun = Math.max(this.stun, stagger);
    const kick = Math.min(impulse * b.invMass * 2.1 * this.type.staggerFactor, 850);
    b.vx += dirX * kick;
    b.vy += dirY * kick;
    this.squash = 1;
    if (this.ai === 'windup' || this.ai === 'lunge' || this.ai === 'hurl' || this.ai === 'slam' || this.ai === 'lash') {
      this.hurled = null;
      this.hurlT = -1;
      this.setState('recover', 0.4);
    }

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
    let applied = amount;
    if (cause.type === 'fire' || cause.type === 'explosion' || cause.type === 'glass' ||
      cause.type === 'shock' || cause.type === 'water') {
      applied *= game.edges.hazardDamageMultiplier();
    }
    const headline = this.type.boss === true ? game.edges.headlineDamageMultiplier(true) : 1;
    applied *= headline;
    if (applied <= 0) return;
    this.hp -= applied;
    if (headline > 1) game.edges.markHeadlineHit();
    this.hitFlash = 1;
    this.aware = true;
    this.applyPhases(game);
    if (this.ai === 'idle' || this.ai === 'investigate') {
      this.lured = false;
      this.setState('chase', 0);
    }
    game.bus.emit({ type: 'ENEMY_HIT', enemy: this, damage: applied, cause });
    if (this.hp <= 0) this.defeat(game, cause);
  }

  shock(game: Game, amount: number, stunSeconds: number, cause: DamageCause): boolean {
    if (this.defeated || this.type.shockImmune || this.shockCooldown > 0) return false;
    this.shockCooldown = 0.8;
    this.shockTimer = stunSeconds;
    game.particles.burst('spark', this.body.x, this.body.y - 8, 14, 260);
    game.particles.burst('sparkle', this.body.x, this.body.y - 14, 12, 230);
    game.particles.burst('glint', this.body.x, this.body.y - 16, 2, 40);
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
    game.audio.voice('panic', this.type.voice, this.type.id);
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
    if (this.type.id === 'gnat') game.discoveries.unlock('caught_bug');
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
