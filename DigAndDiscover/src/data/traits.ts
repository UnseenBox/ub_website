/**
 * The numbers behind the prospecting upgrades and the store's skills. Everything here is data: the game
 * (GameState, TraitSystem, the scenes) and the balance simulations (dev/*.ts) read the same values.
 */

/** Upgrades that change what a swing finds and how the bag works (Upgrades tab, "Prospecting"). */
export const PROSPECT_EFFECTS = {
  /** Relative: +10% of the chance that a swing turns up a rock, per level. */
  findChancePerLevel: 0.1,
  /** Chance per level that a find is two rocks instead of one. */
  doubleFindPerLevel: 0.08,
  /** Chance per level that one hit frees an embedded rock at once. */
  instantCrackPerLevel: 0.06,
  /** Chance per level that a cut reveals a rock one rarity higher than it was. */
  luckyCutPerLevel: 0.05,
  /** Extra bag slots per level (the bag starts with the 5 in GAME_CONFIG.inventory.slots). */
  bagSlotsPerLevel: 1,
} as const;

/** Skills ("traits") bought in the store's Skills tab. Levels scale the chance or the count, not the size of the effect. */
export const TRAIT_EFFECTS = {
  /** A swing sometimes digs a much bigger hole. */
  bigHole: { chancePerLevel: 0.05, depthMult: 2.2, widthMult: 1.8 },
  /**
   * Digging the same spot over and over can make the digger furious: for a few seconds he swings faster
   * and digs deeper, and each swing costs less stamina. Then he needs a breather before the next fit.
   */
  angry: {
    chancePerLevel: 0.06,
    /** Swings in a row at the same spot before the chance starts rolling. */
    minRepeats: 3,
    /** How far (field units) a swing may land from the last one and still count as "the same spot". */
    spotRadius: 40,
    /** A pause longer than this ends the streak. */
    streakGapMs: 4000,
    durationMs: 5000,
    cooldownMs: 6000,
    cooldownMult: 0.4,
    depthMult: 1.5,
    staminaMult: 0.65,
  },
  /** A ghost copy of the tool arrives a moment after the swing and digs the same spot for free. */
  afterimage: { chancePerLevel: 0.05, delayMs: 260 },
  /** A worthless rock that is dug up may be red hot: it blows a big hole where it lay and never reaches the bag. */
  hotRock: { chancePerLevel: 0.2, depthMult: 5, widthMult: 2.4, fuseMs: 650 },
  /**
   * Throwing a worthless rock away loads the shovel: the next swings fire mini projectiles (one per
   * skill level) that each dig a small hole in the bottom of the main one, scattered a little to the sides.
   */
  scrapShot: { loadedSwings: 18, maxCharges: 54, depthSteps: 0.3, widthMult: 0.34, spread: 0.25 },
  /** Once per day, running out of stamina restores a part of the tank instead. */
  secondWind: { restoreBase: 0.25, restorePerLevel: 0.15 },
  /** Rocks sell for more. */
  haggler: { perLevel: 0.04 },
} as const;
