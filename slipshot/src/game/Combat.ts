import { COMBAT, FORTRESS, PLAYER_ID, SLIME } from '../config';
import type { ShotSpec } from './catalog';
import type { FortressPiece } from './Fortress';
import type { PhysicsObject } from '../physics/PhysicsObject';
import type { PhysicsManager, ImpactEvent, ProjectileHit } from '../physics/PhysicsManager';
import type { Tag } from '../physics/tags';
import type { PartName } from '../physics/rig';
import type { Ragdoll } from '../physics/Ragdoll';
import type { SlimeSystem } from '../physics/SlimeSystem';
import type { Effects } from '../render/Effects';
import { clamp } from '../util/math';
import type { Well } from './Mechanics';

export interface CombatContext {
  ragdolls: Ragdoll[];
  objects: PhysicsObject[];
  coatDuration: number;
  splatRadius: number;
  puddleLife: number;
  /** Releases mini blobs from a split shot. The controller creates the bodies. */
  spawnSplit(origin: { x: number; y: number }, normal: { x: number; y: number }, ownerId: number, shot: ShotSpec): void;
  /** Releases shots in a ring from a point (cluster bombs). */
  spawnRadial(origin: { x: number; y: number }, count: number, ownerId: number, shot: ShotSpec): void;
  /** Leaves a gravity well at a point. */
  addWell(at: { x: number; y: number }, well: Well): void;
  /** A shot hit a fortress piece. The controller decides whose shots hurt it, and handles a collapse. */
  damageBlock(piece: FortressPiece, amount: number, ownerId: number): void;
  /** A character took a direct hit; the controller uses this for the combo meter. */
  onCharacterHit(victim: Ragdoll, damage: number, at: { x: number; y: number }): void;
}

interface DamageOptions {
  /** Show the floating number. Default true. */
  text?: boolean;
  /** Flash the hit body part. Default true. */
  flash?: boolean;
}

/** Damage from loose objects (crates and balls), as a share of the normal impact damage. */
const THROWN_IMPACT_MUL = 0.6;

/** Comic words for slime hits on enemies. */
const HIT_WORDS = ['SPLAT!', 'SPLOOSH!', 'GLORP!', 'SPLORT!', 'BLORP!', 'SPLUT!'];

function partMultiplier(part: PartName): number {
  if (part === 'head') return COMBAT.headMultiplier;
  if (part === 'torso' || part === 'pelvis') return COMBAT.torsoMultiplier;
  return COMBAT.limbMultiplier;
}

/**
 * Damage and slime rules. Projectile damage scales with approach speed and the
 * shot's damage multiplier. Body bumps do damage only above the impact
 * threshold. Shots can bounce, drip, split, pierce, explode or leave wells, all
 * driven by their ShotSpec.
 */
export class CombatSystem {
  /** Camera trauma added by impacts; the controller consumes and decays it. */
  trauma = 0;
  /** Seconds the simulation is frozen after a solid hit. */
  hitstop = 0;
  private readonly lastImpact = new Map<Ragdoll, number>();
  private readonly dripAcc = new Map<Ragdoll, number>();

  constructor(
    private readonly physics: PhysicsManager,
    private readonly slime: SlimeSystem,
    private readonly effects: Effects,
  ) {}

  /** Take up to dt seconds of hitstop and return the amount the simulation should skip. */
  consumeHitstop(dt: number): number {
    const used = Math.min(this.hitstop, dt);
    this.hitstop -= used;
    return used;
  }

