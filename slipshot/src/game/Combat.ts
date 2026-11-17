import { COMBAT } from '../config';
import type { PhysicsObject } from '../physics/PhysicsObject';
import type { PhysicsManager, ImpactEvent, ProjectileHit } from '../physics/PhysicsManager';
import type { PartName } from '../physics/rig';
import type { Ragdoll } from '../physics/Ragdoll';
import type { SlimeSystem } from '../physics/SlimeSystem';
import type { Effects } from '../render/Effects';
import { clamp } from '../util/math';

export interface CombatContext {
  ragdolls: Ragdoll[];
  objects: PhysicsObject[];
  coatDuration: number;
  splatRadius: number;
  puddleLife: number;
}

function partMultiplier(part: PartName): number {
  if (part === 'head') return COMBAT.headMultiplier;
  if (part === 'torso' || part === 'pelvis') return COMBAT.torsoMultiplier;
  return COMBAT.limbMultiplier;
}

/**
 * Damage and slime rules. Projectile damage scales with approach speed.
 * Body bumps do damage only above the impact threshold, so landing a fall
 * hurts but a resting contact never does. Hits also coat, stagger and splat.
 */
export class CombatSystem {
  /** Camera trauma added by impacts; the controller consumes and decays it. */
  trauma = 0;
  private readonly lastImpact = new Map<Ragdoll, number>();

  constructor(
    private readonly physics: PhysicsManager,
    private readonly slime: SlimeSystem,
    private readonly effects: Effects,
  ) {}

  onProjectileHit(hit: ProjectileHit, ctx: CombatContext): void {
    const proj = hit.projectile;
    if (proj.consumed || !proj.alive) return;
    proj.consumed = true;
    proj.destroy(this.physics);

    const other = hit.other;
    this.trauma = Math.min(0.5, this.trauma + 0.05 + 0.012 * hit.speed);

    if (other.kind === 'part') {
      const victim = other.ragdoll;
      if (victim.alive) {
        const base = COMBAT.projectileBaseDamage + COMBAT.projectileDamagePerSpeed * Math.max(0, hit.speed - 3);
        const dmg = Math.min(COMBAT.projectileDamageCap, base * partMultiplier(other.part));
        this.damage(victim, dmg, other.part, hit.point);
        victim.coat(ctx.coatDuration, hit.point, other.part);
        if (hit.speed > COMBAT.staggerSpeed) victim.stagger(0.55);
      }
      this.slime.splat(hit.point, hit.normal, ctx.splatRadius, ctx.coatDuration, ctx.ragdolls, ctx.objects, victim);
      return;
    }

    if (other.kind === 'object') {
      other.obj.coat(ctx.coatDuration);
      this.slime.splat(hit.point, hit.normal, ctx.splatRadius, ctx.coatDuration, ctx.ragdolls, ctx.objects, null);
      return;
    }

    // Terrain. A hit from above leaves a puddle on the surface; sides and walls just splat.
    const surfaceUp = -hit.normal.y > 0.5;
    if (surfaceUp && (other.kind === 'ground' || other.kind === 'platform' || other.kind === 'puddle')) {
      this.slime.addPuddle(hit.otherBody, hit.point, ctx.splatRadius, ctx.puddleLife);
    }
    this.slime.splat(hit.point, hit.normal, ctx.splatRadius, ctx.coatDuration, ctx.ragdolls, ctx.objects, null);
  }

  onImpact(imp: ImpactEvent): void {
    const r = imp.ragdoll;
    if (!r.alive) return;
    const now = this.physics.time;
    const last = this.lastImpact.get(r) ?? -10;
    if (now - last < COMBAT.impactCooldown) return;

    const over = imp.speed - COMBAT.impactThreshold;
    const raw = clamp(over * COMBAT.impactDamagePerSpeed, 0, COMBAT.impactDamageCap);
    const dmg = raw * partMultiplier(imp.part);
    if (dmg < 0.4) return;

    this.lastImpact.set(r, now);
    this.trauma = Math.min(0.5, this.trauma + 0.02 + 0.01 * over);
    this.damage(r, dmg, imp.part, imp.point);
    if (imp.speed > COMBAT.staggerSpeed) r.stagger(0.4);
    this.effects.ring(imp.point.x, imp.point.y, '#ffffff', 6);
  }

  /** Apply damage and show the number. Death is handled by the controller. */
  damage(r: Ragdoll, amount: number, part: PartName, at: { x: number; y: number }): void {
    if (!r.alive) return;
    r.hp = Math.max(0, r.hp - amount);
    r.flash(part);
    const text = `-${Math.max(1, Math.round(amount))}`;
    this.effects.text(at.x, at.y + 0.15, text, r.team === 'player' ? '#ff6b6b' : '#ffe066');
  }

  /** Tidy up per-character bookkeeping for characters that were removed. */
  forget(r: Ragdoll): void {
    this.lastImpact.delete(r);
  }
}
