import { ECONOMY, expenseItemsForMonth, installmentForMonth, type ExpenseLine } from '../data/economy';

export type { ExpenseLine };

/** The result of closing one working day. */
export interface DaySettlement {
  /** The bill items of that day. */
  items: ExpenseLine[];
  /** Unpaid household bills carried in from the previous days. */
  carriedIn: number;
  /** Sum of the bill items only (without the carried in bills). */
  expensesTotal: number;
  /** What the family owed for that day: items plus carried in bills. */
  due: number;
  /** How much of it could be paid. */
  paid: number;
  /** What could not be paid and is carried forward. */
  carriedOut: number;
  /** The debt instalment that became due on this day (0 if none). */
  installmentIssued: number;
  /** The debt that is overdue after this day. */
  overdue: number;
  /** True when this was the last working day of the month. */
  isMonthEnd: boolean;
  /** Working days left in the month after this day. */
  daysLeftInMonth: number;
}

/** A snapshot of the ledger for the UI. */
export interface LedgerView {
  debtRemaining: number;
  debtStart: number;
  installment: number;
  installmentIntervalDays: number;
  paidTotal: number;
  paidThisMonth: number;
  overdue: number;
  credit: number;
  /** Day number inside the month of the next instalment, null if there is none. */
  nextInstallmentDay: number | null;
  daysUntilNextInstallment: number;
  daysLeftInMonth: number;
  monthIndex: number;
  /** Month number, 1 based. */
  monthNumber: number;
  dayInMonth: number;
  monthDays: number;
  billsOutstanding: number;
  debtFree: boolean;
  /** What the household bill of today will cost (without carried bills). */
  todaysExpenseEstimate: number;
}

/** The part of the save file that belongs to the finance system. */
export interface FinanceSave {
  debtRemaining: number;
  overdue: number;
  credit: number;
  paidTotal: number;
  paidThisMonth: number;
  monthIndex: number;
  dayInMonth: number;
  billsOutstanding: number;
  debtFree: boolean;
  gameOver: string | null;
  daysSurvived: number;
  monthsCompleted: number;
}

/** The finance part of the end-of-day summary. */
export interface FinanceDaySummary {
  items: ExpenseLine[];
  carriedIn: number;
  due: number;
  paid: number;
  carriedOut: number;
  installmentIssued: number;
  overdue: number;
  isMonthEnd: boolean;
  daysLeftInMonth: number;
  debtRemaining: number;
  /** The money the player has after the household bill was deducted. */
  moneyAfterPayment: number;
}

/** The reason the run ended, or an empty reason when everything is fine. */
export interface MonthCheck {
  ok: boolean;
  reason?: string;
}

function clampMoney(value: unknown, fallback = 0): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  return Math.max(0, Math.round(n));
}

function clampInt(value: unknown, fallback = 0): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : fallback;
  return Math.max(0, n);
}

/**
 * The household ledger: daily bills, the weekly debt instalments and the
 * monthly deadline. Pure logic, no Phaser, no randomness.
 */
export class FinanceSystem {
  /** Cash the family still owes to the bank. */
  debtRemaining = ECONOMY.debt.startingDebt;
  /** Instalments that became due and were not paid yet. */
  overdue = 0;
  /** Money paid ahead of the schedule, used by the next instalments. */
  credit = 0;
  /** Total cash paid to the bank since the start of the run. */
  paidTotal = 0;
  /** Cash paid to the bank in the current month. */
  paidThisMonth = 0;
  /** 0 based index of the current month. */
  monthIndex = 0;
  /** 1 based day number inside the current month. */
  dayInMonth = 1;
  /** Unpaid household bills carried forward. */
  billsOutstanding = 0;
  /** True once the whole debt is paid off. */
  debtFree = false;
  /** Why the run ended, null while the run is alive. */
  gameOver: string | null = null;
  /** Working days survived in this run. */
  daysSurvived = 0;
  /** Months completed in this run. */
  monthsCompleted = 0;

