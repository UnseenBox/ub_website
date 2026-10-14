import { newUid, type Chain } from '../core/types';
import type { Game } from '../core/Game';
import type { RigidBody } from '../physics/RigidBody';
import type { ObjectDefinition } from '../objects/ObjectDefinitions';
import type { Material } from '../objects/Materials';
import type { Zone } from '../hazards/Zone';
import { extendChain, freshChain } from '../gameplay/Chain';
import { GRAVITY_Z } from '../core/constants';
import type { SoundName } from '../audio/AudioManager';
import { SOURCE_LEVEL } from '../hazards/Electricity';
import { updateBehavior } from './Behaviors';

export type StructuralState = 'intact' | 'damaged' | 'broken';

const TIP_DURATION = 0.32;
const ROCKET_ACCEL = 2600;

/**
 * A grabbable, breakable, burnable thing. All behaviour is driven by its definition,
 * its material and its tags — there are no per-object subclasses.
 */
export class PhysicsObject {
  readonly kind = 'object' as const;
  readonly uid = newUid();
  readonly tags = new Set<string>();
  readonly seed = Math.random();
  readonly label: string;

  health: number;
  structural: StructuralState = 'intact';
  alive = true;
  held = false;

  chain: Chain | null = null;
  chainAt = -999;
  thrownByPlayer = false;
  thrownAt = -999;

  /** Surface this object is sitting on, with its offset in the surface's local space. */
  restingOn: PhysicsObject | null = null;
  restX = 0;
  restY = 0;
  restAngle = 0;
  /** Surface it just left; collisions with it are skipped until it lands. */
  fellFrom: PhysicsObject | null = null;

  standing: boolean;
  /** 0..1 while toppling, -1 otherwise. */
  tipProgress = -1;
  tipDirX = 0;
  tipDirY = 0;

  burning = false;
  burnLeft = 0;
  burnTotal = 1;
  igniteExposure = 0;
  fireZone: Zone | null = null;

  energizedUntil = -1;
  electricZone: Zone | null = null;

  rocketLeft = 0;
  private rocketFoamTimer = 0;

  hitFlash = 0;
  squash = 0;
  /** Free-running animation phase (fan blades, flicker). */
  phase = 0;
  /** Seconds left of an alarm clock going off. */
  ringing = 0;
  private ringTick = 0;
  private ringSound: SoundName = 'alarm';

  /** Seconds until it goes off on its own (a lit firework, a pressure cooker). */
  fuseLeft = 0;
  /** The last part of the fuse is spent flying. */
  private fuseRocket = 0;

  /** Tags that fall off again after a while (a boombox that is "playing"). */
  private readonly timedTags = new Map<string, number>();
  /** One slot per emitter in the definition; refilled whenever its tag comes back. */
  private readonly emitterZones: Array<Zone | null> = [];
  private beat = 0;
  private beatCount = 0;

  // ── state for `def.behavior` (see Behaviors.ts) ──
  /** Seconds the behaviour keeps going: wound-up teeth, a boomerang in flight, a flopping fish. */
  active = 0;
  motorX = 0;
  motorY = 0;
  motorTimer = 0;
  stall = 0;
  biteTimer = 0;
  /** A trap that has gone off and not been reset. */
  sprung = false;
  /** 1 → 0 just after a trap goes off, for the drawing. */
  sprungAnim = 0;
  armTimer = 0;

  constructor(
    readonly def: ObjectDefinition,
    readonly material: Material,
    readonly body: RigidBody,
  ) {
    this.label = def.name.toUpperCase();
    this.health = def.health;
    this.standing = def.tip !== undefined;
    body.owner = this;

    const t = this.tags;
    t.add('object').add('solid').add(def.id).add(def.material);
    if (def.breakable) t.add('breakable');
    if (def.flammable) t.add('flammable');
    if (def.conductive) t.add('conductive');
    if (def.throwable) t.add('throwable');
    if (def.explosive) t.add('explosive');
    if (def.electronic) t.add('electronic');
    if (def.funny) t.add('funny');
    if (def.mass >= 8) t.add('heavy');
    if (def.mass <= 2.5) t.add('light');
    if (def.tip) t.add('tippable').add('standing');
    if (def.tags) for (const tag of def.tags) t.add(tag);
    if (def.behavior?.kind === 'flop') this.active = def.behavior.seconds;
  }

