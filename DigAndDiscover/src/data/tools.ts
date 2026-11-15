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
}

export const OLD_SHOVEL: ToolDef = {
  id: 'old-shovel',
  name: 'Old Shovel',
  blurb: 'Rusty, but it still works.',
  textureKey: 'shovel',
  power: 1,
  minEfficiency: 0.1,
  digDepth: 40,
  craterRadius: 36,
  swingCooldownMs: 520,
  plungeMs: 130,
  staminaMult: 1,
};

/** The tool the protagonist starts the game with. */
export const STARTER_TOOL: ToolDef = OLD_SHOVEL;
