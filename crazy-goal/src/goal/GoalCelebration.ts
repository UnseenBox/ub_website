import { clamp01, easeOutExpo } from '../core/math';
import type { ScoreCard } from '../scoring/ScoreSystem';

/** When each piece of the celebration lands, in real seconds after the ball crosses the line. */
export const CELEBRATION_TIMING = {
  hitStop: 0.14,
  slowMoScale: 0.28,
  slowMoSeconds: 0.5,
  cardAt: 0.55,
  lineGap: 0.13,
  /** Clicks before this are ignored, so a stray press cannot skip the moment. */
  retryAfter: 0.6,
  /** When the retry and next buttons appear. */
  buttonsAfter: 1.1,
} as const;

/**
 * The timeline of a goal. It owns no drawing and no sound: the HUD reads it to place the
 * banner and score card, and `onLine` lets audio tick as each score line appears.
 */
export class GoalCelebration {
  active = false;
  /** Real seconds since the goal. */
  t = 0;
  card: ScoreCard | null = null;
  /** Score lines revealed so far. */
  revealed = 0;
  /** The total as currently displayed while it counts up. */
  shownTotal = 0;
  /** Stars revealed so far. */
  starsShown = 0;
  onLine: ((index: number, last: boolean) => void) | null = null;
  onStar: ((index: number) => void) | null = null;

  start(card: ScoreCard): void {
    this.active = true;
    this.t = 0;
    this.card = card;
    this.revealed = 0;
    this.starsShown = 0;
    this.shownTotal = 0;
  }

  stop(): void {
    this.active = false;
    this.card = null;
  }

  get canRetry(): boolean {
    return this.active && this.t >= CELEBRATION_TIMING.retryAfter;
  }

  /** Seconds since line `i` appeared (negative if it has not yet). */
  lineAge(i: number): number {
    return this.t - CELEBRATION_TIMING.cardAt - 0.1 - i * CELEBRATION_TIMING.lineGap;
  }

  /** Seconds since star `i` landed (negative if it has not yet). They follow the total. */
  starAge(i: number): number {
    if (!this.card) return -1;
    return this.lineAge(this.card.lines.length) - 0.4 - i * 0.2;
  }

  /** 0 to 1 once every line is in and the total is counting up. */
  get totalProgress(): number {
    if (!this.card) return 0;
    return clamp01(this.lineAge(this.card.lines.length) / 0.45);
  }

  update(realDt: number): void {
    if (!this.active || !this.card) return;
    this.t += realDt;
    const lines = this.card.lines.length;
    while (this.revealed < lines && this.lineAge(this.revealed) >= 0) {
      this.revealed++;
      this.onLine?.(this.revealed - 1, this.revealed === lines);
    }
    while (this.starsShown < this.card.stars && this.starAge(this.starsShown) >= 0) {
      this.onStar?.(this.starsShown);
      this.starsShown++;
    }
    this.shownTotal = Math.round(this.card.total * easeOutExpo(this.totalProgress));
  }
}