  /** Readable state-machine label derived from the underlying flags. */
  get state(): string {
    if (!this.alive) return 'DESTROYED';
    if (this.tipProgress >= 0) return 'FALLING';
    if (this.rocketLeft > 0) return 'ROCKETING';
    if (this.burning) return 'BURNING';
    if (this.structural === 'broken') return this.electricZone?.alive ? 'ELECTRICAL_HAZARD' : 'BROKEN';
    if (this.tags.has('energized')) return 'ENERGIZED';
    if (this.structural === 'damaged') return this.def.electronic ? 'SPARKING' : 'DAMAGED';
    if (this.def.tip && !this.standing) return 'FALLEN';
    return 'NORMAL';
  }

  /** Where the dangerous end is (lamp head), as a distance along the body angle. */
  get headOffset(): number {
    return this.def.tip && !this.standing && !this.def.tip.perpendicular ? this.def.tip.length / 2 - 8 : 0;
  }

  update(game: Game, dt: number): void {
    if (this.hitFlash > 0) this.hitFlash = Math.max(0, this.hitFlash - dt * 6);
    if (this.squash > 0) this.squash = Math.max(0, this.squash - dt * 5);
    this.phase += dt;

    if (this.sprungAnim > 0) this.sprungAnim = Math.max(0, this.sprungAnim - dt * 2.2);

    if (this.thrownByPlayer && game.time - this.thrownAt > 0.35 && this.body.z === 0 && this.body.speed() < 60) {
      this.thrownByPlayer = false;
      this.tags.delete('thrown');
    }
    // A plate sails: part of gravity is ignored for as long as the throw lasts.
    if (this.def.glide && this.thrownByPlayer && this.body.z > 0) this.body.vz += GRAVITY_Z * this.def.glide * dt;

    if (this.timedTags.size > 0) {
      for (const [tag, left] of this.timedTags) {
        if (left - dt > 0) this.timedTags.set(tag, left - dt);
        else {
          this.timedTags.delete(tag);
          this.tags.delete(tag);
        }
      }
    }
    this.syncEmitters(game);
    if (this.def.behavior) updateBehavior(game, this, this.def.behavior, dt);
    if (this.fuseLeft > 0 && this.updateFuse(game, dt)) return;
    if (this.tags.has('playing')) this.updateMusic(game, dt);

    this.landOnSurface(game);

    if (this.tipProgress >= 0) {
      this.tipProgress += dt / TIP_DURATION;
      this.body.vx = 0;
      this.body.vy = 0;
      if (this.tipProgress >= 1) this.land(game);
    }

    if (this.burning) {
      this.burnLeft -= dt;
      if (Math.random() < dt * 14) {
        game.particles.burst('ember', this.body.x, this.body.y - this.def.height, 1, 40);
      }
      if (this.burnLeft <= 0) {
        game.particles.burst('ash', this.body.x, this.body.y, 14, 90);
        game.particles.burst('smoke', this.body.x, this.body.y, 6, 40);
        game.addDecal('scorch', this.body.x, this.body.y, this.body.boundR + 8);
        this.destroy(game);
        return;
      }
    }

    if (this.rocketLeft > 0) this.updateRocket(game, dt);

    if (this.ringing > 0) {
      this.ringing -= dt;
      this.ringTick -= dt;
      if (this.ringTick <= 0) {
        // Every ring pulls nearby movers towards the noise instead of towards you.
        this.ringTick = 0.42;
        this.squash = 0.5;
        game.lure(this.body.x, this.body.y, 470, 1.3);
        game.fx.ring(this.body.x, this.body.y, 8, 70, 0.4, 'rgba(255,227,110,0.9)', 3);
        game.audio.play(this.ringSound, 1);
      }
      if (this.ringing <= 0) this.tags.delete('ringing');
    }

    if (this.tags.has('energized') && game.time > this.energizedUntil) this.tags.delete('energized');

    if (this.structural === 'damaged' && this.def.electronic && Math.random() < dt * 2.5) {
      game.particles.burst('spark', this.body.x, this.body.y - this.def.height, 2, 120);
    }
  }

