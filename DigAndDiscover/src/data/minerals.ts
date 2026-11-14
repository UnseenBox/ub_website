import type { RarityId } from './rarities';

/** How the inside of a cut rock is drawn. */
export type InteriorStyle = 'plain' | 'cluster' | 'banded' | 'geode' | 'gem' | 'opal' | 'prism';

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
  { id: 'starfire', name: 'Starfire Geode', rarity: 'legendary', weight: 36, style: 'geode', glow: true,
    colors: [0xffd84d, 0xff6a2b, 0x5a1205], value: [1400, 2000], flavor: 'It is warm to the touch...' },
  { id: 'heartstone', name: 'Prismatic Heartstone', rarity: 'legendary', weight: 28, style: 'prism', glow: true,
    colors: [0xfff0a0, 0x2a1a4a], value: [1700, 2400], flavor: 'A rainbow locked inside a rock!' },
  { id: 'nebula', name: 'Nebula Celestine', rarity: 'legendary', weight: 36, style: 'geode', glow: true,
    colors: [0xa8ddff, 0x6c5ce7, 0x1b1446], value: [1300, 1900], flavor: 'Looks like a piece of the night sky.' },
];
