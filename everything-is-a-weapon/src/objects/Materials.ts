export type MaterialId =
  | 'wood'
  | 'metal'
  | 'glass'
  | 'plastic'
  | 'rubber'
  | 'paper'
  | 'electronic'
  | 'fabric'
  | 'ceramic';

export type SoundKind = 'wood' | 'metal' | 'glass' | 'plastic' | 'rubber' | 'paper' | 'soft';
export type DebrisKind = 'splinter' | 'spark' | 'shard' | 'chip' | 'scrap' | 'dust' | 'feather';

export interface Material {
  readonly id: MaterialId;
  /** Surface friction in contacts. */
  readonly friction: number;
  readonly restitution: number;
  /** Multiplier on damage this material deals to creatures. */
  readonly hardness: number;
  /** Multiplier on structural damage this material takes. */
  readonly fragility: number;
  /** How quickly it catches fire per second of exposure (0 = never). */
  readonly flammability: number;
  /** Seconds it burns before being consumed. */
  readonly burnTime: number;
  readonly conductive: boolean;
  readonly sound: SoundKind;
  readonly debris: DebrisKind;
  readonly color: string;
  readonly shade: string;
}

export const MATERIALS: Readonly<Record<MaterialId, Material>> = {
  wood: {
    id: 'wood', friction: 0.5, restitution: 0.22, hardness: 1, fragility: 1, flammability: 1.1, burnTime: 9,
    conductive: false, sound: 'wood', debris: 'splinter', color: '#c98a4b', shade: '#8f5a2c',
  },
  metal: {
    id: 'metal', friction: 0.3, restitution: 0.3, hardness: 1.15, fragility: 0.6, flammability: 0, burnTime: 0,
    conductive: true, sound: 'metal', debris: 'spark', color: '#aab4c4', shade: '#6d7689',
  },
  glass: {
    id: 'glass', friction: 0.25, restitution: 0.15, hardness: 1.1, fragility: 7, flammability: 0, burnTime: 0,
    conductive: false, sound: 'glass', debris: 'shard', color: '#8fe3c8', shade: '#4fae93',
  },
  plastic: {
    id: 'plastic', friction: 0.4, restitution: 0.35, hardness: 0.85, fragility: 1.3, flammability: 0, burnTime: 0,
    conductive: false, sound: 'plastic', debris: 'chip', color: '#e8e4f0', shade: '#a9a3bd',
  },
  rubber: {
    id: 'rubber', friction: 0.8, restitution: 0.62, hardness: 0.7, fragility: 0.1, flammability: 0, burnTime: 0,
    conductive: false, sound: 'rubber', debris: 'chip', color: '#ff7b54', shade: '#c24d2e',
  },
  paper: {
    id: 'paper', friction: 0.6, restitution: 0.1, hardness: 0.8, fragility: 0.5, flammability: 3, burnTime: 3.5,
    conductive: false, sound: 'paper', debris: 'scrap', color: '#f4efe2', shade: '#c9c1ab',
  },
  electronic: {
    id: 'electronic', friction: 0.4, restitution: 0.15, hardness: 1.05, fragility: 1.5, flammability: 0, burnTime: 0,
    conductive: true, sound: 'plastic', debris: 'spark', color: '#d9d4c7', shade: '#9b958a',
  },
  fabric: {
    id: 'fabric', friction: 0.9, restitution: 0.05, hardness: 0.5, fragility: 0.3, flammability: 2, burnTime: 5,
    conductive: false, sound: 'soft', debris: 'feather', color: '#b56576', shade: '#7d3f4d',
  },
  ceramic: {
    id: 'ceramic', friction: 0.5, restitution: 0.12, hardness: 1.2, fragility: 3.2, flammability: 0, burnTime: 0,
    conductive: false, sound: 'glass', debris: 'shard', color: '#d9764a', shade: '#a14e2b',
  },
};
