/**
 * All the numbers of the household economy live here: the daily costs, the debt
 * and the monthly schedule. Nothing else in the code may hardcode a price.
 *
 * Balanced with dev/econ-sim.ts against the income a player makes from rocks:
 * a player who never upgrades earns about $250 a day, one who buys tools as soon
 * as they can quickly earns thousands, so month one is tight and later months
 * scale up with the same pace as the income.
 */

/** One line of the daily household bill. */
export interface ExpenseItemDef {
  /** Stable id, used by the end-of-day screen to lay out the rows. */
  id: string;
  /** Plain text label shown to the player. */
  label: string;
  /** Cost per working day in month 1. */
  base: number;
}

/** A priced bill line for a specific month. */
export interface ExpenseLine {
  id: string;
  label: string;
  /** Cost for one day of that month, rounded to whole dollars. */
  amount: number;
}

export interface EconomyConfig {
  month: { days: number };
  household: {
    items: ExpenseItemDef[];
    /** The family does not get cheaper: every month the daily bill is multiplied by this. */
    growthPerMonth: number;
  };
  debt: {
    startingDebt: number;
    installmentIntervalDays: number;
    firstMonthInstallment: number;
    /** Every month the weekly instalment is multiplied by this (income grows far faster than the bill). */
    installmentGrowthPerMonth: number;
    lenderName: string;
  };
}

/** The whole economy configuration. */
export const ECONOMY: EconomyConfig = {
  month: {
    /** Working days in one month. */
    days: 30,
  },
  household: {
    items: [
      { id: 'food', label: 'Food', base: 35 },
      { id: 'water', label: 'Water', base: 12 },
      { id: 'power', label: 'Electricity', base: 18 },
      { id: 'other', label: 'Other essentials', base: 15 },
    ],
    growthPerMonth: 1.4,
  },
  debt: {
    /** What the father owes when the run starts (about four and a half months of instalments). */
    startingDebt: 250000,
    /** An instalment becomes due every N completed working days. */
    installmentIntervalDays: 7,
    /** Instalment due in month 1 (end of days 7, 14, 21 and 28). */
    firstMonthInstallment: 2500,
    installmentGrowthPerMonth: 2.4,
    lenderName: 'the bank',
  },
};

/**
 * The household bill for one day of the given month (0 based month index).
 */
export function expenseItemsForMonth(monthIndex: number): ExpenseLine[] {
  const index = Math.max(0, Math.floor(monthIndex));
  const factor = Math.pow(ECONOMY.household.growthPerMonth, index);
  return ECONOMY.household.items.map((item) => ({
    id: item.id,
    label: item.label,
    amount: Math.round(item.base * factor),
  }));
}

/** The debt instalment due in the given month (0 based month index). */
export function installmentForMonth(monthIndex: number): number {
  const index = Math.max(0, Math.floor(monthIndex));
  return Math.round(ECONOMY.debt.firstMonthInstallment * Math.pow(ECONOMY.debt.installmentGrowthPerMonth, index));
}

/** The full household bill for one day of the given month. */
export function dailyExpenseTotalForMonth(monthIndex: number): number {
  return expenseItemsForMonth(monthIndex).reduce((sum, item) => sum + item.amount, 0);
}
