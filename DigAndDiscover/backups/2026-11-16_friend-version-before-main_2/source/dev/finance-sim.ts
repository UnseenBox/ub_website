/**
 * Headless checks for the household economy. Run with:
 *   npx -y tsx dev/finance-sim.ts
 * No Phaser, no randomness: only FinanceSystem and the ECONOMY data.
 */
import { FinanceSystem } from '../src/systems/FinanceSystem';
import { ECONOMY, installmentForMonth } from '../src/data/economy';

let failures = 0;

function check(name: string, ok: boolean, detail = ''): void {
  if (ok) {
    console.log('PASS ' + name);
  } else {
    failures++;
    console.log('FAIL ' + name + (detail ? ' -> ' + detail : ''));
  }
}

interface SimResult {
  months: number;
  days: number;
  debtRemaining: number;
  paidTotal: number;
  overdue: number;
  billsOutstanding: number;
  gameOver: string | null;
}

/**
 * Plays the game with a fixed income per day. The income arrives before the
 * day ends, the household bill is settled at the end of the day and the debt
 * is paid when it becomes due.
 */
function simulate(incomePerDay: number, maxDays: number, payInstalments: boolean): SimResult {
  const finance = new FinanceSystem();
  let money = 0;
  for (let day = 0; day < maxDays; day++) {
    money += incomePerDay;
    const settlement = finance.settleDay(money);
    money -= settlement.paid;
    if (payInstalments && settlement.installmentIssued > 0) {
      money -= finance.pay(settlement.installmentIssued, money);
    }
    const view = finance.view();
    if (view.dayInMonth === view.monthDays) {
      const result = finance.evaluateMonth();
      if (!result.ok) {
        finance.triggerGameOver(result.reason ?? 'unknown reason');
        break;
      }
    }
    finance.startNextDay();
  }
  return {
    months: finance.monthsCompleted,
    days: finance.daysSurvived,
    debtRemaining: finance.debtRemaining,
    paidTotal: finance.paidTotal,
    overdue: finance.overdue,
    billsOutstanding: finance.billsOutstanding,
    gameOver: finance.gameOver,
  };
}

console.log('Finance checks');

// (a) A diligent player survives three months and the debt goes down. The
// income must cover the instalment of month 3 (about 2,060 a day) plus bills.
{
  const run = simulate(3000, 400, true);
  check('a diligent player survives 3 months', run.months >= 3, 'months=' + run.months);
  check('a diligent player pays the debt down', run.paidTotal > 0 && run.debtRemaining < ECONOMY.debt.startingDebt,
    'paid=' + run.paidTotal + ' remaining=' + run.debtRemaining);
  check('a diligent player never falls behind', run.overdue === 0, 'overdue=' + run.overdue);
}

// (b) A player who never pays hits the monthly deadline.
{
  const run = simulate(400, 200, false);
  check('a player who never pays loses the run', run.gameOver !== null, 'reason=' + run.gameOver);
  check('the reason names the overdue amount', run.gameOver !== null && run.gameOver.includes(run.overdue.toLocaleString('en-US')),
    'reason=' + run.gameOver + ' overdue=' + run.overdue);
  check('the player lost before completing a month', run.months === 0, 'months=' + run.months);
}

// (c) A broke player carries the unpaid bills forward, nothing is lost.
{
  const finance = new FinanceSystem();
  const first = finance.settleDay(0);
  check('a broke player pays nothing', first.paid === 0, 'paid=' + first.paid);
  check('the unpaid bill is carried out', first.carriedOut === first.due && finance.billsOutstanding === first.due,
    'carriedOut=' + first.carriedOut + ' due=' + first.due);
  const second = finance.settleDay(0);
  check('the bill of yesterday is carried in', second.carriedIn === first.due, 'carriedIn=' + second.carriedIn);
  check('nothing is silently discarded', second.due === second.expensesTotal + second.carriedIn && second.carriedOut === second.due - second.paid,
    'due=' + second.due + ' carriedOut=' + second.carriedOut);
}

// (d) A prepayment covers the next instalments.
{
  const finance = new FinanceSystem();
  const paid = finance.pay(300, 1000);
  check('a prepayment is accepted', paid === 300 && finance.credit === 300 && finance.overdue === 0,
    'paid=' + paid + ' credit=' + finance.credit);
  let issued = 0;
  for (let day = 1; day <= 7; day++) {
    const settlement = finance.settleDay(0);
    if (day === 7) issued = settlement.installmentIssued;
    finance.startNextDay();
  }
  check('the prepayment covers part of the instalment',
    issued === installmentForMonth(0) && finance.overdue === issued - 300 && finance.credit === 0,
    'issued=' + issued + ' overdue=' + finance.overdue + ' credit=' + finance.credit);
}

