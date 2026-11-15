import type { Rock } from '../core/types';

/** Money and sales. Sale prices come from the rock's pre-rolled hidden value. */
export class EconomySystem {
  private balance: number;
  private earned = 0;

  constructor(startingMoney: number, private readonly onChange: (money: number, delta: number) => void) {
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

  sell(rock: Rock): number {
    const price = this.priceOf(rock);
    this.balance += price;
    this.earned += price;
    this.onChange(this.balance, price);
    return price;
  }
}
