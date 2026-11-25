// Workshop: permanent upgrades bought with Supplies between missions.
// Every owned weapon has four tracks of five levels; the bunker has one track.

import { BUNKER } from '../game/config';
import type { WeaponDef } from './weapons';

export type TrackId = 'damage' | 'handling' | 'magazine' | 'reload';

export interface TrackDef {
  id: TrackId;
  name: string;
  /** What one level does, for the upgrade card. */
  perLevel: string;
}

export const TRACKS: TrackDef[] = [
  { id: 'damage', name: 'Damage', perLevel: '+8% damage' },
  { id: 'handling', name: 'Handling', perLevel: '+6% fire rate, -8% spread' },
  { id: 'magazine', name: 'Magazine', perLevel: '+15% rounds per magazine' },
  { id: 'reload', name: 'Reload', perLevel: '-8% reload time' },
];

export const MAX_LEVEL = 5;
/** Cost of each level is base × growth^level. */
export const COST_GROWTH = 1.45;

/** Supplies for the first level of each weapon's tracks. */
export const WEAPON_BASE_COST: Record<string, number> = {
  service: 40,
  rpg: 100,
  tesla: 105,
  railgun: 110,
  m4: 55,
  shotgun: 60,
  m249: 80,
  m32: 90,
  m82: 95,
  flamer: 75,
};

export type WeaponLevels = Record<TrackId, number>;

export function emptyLevels(): WeaponLevels {
  return { damage: 0, handling: 0, magazine: 0, reload: 0 };
}

/** Supplies to buy the next level of a track, or null when it is maxed. */
export function trackCost(weaponId: string, level: number): number | null {
  if (level >= MAX_LEVEL) return null;
  const base = WEAPON_BASE_COST[weaponId] ?? 60;
  return Math.round(base * COST_GROWTH ** level);
}

/** A weapon's stats with its Workshop levels applied. */
export function upgradedWeapon(def: WeaponDef, lv: WeaponLevels | undefined): WeaponDef {
  if (!lv) return def;
  const handling = lv.handling;
  return {
    ...def,
    damage: def.damage * (1 + 0.08 * lv.damage),
    fireRate: def.fireRate * (1 + 0.06 * handling),
    spread: def.spread * (1 - 0.08 * handling),
    maxSpread: def.maxSpread * (1 - 0.08 * handling),
    bloomPerShot: def.bloomPerShot * (1 - 0.08 * handling),
    magazine: def.magazine + Math.max(lv.magazine, Math.floor(def.magazine * 0.15 * lv.magazine)),
    reloadTime: def.reloadTime * (1 - 0.08 * lv.reload),
  };
}

// ------------------------------------------------------------------ bunker

export const BUNKER_TRACK = {
  name: 'Reinforced Bunker',
  perLevel: '+150 bunker health',
  healthPerLevel: 150,
  baseCost: 70,
} as const;

export function bunkerCost(level: number): number | null {
  if (level >= MAX_LEVEL) return null;
  return Math.round(BUNKER_TRACK.baseCost * COST_GROWTH ** level);
}

export function bunkerHealth(level: number): number {
  return BUNKER.maxHealth + BUNKER_TRACK.healthPerLevel * Math.min(level, MAX_LEVEL);
}
