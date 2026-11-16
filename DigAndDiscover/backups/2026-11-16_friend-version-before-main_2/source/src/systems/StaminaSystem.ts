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
  private maxBonus = 0;
  private regenBonus = 0;
  private costMult = 1;

  constructor(private readonly config: StaminaConfig) {
    this.current = config.max;
  }

  /** Store upgrades: bigger tank, faster recovery, cheaper swings. */
  setUpgrades(maxBonus: number, regenBonus: number, costMult: number): void {
    const grew = maxBonus - this.maxBonus;
    this.maxBonus = maxBonus;
    this.regenBonus = regenBonus;
    this.costMult = costMult;
    // A bigger tank arrives full of the extra energy.
    this.current = Math.min(this.max, this.current + Math.max(0, grew));
  }

  /** A little energy back (dig-streak bonus). */
  restore(amount: number): void {
    this.current = Math.min(this.max, this.current + amount);
  }

  /** Instantly full (rewarded ad, new day). */
  refill(): void {
    this.current = this.max;
    this.msSinceSpend = Number.POSITIVE_INFINITY;
  }

  get value(): number {
    return this.current;
  }

  get max(): number {
    return this.config.max + this.maxBonus;
  }

  get fraction(): number {
    return this.current / this.max;
  }

  get canDig(): boolean {
    return this.current >= this.costOf();
  }

  /** Cost of one swing for the given multiplier (tool x layer). */
  costOf(multiplier = 1): number {
    return this.config.digCost * multiplier * this.costMult;
  }

  get isRegenerating(): boolean {
    return this.current < this.max && this.msSinceSpend >= this.config.regenDelayMs;
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
    this.current = this.max;
    this.msSinceSpend = Number.POSITIVE_INFINITY;
  }

  update(deltaMs: number): void {
    this.msSinceSpend += deltaMs;
    if (this.msSinceSpend >= this.config.regenDelayMs && this.current < this.max) {
      this.current = Math.min(this.max, this.current + ((this.config.regenPerSecond + this.regenBonus) * deltaMs) / 1000);
    }
  }
}
