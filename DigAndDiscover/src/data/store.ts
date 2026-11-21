/**
 * The store catalogue, as data. This is DISPLAY ONLY for now: nothing here
 * touches money, tools or stats. When you are ready to connect it, the one
 * place to do it is `StoreScene.requestPurchase()`.
 *
 * Swapping art: drop a PNG named after the item id into `src/assets/store/`
 * (e.g. `tool-iron-shovel.png`). It replaces the placeholder / painted icon
 * automatically - no code change needed. Square images (256x256) look best.
 */

import { FEATURES } from '../config/features';

export type StoreTab = 'tools' | 'upgrades' | 'skills';

/** How an item icon is painted when no PNG override exists. */
export type IconStyle =
  | { kind: 'shovel'; blade: number; shine: number; handle?: number }
  | { kind: 'placeholder' }
  | { kind: 'glyph'; glyph: UpgradeGlyph; color: number }
  | { kind: 'tool-art'; art: 'hand-axe' | 'pickaxe' | 'jackhammer' | 'drill' }
  | { kind: 'skill-art'; art: SkillArtId };

/** Painted by art/SkillIcons.ts. */
export type SkillArtId =
  | 'keen-eye' | 'double-find' | 'quick-crack' | 'master-cut' | 'big-bag' | 'big-hole'
  | 'angry' | 'afterimage' | 'hot-rock' | 'scrap-shot' | 'second-wind' | 'haggler';

export type UpgradeGlyph = 'bolt' | 'refill' | 'efficiency' | 'damage' | 'speed';

export interface ToolItem {
  id: string;
  name: string;
  blurb: string;
  price: number;
  icon: IconStyle;
  /** Shown as "Owned" - the starter tool. */
  owned?: boolean;
  /** A stand-in slot waiting for real art and stats. */
  placeholder?: boolean;
  /** Shown with a COMING SOON label and cannot be bought yet. */
  comingSoon?: boolean;
  /** Prospector level needed before it can be bought. */
  minLevel: number;
  /** 'dig' tools replace each other; 'scanner' gadgets are passive. */
  kind: 'dig' | 'scanner';
}

export interface ToolSection {
  title: string;
  subtitle: string;
  items: ToolItem[];
}

export interface UpgradeItem {
  id: string;
  name: string;
  /** What one level gives, e.g. "+20 max stamina". */
  perLevel: string;
  blurb: string;
  icon: IconStyle;
  maxLevel: number;
  /** Price of level 1; later levels multiply by `priceGrowth`. */
  basePrice: number;
  priceGrowth: number;
  /** Explicit price per level. When present it overrides `basePrice`/`priceGrowth`. */
  prices?: readonly number[];
  /** Level the player currently has. Display only - always 0 until linked. */
  level: number;
  /** Prospector level needed before the first level can be bought (skills only). */
  minLevel?: number;
}

export interface UpgradeSection {
  title: string;
  subtitle: string;
  items: UpgradeItem[];
}

/** Prospector level that unlocks each tool (the long-term progression). */
const MIN_LEVEL: Record<string, number> = {
  'tool-iron-shovel': 2, 'tool-steel-shovel': 3, 'tool-hand-axe': 4, 'tool-scanner': 4, 'tool-gold-shovel': 5,
  'tool-pickaxe': 6, 'tool-jackhammer': 8, 'tool-diamond-shovel': 9, 'tool-deep-scanner': 9, 'tool-drill': 11,
};

export function upgradePrice(item: UpgradeItem, level: number): number {
  const fixed = item.prices?.[level];
  if (fixed !== undefined) return fixed;
  return Math.round((item.basePrice * Math.pow(item.priceGrowth, level)) / 5) * 5;
}

const shovel = (blade: number, shine: number, handle?: number): IconStyle => ({ kind: 'shovel', blade, shine, handle });
const PLACEHOLDER: IconStyle = { kind: 'placeholder' };

type RawTool = Omit<ToolItem, 'minLevel' | 'kind'>;
interface RawSection extends Omit<ToolSection, 'items'> {
  items: RawTool[];
}

