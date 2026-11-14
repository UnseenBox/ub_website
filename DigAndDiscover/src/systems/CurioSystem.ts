import { CURIOS, type CurioCategory, type CurioDef } from '../data/curios';

/**
 * Tier odds (common ... mythic) by pair of layers: layers 1-2, 3-4, ... 9-10.
 * Deeper ground makes the big surprises a real possibility, not a once-a-month rumour.
 */
const TIER_ODDS: ReadonlyArray<readonly [number, number, number, number, number]> = [
  [62, 32, 6, 0, 0],
  [38, 40, 18, 4, 0],
  [24, 36, 26, 12, 2],
  [16, 30, 30, 18, 6],
  [10, 26, 32, 22, 10],
];

/** Share of finds per category, so skeletons, war relics, weirdness and idioms all show up. */
const CATEGORY_WEIGHT: Record<CurioCategory, number> = { bones: 24, war: 22, weird: 24, idiom: 24, treasure: 8 };

/** How much likelier a curio you have never found is. */
const NEW_BONUS = 3;

/**
 * Decides when a swing unearths a curio and which one. Independent of rocks:
 * a long dry spell makes the next surprise more likely ("dig long enough and
 * something strange turns up"), deeper layers make it likelier still, and
 * curios you have not found yet are favoured so the collection fills up.
 */
export class CurioSystem {
  /** Starts part-way up so the very first surprise arrives early. */
  private swingsSince = 12;

  chance(layerIndex: number): number {
    const base = 0.02 + 0.0018 * this.swingsSince;
    return Math.min(0.1, base) * (1 + 0.07 * layerIndex);
  }

  /** Rolls one swing. Call once per swing that was allowed to find something. */
  roll(layerIndex: number, rng: () => number = Math.random): boolean {
    const found = rng() < this.chance(layerIndex);
    this.swingsSince = found ? 0 : this.swingsSince + 1;
    return found;
  }

  /** Picks a curio that can appear this deep: tier first, then a fair spread over categories. */
  pick(layerIndex: number, hasFound: (id: string) => boolean, rng: () => number = Math.random): CurioDef {
    const odds = TIER_ODDS[Math.min(TIER_ODDS.length - 1, Math.floor(layerIndex / 2))];
    let roll = rng() * odds.reduce((a, b) => a + b, 0);
    let tier = 0;
    for (let i = 0; i < odds.length; i++) {
      roll -= odds[i];
      if (roll < 0) {
        tier = i;
        break;
      }
    }
    // A tier with nothing unlocked yet falls back to the next one down.
    let pool = CURIOS.filter((x) => x.minLayer <= layerIndex && x.tier === tier);
    while (pool.length === 0 && tier > 0) {
      tier--;
      pool = CURIOS.filter((x) => x.minLayer <= layerIndex && x.tier === tier);
    }
    if (pool.length === 0) pool = CURIOS.filter((x) => x.minLayer <= layerIndex);

    const perCategory = new Map<CurioCategory, number>();
    for (const x of pool) perCategory.set(x.category, (perCategory.get(x.category) ?? 0) + 1);
    const weights = pool.map((x) => (CATEGORY_WEIGHT[x.category] / (perCategory.get(x.category) ?? 1)) * (hasFound(x.id) ? 1 : NEW_BONUS));
    let r = rng() * weights.reduce((a, b) => a + b, 0);
    for (let i = 0; i < pool.length; i++) {
      r -= weights[i];
      if (r <= 0) return pool[i];
    }
    return pool[pool.length - 1];
  }
}
