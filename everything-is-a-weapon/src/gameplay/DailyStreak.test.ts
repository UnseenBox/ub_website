import { expect, it } from 'vitest';
import { cycleDay, dailyView, dayGap, nextStreak, rewardFor } from './DailyStreak';

it('rewards climb through the week and day 7 pays most', () => {
  const scraps = [1, 2, 3, 4, 5, 6, 7].map((d) => rewardFor(d).scrap);
  expect([...scraps]).toEqual([...scraps].sort((a, b) => a - b));
  expect(rewardFor(3).gift).toBe(true);
  expect(rewardFor(7).freeze).toBe(true);
  expect(rewardFor(8).scrap).toBe(rewardFor(1).scrap);
  expect(cycleDay(14)).toBe(7);
  expect(cycleDay(15)).toBe(1);
});

it('counts calendar days across month ends', () => {
  expect(dayGap('2026-01-31', '2026-02-01')).toBe(1);
  expect(dayGap('2026-11-09', '2026-11-09')).toBe(0);
  expect(dayGap('2026-11-07', '2026-11-09')).toBe(2);
});

it('the streak grows daily, forgives one missed day with a freeze, and otherwise resets', () => {
  expect(nextStreak('', 0, 0, '2026-11-09')).toEqual({ streak: 1, usedFreeze: false });
  expect(nextStreak('2026-11-08', 4, 0, '2026-11-09')).toEqual({ streak: 5, usedFreeze: false });
  expect(nextStreak('2026-11-07', 4, 1, '2026-11-09')).toEqual({ streak: 5, usedFreeze: true });
  expect(nextStreak('2026-11-07', 4, 0, '2026-11-09').streak).toBe(1);
  expect(nextStreak('2026-11-01', 4, 1, '2026-11-09').streak).toBe(1);
});

it('the menu view shows what is safe, what is next and the week row', () => {
  const today = '2026-11-09';
  const fresh = dailyView({ lastDaily: '', dailyStreak: 0, dailyFreezes: 0 }, today);
  expect(fresh).toMatchObject({ doneToday: false, streak: 0, nextDay: 1, pips: 0 });
  const mid = dailyView({ lastDaily: '2026-11-08', dailyStreak: 2, dailyFreezes: 0 }, today);
  expect(mid).toMatchObject({ doneToday: false, streak: 2, nextDay: 3, pips: 2 });
  const done = dailyView({ lastDaily: today, dailyStreak: 3, dailyFreezes: 0 }, today);
  expect(done).toMatchObject({ doneToday: true, streak: 3, nextDay: 4, pips: 3 });
  const week = dailyView({ lastDaily: today, dailyStreak: 7, dailyFreezes: 1 }, today);
  expect(week).toMatchObject({ doneToday: true, pips: 7, nextDay: 1 });
  const lapsed = dailyView({ lastDaily: '2026-11-01', dailyStreak: 6, dailyFreezes: 0 }, today);
  expect(lapsed).toMatchObject({ streak: 0, nextDay: 1, pips: 0 });
});
