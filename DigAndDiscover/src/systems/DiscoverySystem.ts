import type { Rng } from '../core/Random';
import type { LayerDef } from '../data/layers';

/**
 * Decides whether a swing turns up a rock. Pure randomness weighted by the
 * layer, plus a mild "pity" ramp so a long dry spell gets more likely to end.
 * Nothing here ever guarantees a find, so every swing stays a small gamble.
 */
export class DiscoverySystem {
  private swingsSinceFind = 0;

  /** Chance the next swing in this layer finds a rock. */
  chance(layer: LayerDef): number {
    const d = layer.discovery;
    return Math.min(d.maxChance, d.baseChance + d.pityPerSwing * this.swingsSinceFind);
  }

  /** Rolls one swing. Call once per swing that is allowed to find something. */
  roll(layer: LayerDef, rng: Rng): boolean {
    const found = rng() < this.chance(layer);
    this.swingsSinceFind = found ? 0 : this.swingsSinceFind + 1;
    return found;
  }

  /** A swing happened but could not find anything (e.g. rocks already waiting). */
  skip(): void {
    this.swingsSinceFind++;
  }
}
