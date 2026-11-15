import type { RarityId } from './rarities';

/** How the inside of a cut rock is drawn. */
export type InteriorStyle =
  | 'plain'
  | 'cluster'
  | 'banded'
  | 'geode'
  | 'gem'
  | 'opal'
  | 'prism'
  | 'druse'
  | 'veined'
  | 'swirl'
  | 'shards'
  | 'ember'
  | 'galaxy'
  | 'bubbles'
  | 'fibrous'
  | 'dendrite'
  | 'frost'
  | 'spiral'
  | 'hollow'
  | 'chalky';

/**
 * How the cut of a rock should feel. Purely descriptive data for now: the
 * workshop scene will map these onto its reveal effects.
 */
export type RevealStyle =
  | 'dust'
  | 'sparkle'
  | 'glow'
  | 'shimmer'
  | 'embers'
  | 'frost'
  | 'storm'
  | 'rainbow'
  | 'stars'
  | 'fizzle';

/** Chance that a rock's outside is one of its mineral's hinted exteriors. */
export const EXTERIOR_HINT_CHANCE = 0.4;

export interface MineralDef {
  id: string;
  name: string;
  rarity: RarityId;
  /** Relative weight within its rarity tier. */
  weight: number;
  style: InteriorStyle;
  /** Style-specific palette. Index 0 is always the signature color. */
  colors: number[];
  /** Fictional sale value range before the size bonus. */
  value: [number, number];
  flavor: string;
  /** A dud: nothing special inside. */
  dud?: boolean;
  glow?: boolean;
  /** First layer index where this mineral can appear (0 = Surface Soil). */
  minLayer?: number;
  /** Last layer index where this mineral can appear. */
  maxLayer?: number;
  /** Exterior ids that suit this mineral. A weak hint only. */
  exteriors?: readonly string[];
  /** How the cut should feel. */
  reveal?: RevealStyle;
}

