/**
 * Steps the visual quality down when a device cannot keep up, and never back up.
 *
 * Frame times are collected in WINDOW_S windows. A window whose 95th-percentile frame
 * takes longer than SLOW_MS is "slow"; WINDOWS_TO_STEP slow windows in a row (10 s) cost one
 * quality step. A good window resets the count, so a single hitch (a boss death) never does.
 * A device that holds 60 fps never leaves step 0.
 *
 * What each step does is the caller's business (see Game): 1 halves the particle count,
 * 2 lowers the pixel-ratio cap, 3 drops the single-particle trails.
 */
export const SLOW_MS = 24;
export const WINDOW_S = 5;
export const WINDOWS_TO_STEP = 2;
export const MAX_QUALITY_STEP = 3;

export class AdaptiveQuality {
  /** 0 = full quality. */
  step = 0;
  private times: number[] = [];
  private elapsed = 0;
  private slowWindows = 0;

  constructor(private readonly onStep: (step: number, p95Ms: number) => void) {}

  /** One displayed frame, in milliseconds of wall time. */
  frame(ms: number): void {
    if (!(ms > 0) || this.step >= MAX_QUALITY_STEP) return;
    this.times.push(ms);
    this.elapsed += ms / 1000;
    if (this.elapsed < WINDOW_S) return;
    const sorted = this.times.sort((a, b) => a - b);
    const p95 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))]!;
    this.times = [];
    this.elapsed = 0;
    if (p95 <= SLOW_MS) {
      this.slowWindows = 0;
      return;
    }
    if (++this.slowWindows < WINDOWS_TO_STEP) return;
    this.slowWindows = 0;
    this.step++;
    this.onStep(this.step, Math.round(p95));
  }
}