  /** Something dropping onto a table comes to rest on it instead of clipping through. */
  private landOnSurface(game: Game): void {
    const b = this.body;
    if (b.z <= 0 || b.vz >= 0 || this.restingOn || this.held || this.def.surface) return;
    for (const surface of game.objects) {
      if (!surface.def.surface || !surface.alive || surface === this.fellFrom) continue;
      const height = surface.def.height;
      if (b.z > height + 3 || b.z < height - 8 || !surface.body.containsPoint(b.x, b.y, -4)) continue;
      const speed = -b.vz;
      b.vz = 0;
      b.vx *= 0.2;
      b.vy *= 0.2;
      b.w *= 0.3;
      this.placeOn(surface);
      game.impacts.landed(this, speed);
      return;
    }
  }

  private updateRocket(game: Game, dt: number): void {
    const b = this.body;
    this.rocketLeft -= dt;
    b.wake();
    // Wobbling thrust: readable enough to predict, chaotic enough to be funny.
    b.angle += Math.sin(this.phase * 9 + this.seed * 10) * 3.2 * dt;
    const dx = Math.cos(b.angle);
    const dy = Math.sin(b.angle);
    b.vx += dx * ROCKET_ACCEL * dt;
    b.vy += dy * ROCKET_ACCEL * dt;
    this.chainAt = game.time;

    this.rocketFoamTimer -= dt;
    if (this.rocketFoamTimer <= 0) {
      this.rocketFoamTimer = 0.09;
      if (this.tags.has('pressurized')) {
        const chain = freshChain(this, game.time);
        game.zones.spawn(game, 'foam', b.x - dx * 22, b.y - dy * 22, 32, {
          ttl: 5,
          chain: chain ? extendChain(chain, 'FOAM') : null,
        });
        game.particles.burst('foam', b.x - dx * 16, b.y - dy * 16, 3, 160, { dirX: -dx, dirY: -dy, spread: 0.7 });
      } else {
        // anything else with a lit end leaves a tail of sparks
        game.particles.burst('spark', b.x - dx * 14, b.y - dy * 14, 4, 220, { dirX: -dx, dirY: -dy, spread: 0.5 });
        game.particles.burst('smoke', b.x - dx * 18, b.y - dy * 18, 1, 40);
      }
    }
    if (this.rocketLeft <= 0) this.tags.delete('rocketing');
  }

  /** Counts a fuse down. Returns true if the object is gone as a result. */
  private updateFuse(game: Game, dt: number): boolean {
    const b = this.body;
    this.fuseLeft -= dt;
    if (Math.random() < dt * 26) game.particles.burst('spark', b.x, b.y - b.z - this.def.height, 1, 110);
    if (this.fuseRocket > 0 && this.fuseLeft <= this.fuseRocket && this.rocketLeft <= 0) {
      this.startRocket(game, this.fuseRocket, true);
      this.fuseRocket = 0;
    }
    if (this.fuseLeft > 0) return false;
    this.tags.delete('fused');
    if (this.chain) this.chainAt = game.time;
    this.breakApart(game);
    return !this.alive;
  }

  /** A boombox that is on: a note every half beat, and a few of them drifting up off it. */
  private updateMusic(game: Game, dt: number): void {
    this.beat -= dt;
    if (this.beat > 0) return;
    this.beat = 0.3;
    this.squash = 0.45;
    const b = this.body;
    game.audio.play('boombox', 1, this.beatCount++);
    game.particles.burst('note', b.x, b.y - b.z - this.def.height - 6, 1, 60, { dirX: 0, dirY: -1, spread: 0.7 });
    if (this.beatCount % 2 === 0) game.fx.ring(b.x, b.y, 10, 120, 0.5, 'rgba(164,140,242,0.5)', 2);
  }

  /** Keeps the definition's emitter zones in step with the tags that switch them on. */
  syncEmitters(game: Game): void {
    const emitters = this.def.emitters;
    if (!emitters) return;
    for (let i = 0; i < emitters.length; i++) {
      const emitter = emitters[i]!;
      const zone = this.emitterZones[i];
      if (zone && zone.alive) continue;
      if (emitter.whileTag && !this.tags.has(emitter.whileTag)) continue;
      const created = game.zones.spawn(game, emitter.zone, this.body.x, this.body.y, emitter.radius, {
        attached: this,
        offset: emitter.offset ?? 0,
        emitterTag: emitter.whileTag,
        level: emitter.zone === 'electric' ? SOURCE_LEVEL : 0,
        extraTags: emitter.tags,
      });
      this.emitterZones[i] = created;
      if (emitter.zone === 'fire') this.fireZone = created;
    }
  }

