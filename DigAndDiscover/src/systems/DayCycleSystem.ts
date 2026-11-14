import { ClockSystem, type ClockConfig } from './ClockSystem';

/**
 * working : the clock runs and every action is allowed.
 * closing : 5:00 PM passed. Digging stops; every rock still in the bag has to be
 *           cut and sold before the day can end. Running animations finish.
 * summary : the end-of-day screen is up.
 */
export type DayPhase = 'working' | 'closing' | 'summary';

export interface DayTimingConfig {
  /** Pause after the last rock is sold before the summary opens. */
  readonly closingMinMs: number;
  /** Longest wait for animations once nothing is left to cut. */
  readonly closingMaxMs: number;
}

export interface TodayStats {
  found: number;
  processed: number;
  earned: number;
}

/** Everything the end-of-day screen needs, gathered in one place. */
export interface DaySummary {
  day: number;
  hoursWorked: number;
  startLabel: string;
  endLabel: string;
  rocksDiscovered: number;
  rocksProcessed: number;
  moneyEarned: number;
  totalMoney: number;
  totalDiscoveries: number;
  depthMeters: number;
  maxDepthMeters: number;
  depthFraction: number;
  layerName: string;
  /** Number of layers entered so far / total layers. */
  layerIndex: number;
  layerCount: number;
}

export interface DayCycleHooks {
  onPhase: (phase: DayPhase) => void;
}

/** Day counter, working-day clock, phase machine and per-day tallies. */
export class DayCycleSystem {
  readonly clock: ClockSystem;
  day = 1;
  readonly today: TodayStats = { found: 0, processed: 0, earned: 0 };
  private currentPhase: DayPhase = 'working';
  private closingMs = 0;
  /** Time spent in the closing phase with nothing left to cut. */
  private settleMs = 0;

  constructor(
    clock: ClockConfig,
    private readonly timing: DayTimingConfig,
    private readonly hooks: DayCycleHooks,
  ) {
    this.clock = new ClockSystem(clock);
  }

  get phase(): DayPhase {
    return this.currentPhase;
  }

  /** New digging may begin (the working day is still on). */
  get canWork(): boolean {
    return this.currentPhase === 'working';
  }

  /** Rocks may still be cut and sold: all day, and after closing time until the bag is empty. */
  get canCut(): boolean {
    return this.currentPhase !== 'summary';
  }

  get closingElapsedMs(): number {
    return this.closingMs;
  }

  /**
   * Advance time by real milliseconds (the clock runs while working; closing
   * time is counted while closing). rocksLeft is how many rocks are still in the bag.
   */
  tick(deltaMs: number, rocksLeft = 0): void {
    if (this.currentPhase === 'working') {
      this.clock.update(deltaMs);
      if (this.clock.isOver) this.setPhase('closing');
    } else if (this.currentPhase === 'closing') {
      this.closingMs += deltaMs;
      this.settleMs = rocksLeft > 0 ? 0 : this.settleMs + deltaMs;
    }
  }

  /**
   * True once every rock has been cut and sold, the short closing pause is over
   * and nothing is mid-animation (or the safety timeout hit). Never true while rocks are left.
   */
  readyForSummary(somethingRunning: boolean, rocksLeft = 0): boolean {
    if (this.currentPhase !== 'closing' || rocksLeft > 0) return false;
    if (this.settleMs < this.timing.closingMinMs) return false;
    return !somethingRunning || this.settleMs >= this.timing.closingMaxMs;
  }

  openSummary(): void {
    if (this.currentPhase === 'closing') this.setPhase('summary');
  }

  startNextDay(): void {
    if (this.currentPhase !== 'summary') return;
    this.day++;
    this.clock.reset();
    this.closingMs = 0;
    this.settleMs = 0;
    this.today.found = 0;
    this.today.processed = 0;
    this.today.earned = 0;
    this.setPhase('working');
  }

  private setPhase(phase: DayPhase): void {
    this.currentPhase = phase;
    this.hooks.onPhase(phase);
  }
}