export const MINERALS: readonly MineralDef[] = [
  // Common
  { id: 'stone', name: 'Ordinary Stone', rarity: 'common', weight: 40, style: 'plain',
    colors: [0x9a958e, 0x7b766f, 0xb3aea6], value: [3, 6], flavor: 'Just a rock. Happens to the best of us.', dud: true },
  { id: 'quartz', name: 'Quartz Cluster', rarity: 'common', weight: 35, style: 'cluster',
    colors: [0xf4f8ff, 0xd5d9e2, 0xb9c3d4], value: [10, 16], flavor: 'Clear little crystal spikes.' },
  { id: 'calcite', name: 'Honey Calcite', rarity: 'common', weight: 25, style: 'cluster',
    colors: [0xffc27f, 0xf2dfc4, 0xe5a466], value: [8, 14], flavor: 'Warm and glossy, like candy.' },

  // Uncommon
  { id: 'agate', name: 'Banded Agate', rarity: 'uncommon', weight: 34, style: 'banded',
    colors: [0x7fb7c9, 0xf1e6d2, 0x4f87a3, 0xc9dfe6, 0x2f6585], value: [26, 40], flavor: 'Rings like a tiny ocean.' },
  { id: 'amethyst', name: 'Amethyst Geode', rarity: 'uncommon', weight: 33, style: 'geode',
    colors: [0xb36ae3, 0x7a3fb0, 0x3d1f5c], value: [38, 56], flavor: 'A purple cave of crystals!' },
  { id: 'citrine', name: 'Citrine Geode', rarity: 'uncommon', weight: 33, style: 'geode',
    colors: [0xffc93c, 0xe08a1c, 0x6b3a10], value: [32, 50], flavor: 'Sunshine trapped in stone.' },

  // Rare
  { id: 'garnet', name: 'Garnet', rarity: 'rare', weight: 34, style: 'gem',
    colors: [0xc8243f, 0x6e1022], value: [95, 135], flavor: 'Deep red and full of fire.' },
  { id: 'opal', name: 'Fire Opal', rarity: 'rare', weight: 30, style: 'opal',
    colors: [0xeef4f6, 0x7fe0d0, 0xff9ad5, 0x9fb4ff, 0xffe27a, 0x8ef08a], value: [120, 175], flavor: 'Every color at once.' },
  { id: 'aquamarine', name: 'Aquamarine', rarity: 'rare', weight: 36, style: 'gem',
    colors: [0x6fe3ea, 0x2a9fb0], value: [105, 150], flavor: 'Sea-blue and glassy.' },

  // Epic
  { id: 'emerald', name: 'Emerald', rarity: 'epic', weight: 34, style: 'gem',
    colors: [0x22c46c, 0x0d7a40], value: [320, 440], flavor: 'A brilliant green treasure.' },
  { id: 'ruby', name: 'Ruby', rarity: 'epic', weight: 30, style: 'gem',
    colors: [0xff2e58, 0x9c0f2e], value: [340, 470], flavor: 'Glowing like a cherry ember.' },
  { id: 'sapphire', name: 'Sapphire', rarity: 'epic', weight: 36, style: 'gem',
    colors: [0x3a6bff, 0x1a2f9c], value: [310, 450], flavor: 'Midnight blue brilliance.' },

  // Legendary (fictional specimens)
  { id: 'starfire', name: 'Starfire Geode', rarity: 'legendary', weight: 36, minLayer: 2, style: 'geode', glow: true,
    colors: [0xffd84d, 0xff6a2b, 0x5a1205], value: [1400, 2000], flavor: 'It is warm to the touch...' },
  { id: 'heartstone', name: 'Prismatic Heartstone', rarity: 'legendary', weight: 28, minLayer: 3, style: 'prism', glow: true,
    colors: [0xfff0a0, 0x2a1a4a], value: [1700, 2400], flavor: 'A rainbow locked inside a rock!' },
  { id: 'nebula', name: 'Nebula Celestine', rarity: 'legendary', weight: 36, minLayer: 3, style: 'geode', glow: true,
    colors: [0xa8ddff, 0x6c5ce7, 0x1b1446], value: [1300, 1900], flavor: 'Looks like a piece of the night sky.' },

  // ---- New catalogue -------------------------------------------------
  // Common: small finds of the everyday-but-pretty sort.
  { id: 'mossglow', name: 'Mossglow Stone', rarity: 'common', weight: 30, style: 'druse',
    colors: [0x7fc24a, 0x3f7a2a, 0xd4f38f], value: [6, 14], flavor: 'Looks like a lawn. Smells like a forest.',
    reveal: 'dust', exteriors: ['mossy', 'dusty'] },
  { id: 'sootquartz', name: 'Soot Quartz', rarity: 'common', weight: 28, style: 'shards',
    colors: [0x1a1a1e, 0x3a3a44, 0x75757f], value: [7, 16], flavor: 'Dark as a burnt pancake, twice as hard.',
    reveal: 'dust', exteriors: ['charred', 'basalt'] },
  { id: 'rosepetal', name: 'Rosepetal Crystal', rarity: 'common', weight: 26, style: 'cluster',
    colors: [0xffb3c9, 0xff8fb0, 0xfff0f5], value: [8, 17], flavor: 'Picked from a very polite quarry.',
    reveal: 'sparkle', exteriors: ['dusty', 'egg'] },
  { id: 'rustbloom', name: 'Rustbloom Ore', rarity: 'common', weight: 30, style: 'veined',
    colors: [0xc46a2a, 0x7a3a12, 0xe8a05a], value: [5, 13], flavor: 'Orange metal that stains your gloves.',
    reveal: 'dust', exteriors: ['rusty', 'dusty'] },
  { id: 'pebblepop', name: 'Pebblepop', rarity: 'common', weight: 24, style: 'bubbles',
    colors: [0xffc8dd, 0x9be7ff, 0xfff3a8, 0xc0f7a8, 0xd9c2ff], value: [6, 15], flavor: 'A handful of tiny party favours.',
    reveal: 'sparkle', exteriors: ['cobble', 'river'] },
  { id: 'frostmilk', name: 'Frostmilk Stone', rarity: 'common', weight: 22, style: 'fibrous',
    colors: [0xeaf4ff, 0xc3d9ec, 0x9db9d4], value: [7, 16], flavor: 'Cold to the touch, warm to the story.',
    reveal: 'frost', exteriors: ['glassy', 'cobble'] },

  // Uncommon: proper finds.
  { id: 'bluebell', name: 'Bluebell Druse', rarity: 'uncommon', weight: 30, minLayer: 1, style: 'druse',
    colors: [0x2a5fd0, 0x143a8c, 0x8fc0ff], value: [28, 48], flavor: 'A lawn of tiny blue bells. None of them ring.',
    reveal: 'sparkle', exteriors: ['basalt', 'glassy'] },
  { id: 'tangerine', name: 'Tangerine Spar', rarity: 'uncommon', weight: 28, minLayer: 0, style: 'cluster', glow: true,
    colors: [0xff9a2e, 0xd96b10, 0xffd79a], value: [32, 55], flavor: 'Bright enough to find your keys with.',
    maxLayer: 4, reveal: 'embers', exteriors: ['rusty', 'crusted'] },
  { id: 'violetcloud', name: 'Violet Cloudstone', rarity: 'uncommon', weight: 26, minLayer: 0, style: 'swirl',
    colors: [0x8a5cd0, 0x5a3490, 0xd7c2ff], value: [26, 45], flavor: 'Weather trapped inside a stone.',
    reveal: 'glow', exteriors: ['basalt', 'glassy'] },
  { id: 'silverthread', name: 'Silverthread Ore', rarity: 'uncommon', weight: 32, minLayer: 1, style: 'veined',
    colors: [0xd8dce4, 0x8a8f99, 0x3a3e46], value: [24, 42], flavor: 'Pull it and the whole rock unravels.',
    reveal: 'shimmer', exteriors: ['basalt', 'glassy'] },
  { id: 'limeprism', name: 'Lime Prism', rarity: 'uncommon', weight: 24, minLayer: 2, style: 'frost',
    colors: [0x9ef05a, 0x4fa82a, 0xe4ffb0], value: [30, 52], flavor: 'Refracts badly, sparkles beautifully.',
    maxLayer: 5, reveal: 'frost', exteriors: ['crusted', 'mossy'] },
  { id: 'honeycomb', name: 'Honeycomb Spar', rarity: 'uncommon', weight: 26, minLayer: 1, style: 'bubbles',
    colors: [0xffb43c, 0xd07a12, 0xffe3a0], value: [27, 47], flavor: 'Sticky? No. Hungry? Possibly.',
    reveal: 'glow', exteriors: ['crusted', 'dusty'] },

  // Rare: the shelf starts filling up.
  { id: 'midnightsaph', name: 'Midnight Sapphirine', rarity: 'rare', weight: 30, minLayer: 2, style: 'gem',
    colors: [0x1c2f7a, 0x0a1440, 0x6f8fe0], value: [110, 165], flavor: 'Blue all the way down. It goes on forever.',
    maxLayer: 7, reveal: 'glow', exteriors: ['glassy', 'basalt'] },
  { id: 'dragonscale', name: 'Dragonscale Opaline', rarity: 'rare', weight: 26, minLayer: 3, style: 'swirl',
    colors: [0x7fe0d0, 0xff9ad5, 0x9fb4ff, 0xffe27a, 0x8ef08a], value: [120, 175], flavor: 'Shiny, smooth, and mildly suspicious.',
    reveal: 'rainbow', exteriors: ['glassy', 'river'] },
  { id: 'emberveil', name: 'Emberveil Geode', rarity: 'rare', weight: 28, minLayer: 2, style: 'ember', glow: true,
    colors: [0xff6a2b, 0x3a1410, 0xffc46a], value: [95, 145], flavor: 'Still warm. Still complaining.',
    reveal: 'embers', exteriors: ['charred', 'basalt'] },
  { id: 'orchidstar', name: 'Orchid Starstone', rarity: 'rare', weight: 24, minLayer: 1, style: 'fibrous',
    colors: [0xd98fe0, 0x9a4fb0, 0xf7d8ff], value: [100, 155], flavor: 'Silky enough to sleep on. Do not.',
    reveal: 'glow', exteriors: ['glassy', 'river'] },
  { id: 'gildedtangle', name: 'Gilded Tangle', rarity: 'rare', weight: 30, minLayer: 1, style: 'dendrite',
    colors: [0xffc93c, 0xa8781a, 0x5c3a08], value: [90, 140], flavor: 'A gold tree that never grew a leaf.',
    reveal: 'shimmer', exteriors: ['rusty', 'crusted'] },
  { id: 'verdantheart', name: 'Verdant Heartgem', rarity: 'rare', weight: 26, minLayer: 2, style: 'gem',
    colors: [0x2fb56a, 0x0d6b3a, 0x9ff0bd], value: [115, 170], flavor: 'Two lumps, one beat, no explanation.',
    reveal: 'glow', exteriors: ['mossy', 'crusted'] },

  // Epic: now we are talking.
  { id: 'blackglass', name: 'Blackglass Oracle', rarity: 'epic', weight: 30, minLayer: 3, style: 'shards', glow: true,
    colors: [0x14121c, 0x6b4fd0, 0x2a2038], value: [320, 470], flavor: 'It reflects your future. It is a very dark future.',
    reveal: 'glow', exteriors: ['charred', 'glassy'] },
  { id: 'auroral', name: 'Auroral Cavern', rarity: 'epic', weight: 26, minLayer: 4, style: 'geode', glow: true,
    colors: [0x8ef08a, 0x6c5ce7, 0x1b1446, 0xffd84d], value: [350, 500], flavor: 'A private sky, folded into a small rock.',
    maxLayer: 8, reveal: 'rainbow', exteriors: ['crusted', 'basalt'] },
  { id: 'crimsonrosette', name: 'Crimson Rosette', rarity: 'epic', weight: 28, minLayer: 4, style: 'spiral',
    colors: [0xd01f4a, 0x7a0c26, 0xff8fa8], value: [310, 460], flavor: 'A rose that only grows when nobody is digging.',
    reveal: 'sparkle', exteriors: ['dusty', 'rusty'] },
  { id: 'stormcore', name: 'Stormcore', rarity: 'epic', weight: 30, minLayer: 5, style: 'dendrite', glow: true,
    colors: [0x5fd0ff, 0x1a5fd0, 0xe8f6ff], value: [330, 490], flavor: 'The rock is grumbling. It wants to storm.',
    reveal: 'storm', exteriors: ['basalt', 'glassy'] },

  // Legendary: the stuff you brag about.
  { id: 'phoenixember', name: 'Phoenix Ember', rarity: 'legendary', weight: 34, minLayer: 6, style: 'ember', glow: true,
    colors: [0xff8a2b, 0x5a1205, 0xffd84d], value: [1500, 2200], flavor: 'It keeps a flame that no shovel can put out.',
    reveal: 'embers', exteriors: ['charred', 'crusted'] },
  { id: 'galaxyheart', name: 'Galaxy Heart', rarity: 'legendary', weight: 30, minLayer: 7, style: 'galaxy', glow: true,
    colors: [0x2a1f6a, 0x0d0a2a, 0xa8ddff], value: [1400, 2000], flavor: 'Do not stare too long, it counts the seconds.',
    reveal: 'stars', exteriors: ['glassy', 'basalt'] },
  { id: 'wyrmstone', name: 'Prism Wyrmstone', rarity: 'legendary', weight: 26, minLayer: 8, style: 'spiral', glow: true,
    colors: [0xff6ad5, 0x6c5ce7, 0x7fe0d0, 0xffd84d], value: [1700, 2500], flavor: 'A dragon shed a scale. That is the whole story.',
    reveal: 'rainbow', exteriors: ['glassy', 'river'] },

  // Worthless: a whole category of letdown.
  { id: 'hollowhusk', name: 'Hollow Husk', rarity: 'worthless', weight: 26, style: 'hollow',
    colors: [0x6b6055, 0x413a32, 0x8f8478], value: [0, 0], flavor: 'The good part was already taken.',
    reveal: 'fizzle', exteriors: ['dusty', 'crusted'] },
  { id: 'chalklump', name: 'Chalk Lump', rarity: 'worthless', weight: 28, style: 'chalky',
    colors: [0xe6e2d6, 0xc4bfb0, 0xa8a294], value: [0, 0], flavor: 'Heavier than it looks. Worth less than it weighs.',
    reveal: 'fizzle', exteriors: ['egg', 'cobble'] },
  { id: 'gloomclay', name: 'Gloomclay', rarity: 'worthless', weight: 26, style: 'chalky',
    colors: [0x4a4540, 0x2e2a26, 0x635c54], value: [0, 0], flavor: 'Damp, dark, and utterly without ambition.',
    reveal: 'fizzle', exteriors: ['basalt', 'charred'] },
  { id: 'foolsgleam', name: "Fool's Gleam", rarity: 'worthless', weight: 24, style: 'veined',
    colors: [0xb8bcc4, 0x6a6e76, 0xe8ecf2], value: [0, 0], flavor: 'Shiny metal! ...No. It is a very good rock.',
    reveal: 'fizzle', exteriors: ['glassy', 'cobble'] },
  { id: 'dustball', name: 'Dustball', rarity: 'worthless', weight: 22, style: 'chalky',
    colors: [0xd6b483, 0xae8a5c, 0xf0d9b0], value: [0, 0], flavor: 'Crumbles if you look at it wrong.',
    reveal: 'fizzle', exteriors: ['dusty', 'egg'] },
];