const RAW_TOOL_SECTIONS: RawSection[] = [
  {
    title: 'Shovels',
    subtitle: 'Better metal, deeper holes',
    items: [
      { id: 'tool-old-shovel', name: 'Old Shovel', blurb: 'Rusty, but it still works.', price: 0, owned: true, icon: shovel(0x8a8f95, 0xc9ced3, 0x7a5330) },
      { id: 'tool-iron-shovel', name: 'Iron Shovel', blurb: 'Solid grey iron. Bites a little deeper.', price: 180, icon: shovel(0x6d7a86, 0xb7c3cd, 0x7a5330) },
      { id: 'tool-steel-shovel', name: 'Steel Shovel', blurb: 'Sharp blue steel that stays sharp.', price: 1200, icon: shovel(0x3f7fc4, 0x9fd0ff, 0x5b3a21) },
      { id: 'tool-gold-shovel', name: 'Golden Shovel', blurb: 'Flashy. Surprisingly practical.', price: 5500, icon: shovel(0xe0a21b, 0xffe48a, 0x5b3a21) },
      { id: 'tool-diamond-shovel', name: 'Diamond Shovel', blurb: 'Cuts through almost anything.', price: 34000, icon: shovel(0x35c8d8, 0xc8fbff, 0x3a2816) },
    ],
  },
  {
    title: 'Digging Tools',
    subtitle: 'Axes, picks and power tools',
    items: [
      { id: 'tool-hand-axe', name: 'Hand Axe', blurb: 'Chops through roots and loose rock.', price: 2800, icon: { kind: 'tool-art', art: 'hand-axe' } },
      { id: 'tool-pickaxe', name: 'Pickaxe', blurb: 'The classic. Cracks hard ground.', price: 9000, icon: { kind: 'tool-art', art: 'pickaxe' } },
      { id: 'tool-jackhammer', name: 'Jackhammer', blurb: 'Loud, heavy, very effective.', price: 26000, icon: { kind: 'tool-art', art: 'jackhammer' } },
      { id: 'tool-drill', name: 'Power Drill', blurb: 'Bores straight down through bedrock.', price: 75000, icon: { kind: 'tool-art', art: 'drill' } },
    ],
  },
  {
    title: 'Scanners',
    subtitle: 'See what is hiding underground',
    items: [
      { id: 'tool-scanner', name: 'Rock Scanner', blurb: 'Pings nearby rocks as you dig.', price: 6000, icon: PLACEHOLDER, comingSoon: true },
      { id: 'tool-deep-scanner', name: 'Deep Scanner', blurb: 'Reads the rock before you cut it.', price: 45000, icon: PLACEHOLDER, comingSoon: true },
    ],
  },
  {
    title: 'Placeholder Shovels',
    subtitle: 'Empty slots - replace with your own designs',
    items: Array.from({ length: 6 }, (_, i): RawTool => ({
      id: `tool-placeholder-${i + 1}`,
      name: `Placeholder Shovel ${i + 1}`,
      blurb: 'Replace this art, name and price.',
      price: 0,
      placeholder: true,
      comingSoon: true,
      icon: PLACEHOLDER,
    })),
  },
];

/** Extra Saws is a v2-only upgrade: each level adds one more cutting machine. */
const EXTRA_SAWS_UPGRADE: UpgradeItem = {
  id: 'up-saws',
  name: 'Extra Saws',
  perLevel: '+1 cutting machine',
  blurb: 'Place, cut and sell more rocks at once.',
  icon: { kind: 'skill-art', art: 'master-cut' },
  maxLevel: 3,
  basePrice: 1000,
  priceGrowth: 1,
  level: 0,
  prices: [1000, 2500, 5000],
};

export const UPGRADE_SECTIONS: UpgradeSection[] = [
  {
    title: 'Stamina',
    subtitle: 'Work longer before you tire',
    items: [
      { id: 'up-stamina-tank', name: 'Bigger Tank', perLevel: '+20 max stamina', blurb: 'More swings from a full tank.', icon: { kind: 'glyph', glyph: 'bolt', color: 0xffc83d }, maxLevel: 8, basePrice: 240, priceGrowth: 1.55, level: 0 },
      { id: 'up-stamina-regen', name: 'Quick Recovery', perLevel: '+1.5 stamina / second', blurb: 'Catch your breath faster.', icon: { kind: 'glyph', glyph: 'refill', color: 0x5fcf5c }, maxLevel: 8, basePrice: 400, priceGrowth: 1.55, level: 0 },
      { id: 'up-stamina-efficiency', name: 'Efficient Swings', perLevel: '-6% stamina per swing', blurb: 'Waste less effort on every dig.', icon: { kind: 'glyph', glyph: 'efficiency', color: 0x4fb0ff }, maxLevel: 8, basePrice: 330, priceGrowth: 1.6, level: 0 },
    ],
  },
  {
    title: 'Digging',
    subtitle: 'Hit harder, dig faster',
    items: [
      { id: 'up-dig-damage', name: 'Digging Damage', perLevel: '+10% depth per swing', blurb: 'Every swing removes more ground.', icon: { kind: 'glyph', glyph: 'damage', color: 0xff6b4a }, maxLevel: 8, basePrice: 370, priceGrowth: 1.6, level: 0 },
      { id: 'up-dig-speed', name: 'Swing Speed', perLevel: '-6% time between swings', blurb: 'Less waiting, more digging.', icon: { kind: 'glyph', glyph: 'speed', color: 0xb98cff }, maxLevel: 8, basePrice: 180, priceGrowth: 1.6, level: 0 },
    ],
  },
  {
    title: 'Prospecting',
    subtitle: 'Find more, carry more, cut better',
    items: [
      { id: 'up-find-chance', name: 'Keen Eye', perLevel: '+10% rock find chance', blurb: 'More swings turn up a rock.', icon: { kind: 'skill-art', art: 'keen-eye' }, maxLevel: 8, basePrice: 700, priceGrowth: 1.75, level: 0 },
      { id: 'up-instant-crack', name: 'Quick Crack', perLevel: '+6% chance to free in one hit', blurb: 'Sometimes one hit is enough.', icon: { kind: 'skill-art', art: 'quick-crack' }, maxLevel: 5, basePrice: 1500, priceGrowth: 2.0, level: 0 },
      { id: 'up-bag', name: 'Bigger Bag', perLevel: '+1 bag slot (starts with 5)', blurb: 'Carry more rocks to the workshop.', icon: { kind: 'skill-art', art: 'big-bag' }, maxLevel: 5, basePrice: 800, priceGrowth: 3.6, level: 0 },
      { id: 'up-double-find', name: 'Double Find', perLevel: '+8% chance of two rocks', blurb: 'Lucky digs turn up a pair.', icon: { kind: 'skill-art', art: 'double-find' }, maxLevel: 5, basePrice: 4500, priceGrowth: 2.1, level: 0 },
      { id: 'up-lucky-cut', name: 'Master Cutter', perLevel: '+5% chance of a better cut', blurb: 'A steady hand finds a higher tier inside.', icon: { kind: 'skill-art', art: 'master-cut' }, maxLevel: 5, basePrice: 4500, priceGrowth: 2.1, level: 0 },
      ...(FEATURES.v2 ? [EXTRA_SAWS_UPGRADE] : []),
    ],
  },
  {
    title: 'Mastery',
    subtitle: 'Endless - for deep pockets',
    items: [
      { id: 'up-mastery', name: 'Master Digger', perLevel: '+5% tool power', blurb: 'There is always more to learn.', icon: { kind: 'glyph', glyph: 'damage', color: 0xffd84d }, maxLevel: 99, basePrice: 12000, priceGrowth: 1.2, level: 0 },
    ],
  },
];