  onProjectileHit(hit: ProjectileHit, ctx: CombatContext): void {
    const proj = hit.projectile;
    if (proj.consumed || !proj.alive) return;
    const shot = proj.shot;
    if (hit.other.kind === 'gum') hit.other.gum.jiggle = 1;
    // A gum blob stuck to a character counts as a hit on that character.
    const other: Tag =
      hit.other.kind === 'gum' ? { kind: 'part', ragdoll: hit.other.gum.host, part: hit.other.gum.part, foot: false } : hit.other;
    if (other.kind === 'block') {
      // Physics already lets the player's own shots through; this guards any stray contact.
      if (proj.ownerId === PLAYER_ID) return;
      ctx.damageBlock(other.piece, FORTRESS.shotDamage * shot.damageMul, proj.ownerId);
      // A jelly pad sends the shot back: one free bounce, and the pad's restitution does the rest.
      if (other.piece.def.id === 'jelly') proj.bouncesLeft = Math.max(proj.bouncesLeft, 1);
    }

    // Bouncers rebound off terrain and loose objects until they run out of
    // bounces. The cooldown stops one bounce from being counted twice.
    const terrain =
      other.kind === 'ground' || other.kind === 'platform' || other.kind === 'puddle' || other.kind === 'wall' || other.kind === 'block';
    const bounceable = terrain || other.kind === 'object';
    const now = this.physics.time;
    if (bounceable && proj.bouncesLeft > 0 && now - proj.lastBounce > 0.1) {
      proj.bouncesLeft--;
      proj.lastBounce = now;
      this.effects.ring(hit.point.x, hit.point.y, proj.color, 6);
      this.trauma = Math.min(0.5, this.trauma + 0.02);
      return;
    }

    // Piercing shots (boomerangs) hit each character once and carry on.
    if (shot.pierce && other.kind === 'part') {
      if (proj.hitTargets.has(other.ragdoll)) return;
      proj.hitTargets.add(other.ragdoll);
      this.hitCharacter(other.ragdoll, other.part, hit, ctx, 1);
      return;
    }

    proj.consumed = true;
    proj.destroy(this.physics);
    this.trauma = Math.min(0.5, this.trauma + 0.05 + 0.012 * hit.speed);

    if (shot.explode) {
      this.explode(hit.point, shot, proj.ownerId, ctx);
      return;
    }
    if (shot.well) {
      ctx.addWell(hit.point, { ...shot.well, x: hit.point.x, y: hit.point.y });
      this.slime.splat(hit.point, hit.normal, ctx.splatRadius * 0.6, ctx.coatDuration, ctx.ragdolls, ctx.objects, null);
      this.effects.ring(hit.point.x, hit.point.y, shot.color, 10);
      return;
    }

    const splatRadius = ctx.splatRadius * shot.splatMul;

    if (other.kind === 'part') {
      this.hitCharacter(other.ragdoll, other.part, hit, ctx, 1);
      this.slime.splat(hit.point, hit.normal, splatRadius, ctx.coatDuration, ctx.ragdolls, ctx.objects, other.ragdoll);
      if (other.ragdoll.team === 'enemy') this.gumUp(other.ragdoll, other.part, hit, shot);
    } else if (other.kind === 'object') {
      other.obj.coat(ctx.coatDuration);
      this.slime.splat(hit.point, hit.normal, splatRadius, ctx.coatDuration, ctx.ragdolls, ctx.objects, null);
    } else {
      // Terrain. A hit from above leaves a puddle on the surface; sides and walls just splat.
      const surfaceUp = -hit.normal.y > 0.5;
      if (surfaceUp && (other.kind === 'ground' || other.kind === 'platform' || other.kind === 'puddle')) {
        const radius = splatRadius * shot.puddleMul;
        const life = ctx.puddleLife * shot.puddleLifeMul;
        if (shot.glue > 0) this.slime.addPuddle(hit.otherBody, hit.point, radius, life, shot.glue, true);
        else this.slime.addPuddle(hit.otherBody, hit.point, radius, life);
      }
      this.slime.splat(hit.point, hit.normal, splatRadius, ctx.coatDuration, ctx.ragdolls, ctx.objects, null);
    }

    if (shot.splitCount > 0) ctx.spawnSplit(hit.point, hit.normal, proj.ownerId, shot);
  }

