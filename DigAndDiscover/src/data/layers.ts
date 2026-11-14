/**
 * Geological layers, listed from the surface downward.
 *
 * Everything that differs between layers is data here: how hard the ground is,
 * what it looks like, how the shovel's impact feels and what the dirt hides.
 * Add, remove, reorder or rebalance entries freely - the excavation system,
 * the terrain painter, the HUD gauge and the discovery rolls all read this list.
 */

export type LayerDetail = 'roots' | 'clay' | 'cracks' | 'boulders' | 'crystals' | 'bones' | 'bricks' | 'magma';

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
  /** Multiplies the value of rocks found here (deeper = richer). Default 1. */
  valueMult?: number;
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
    thickness: 300,
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
    thickness: 340,
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
    thickness: 360,
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
    thickness: 360,
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
    thickness: 360,
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
  {
    id: 'fossil-bed',
    name: 'Fossil Bed',
    thickness: 360,
    hardness: 15,
    staminaMult: 2.3,
    look: {
      top: '#c9b48a',
      bottom: '#a68d62',
      blobs: ['rgba(232,214,168,0.5)', 'rgba(140,114,74,0.5)', 'rgba(250,236,200,0.3)', 'rgba(104,82,52,0.4)'],
      speckDark: 'rgba(60,44,22,0.26)',
      speckLight: 'rgba(255,246,222,0.22)',
      stones: { per100k: 24, minRadius: 6, maxRadius: 16, tones: ['#e6d8b4', '#cdbd96', '#b3a47c'], angular: 0.5 },
      detail: 'bones',
      detailColor: '#f4ead0',
      gauge: 0xc9b48a,
    },
    feel: { chunkTints: [0xf0e4c4, 0xcdb88a, 0xa68d62, 0x7c6644], chunkScale: 0.85, chunks: 6, dustTint: 0xe0d2aa, shake: 0.0046, clang: 1, sparks: 3 },
    discovery: {
      baseChance: 0.09, pityPerSwing: 0.008, maxChance: 0.26,
      rarityWeights: [24, 25, 25, 17, 9],
      freeHits: { min: 3, max: 5 },
      valueMult: 1.5,
    },
  },
  {
    id: 'buried-ruins',
    name: 'Buried Ruins',
    thickness: 360,
    hardness: 19,
    staminaMult: 2.6,
    look: {
      top: '#52606a',
      bottom: '#36424c',
      blobs: ['rgba(110,128,140,0.45)', 'rgba(30,38,46,0.55)', 'rgba(80,104,116,0.35)', 'rgba(20,26,32,0.45)'],
      speckDark: 'rgba(8,12,16,0.4)',
      speckLight: 'rgba(200,225,235,0.16)',
      stones: { per100k: 26, minRadius: 8, maxRadius: 20, tones: ['#7a8890', '#5f6e78', '#93a3ac', '#46535c'], angular: 0.8 },
      detail: 'bricks',
      detailColor: '#8fa3ad',
      gauge: 0x52606a,
    },
    feel: { chunkTints: [0xb8c8d0, 0x8a9aa4, 0x5f6e78, 0x3a464e], chunkScale: 0.85, chunks: 6, dustTint: 0x9aaab2, shake: 0.0052, clang: 1, sparks: 3 },
    discovery: {
      baseChance: 0.09, pityPerSwing: 0.008, maxChance: 0.26,
      rarityWeights: [20, 23, 26, 20, 11],
      freeHits: { min: 3, max: 5 },
      valueMult: 1.9,
    },
  },
  {
    id: 'frozen-cavern',
    name: 'Frozen Cavern',
    thickness: 360,
    hardness: 24,
    staminaMult: 3,
    look: {
      top: '#7fa8c8',
      bottom: '#4f7898',
      blobs: ['rgba(190,226,248,0.45)', 'rgba(40,78,112,0.5)', 'rgba(230,246,255,0.3)', 'rgba(30,58,88,0.45)'],
      speckDark: 'rgba(10,30,50,0.3)',
      speckLight: 'rgba(240,252,255,0.35)',
      stones: { per100k: 22, minRadius: 7, maxRadius: 20, tones: ['#c8e4f4', '#9fc8e0', '#7aa8c8', '#e6f4fc'], angular: 1 },
      detail: 'crystals',
      detailColor: '#d8f4ff',
      gauge: 0x7fa8c8,
    },
    feel: { chunkTints: [0xf0fbff, 0xbfe4f8, 0x8ec4e4, 0x6aa0c4], chunkScale: 0.8, chunks: 7, dustTint: 0xdaf2ff, shake: 0.0056, clang: 1, sparks: 5 },
    discovery: {
      baseChance: 0.09, pityPerSwing: 0.008, maxChance: 0.26,
      rarityWeights: [17, 21, 26, 23, 13],
      freeHits: { min: 4, max: 5 },
      valueMult: 2.4,
    },
  },
  {
    id: 'magma-veins',
    name: 'Magma Veins',
    thickness: 360,
    hardness: 30,
    staminaMult: 3.4,
    look: {
      top: '#4a2420',
      bottom: '#2c1210',
      blobs: ['rgba(120,44,32,0.5)', 'rgba(24,8,8,0.6)', 'rgba(160,70,30,0.3)', 'rgba(16,6,6,0.5)'],
      speckDark: 'rgba(6,2,2,0.45)',
      speckLight: 'rgba(255,150,70,0.22)',
      stones: { per100k: 30, minRadius: 8, maxRadius: 22, tones: ['#3a2a28', '#2a1c1a', '#4e3a36', '#1e1412'], angular: 1 },
      detail: 'magma',
      detailColor: '#ff7a1a',
      gauge: 0xc2441f,
    },
    feel: { chunkTints: [0xff9a3a, 0xc2441f, 0x5a2a22, 0x2e1614], chunkScale: 0.85, chunks: 7, dustTint: 0xa8603a, shake: 0.0062, clang: 1, sparks: 6 },
    discovery: {
      baseChance: 0.09, pityPerSwing: 0.008, maxChance: 0.26,
      rarityWeights: [13, 19, 26, 26, 16],
      freeHits: { min: 4, max: 6 },
      valueMult: 3,
    },
  },
  {
    id: 'heart-of-the-earth',
    name: 'Heart of the Earth',
    thickness: 380,
    hardness: 38,
    staminaMult: 3.8,
    look: {
      top: '#3a1f5c',
      bottom: '#1c0e38',
      blobs: ['rgba(120,70,190,0.5)', 'rgba(20,8,44,0.6)', 'rgba(255,200,80,0.18)', 'rgba(12,4,30,0.5)'],
      speckDark: 'rgba(6,2,16,0.45)',
      speckLight: 'rgba(255,224,130,0.3)',
      stones: { per100k: 26, minRadius: 8, maxRadius: 24, tones: ['#5a3a8a', '#44286e', '#7a52b0', '#2e1a52'], angular: 1 },
      detail: 'crystals',
      detailColor: '#ffd84d',
      gauge: 0xffb627,
    },
    feel: { chunkTints: [0xffe08a, 0xc89cff, 0x7a52b0, 0x3a1f5c], chunkScale: 0.8, chunks: 8, dustTint: 0xb89cf0, shake: 0.007, clang: 1, sparks: 8 },
    discovery: {
      baseChance: 0.09, pityPerSwing: 0.008, maxChance: 0.26,
      rarityWeights: [8, 16, 26, 29, 21],
      freeHits: { min: 5, max: 6 },
      valueMult: 4,
    },
  },
];