  /** Adds a tag that removes itself again after `seconds`. */
  tagFor(tag: string, seconds: number): void {
    this.tags.add(tag);
    this.timedTags.set(tag, Math.max(seconds, this.timedTags.get(tag) ?? 0));
  }

  /** Called by the player at the moment of release. */
  onThrown(game: Game): void {
    this.thrownByPlayer = true;
    this.thrownAt = game.time;
    this.tags.add('thrown');
    const behavior = this.def.behavior;
    if (behavior && (behavior.kind === 'seek' || behavior.kind === 'boomerang')) this.active = behavior.seconds;
  }

  /** A trap going off. */
  spring(): void {
    this.tags.delete('armed');
    this.sprung = true;
    this.sprungAnim = 1;
    this.armTimer = 0;
    this.squash = 1;
  }

  /** Starts a countdown that ends with the object breaking. `rocket` seconds of it are spent in flight. */
  lightFuse(game: Game, seconds: number, rocket = 0): boolean {
    if (this.fuseLeft > 0 || !this.alive || this.structural === 'broken') return false;
    this.fuseLeft = seconds;
    this.fuseRocket = Math.min(rocket, seconds);
    this.tags.add('fused');
    game.audio.play('fuse', 1);
    return true;
  }

  startRinging(duration: number, sound: SoundName = 'alarm'): boolean {
    const fresh = this.ringing <= 0;
    this.ringing = duration;
    this.ringTick = 0;
    this.ringSound = sound;
    this.tags.add('ringing');
    return fresh;
  }

  startRocket(game: Game, duration: number, keepHeading = false): boolean {
    if (this.rocketLeft > 0 || !this.alive) return false;
    // It will not stay in your hands.
    if (this.held) game.player.release();
    this.rocketLeft = duration;
    this.tags.add('rocketing');
    if (!keepHeading) this.body.angle = game.rng.range(0, Math.PI * 2);
    game.audio.play('hiss', 1);
    return true;
  }

  applyDamage(game: Game, amount: number): boolean {
    if (!this.alive || !this.def.breakable || this.structural === 'broken' || amount <= 0) return false;
    this.health -= amount;
    this.hitFlash = 1;
    if (this.health <= 0) {
      this.breakApart(game);
    } else if (this.structural === 'intact' && this.health <= this.def.health * 0.55) {
      this.structural = 'damaged';
      this.tags.add('damaged');
      game.bus.emit({ type: 'OBJECT_DAMAGED', object: this });
    }
    return true;
  }

  breakApart(game: Game): void {
    if (this.structural === 'broken' || !this.alive) return;
    this.structural = 'broken';
    this.health = 0;
    this.tags.add('broken');
    this.tags.delete('damaged');
    this.tags.delete('powered');
    this.tags.delete('playing');
    game.bus.emit({ type: 'OBJECT_BROKEN', object: this });
    if (this.def.removeOnBreak) this.destroy(game);
  }

  destroy(game: Game): void {
    if (!this.alive) return;
    this.alive = false;
    if (this.fireZone) this.fireZone.alive = false;
    if (this.electricZone) this.electricZone.alive = false;
    game.bus.emit({ type: 'OBJECT_DESTROYED', object: this });
  }

  ignite(game: Game, chain: Chain | null): boolean {
    if (this.burning || !this.alive || !this.def.flammable) return false;
    this.burning = true;
    this.tags.add('burning');
    this.burnTotal = this.burnLeft = this.material.burnTime * (this.def.mass > 30 ? 1.6 : 1);
    this.igniteExposure = 0;
    if (chain) {
      this.chain = chain;
      this.chainAt = game.time;
    }
    this.fireZone = game.zones.spawn(game, 'fire', this.body.x, this.body.y, this.body.boundR * 0.8 + 14, {
      attached: this,
      chain: chain ? extendChain(chain, 'FIRE') : null,
    });
    game.bus.emit({ type: 'FIRE_CONTACT', target: this });
    return true;
  }

  extinguish(): void {
    this.burning = false;
    this.igniteExposure = 0;
    this.tags.delete('burning');
    this.tags.delete('lit');
    if (this.fireZone) {
      this.fireZone.alive = false;
      this.fireZone = null;
    }
  }