  /**
   * Slime that hits an enemy bursts, pops the body part back, and sticks to it as
   * a gum blob. The blob is welded to the part, so it jiggles with the enemy until
   * it fades.
   */
  private gumUp(enemy: Ragdoll, part: PartName, hit: ProjectileHit, shot: ShotSpec): void {
    const n = hit.normal;
    this.effects.burst(hit.point.x, hit.point.y, shot.color, 24, 9, -n.x, -n.y);
    this.effects.burst(hit.point.x, hit.point.y, '#e9ffd6', 8, 5, -n.x, -n.y);
    this.effects.ring(hit.point.x, hit.point.y, shot.color, 12);
    this.trauma = Math.min(0.5, this.trauma + 0.06);
    const body = enemy.parts.get(part)?.body;
    if (body) {
      // Pop: a small push into the enemy, along the shot's direction.
      const k = Math.min(4, 0.3 * shot.mass * Math.max(4, hit.speed));
      body.applyLinearImpulse({ x: n.x * k, y: n.y * k }, hit.point, true);
    }
    // Gum already on this enemy ripples with the new hit.
    for (const g of this.slime.gums) if (g.host === enemy) g.jiggle = Math.max(g.jiggle, 0.7);
    this.slime.addGum(enemy, part, hit.point, Math.max(0.22, shot.radius * 2.2), SLIME.gumLife);
  }

  /**
   * A comic sound word on a hit to an enemy: a headshot gets its own gold word,
   * a flash and a shockwave; other hits get a random splat word, bigger when
   * they hurt more.
   */
  private hitWord(part: PartName, dmg: number, hit: ProjectileHit): void {
    const at = { x: hit.point.x + 0.35, y: hit.point.y + 0.9 };
    if (part === 'head') {
      this.effects.text(at.x, at.y + 0.3, 'HEADSHOT!', '#ffd23f', 30);
      this.effects.shockwave(hit.point.x, hit.point.y, '#ffd23f', 1.4, 0.35);
      this.effects.flash(0.18);
      this.hitstop = Math.max(this.hitstop, 0.1);
      this.trauma = Math.min(0.6, this.trauma + 0.12);
      return;
    }
    const word = HIT_WORDS[Math.floor(Math.random() * HIT_WORDS.length)];
    this.effects.text(at.x, at.y, word, '#d6ff8a', dmg >= 18 ? 30 : 26);
    this.effects.shockwave(hit.point.x, hit.point.y, '#eaffd9', 0.9, 0.3);
  }

  /** Direct damage, coating, stagger and drip for a body hit. `scale` multiplies the damage. */
  private hitCharacter(victim: Ragdoll, part: PartName, hit: ProjectileHit, ctx: CombatContext, scale: number): void {
    if (!victim.alive) return;
    const shot = hit.projectile.shot;
    const base = COMBAT.projectileBaseDamage + COMBAT.projectileDamagePerSpeed * Math.max(0, hit.speed - 3);
    const dmg = Math.min(COMBAT.projectileDamageCap, base * partMultiplier(part) * shot.damageMul * scale);
    this.damage(victim, dmg, part, hit.point);
    ctx.onCharacterHit(victim, dmg, hit.point);
    this.hitstop = Math.max(this.hitstop, Math.min(0.09, 0.03 + dmg * 0.0012));
    if (victim.team === 'enemy') this.hitWord(part, dmg, hit);
    victim.coat(ctx.coatDuration, hit.point, part);
    if (hit.speed > COMBAT.staggerSpeed) victim.stagger(0.55);
    if (shot.dripTime > 0) victim.drip(shot.dripTime, shot.dripDps);
  }

