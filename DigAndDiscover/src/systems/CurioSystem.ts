import { CURIOS, type CurioDef } from '../data/curios';

/** Relative odds by tier (common ... mythic) before the layer bends them. */
const TIER_WEIGHT = [40, 30, 18, 8, 2] as const;

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
    const base = 0.028 + 0.0024 * this.swingsSince;
    return Math.min(0.13, base) * (1 + 0.07 * layerIndex);
  }

  /** Rolls one swing. Call once per swing that was allowed to find something. */
  roll(layerIndex: number, rng: () => number = Math.random): boolean {
    const found = rng() < this.chance(layerIndex);
    this.swingsSince = found ? 0 : this.swingsSince + 1;
    return found;
  }

  /** Picks a curio that can appear this deep. Unfound ones are three times as likely. */
  pick(layerIndex: number, hasFound: (id: string) => boolean, rng: () => number = Math.random): CurioDef {
    const pool = CURIOS.filter((x) => x.minLayer <= layerIndex);
    const weights = pool.map((x) => TIER_WEIGHT[x.tier] * (1 + 0.1 * layerIndex * x.tier) * (hasFound(x.id) ? 1 : 3));
    let roll = rng() * weights.reduce((a, b) => a + b, 0);
    for (let i = 0; i < pool.length; i++) {
      roll -= weights[i];
      if (roll <= 0) return pool[i];
    }
    return pool[pool.length - 1];
  }
}