/** The Skills tab: traits that change how digging plays. Each needs a prospector level before the first level. */
export const SKILL_SECTIONS: UpgradeSection[] = [
  {
    title: 'Digging skills',
    subtitle: 'Swings that do something extra',
    items: [
      { id: 'trait-big-hole', name: 'Big Hole', perLevel: '+5% chance of a huge hole', blurb: 'Some swings dig a much bigger, deeper hole.', icon: { kind: 'skill-art', art: 'big-hole' }, maxLevel: 5, basePrice: 4000, priceGrowth: 2.05, level: 0, minLevel: 3 },
      { id: 'trait-angry', name: 'Angry Shoveler', perLevel: '+6% rage chance (same spot)', blurb: 'Dig the same spot and he may snap: 5 seconds of faster, deeper swings.', icon: { kind: 'skill-art', art: 'angry' }, maxLevel: 5, basePrice: 8500, priceGrowth: 2.1, level: 0, minLevel: 5 },
      { id: 'trait-afterimage', name: 'After Image', perLevel: '+5% chance of a ghost swing', blurb: 'A ghost shovel appears and digs the same spot for free.', icon: { kind: 'skill-art', art: 'afterimage' }, maxLevel: 5, basePrice: 9000, priceGrowth: 2.2, level: 0, minLevel: 7 },
    ],
  },
  {
    title: 'Junk skills',
    subtitle: 'Worthless rocks finally pay off',
    items: [
      { id: 'trait-hot-rock', name: 'Hot Rock', perLevel: '+20% chance it explodes', blurb: 'A worthless rock you dig up may turn red hot and blast a big hole.', icon: { kind: 'skill-art', art: 'hot-rock' }, maxLevel: 5, basePrice: 1200, priceGrowth: 1.8, level: 0, minLevel: 6 },
      { id: 'trait-scrap-shot', name: 'Scrap Shot', perLevel: '+1 shot per loaded swing', blurb: 'Throw a worthless rock away: your next swings fire mini shots.', icon: { kind: 'skill-art', art: 'scrap-shot' }, maxLevel: 5, basePrice: 1800, priceGrowth: 1.9, level: 0, minLevel: 8 },
    ],
  },
  {
    title: 'Survival and trade',
    subtitle: 'Last longer, earn more',
    items: [
      { id: 'trait-second-wind', name: 'Second Wind', perLevel: 'Once a day: +40/55/70% stamina', blurb: 'When the tank runs dry, part of it comes back.', icon: { kind: 'skill-art', art: 'second-wind' }, maxLevel: 3, basePrice: 7500, priceGrowth: 2.5, level: 0, minLevel: 4 },
      { id: 'trait-haggler', name: 'Haggler', perLevel: '+4% rock sale price', blurb: 'Every rock sells for a little more.', icon: { kind: 'skill-art', art: 'haggler' }, maxLevel: 5, basePrice: 4000, priceGrowth: 2.2, level: 0, minLevel: 6 },
    ],
  },
];

export const TOOL_SECTIONS: ToolSection[] = RAW_TOOL_SECTIONS.map((section) => ({
  ...section,
  items: section.items.map((item): ToolItem => ({
    ...item,
    minLevel: MIN_LEVEL[item.id] ?? 1,
    kind: item.id.includes('scanner') ? 'scanner' : 'dig',
  })),
}));

export const ALL_TOOLS: ToolItem[] = TOOL_SECTIONS.flatMap((s) => s.items);
export const ALL_UPGRADES = [...UPGRADE_SECTIONS, ...SKILL_SECTIONS].flatMap((s) => s.items);