  /**
   * Explosion: pushes every body in the blast radius (with falloff), damages
   * characters by distance, splats slime, and releases cluster shots if any.
   */
  explode(at: { x: number; y: number }, shot: ShotSpec, ownerId: number, ctx: CombatContext): void {
    const e = shot.explode;
    if (!e) return;
    this.effects.ring(at.x, at.y, shot.color, 16);
    this.effects.burst(at.x, at.y, shot.color, 28, 10, 0, 1);
    this.trauma = Math.min(0.6, this.trauma + 0.3);
    this.hitstop = Math.max(this.hitstop, 0.09);

    for (const r of ctx.ragdolls) {
      if (!r.alive) continue;
      let nearest = Infinity;
      let total = 0;
      for (const part of r.parts.values()) total += part.spec.mass;
      for (const part of r.parts.values()) {
        const p = part.body.getPosition();
        const d = Math.hypot(p.x - at.x, p.y - at.y);
        nearest = Math.min(nearest, d);
        if (d >= e.radius) continue;
        const f = 1 - d / e.radius;
        const ux = d < 0.05 ? 0 : (p.x - at.x) / d;
        const uy = d < 0.05 ? 1 : (p.y - at.y) / d;
        // The blast's impulse is shared by mass, so the whole character moves together.
        const share = e.impulse * f * (part.spec.mass / total);
        part.body.applyLinearImpulse({ x: ux * share, y: uy * share }, p, true);
      }
      if (nearest < e.radius) {
        const f = 1 - nearest / e.radius;
        const blast = e.damage * f;
        this.damage(r, blast, 'torso', r.torsoPosition());
        ctx.onCharacterHit(r, blast, r.torsoPosition());
        if (f > 0.35) r.stagger(0.8);
      }
    }

    for (const o of ctx.objects) {
      const p = o.body.getPosition();
      const d = Math.hypot(p.x - at.x, p.y - at.y);
      if (d >= e.radius) continue;
      const f = 1 - d / e.radius;
      const ux = d < 0.05 ? 0 : (p.x - at.x) / d;
      const uy = d < 0.05 ? 1 : (p.y - at.y) / d;
      const share = e.impulse * 0.5 * f;
      o.body.applyLinearImpulse({ x: ux * share, y: uy * share }, p, true);
    }

    this.slime.splat(at, { x: 0, y: 1 }, e.radius * 0.6, ctx.coatDuration, ctx.ragdolls, ctx.objects, null);
    if (e.clusterCount > 0 && e.clusterShot) ctx.spawnRadial(at, e.clusterCount, ownerId, e.clusterShot);
  }

  onImpact(imp: ImpactEvent): void {
    const r = imp.ragdoll;
    if (!r.alive) return;
    const now = this.physics.time;
    const last = this.lastImpact.get(r) ?? -10;
    if (now - last < COMBAT.impactCooldown) return;

    const over = imp.speed - COMBAT.impactThreshold;
    const raw = clamp(over * COMBAT.impactDamagePerSpeed, 0, COMBAT.impactDamageCap);
    // Thrown objects hurt, but less than a fall: a crate is not a boulder.
    const dmg = raw * partMultiplier(imp.part) * (imp.source === 'object' ? THROWN_IMPACT_MUL : 1);
    if (dmg < 0.4) return;

    this.lastImpact.set(r, now);
    this.trauma = Math.min(0.5, this.trauma + 0.02 + 0.01 * over);
    this.damage(r, dmg, imp.part, imp.point);
    if (imp.speed > COMBAT.staggerSpeed) r.stagger(0.4);
    this.effects.ring(imp.point.x, imp.point.y, '#ffffff', 6);
  }

  /** Apply damage, scaled by the character's armour, and show the number. Death is handled by the controller. */
  damage(r: Ragdoll, amount: number, part: PartName, at: { x: number; y: number }, opts: DamageOptions = {}): void {
    if (!r.alive) return;
    r.hp = Math.max(0, r.hp - amount * r.incomingMul);
    if (opts.flash !== false) r.flash(part);
    if (opts.text !== false) {
      const shown = Math.max(1, Math.round(amount * r.incomingMul));
      this.effects.text(at.x, at.y + 0.15, `-${shown}`, r.team === 'player' ? '#ff6b6b' : '#ffe066');
    }
  }

  /** Slime drip: steady damage over time from Clinger shots. Numbers are batched so they stay readable. */
  tickDrips(dt: number, ragdolls: Ragdoll[]): void {
    for (const r of ragdolls) {
      if (!r.alive || r.dripTime <= 0 || r.dripDps <= 0) continue;
      const amount = r.dripDps * dt;
      this.damage(r, amount, 'torso', r.torsoPosition(), { text: false, flash: false });
      let acc = (this.dripAcc.get(r) ?? 0) + amount * r.incomingMul;
      if (acc >= 3) {
        const t = r.torsoPosition();
        this.effects.text(t.x, t.y + 0.5, `-${Math.round(acc)}`, '#c77dff');
        acc = 0;
      }
      this.dripAcc.set(r, acc);
    }
  }

  /** Clean up bookkeeping for a character that was removed. */
  forget(r: Ragdoll): void {
    this.lastImpact.delete(r);
    this.dripAcc.delete(r);
  }
}
