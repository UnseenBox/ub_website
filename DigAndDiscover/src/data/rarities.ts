export type RarityId = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

export interface RarityDef {
  id: RarityId;
  label: string;
  /** 0 = common ... 4 = legendary. Drives how big the reveal celebration is. */
  tier: number;
  /** Relative roll weight (initial balancing values, not fixed rules). */
  weight: number;
  color: number;
  css: string;
  /** Chance that the rock's outside glitters. A weak hint, never a guarantee. */
  sparkleChance: number;
}

export const RARITIES: readonly RarityDef[] = [
  { id: 'common', label: 'Common', tier: 0, weight: 60, color: 0xb9b1a4, css: '#8f8576', sparkleChance: 0.06 },
  { id: 'uncommon', label: 'Uncommon', tier: 1, weight: 25, color: 0x5fcf6e, css: '#2f9e45', sparkleChance: 0.12 },
  { id: 'rare', label: 'Rare', tier: 2, weight: 10, color: 0x4fa8ff, css: '#1f7ad6', sparkleChance: 0.25 },
  { id: 'epic', label: 'Epic', tier: 3, weight: 4, color: 0xb565ff, css: '#9037e0', sparkleChance: 0.4 },
  { id: 'legendary', label: 'Legendary', tier: 4, weight: 1, color: 0xffb627, css: '#e08a00', sparkleChance: 0.6 },
];
