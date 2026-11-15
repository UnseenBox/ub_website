/**
 * Geological layers, listed from the surface downward.
 *
 * Everything that differs between layers is data here: how hard the ground is,
 * what it looks like, how the shovel's impact feels and what the dirt hides.
 * Add, remove, reorder or rebalance entries freely - the excavation system,
 * the terrain painter, the HUD gauge and the discovery rolls all read this list.
 */

export type LayerDetail = 'roots' | 'clay' | 'cracks' | 'boulders' | 'crystals';

export interface LayerLook {
  /** Base gradient from the top to the bottom of the layer (CSS colours). */
  top: string;
  bottom: string;
  /** Soft mottling blobs (rgba). */
  blobs: readonly string[];
  /** Dark and light speckles that give the soil its grain. */
  speckDark: string;
  speckLight: string;
  /** Decorative embedded stones (not collectable). Count is per 100,000 square field units. */
  stones: {
    per100k: number;
    minRadius: number;
    maxRadius: number;
    /** CSS colours picked at random for each stone. */
    tones: readonly string[];
    /** 0 = round pebbles, 1 = sharp angular boulders. */
    angular: number;
  };
  /** Layer specific environmental detail painted over the soil. */
  detail: LayerDetail;
  detailColor: string;
  /** Colour of the labels and the gauge segment for this layer. */
  gauge: number;
}

export interface LayerFeel {
  /** Tints of the flying clods when the shovel hits this ground. */
  chunkTints: readonly number[];
  chunkScale: number;
  /** Clods per swing at full efficiency (scaled down when the ground resists). */
  chunks: number;
  dustTint: number;
  /** Camera shake strength per swing. */
  shake: number;
  /** Hard ground makes the shovel bounce and clang. 0 = soft thud, 1 = rock hard. */
  clang: number;
  /** Sparkle sprites on impact (deep mineral glints). */
  sparks: number;
}

export interface LayerDiscovery {
  /** Chance that a swing in this layer turns up an embedded rock. */
  baseChance: number;
  /** Extra chance per swing since the last find (a mild pity timer, still random). */
  pityPerSwing: number;
  maxChance: number;
  /** Rarity weights in RARITIES order: common, uncommon, rare, epic, legendary. */
  rarityWeights: readonly [number, number, number, number, number];
  /** Extra hits needed to free a found rock (inclusive range). */
  freeHits: { min: number; max: number };
}

export interface LayerDef {
  id: string;
  name: string;
  /** Vertical size in field units. */
  thickness: number;
  /** Resistance. Efficiency of a swing = tool.power / hardness (clamped). */
  hardness: number;
  /** Multiplier on the stamina cost of one swing. */
  staminaMult: number;
  look: LayerLook;
  feel: LayerFeel;
  discovery: LayerDiscovery;
}