  /**
   * Closes one working day: the household bill is taken from the money and an
   * instalment becomes due on every multiple of the interval. The money itself
   * is not touched here, the caller deducts `paid`.
   */
  settleDay(money: number): DaySettlement {
    const items = expenseItemsForMonth(this.monthIndex);
    const expensesTotal = items.reduce((sum, item) => sum + item.amount, 0);
    const carriedIn = this.billsOutstanding;
    const due = expensesTotal + carriedIn;
    const paid = Math.min(Math.max(0, Math.floor(money)), due);
    this.billsOutstanding = due - paid;

    let installmentIssued = 0;
    const interval = ECONOMY.debt.installmentIntervalDays;
    if (!this.debtFree && this.dayInMonth % interval === 0) {
      const amount = Math.min(installmentForMonth(this.monthIndex), this.debtRemaining);
      const take = Math.min(this.credit, amount);
      this.credit -= take;
      this.overdue += amount - take;
      installmentIssued = amount;
    }

    this.daysSurvived++;
    return {
      items,
      carriedIn,
      expensesTotal,
      due,
      paid,
      carriedOut: this.billsOutstanding,
      installmentIssued,
      overdue: this.overdue,
      isMonthEnd: this.dayInMonth === ECONOMY.month.days,
      daysLeftInMonth: Math.max(0, ECONOMY.month.days - this.dayInMonth),
    };
  }

  /**
   * Pays the bank. Never more than the player owns and never more than what
   * is owed. The overdue part is cleared first, the rest is a prepayment.
   * Returns the amount actually paid.
   */
  pay(amount: number, money: number): number {
    const x = Math.min(Math.max(0, amount), Math.max(0, money), this.debtRemaining);
    if (x <= 0) return 0;
    this.debtRemaining -= x;
    this.paidTotal += x;
    this.paidThisMonth += x;
    const overduePart = Math.min(x, this.overdue);
    this.overdue = Math.max(0, this.overdue - x);
    this.credit += x - overduePart;
    if (this.debtRemaining <= 0) {
      this.debtRemaining = 0;
      this.debtFree = true;
      this.overdue = 0;
      this.credit = 0;
    }
    return x;
  }

  /**
   * Pays what is due: the overdue amount if there is any, otherwise the next
   * instalment (that is a prepayment). Returns the amount actually paid.
   */
  payInstallment(money: number): number {
    if (this.debtFree) return 0;
    const target = this.overdue > 0 ? this.overdue : installmentForMonth(this.monthIndex);
    return this.pay(target, money);
  }

  /** Pays household bills that were carried forward. Returns the amount actually paid. */
  payBills(money: number): number {
    const paid = Math.max(0, Math.min(Math.round(money), this.billsOutstanding));
    this.billsOutstanding -= paid;
    return paid;
  }

  /**
   * Checked when the player starts the day after the last day of the month.
   * Anything overdue at that moment ends the run.
   */
  evaluateMonth(): MonthCheck {
    if (this.overdue > 0) {
      const month = this.monthIndex + 1;
      const lender = ECONOMY.debt.lenderName;
      const lenderCap = lender.charAt(0).toUpperCase() + lender.slice(1);
      const owed = `$${Math.round(this.overdue).toLocaleString('en-US')}`;
      return {
        ok: false,
        reason:
          `Month ${month} ended with ${owed} of debt still overdue. ` +
          `${lenderCap} does not wait, and the family cannot pay the bills either. ` +
          'Pay what is due before the month turns over.',
      };
    }
    return { ok: true };
  }

  /** Advances the day and month counters. */
  startNextDay(): void {
    this.dayInMonth++;
    if (this.dayInMonth > ECONOMY.month.days) {
      this.monthIndex++;
      this.dayInMonth = 1;
      this.paidThisMonth = 0;
      this.monthsCompleted++;
    }
  }

