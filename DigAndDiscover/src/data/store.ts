/**
 * The store catalogue, as data. This is DISPLAY ONLY for now: nothing here
 * touches money, tools or stats. When you are ready to connect it, the one
 * place to do it is `StoreScene.requestPurchase()`.
 *
 * Swapping art: drop a PNG named after the item id into `src/assets/store/`
 * (e.g. `tool-iron-shovel.png`). It replaces the placeholder / painted icon
 * automatically - no code change needed. Square images (256x256) look best.
 */

export type StoreTab = 'tools' | 'upgrades';

/** How an item icon is painted when no PNG override exists. */
export type IconStyle =
  | { kind: 'shovel'; blade: number; shine: number; handle?: number }
  | { kind: 'placeholder' }
  | { kind: 'glyph'; glyph: UpgradeGlyph; color: number };

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
  /** Level the player currently has. Display only - always 0 until linked. */
  level: number;
}

export interface UpgradeSection {
  title: string;
  subtitle: string;
  items: UpgradeItem[];
}

export function upgradePrice(item: UpgradeItem, level: number): number {
  return Math.round((item.basePrice * Math.pow(item.priceGrowth, level)) / 5) * 5;
}

const shovel = (blade: number, shine: number, handle?: number): IconStyle => ({ kind: 'shovel', blade, shine, handle });
const PLACEHOLDER: IconStyle = { kind: 'placeholder' };

export const TOOL_SECTIONS: ToolSection[] = [
  {
    title: 'Shovels',
    subtitle: 'Better metal, deeper holes',
    items: [
      { id: 'tool-old-shovel', name: 'Old Shovel', blurb: 'Rusty, but it still works.', price: 0, owned: true, icon: shovel(0x8a8f95, 0xc9ced3, 0x7a5330) },
      { id: 'tool-iron-shovel', name: 'Iron Shovel', blurb: 'Solid grey iron. Bites a little deeper.', price: 150, icon: shovel(0x6d7a86, 0xb7c3cd, 0x7a5330) },
      { id: 'tool-steel-shovel', name: 'Steel Shovel', blurb: 'Sharp blue steel that stays sharp.', price: 600, icon: shovel(0x3f7fc4, 0x9fd0ff, 0x5b3a21) },
      { id: 'tool-gold-shovel', name: 'Golden Shovel', blurb: 'Flashy. Surprisingly practical.', price: 2200, icon: shovel(0xe0a21b, 0xffe48a, 0x5b3a21) },
      { id: 'tool-diamond-shovel', name: 'Diamond Shovel', blurb: 'Cuts through almost anything.', price: 9000, icon: shovel(0x35c8d8, 0xc8fbff, 0x3a2816) },
    ],
  },
  {
    title: 'Digging Tools',
    subtitle: 'Axes, picks and power tools',
    items: [
      { id: 'tool-hand-axe', name: 'Hand Axe', blurb: 'Chops through roots and loose rock.', price: 1200, icon: PLACEHOLDER },
      { id: 'tool-pickaxe', name: 'Pickaxe', blurb: 'The classic. Cracks hard ground.', price: 3000, icon: PLACEHOLDER },
      { id: 'tool-jackhammer', name: 'Jackhammer', blurb: 'Loud, heavy, very effective.', price: 8500, icon: PLACEHOLDER },
      { id: 'tool-drill', name: 'Power Drill', blurb: 'Bores straight down through bedrock.', price: 15000, icon: PLACEHOLDER },
    ],
  },
  {
    title: 'Scanners',
    subtitle: 'See what is hiding underground',
    items: [
      { id: 'tool-scanner', name: 'Rock Scanner', blurb: 'Pings nearby rocks as you dig.', price: 5000, icon: PLACEHOLDER },
      { id: 'tool-deep-scanner', name: 'Deep Scanner', blurb: 'Reads the rock before you cut it.', price: 20000, icon: PLACEHOLDER },
    ],
  },
  {
    title: 'Placeholder Shovels',
    subtitle: 'Empty slots - replace with your own designs',
    items: Array.from({ length: 6 }, (_, i): ToolItem => ({
      id: `tool-placeholder-${i + 1}`,
      name: `Placeholder Shovel ${i + 1}`,
      blurb: 'Replace this art, name and price.',
      price: 0,
      placeholder: true,
      icon: PLACEHOLDER,
    })),
  },
];

export const UPGRADE_SECTIONS: UpgradeSection[] = [
  {
    title: 'Stamina',
    subtitle: 'Work longer before you tire',
    items: [
      { id: 'up-stamina-tank', name: 'Bigger Tank', perLevel: '+20 max stamina', blurb: 'More swings from a full tank.', icon: { kind: 'glyph', glyph: 'bolt', color: 0xffc83d }, maxLevel: 5, basePrice: 120, priceGrowth: 1.7, level: 0 },
      { id: 'up-stamina-regen', name: 'Quick Recovery', perLevel: '+2 stamina / second', blurb: 'Catch your breath faster.', icon: { kind: 'glyph', glyph: 'refill', color: 0x5fcf5c }, maxLevel: 5, basePrice: 150, priceGrowth: 1.7, level: 0 },
      { id: 'up-stamina-efficiency', name: 'Efficient Swings', perLevel: '-6% stamina per swing', blurb: 'Waste less effort on every dig.', icon: { kind: 'glyph', glyph: 'efficiency', color: 0x4fb0ff }, maxLevel: 5, basePrice: 200, priceGrowth: 1.8, level: 0 },
    ],
  },
  {
    title: 'Digging',
    subtitle: 'Hit harder, dig faster',
    items: [
      { id: 'up-dig-damage', name: 'Digging Damage', perLevel: '+10% depth per swing', blurb: 'Every swing removes more ground.', icon: { kind: 'glyph', glyph: 'damage', color: 0xff6b4a }, maxLevel: 5, basePrice: 180, priceGrowth: 1.8, level: 0 },
      { id: 'up-dig-speed', name: 'Swing Speed', perLevel: '-8% time between swings', blurb: 'Less waiting, more digging.', icon: { kind: 'glyph', glyph: 'speed', color: 0xb98cff }, maxLevel: 5, basePrice: 220, priceGrowth: 1.8, level: 0 },
    ],
  },
];