export const LAYERS: readonly LayerDef[] = [
  {
    id: 'surface-soil',
    name: 'Surface Soil',
    thickness: 340,
    hardness: 1.4,
    staminaMult: 1,
    look: {
      top: '#c99660',
      bottom: '#b07a45',
      blobs: ['rgba(214,160,104,0.55)', 'rgba(160,108,62,0.5)', 'rgba(190,134,82,0.55)', 'rgba(132,88,50,0.4)'],
      speckDark: 'rgba(60,30,10,0.22)',
      speckLight: 'rgba(255,232,190,0.18)',
      stones: { per100k: 12, minRadius: 5, maxRadius: 13, tones: ['#b9ab98', '#a39482', '#c8bba8'], angular: 0.15 },
      detail: 'roots',
      detailColor: '#6b4524',
      gauge: 0xc99660,
    },
    feel: { chunkTints: [0xffffff, 0xe0b890, 0xb98a60, 0x8f6440], chunkScale: 1, chunks: 11, dustTint: 0xe3c49c, shake: 0.0012, clang: 0, sparks: 0 },
    discovery: {
      baseChance: 0.12, pityPerSwing: 0.008, maxChance: 0.3,
      rarityWeights: [78, 17, 4.5, 0.5, 0],
      freeHits: { min: 1, max: 2 },
    },
  },
  {
    id: 'compact-soil',
    name: 'Compact Soil',
    thickness: 440,
    hardness: 3.2,
    staminaMult: 1.15,
    look: {
      top: '#b5703f',
      bottom: '#954f2b',
      blobs: ['rgba(204,132,82,0.5)', 'rgba(120,64,34,0.5)', 'rgba(228,176,130,0.28)', 'rgba(98,52,30,0.45)'],
      speckDark: 'rgba(52,22,8,0.26)',
      speckLight: 'rgba(255,214,170,0.16)',
      stones: { per100k: 20, minRadius: 6, maxRadius: 15, tones: ['#cdbba4', '#b8a38a', '#9c8872'], angular: 0.3 },
      detail: 'clay',
      detailColor: '#e8c9a0',
      gauge: 0xb5703f,
    },
    feel: { chunkTints: [0xf0c9a4, 0xc9895b, 0x9c5d36, 0x7a4526], chunkScale: 1.15, chunks: 9, dustTint: 0xd9a57a, shake: 0.0018, clang: 0.2, sparks: 0 },
    discovery: {
      baseChance: 0.11, pityPerSwing: 0.008, maxChance: 0.3,
      rarityWeights: [62, 25, 10, 2.5, 0.5],
      freeHits: { min: 1, max: 3 },
    },
  },
  {
    id: 'hard-earth',
    name: 'Hard Earth',
    thickness: 500,
    hardness: 5.5,
    staminaMult: 1.35,
    look: {
      top: '#9a8a70',
      bottom: '#76685a',
      blobs: ['rgba(176,160,134,0.5)', 'rgba(110,98,84,0.5)', 'rgba(140,126,108,0.5)', 'rgba(80,70,60,0.4)'],
      speckDark: 'rgba(30,24,18,0.3)',
      speckLight: 'rgba(240,232,214,0.18)',
      stones: { per100k: 26, minRadius: 7, maxRadius: 18, tones: ['#8d8f93', '#a4a6a8', '#767a80', '#b8b3a6'], angular: 0.6 },
      detail: 'cracks',
      detailColor: '#2c241c',
      gauge: 0x9a8a70,
    },
    feel: { chunkTints: [0xd8d0c0, 0xa89c88, 0x7c7060, 0x5e5448], chunkScale: 0.9, chunks: 7, dustTint: 0xc2b8a6, shake: 0.0026, clang: 0.55, sparks: 1 },
    discovery: {
      baseChance: 0.10, pityPerSwing: 0.008, maxChance: 0.28,
      rarityWeights: [50, 27, 15, 6, 2],
      freeHits: { min: 2, max: 3 },
    },
  },
  {
    id: 'rocky-soil',
    name: 'Rocky Soil',
    thickness: 520,
    hardness: 8,
    staminaMult: 1.6,
    look: {
      top: '#5f4a3e',
      bottom: '#43342b',
      blobs: ['rgba(110,86,70,0.5)', 'rgba(64,48,38,0.55)', 'rgba(90,72,60,0.45)', 'rgba(40,30,24,0.4)'],
      speckDark: 'rgba(14,8,4,0.35)',
      speckLight: 'rgba(230,210,190,0.14)',
      stones: { per100k: 44, minRadius: 9, maxRadius: 26, tones: ['#7c8088', '#656a72', '#8e9298', '#53575e', '#a39f98'], angular: 0.9 },
      detail: 'boulders',
      detailColor: '#25201c',
      gauge: 0x5f4a3e,
    },
    feel: { chunkTints: [0xb5b8bd, 0x8a8e95, 0x6a5648, 0x4a3b32], chunkScale: 0.85, chunks: 6, dustTint: 0x9a8e84, shake: 0.0034, clang: 0.8, sparks: 2 },
    discovery: {
      baseChance: 0.095, pityPerSwing: 0.008, maxChance: 0.28,
      rarityWeights: [40, 27, 20, 9, 4],
      freeHits: { min: 2, max: 4 },
    },
  },
  {
    id: 'deep-deposit',
    name: 'Deep Mineral Deposit',
    thickness: 560,
    hardness: 12,
    staminaMult: 2,
    look: {
      top: '#3d3858',
      bottom: '#272342',
      blobs: ['rgba(88,76,128,0.5)', 'rgba(32,28,60,0.55)', 'rgba(60,92,132,0.3)', 'rgba(24,20,44,0.45)'],
      speckDark: 'rgba(8,6,20,0.4)',
      speckLight: 'rgba(170,200,255,0.2)',
      stones: { per100k: 30, minRadius: 8, maxRadius: 22, tones: ['#5a5f86', '#464a70', '#6d6a9a', '#3a3d5c'], angular: 1 },
      detail: 'crystals',
      detailColor: '#6fe6ff',
      gauge: 0x6a5acd,
    },
    feel: { chunkTints: [0xa9b8ff, 0x7c8ad8, 0x56508a, 0x6fe6ff], chunkScale: 0.8, chunks: 6, dustTint: 0x8a84c8, shake: 0.0042, clang: 1, sparks: 4 },
    discovery: {
      baseChance: 0.09, pityPerSwing: 0.008, maxChance: 0.26,
      rarityWeights: [28, 26, 24, 15, 7],
      freeHits: { min: 3, max: 4 },
    },
  },
];
