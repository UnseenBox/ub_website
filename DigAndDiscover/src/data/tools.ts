/**
 * Digging tools as data. Only the starter shovel exists today; a reinforced
 * shovel, pickaxe or drill would be extra entries (buying them is a future
 * feature, not part of this prototype).
 */
export interface ToolDef {
  id: string;
  name: string;
  /** One short line of character shown to the player. */
  blurb: string;
  /** Texture key painted by TextureFactory. */
  textureKey: string;
  /** Digging strength. A swing's efficiency is power / layer.hardness (clamped to 0..1). */
  power: number;
  /** Floor never drops less than this fraction of digDepth per swing, however hard the ground. */
  minEfficiency: number;
  /** Depth removed by one full-efficiency swing, in field units. */
  digDepth: number;
  /** Radius of the crater a swing leaves. */
  craterRadius: number;
  /** Time between swings in ms - an old shovel is slow. */
  swingCooldownMs: number;
  /** Time the blade takes to reach the ground. */
  plungeMs: number;
  /** Multiplier on the stamina cost of a swing. */
  staminaMult: number;
  /** Colour wash for the in-world shovel sprite (0xffffff / undefined = untouched). */
  tint?: number;
}

export const OLD_SHOVEL: ToolDef = {
  id: 'old-shovel',
  name: 'Old Shovel',
  blurb: 'Rusty, but it still works.',
  textureKey: 'shovel',
  power: 1,
  minEfficiency: 0.05,
  digDepth: 40,
  craterRadius: 36,
  swingCooldownMs: 520,
  plungeMs: 130,
  staminaMult: 1,
};

/** The tool the protagonist starts the game with. */
export const STARTER_TOOL: ToolDef = OLD_SHOVEL;

const tool = (id: string, name: string, blurb: string, tint: number, over: Partial<ToolDef>): ToolDef => ({
  ...OLD_SHOVEL,
  id,
  name,
  blurb,
  tint,
  ...over,
});

/**
 * Every buyable digging tool, keyed by its store id (see data/store.ts). Power is
 * measured against layer hardness (1.4 / 3.2 / 5.5 / 8 / 12): a tool bites at full
 * strength once power >= hardness, so each layer wants a better tool.
 * The in-world sprite is still the shovel, washed with `tint`, until real art exists.
 */
export const TOOL_DEFS: Record<string, ToolDef> = {
  'tool-old-shovel': OLD_SHOVEL,
  'tool-iron-shovel': tool('tool-iron-shovel', 'Iron Shovel', 'Solid grey iron.', 0xc3ccd4, { power: 2.2, digDepth: 42, craterRadius: 38, swingCooldownMs: 490, staminaMult: 0.95 }),
  'tool-steel-shovel': tool('tool-steel-shovel', 'Steel Shovel', 'Sharp blue steel.', 0x8cbcf0, { power: 3.6, digDepth: 44, craterRadius: 40, swingCooldownMs: 460, staminaMult: 0.92 }),
  'tool-hand-axe': tool('tool-hand-axe', 'Hand Axe', 'Chops loose rock.', 0xd49a62, { power: 4.8, digDepth: 46, craterRadius: 42, swingCooldownMs: 400, plungeMs: 110, staminaMult: 0.9 }),
  'tool-gold-shovel': tool('tool-gold-shovel', 'Golden Shovel', 'Flashy and practical.', 0xffd45a, { power: 6, digDepth: 46, craterRadius: 42, swingCooldownMs: 440, staminaMult: 0.88 }),
  'tool-pickaxe': tool('tool-pickaxe', 'Pickaxe', 'Cracks hard ground.', 0xaab4ff, { power: 7.5, digDepth: 50, craterRadius: 44, swingCooldownMs: 420, plungeMs: 110, staminaMult: 0.85 }),
  'tool-jackhammer': tool('tool-jackhammer', 'Jackhammer', 'Loud and very effective.', 0xff9d5c, { power: 10, digDepth: 34, craterRadius: 40, swingCooldownMs: 240, plungeMs: 80, staminaMult: 0.7 }),
  'tool-diamond-shovel': tool('tool-diamond-shovel', 'Diamond Shovel', 'Cuts through almost anything.', 0x86f2ff, { power: 11, digDepth: 52, craterRadius: 46, swingCooldownMs: 400, staminaMult: 0.8 }),
  'tool-drill': tool('tool-drill', 'Power Drill', 'Bores through bedrock.', 0xff7a66, { power: 15, digDepth: 30, craterRadius: 38, swingCooldownMs: 170, plungeMs: 60, staminaMult: 0.55 }),
};

/** Passive gadgets: owning one improves the odds of a find (and may show what is inside a rock). */
export const SCANNERS: Record<string, { findBonus: number; showsRarity: boolean }> = {
  'tool-scanner': { findBonus: 0.25, showsRarity: false },
  'tool-deep-scanner': { findBonus: 0.5, showsRarity: true },
};

/** What each upgrade level does. Applied in GameState (see applyUpgrades). */
export const UPGRADE_EFFECTS = {
  staminaPerLevel: 20,
  regenPerLevel: 1.5,
  costReductionPerLevel: 0.06,
  digDepthPerLevel: 0.1,
  cooldownReductionPerLevel: 0.06,
  /** The endless "Master Digger" upgrade: more tool power per level. */
  masteryPerLevel: 0.05,
} as const;