  /** Starts toppling in the given direction. Returns false if it is not standing. */
  tip(game: Game, dirX: number, dirY: number): boolean {
    const spec = this.def.tip;
    if (!spec || !this.standing || this.tipProgress >= 0 || !this.alive) return false;
    let dx = dirX;
    let dy = dirY;
    if (spec.perpendicular) {
      // Fall across the long axis, towards whichever side the push came from.
      const px = -Math.sin(this.body.angle);
      const py = Math.cos(this.body.angle);
      const side = dx * px + dy * py >= 0 ? 1 : -1;
      dx = px * side;
      dy = py * side;
    }
    const len = Math.hypot(dx, dy);
    if (len < 1e-4) {
      dx = 1;
      dy = 0;
    } else {
      dx /= len;
      dy /= len;
    }
    // Never topple into a wall: if the landing spot is outside the room, fall the other way.
    const landX = this.body.x + dx * spec.length;
    const landY = this.body.y + dy * spec.length;
    const room = game.room.def;
    if (landX < 0 || landX > room.width || landY < 0 || landY > room.height) {
      dx = -dx;
      dy = -dy;
    }
    this.standing = false;
    this.tags.delete('standing');
    this.tipProgress = 0;
    this.tipDirX = dx;
    this.tipDirY = dy;
    this.body.vx = this.body.vy = this.body.w = 0;
    this.body.wake();
    this.chainAt = game.time;
    game.bus.emit({ type: 'OBJECT_ACTIVATED', object: this });
    return true;
  }

  private land(game: Game): void {
    const spec = this.def.tip;
    this.tipProgress = -1;
    if (!spec) return;
    const b = this.body;
    b.setShape(spec.fallenShape);
    b.teleport(
      b.x + this.tipDirX * (spec.length / 2),
      b.y + this.tipDirY * (spec.length / 2),
      Math.atan2(this.tipDirY, this.tipDirX),
    );
    b.wake();
    this.chainAt = game.time;
    game.bus.emit({ type: 'OBJECT_FALLEN', object: this });
    if (this.def.breakable) this.applyDamage(game, this.health + 1);
  }

  /** Lays a standing object flat without the dramatic fall (used when it is picked up). */
  layDown(): void {
    const spec = this.def.tip;
    if (!spec || !this.standing) return;
    this.standing = false;
    this.tags.delete('standing');
    this.body.setShape(spec.fallenShape);
  }

  placeOn(surface: PhysicsObject): void {
    const s = surface.body;
    const dx = this.body.x - s.x;
    const dy = this.body.y - s.y;
    const c = Math.cos(s.angle);
    const sn = Math.sin(s.angle);
    this.restingOn = surface;
    this.restX = dx * c + dy * sn;
    this.restY = -dx * sn + dy * c;
    this.restAngle = this.body.angle - s.angle;
    this.body.z = this.body.prevZ = surface.def.height;
  }

  leaveSurface(): void {
    const surface = this.restingOn;
    if (!surface) return;
    this.restingOn = null;
    this.fellFrom = surface;
    this.body.z = surface.def.height;
    this.body.vz = 60;
    this.body.wake();
  }

  /** Before the physics step: ride along with whatever this object is sitting on. */
  preStep(): void {
    const surface = this.restingOn;
    if (!surface) return;
    if (!surface.alive || this.held || surface.tipProgress >= 0) {
      this.leaveSurface();
      return;
    }
    this.body.vx = surface.body.vx;
    this.body.vy = surface.body.vy;
    this.body.w = 0;
    this.body.z = surface.def.height;
    this.body.vz = 0;
  }

  /** After the physics step: stay glued to the surface unless something knocked this off. */
  postStep(): void {
    const surface = this.restingOn;
    if (!surface) return;
    const s = surface.body;
    const b = this.body;
    const relative = Math.hypot(b.vx - s.vx, b.vy - s.vy);
    if (relative > 110 || s.speed() > 170 || Math.abs(s.w) > 4) {
      this.leaveSurface();
      return;
    }
    const c = Math.cos(s.angle);
    const sn = Math.sin(s.angle);
    b.x = s.x + this.restX * c - this.restY * sn;
    b.y = s.y + this.restX * sn + this.restY * c;
    b.angle = s.angle + this.restAngle;
    b.z = surface.def.height;
  }
}
