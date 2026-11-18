import { COMBO } from '../config';

/**
 * A short hit chain. Every hit on an enemy extends it, and a hit on the player
 * breaks it. The meter is pure state so the HUD can read it every frame.
 */
export class ComboMeter {
  count = 0;
  timer = 0;

  /** Record one hit and return the new chain length. */
  hit(): number {
    this.count = Math.min(COMBO.max, this.count + 1);
    this.timer = COMBO.window;
    return this.count;
  }

  break(): void {
    this.count = 0;
    this.timer = 0;
  }

  update(dt: number): void {
    if (this.timer <= 0) return;
    this.timer = Math.max(0, this.timer - dt);
    if (this.timer === 0) this.count = 0;
  }

  /** 0..1 share of the window left, for the HUD bar. */
  get fraction(): number {
    return this.timer / COMBO.window;
  }

  get scoreMultiplier(): number {
    return Math.min(COMBO.maxScoreMultiplier, 1 + COMBO.scorePerHit * Math.max(0, this.count - 1));
  }

  get coinMultiplier(): number {
    return Math.min(COMBO.maxCoinMultiplier, 1 + COMBO.coinPerHit * Math.max(0, this.count - 1));
  }
}
