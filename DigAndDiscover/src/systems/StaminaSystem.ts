export interface StaminaConfig {
  readonly max: number;
  readonly digCost: number;
  readonly regenPerSecond: number;
  readonly regenDelayMs: number;
}

/** Pure stamina logic: spending, a short rest delay, then smooth regeneration. */
export class StaminaSystem {
  private current: number;
  private msSinceSpend = Number.POSITIVE_INFINITY;

  constructor(private readonly config: StaminaConfig) {
    this.current = config.max;
  }

  get value(): number {
    return this.current;
  }

  get max(): number {
    return this.config.max;
  }

  get fraction(): number {
    return this.current / this.config.max;
  }

  get canDig(): boolean {
    return this.current >= this.config.digCost;
  }

  /** Cost of one swing for the given multiplier (tool x layer). */
  costOf(multiplier = 1): number {
    return this.config.digCost * multiplier;
  }

  get isRegenerating(): boolean {
    return this.current < this.config.max && this.msSinceSpend >= this.config.regenDelayMs;
  }

  /** Spends one swing's worth of stamina. A swing is allowed while at least its cost remains. */
  trySpend(multiplier = 1): boolean {
    const cost = this.costOf(multiplier);
    if (this.current < cost) return false;
    this.current -= cost;
    this.msSinceSpend = 0;
    return true;
  }

  /** A new working day starts rested: full tank, regeneration ready. */
  reset(): void {
    this.current = this.config.max;
    this.msSinceSpend = Number.POSITIVE_INFINITY;
  }

  update(deltaMs: number): void {
    this.msSinceSpend += deltaMs;
    if (this.msSinceSpend >= this.config.regenDelayMs && this.current < this.config.max) {
      this.current = Math.min(this.config.max, this.current + (this.config.regenPerSecond * deltaMs) / 1000);
    }
  }
}
