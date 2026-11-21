import { FEATURES } from '../config/features';
import {
  DailyGoal,
  DailyGoalsSave,
  DailyMetric,
  DailyStrength,
  DailyTier,
  generateDailyGoals,
} from '../data/dailyGoals';

/**
 * Runtime for the three daily goals.
 *
 * Pure logic: no Phaser, no scenes. GameState owns one instance and forwards
 * metrics to `note()`. Cash is paid through hooks, so this class never touches
 * the economy directly and is trivial to exercise in a headless simulation.
 */

export interface DailyHooks {
  /** A goal progressed or the day's state changed (save + refresh the UI). */
  changed(): void;
  /** One goal just completed. Pay `goal.cash` here. */
  completed(goal: DailyGoal): void;
  /** All three goals just completed. Pay the bonus here. */
  allDone(bonus: number): void;
}

const VALID_METRICS: readonly DailyMetric[] = ['dig', 'find', 'rare', 'cut', 'earn', 'depth', 'sale'];
const VALID_TIERS: readonly DailyTier[] = ['easy', 'medium', 'hard'];

export class DailyGoalSystem {
  goals: DailyGoal[] = [];
  bonus = 0;
  /** Cash paid by today's goals, including the all-three bonus. */
  earned = 0;
  /** All three goals are done. */
  done = false;

  private day = 0;
  private lastSignature = '';

  constructor(
    private readonly hooks: DailyHooks,
    readonly enabled: boolean = FEATURES.v2,
  ) {}

  /** True only when the feature is on and goals exist. */
  get active(): boolean {
    return this.enabled && this.goals.length > 0;
  }

  get completedCount(): number {
    let count = 0;
    for (const goal of this.goals) if (goal.done) count++;
    return count;
  }

  get total(): number {
    return this.goals.length;
  }

  /** Build goals for `day` if they are not there yet. Safe to call every tick. */
  ensure(day: number, strength: DailyStrength): void {
    if (!this.enabled) return;
    if (this.day === day && this.goals.length === 3) return;
    this.apply(day, strength, this.lastSignature);
  }

  /** Start a new day: fresh goals, no progress, no cash paid. */
  reset(day: number, strength: DailyStrength): void {
    if (!this.enabled) {
      this.clear();
      return;
    }
    this.apply(day, strength, this.lastSignature);
    this.hooks.changed();
  }

  /**
   * Restore today's goals from a save. If the save is from another day (or is
   * missing/invalid) fresh goals are generated instead, so old saves load fine.
   */
  restore(save: DailyGoalsSave | undefined, day: number, strength: DailyStrength): void {
    if (!this.enabled) {
      this.clear();
      return;
    }
    if (save && save.day === day && this.isValid(save)) {
      this.day = save.day;
      this.goals = save.goals.map((goal) => ({ ...goal }));
      this.bonus = save.bonus;
      this.earned = save.earned;
      this.done = save.done || this.goals.every((goal) => goal.done);
      this.lastSignature = save.signature || this.signature();
      return;
    }
    this.apply(day, strength, '');
  }

  /** Save shape for ProgressSystem. Undefined when the feature is off. */
  toSave(): DailyGoalsSave | undefined {
    if (!this.enabled || this.goals.length === 0) return undefined;
    return {
      day: this.day,
      goals: this.goals.map((goal) => ({ ...goal })),
      bonus: this.bonus,
      earned: this.earned,
      done: this.done,
      signature: this.lastSignature,
    };
  }

  /**
   * Feed a metric. `absolute` is for values that are already totals (depth,
   * best sale) rather than increments (digs, finds, cash earned).
   */
  note(metric: DailyMetric, amount = 1, absolute = false): void {
    if (!this.active || this.done || !Number.isFinite(amount) || amount <= 0) return;

    let changed = false;
    for (const goal of this.goals) {
      if (goal.done || goal.metric !== metric) continue;
      const next = absolute ? Math.max(goal.progress, amount) : goal.progress + amount;
      if (next === goal.progress) continue;
      goal.progress = Math.min(goal.target, next);
      changed = true;
      if (goal.progress >= goal.target) {
        goal.done = true;
        this.earned += goal.cash;
        this.hooks.completed(goal);
      }
    }

    if (!this.done && this.goals.length > 0 && this.goals.every((goal) => goal.done)) {
      this.done = true;
      this.earned += this.bonus;
      this.hooks.allDone(this.bonus);
    }

    if (changed) this.hooks.changed();
  }

  /** The current tier:metric signature (used to avoid repeating a trio). */
  signature(): string {
    return this.goals.map((goal) => `${goal.tier}:${goal.metric}`).join('|');
  }

  private apply(day: number, strength: DailyStrength, previousSignature: string): void {
    const generated = generateDailyGoals(day, strength, previousSignature);
    this.day = Math.max(1, Math.floor(day));
    this.goals = generated.goals;
    this.bonus = generated.bonus;
    this.lastSignature = generated.signature;
    this.earned = 0;
    this.done = false;
  }

  private clear(): void {
    this.goals = [];
    this.bonus = 0;
    this.earned = 0;
    this.done = false;
    this.day = 0;
    this.lastSignature = '';
  }

  private isValid(save: DailyGoalsSave): boolean {
    if (!Array.isArray(save.goals) || save.goals.length !== 3) return false;
    if (!Number.isFinite(save.bonus) || save.bonus < 0) return false;
    if (!Number.isFinite(save.earned) || save.earned < 0) return false;
    if (typeof save.done !== 'boolean') return false;

    const tiers = new Set<DailyTier>();
    for (const goal of save.goals) {
      if (!goal || !VALID_METRICS.includes(goal.metric) || !VALID_TIERS.includes(goal.tier)) return false;
      if (!Number.isFinite(goal.target) || goal.target <= 0) return false;
      if (!Number.isFinite(goal.cash) || goal.cash < 0) return false;
      if (!Number.isFinite(goal.progress) || goal.progress < 0) return false;
      if (typeof goal.done !== 'boolean') return false;
      tiers.add(goal.tier);
    }
    return tiers.size === 3;
  }
}