// (e) The player cannot pay more than they own or more than they owe.
{
  const poor = new FinanceSystem();
  check('paying is capped by the money', poor.pay(5000, 100) === 100, 'paid=' + poor.pay(1, 0));
  const rich = new FinanceSystem();
  const paid = rich.pay(999999, 999999);
  check('paying is capped by the debt', paid === ECONOMY.debt.startingDebt && rich.debtRemaining === 0,
    'paid=' + paid + ' remaining=' + rich.debtRemaining);
  check('paying the whole debt means debt free', rich.debtFree === true);
}

// (f) Debt free means no more instalments.
{
  const finance = new FinanceSystem();
  finance.pay(ECONOMY.debt.startingDebt, ECONOMY.debt.startingDebt);
  let issued = 0;
  for (let day = 1; day <= 30; day++) {
    const settlement = finance.settleDay(0);
    if (settlement.installmentIssued > 0) issued += settlement.installmentIssued;
    finance.startNextDay();
  }
  check('a debt free player gets no instalments', issued === 0 && finance.debtFree === true, 'issued=' + issued);
}

// (h) Household bills that were carried forward can be paid from the ledger.
{
  const finance = new FinanceSystem();
  finance.settleDay(0);
  const owed = finance.billsOutstanding;
  const part = finance.payBills(10);
  check('part of a carried bill can be paid', part === 10 && finance.billsOutstanding === owed - 10,
    'part=' + part + ' left=' + finance.billsOutstanding);
  const rest = finance.payBills(999999);
  check('the rest of the carried bill is paid and nothing more', rest === owed - 10 && finance.billsOutstanding === 0,
    'rest=' + rest + ' left=' + finance.billsOutstanding);
  check('paying with no money pays nothing', finance.payBills(0) === 0 && finance.payBills(-5) === 0);
}

// (g) The save round trip.
{
  const finance = new FinanceSystem();
  finance.settleDay(500);
  finance.pay(120, 400);
  finance.startNextDay();
  const data = finance.toSave();
  const restored = new FinanceSystem();
  restored.restore(data);
  check('the save round trip keeps every number',
    restored.debtRemaining === finance.debtRemaining &&
      restored.overdue === finance.overdue &&
      restored.credit === finance.credit &&
      restored.paidTotal === finance.paidTotal &&
      restored.paidThisMonth === finance.paidThisMonth &&
      restored.monthIndex === finance.monthIndex &&
      restored.dayInMonth === finance.dayInMonth &&
      restored.billsOutstanding === finance.billsOutstanding &&
      restored.debtFree === finance.debtFree &&
      restored.daysSurvived === finance.daysSurvived &&
      restored.monthsCompleted === finance.monthsCompleted);
  const broken = new FinanceSystem();
  broken.restore({ debtRemaining: -10, overdue: NaN, dayInMonth: 999 } as never);
  check('a broken save falls back to sane numbers',
    broken.debtRemaining === ECONOMY.debt.startingDebt && broken.overdue === 0 && broken.dayInMonth === ECONOMY.month.days,
    'debt=' + broken.debtRemaining + ' day=' + broken.dayInMonth);
}

console.log('');
console.log('Balance table (the player pays everything due as early as possible)');
console.log('daily income | months survived | days survived | debt paid | debt left | result');
for (const income of [300, 450, 600, 1000, 2500, 4000]) {
  const run = simulate(income, 3650, true);
  console.log(
    [
      String(income).padStart(12),
      String(run.months).padStart(16),
      String(run.days).padStart(14),
      String(run.paidTotal).padStart(10),
      String(run.debtRemaining).padStart(10),
      run.gameOver ? 'game over' : 'still alive',
    ].join(' | '),
  );
}

console.log('');
console.log('Installments per month: ' + [0, 1, 2, 3, 4].map((m) => installmentForMonth(m)).join(', '));
console.log('Days in a month: ' + ECONOMY.month.days + ', instalment every ' + ECONOMY.debt.installmentIntervalDays + ' days');

if (failures > 0) {
  console.log('');
  console.log(failures + ' check(s) failed');
  process.exit(1);
}
console.log('All checks passed');
