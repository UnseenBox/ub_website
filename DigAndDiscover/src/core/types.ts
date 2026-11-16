import type { ExteriorDef } from '../data/exteriors';
import type { MineralDef } from '../data/minerals';
import type { RarityDef } from '../data/rarities';

export interface Rock {
  id: string;
  /** Seed for deterministic artwork (outside and cross-section share a silhouette). */
  seed: number;
  exterior: ExteriorDef;
  /** Hidden until the rock is cut. */
  mineral: MineralDef;
  rarity: RarityDef;
  size: number;
  value: number;
  sparkly: boolean;
  cut: boolean;
  /** Layer the rock was found in (a better cut stays inside the layer's minerals). */
  layer: number;
  /** The deposit's value multiplier when it was found. */
  valueMult: number;
}

export type GameMode = 'dig' | 'workshop';
