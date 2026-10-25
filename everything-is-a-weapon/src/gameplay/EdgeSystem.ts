import { edgeStacks, type EdgeId } from './Edges';

export interface EdgeRunState {
  runBoosts: string[];
  runStreak: number;
  runInsuranceUsed: boolean;
}

/**
 * Turns owned Edge stacks into the small set of multipliers the simulation asks
 * for. Pure except for the two once-per-run/per-floor flags on this instance.
 */
export class EdgeSystem {
  private active = true;
  private headlineUsed = false;
  private glassCannonUsed = false;

  constructor(private readonly state: EdgeRunState) {}

  setActive(active: boolean): void {
    this.active = active;
    this.beginFloor();
  }

  stacks(id: EdgeId): number {
    return this.active ? edgeStacks(this.state.runBoosts, id) : 0;
  }

  impactDamageMultiplier(chainLink: number): number {
    if (!this.active) return 1;
    let multiplier = 1 + 0.25 * this.stacks('heavy_hands');
    if (chainLink >= 2) multiplier *= 1 + 0.35 * this.stacks('chain_reaction');
    return multiplier;
  }

  hazardDamageMultiplier(): number {
    return 1 + 0.25 * this.stacks('heavy_hands');
  }

  headlineDamageMultiplier(isHeadliner: boolean): number {
    if (!isHeadliner || this.headlineUsed || this.stacks('headline_act') === 0) return 1;
    return 1.3;
  }

  /** Called after the boosted hit lands, so speculative UI reads stay safe. */
  markHeadlineHit(): void {
    this.headlineUsed = true;
  }

  moveSpeedMultiplier(): number {
    const multiplier = 1 + 0.12 * this.stacks('quick_feet') + 0.25 * this.stacks('glass_cannon');
    return Math.min(1.45, multiplier);
  }

  dashSpeedMultiplier(): number {
    return 1 + 0.20 * this.stacks('quick_feet');
  }

  scoreMultiplier(streak = this.state.runStreak): number {
    const crowd = this.stacks('crowd_pleaser');
    const crowdMultiplier = crowd === 0
      ? 1
      : Math.min(3, 1 + crowd * (0.25 + 0.10 * Math.min(5, Math.max(0, streak))));
    return Math.max(0.25, crowdMultiplier * (1 - 0.10 * this.stacks('magnate')));
  }

  scrapMultiplier(): number {
    return (1 + 0.20 * this.stacks('scrap_luck')) * (1 + 0.40 * this.stacks('magnate'));
  }

  armorAtFloorStart(): number {
    return this.stacks('second_wind');
  }

  petFrenzyMultiplier(): number {
    return 1 + 0.5 * this.stacks('cat_frenzy');
  }

  consumeInsurance(): boolean {
    if (!this.active || this.stacks('fine_print') === 0 || this.state.runInsuranceUsed) return false;
    this.state.runInsuranceUsed = true;
    return true;
  }

  consumeGlassCannon(): boolean {
    if (!this.active || this.stacks('glass_cannon') === 0 || this.glassCannonUsed) return false;
    this.glassCannonUsed = true;
    return true;
  }

  beginFloor(): void {
    this.headlineUsed = false;
    this.glassCannonUsed = false;
  }
}