  /** A snapshot of the whole ledger for the UI. */
  view(): LedgerView {
    const monthDays = ECONOMY.month.days;
    const interval = ECONOMY.debt.installmentIntervalDays;
    let nextInstallmentDay: number | null = null;
    if (!this.debtFree) {
      for (let day = this.dayInMonth + 1; day <= monthDays; day++) {
        if (day % interval === 0) {
          nextInstallmentDay = day;
          break;
        }
      }
    }
    const items = expenseItemsForMonth(this.monthIndex);
    return {
      debtRemaining: this.debtRemaining,
      debtStart: ECONOMY.debt.startingDebt,
      installment: installmentForMonth(this.monthIndex),
      installmentIntervalDays: interval,
      paidTotal: this.paidTotal,
      paidThisMonth: this.paidThisMonth,
      overdue: this.overdue,
      credit: this.credit,
      nextInstallmentDay,
      daysUntilNextInstallment: nextInstallmentDay === null ? 0 : nextInstallmentDay - this.dayInMonth,
      daysLeftInMonth: Math.max(0, monthDays - this.dayInMonth),
      monthIndex: this.monthIndex,
      monthNumber: this.monthIndex + 1,
      dayInMonth: this.dayInMonth,
      monthDays,
      billsOutstanding: this.billsOutstanding,
      debtFree: this.debtFree,
      todaysExpenseEstimate: items.reduce((sum, item) => sum + item.amount, 0),
    };
  }

  /** Ends the run with the given reason. */
  triggerGameOver(reason: string): void {
    this.gameOver = reason;
  }

  /** Back to the start of a fresh run. */
  reset(): void {
    this.debtRemaining = ECONOMY.debt.startingDebt;
    this.overdue = 0;
    this.credit = 0;
    this.paidTotal = 0;
    this.paidThisMonth = 0;
    this.monthIndex = 0;
    this.dayInMonth = 1;
    this.billsOutstanding = 0;
    this.debtFree = false;
    this.gameOver = null;
    this.daysSurvived = 0;
    this.monthsCompleted = 0;
  }

  /** The finance part of the save file. */
  toSave(): FinanceSave {
    return {
      debtRemaining: this.debtRemaining,
      overdue: this.overdue,
      credit: this.credit,
      paidTotal: this.paidTotal,
      paidThisMonth: this.paidThisMonth,
      monthIndex: this.monthIndex,
      dayInMonth: this.dayInMonth,
      billsOutstanding: this.billsOutstanding,
      debtFree: this.debtFree,
      gameOver: this.gameOver,
      daysSurvived: this.daysSurvived,
      monthsCompleted: this.monthsCompleted,
    };
  }

  /** Restores a save. Missing or broken fields fall back to the defaults. */
  restore(data?: Partial<FinanceSave>): void {
    if (!data) {
      this.reset();
      return;
    }
    const debt =
      typeof data.debtRemaining === 'number' && Number.isFinite(data.debtRemaining) && data.debtRemaining >= 0
        ? Math.round(data.debtRemaining)
        : ECONOMY.debt.startingDebt;
    this.debtRemaining = debt;
    this.overdue = clampMoney(data.overdue);
    this.credit = clampMoney(data.credit);
    this.paidTotal = clampMoney(data.paidTotal);
    this.paidThisMonth = clampMoney(data.paidThisMonth);
    this.monthIndex = clampInt(data.monthIndex);
    this.dayInMonth = Math.min(ECONOMY.month.days, Math.max(1, clampInt(data.dayInMonth, 1)));
    this.billsOutstanding = clampMoney(data.billsOutstanding);
    this.debtFree = data.debtFree === true || this.debtRemaining === 0;
    this.gameOver = typeof data.gameOver === 'string' ? data.gameOver : null;
    this.daysSurvived = clampInt(data.daysSurvived);
    this.monthsCompleted = clampInt(data.monthsCompleted);
    if (this.debtFree) {
      this.debtRemaining = 0;
      this.overdue = 0;
      this.credit = 0;
    }
  }
}
