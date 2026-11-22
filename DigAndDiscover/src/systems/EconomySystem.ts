import type { Rock } from '../core/types';

/** Money and sales. Sale prices come from the rock's pre-rolled hidden value. */
export class EconomySystem {
  private balance: number;
  private earned = 0;

  constructor(startingMoney: number, private readonly onChange: (money: number, delta: number, earned: boolean) => void) {
    this.balance = startingMoney;
  }

  get money(): number {
    return this.balance;
  }

  get totalEarned(): number {
    return this.earned;
  }

  priceOf(rock: Rock): number {
    return rock.value;
  }

  /** `multiplier` is for bonus sales (e.g. a rewarded ad doubles the price). */
  sell(rock: Rock, multiplier = 1): number {
    const price = Math.round(this.priceOf(rock) * multiplier);
    this.balance += price;
    this.earned += price;
    this.onChange(this.balance, price, true);
    return price;
  }

  /** Money made by digging something up (counts toward "earned" like a sale). */
  earn(amount: number): void {
    if (amount <= 0) return;
    this.balance += amount;
    this.earned += amount;
    this.onChange(this.balance, amount, true);
  }

  /** Cash that is not a sale: goal rewards, level bonuses, ad rewards. */
  grant(amount: number): void {
    if (amount <= 0) return;
    this.balance += amount;
    this.onChange(this.balance, amount, false);
  }

  /** Pays for something. False (and no change) if there is not enough. */
  spend(amount: number): boolean {
    if (amount > this.balance) return false;
    this.balance -= amount;
    this.onChange(this.balance, -amount, false);
    return true;
  }

  /** Restores a saved balance. */
  load(amount: number): void {
    this.balance = Math.max(0, Math.round(amount));
  }

  /** Starts a fresh run with the given balance and no income history. */
  reset(amount: number): void {
    this.balance = Math.max(0, Math.round(amount));
    this.earned = 0;
  }
}
