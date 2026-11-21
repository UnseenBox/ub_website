import { EnemyDef, HitZone } from '../data/enemies';
import { MOD_EFFECTS, ModId } from '../data/upgrades';

export interface HitResult {
  damage: number;
  /** True if armour absorbed most of the hit (used for ricochet feedback). */
  deflected: boolean;
  headshot: boolean;
}

/**
 * Damage for one bullet hit. Headshot multiplier comes from the weapon; zone
 * and armour multipliers from the enemy; mods can double damage or pierce armour.
 */
export function bulletDamage(
  baseDamage: number,
  headshotMultiplier: number,
  zone: HitZone,
  enemy: EnemyDef,
  activeMods: ReadonlySet<ModId>,
): HitResult {
  let dmg = baseDamage;
  if (activeMods.has('double')) dmg *= MOD_EFFECTS.doubleMultiplier;
  const headshot = zone === 'head';
  if (headshot) dmg *= headshotMultiplier;
  let zoneMul = enemy.zoneMultiplier[zone];
  const armored = enemy.armoredZones.includes(zone);
  if (armored && activeMods.has('ap')) zoneMul = Math.max(zoneMul, 1);
  dmg *= zoneMul;
  return { damage: dmg, deflected: armored && zoneMul < 0.5, headshot };
}

/** Explosion damage with linear falloff to 25% at the edge; ignores armour. */
export function blastDamage(base: number, distance: number, radius: number, activeMods: ReadonlySet<ModId>): number {
  if (distance > radius) return 0;
  const falloff = 1 - 0.75 * (distance / radius);
  let dmg = base * falloff;
  if (activeMods.has('double')) dmg *= MOD_EFFECTS.doubleMultiplier;
  return dmg;
}

/** Kill payout. Called exactly once per kill; headshot bonus is part of the same payment. */
export function killReward(enemy: EnemyDef, headshotKill: boolean): number {
  return enemy.reward + (headshotKill ? enemy.headshotBonus : 0);
}
