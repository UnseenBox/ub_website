import { Emitter } from './Emitter';

export type EarnReason = 'kill' | 'headshot' | 'wave' | 'refund';

interface EconomyEvents extends Record<string, unknown> {
  change: { cash: number; delta: number };
  earn: { amount: number; reason: EarnReason };
  spend: { amount: number; item: string };
}

export class EconomyManager {
  readonly events = new Emitter<EconomyEvents>();
  private _cash: number;
  totalEarned = 0;

  constructor(startingCash: number) {
    this._cash = Math.max(0, Math.floor(startingCash));
  }

  get cash(): number {
    return this._cash;
  }

  canAfford(amount: number): boolean {
    return amount >= 0 && this._cash >= amount;
  }

  earn(amount: number, reason: EarnReason): void {
    const a = Math.floor(amount);
    if (a <= 0) return;
    this._cash += a;
    this.totalEarned += a;
    this.events.emit('earn', { amount: a, reason });
    this.events.emit('change', { cash: this._cash, delta: a });
  }

  /** Deducts `amount` if affordable. Never lets the balance go negative. */
  spend(amount: number, item: string): boolean {
    const a = Math.floor(amount);
    if (a < 0 || !this.canAfford(a)) return false;
    this._cash -= a;
    this.events.emit('spend', { amount: a, item });
    this.events.emit('change', { cash: this._cash, delta: -a });
    return true;
  }
}
