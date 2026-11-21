/**
 * Headless check of the monthly bank payment (retention update, FEATURES.v2 on).
 * Run (esbuild ships with vite; the define turns the feature switch on):
 *   npx esbuild dev/finance-v2-check.ts --bundle --platform=node --format=cjs --define:import.meta.env='{"MODE":"crazygames-basic"}' --outfile=%TEMP%/fv2.cjs
 *   node %TEMP%/fv2.cjs
 */
import { FinanceSystem } from '../src/systems/FinanceSystem';
import { FEATURES } from '../src/config/features';
import { ECONOMY } from '../src/data/economy';

let failures = 0;
function check(name: string, ok: boolean, detail = ''): void {
  if (!ok) failures++;
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (ok || !detail ? '' : ' -> ' + detail));
}

check('feature switch is on in this run', FEATURES.v2 === true);
check('one payment per month (interval = month length)', ECONOMY.debt.installmentIntervalDays === ECONOMY.month.days);
check('same monthly total as four weekly payments of 2500', ECONOMY.debt.firstMonthInstallment === 10000);

/** Plays one month with the given income per day and an optional payment day. Returns the finance object. */
function playMonth(income: number, payOnDay: number | null, f = new FinanceSystem(), money0 = 0): { f: FinanceSystem; money: number } {
  let money = money0;
  for (let day = 1; day <= ECONOMY.month.days; day++) {
    money += income;
    if (payOnDay === day) money -= f.payInstallment(money);
    const s = f.settleDay(money);
    money -= s.paid;
    // the view must always make sense
    const v = f.view();
    if (v.daysToPayment < 0 || v.paymentLeft < 0) check('view is sane on day ' + day, false, JSON.stringify(v));
    if (day < ECONOMY.month.days) f.startNextDay();
  }
  return { f, money };
}

// 1. Nothing paid: the payment is overdue at the end of day 30 and the month check ends the run.
{
  const { f } = playMonth(2000, null);
  const v = f.view();
  check('unpaid: payment is overdue after day 30', v.overdue === 10000, 'overdue ' + v.overdue);
  check('unpaid: no days left to pay', v.daysToPayment === 0);
  check('unpaid: the month check ends the run', !f.evaluateMonth().ok);
}

// 2. Paid on day 30 (in the evening summary, after the payment was issued).
{
  const { f, money } = playMonth(100000, null);
  const before = f.view();
  const paid = f.payInstallment(money);
  check('late payment on day 30 covers the overdue amount', paid === 10000 && f.view().paymentLeft === 0, 'paid ' + paid);
  check('after paying, the month check passes', f.evaluateMonth().ok && before.overdue === 10000);
}

// 3. Paid early (day 12): covered at once, nothing overdue on day 30.
{
  const f = new FinanceSystem();
  let money = 0;
  for (let day = 1; day <= 11; day++) {
    money += 50000;
    money -= f.settleDay(money).paid;
    f.startNextDay();
  }
  const left0 = f.view().paymentLeft;
  money -= f.payInstallment(money);
  const v = f.view();
  check('early payment: payment left was the full month', left0 === 10000, String(left0));
  check('early payment: covered afterwards', v.paymentLeft === 0 && v.daysToPayment === 30 - 12 + 1, JSON.stringify(v));
  for (let day = 12; day <= 30; day++) {
    money += 50000;
    money -= f.settleDay(money).paid;
    if (day < 30) f.startNextDay();
  }
  check('early payment: nothing overdue at the end of the month', f.view().overdue === 0 && f.evaluateMonth().ok);
}

// 4. Partial payment: only the missing part is asked for next time.
{
  const f = new FinanceSystem();
  f.pay(4000, 100000);
  check('partial payment: 6000 still missing', f.view().paymentLeft === 6000, String(f.view().paymentLeft));
  const paid = f.payInstallment(100000);
  check('payInstallment pays exactly the missing 6000', paid === 6000 && f.view().paymentLeft === 0, String(paid));
}

// 5. Days left count down 30 .. 1 and the payment grows 2.4x per month.
{
  const f = new FinanceSystem();
  const seen: number[] = [];
  for (let day = 1; day <= 30; day++) {
    seen.push(f.view().daysToPayment);
    f.settleDay(0);
    if (day < 30) f.startNextDay();
  }
  check('days left run from 30 down to 1', seen[0] === 30 && seen[29] === 1 && seen.every((d, i) => d === 30 - i), seen.join(','));
  f.reset();
  f.monthIndex = 1;
  check('month 2 payment is 24000', f.view().monthlyPayment === 24000, String(f.view().monthlyPayment));
}

console.log(failures === 0 ? '\nALL PASSED' : '\n' + failures + ' FAILED');
process.exit(failures === 0 ? 0 : 1);
