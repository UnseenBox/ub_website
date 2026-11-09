/**
 * The daily-challenge streak: come back each day and the prize grows. A week is one cycle.
 * Day 3 opens a hero (or a pet outfit), day 7 pays big and earns a streak freeze, which
 * quietly forgives one missed day so a busy Tuesday does not wipe out a week.
 */

export const CYCLE = 7;

export interface DailyReward {
  readonly scrap: number;
  /** Unlocks the next locked hero (or, with none left, a free pet outfit). */
  readonly gift: boolean;
  /** Earns a streak freeze (one is kept at most). */
  readonly freeze: boolean;
}

const SCRAP: readonly number[] = [20, 30, 40, 50, 60, 80, 150];

/** 1-based day within the weekly cycle (streak 1 → 1, 7 → 7, 8 → 1). */
export function cycleDay(streak: number): number {
  return ((Math.max(1, Math.floor(streak)) - 1) % CYCLE) + 1;
}

export function rewardFor(streak: number): DailyReward {
  const day = cycleDay(streak);
  return { scrap: SCRAP[day - 1]!, gift: day === 3, freeze: day === CYCLE };
}

/** Whole calendar days from `from` to `to` (YYYY-MM-DD keys). */
export function dayGap(from: string, to: string): number {
  const parse = (key: string): number => {
    const [y, m, d] = key.split('-').map(Number);
    return Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1) / 86_400_000;
  };
  return Math.round(parse(to) - parse(from));
}

export interface StreakStep {
  /** The streak after playing today. */
  streak: number;
  usedFreeze: boolean;
}

/** What playing today does to the streak. `last` is the last day a daily was won ('' for never). */
export function nextStreak(last: string, streak: number, freezes: number, today: string): StreakStep {
  if (!last) return { streak: 1, usedFreeze: false };
  const gap = dayGap(last, today);
  if (gap <= 0) return { streak: Math.max(1, streak), usedFreeze: false };
  if (gap === 1) return { streak: streak + 1, usedFreeze: false };
  if (gap === 2 && freezes > 0) return { streak: streak + 1, usedFreeze: true };
  return { streak: 1, usedFreeze: false };
}

export interface DailyView {
  doneToday: boolean;
  /** Streak days banked (what you would lose by skipping). */
  streak: number;
  /** Day of the weekly cycle the next reward is for (today's if not done, tomorrow's if done). */
  nextDay: number;
  /** Filled pips in the week row. */
  pips: number;
  freezes: number;
}

export function dailyView(
  save: { lastDaily: string; dailyStreak: number; dailyFreezes: number },
  today: string,
): DailyView {
  const freezes = save.dailyFreezes;
  if (save.lastDaily === today) {
    const streak = save.dailyStreak;
    return { doneToday: true, streak, nextDay: cycleDay(streak + 1), pips: cycleDay(streak), freezes };
  }
  const step = nextStreak(save.lastDaily, save.dailyStreak, freezes, today);
  const banked = step.streak - 1; // streak days that are safe if played today
  return {
    doneToday: false,
    streak: banked,
    nextDay: cycleDay(step.streak),
    pips: banked % CYCLE,
    freezes,
  };
}
