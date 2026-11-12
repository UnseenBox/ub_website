/**
 * The rules of progress, with no browser, canvas or save file in sight: which levels are open,
 * what a goal pays, how many stars there are. Game, Overlay and the shell all ask here, so the
 * rules can be unit-tested and tuned in one place.
 */

/** The part of a level record the rules read. */
export interface ProgressRecord {
  goals: number;
  stars: number;
}

/** The part of the save the rules read. */
export interface ProgressSave {
  levels: Record<string, ProgressRecord | undefined>;
}

/** The part of a level definition the rules read. */
export interface ProgressLevel {
  id: string;
}

/** Chapters of twelve houmas; the last one is the four finals. */
export const CHAPTERS: ReadonlyArray<{ until: number; title: string }> = [
  { until: 12, title: 'THE HOUMA' },
  { until: 24, title: 'NEW GROUNDS' },
  { until: 36, title: 'CRAZY LEAGUE' },
  { until: 48, title: 'LEGENDS' },
  { until: 60, title: 'STREET KINGS' },
  { until: 72, title: 'NIGHT LEAGUE' },
  { until: 84, title: 'GOLDEN HOUR' },
  { until: 96, title: 'HALL OF FAME' },
  { until: Number.POSITIVE_INFINITY, title: 'THE FINALS' },
];

/** The chapter a level (0-based index) belongs to, counted from 1. */
export function chapterOf(index: number): number {
  for (let i = 0; i < CHAPTERS.length; i++) if (index < CHAPTERS[i].until) return i + 1;
  return CHAPTERS.length;
}

/** English title of a chapter (1-based); `tr()` translates it where it is shown. */
export const chapterTitle = (chapter: number): string => CHAPTERS[Math.max(1, Math.min(CHAPTERS.length, chapter)) - 1].title;

/** Index of the first level of a chapter (1-based). */
export const chapterStart = (chapter: number): number => (chapter <= 1 ? 0 : CHAPTERS[Math.min(chapter, CHAPTERS.length) - 2].until);

const goalsOf = (save: ProgressSave, id: string): number => save.levels[id]?.goals ?? 0;

/** Stars needed per chapter after the first: chapter `c` opens at `GATE_PER_CHAPTER * (c - 1)`. Twelve levels give twelve, so four more come from style. */
export const GATE_PER_CHAPTER = 16;

/** Stars won in the houmas alone: Free Kicks does not open chapters. */
export function classicStars(save: ProgressSave): number {
  let sum = 0;
  for (const rec of Object.values(save.levels)) sum += rec?.stars ?? 0;
  return sum;
}

/** Stars the first level of a chapter asks for. */
export const chapterGate = (chapter: number): number => (chapter <= 1 ? 0 : GATE_PER_CHAPTER * (chapter - 1));

/** Index range [from, to) of a chapter's levels in a list of `count` levels. */
function chapterRange(chapter: number, count: number): [number, number] {
  return [chapterStart(chapter), chapter >= CHAPTERS.length ? count : Math.min(count, chapterStart(chapter + 1))];
}

export interface GateStatus {
  /** Stars the chapter asks for. */
  need: number;
  /** Stars won so far in the houmas. */
  have: number;
  /** The gate no longer blocks: enough stars, or a level here was already scored on. */
  open: boolean;
}

/** Whether a chapter's gate is met. A chapter where any level has a goal stays open forever (grandfathering). */
export function gateStatus(save: ProgressSave, levels: readonly ProgressLevel[], chapter: number): GateStatus {
  const need = chapterGate(chapter);
  const have = classicStars(save);
  if (have >= need) return { need, have, open: true };
  const [from, to] = chapterRange(chapter, levels.length);
  for (let i = from; i < to; i++) if (goalsOf(save, levels[i].id) > 0) return { need, have, open: true };
  return { need, have, open: false };
}

/**
 * A level is open once the one before it has been scored on. The first level of chapter 2 and
 * on also needs the chapter's star gate.
 */
export function isLevelUnlocked(save: ProgressSave, levels: readonly ProgressLevel[], index: number): boolean {
  if (index === 0) return true;
  if (goalsOf(save, levels[index - 1].id) <= 0) return false;
  const chapter = chapterOf(index);
  if (index === chapterStart(chapter)) return gateStatus(save, levels, chapter).open;
  return true;
}

/** True when the only thing between the player and this level is its chapter's star gate. */
export function isGateBlocked(save: ProgressSave, levels: readonly ProgressLevel[], index: number): boolean {
  if (index <= 0 || goalsOf(save, levels[index - 1].id) <= 0) return false;
  const chapter = chapterOf(index);
  return index === chapterStart(chapter) && !gateStatus(save, levels, chapter).open;
}

/** Stars across the whole career: every houma, plus whatever Free Kicks has earned. */
export function totalStars(save: ProgressSave, fkStars = 0): number {
  return classicStars(save) + fkStars;
}

/** Economy. Coins come from progress, never from replaying a level you have already beaten. */
export const FIRST_CLEAR_MIN_COINS = 10;
/** A first clear pays about a hundredth of its Crazy Score, but never less than the minimum. */
export const FIRST_CLEAR_SCORE_DIVISOR = 100;
/** Paid once for every star a level has ever shown, the first one included. */
export const STAR_COINS = 10;
/** The coin hanging in each alley: paid the first time it is hit, never again. */
export const LEVEL_COIN_VALUE = 10;

/**
 * What a solo goal pays. `oldStars` is how many stars have already been paid for on this level
 * (`paidStars` in the save), `newStars` the best now. A replay that wins nothing new pays nothing.
 */
export function coinsForGoal(input: { firstClear: boolean; oldStars: number; newStars: number; total: number }): number {
  const clear = input.firstClear ? Math.max(FIRST_CLEAR_MIN_COINS, Math.round(input.total / FIRST_CLEAR_SCORE_DIVISOR)) : 0;
  return clear + STAR_COINS * Math.max(0, input.newStars - input.oldStars);
}

/** The two thresholds a level sets for its second and third star (`stars` in level data). */
export interface StarTargets {
  stars: readonly [number, number];
}

export interface NextStar {
  /** The star that is next to win: 2 or 3. */
  star: 2 | 3;
  /** The Crazy Score that wins it. */
  target: number;
}

/**
 * What the next star on a level needs, given the stars already won there (the stored best, not
 * this shot). `null` once all three are in.
 */
export function nextStarTarget(level: StarTargets, earned: number): NextStar | null {
  if (earned >= 3) return null;
  return earned >= 2 ? { star: 3, target: level.stars[1] } : { star: 2, target: level.stars[0] };
}

/** What a goal did, for choosing the nudge toward a better one. */
export interface GoalFacts {
  bounces: number;
  /** The shot used something in the street (a wall prop, a mechanic) that scored a label. */
  street: boolean;
}

/** One line of advice toward the next star; `tr()` translates it. */
export function starHint(goal: GoalFacts): string {
  if (goal.bounces === 0) return 'BOUNCE IT OFF A WALL';
  if (!goal.street) return 'USE THE STREET';
  return 'GO CRAZIER';
}

/** Onboarding: the boost column stays hidden until this houma (0-based index 5 is houma 6). */
export const BOOST_INTRO_LEVEL = 5;
/** The free MAGNET handed over with the boost introduction. */
export const BOOST_INTRO_FREE_MAGNETS = 1;
/** The houma where the scoring tip about banks is shown, before its first shot (0-based). */
export const BANK_TIP_LEVEL = 1;

/** Keys of the one-time tips kept in `save.tips`. */
export type TipKey = 'bank' | 'labels' | 'chain' | 'fkUnlock';

/** Free Kicks: the Street Cup has five stages of three stars; the Legend stage adds three more once stage 5 has a star. */
export const FK_CAMPAIGN_STAR_MAX = 15;
export const FK_LEGEND_STAR_MAX = 3;
export const FK_LAST_CAMPAIGN_STAGE = 'stage-5-pressure';
/** Paid the first time a stage is cleared (any star), and for each star a stage has ever shown. */
export const FK_CLEAR_COINS = 20;
export const FK_STAR_COINS = 10;

/**
 * Coins a Free Kicks stage result pays: what the stage's best stars are worth in total, minus
 * what has already been paid for it (`paid`, the save's `fk.coinsPaid[stageId]`). A replay that
 * wins nothing new, or a worse run, pays 0.
 */
export function fkStagePayout(stars: number, paid: number): number {
  const s = Math.max(0, Math.min(3, Math.floor(stars)));
  const worth = s > 0 ? FK_CLEAR_COINS + FK_STAR_COINS * s : 0;
  return Math.max(0, worth - Math.max(0, paid));
}

/** Free Kicks opens with a goal in this houma (0-based index 2 is houma 3), or for anyone who has already played it. */
export const FK_UNLOCK_LEVEL = 2;

export function isFreeKicksUnlocked(save: ProgressSave, levels: readonly ProgressLevel[], fkPlayed: boolean): boolean {
  if (fkPlayed) return true;
  const gate = levels[FK_UNLOCK_LEVEL];
  return !!gate && goalsOf(save, gate.id) > 0;
}

/** Daily Kick: coins per goal, and the bonus for five out of five. */
export const DAILY_GOAL_COINS = 5;
export const DAILY_PERFECT_COINS = 25;
/** How many past dates the save keeps results for. */
export const DAILY_HISTORY_DAYS = 60;

/** The part of the save the Daily Kick rules read and write. */
export interface DailyState {
  lastDate: string;
  streak: number;
  results: Record<string, string>;
}

/** A local calendar date as `YYYY-MM-DD`. */
export function dateKey(d: Date): string {
  const p = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** The calendar day before a `YYYY-MM-DD` date (local calendar, so daylight saving cannot skip or repeat a day). */
export function previousDay(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return dateKey(new Date(y, m - 1, d - 1));
}

export interface DailyOutcome {
  /** Today's scored attempt was already in: nothing changed, nothing paid. */
  already: boolean;
  streak: number;
  coins: number;
  state: DailyState;
}

/**
 * Records the Daily Kick's one scored attempt for `date`. The streak goes up by one when the day before
 * was played, and starts again at 1 otherwise. A second record for the same date changes nothing.
 */
export function applyDaily(state: DailyState, date: string, goals: number, line: string): DailyOutcome {
  if (state.results[date] !== undefined) return { already: true, streak: state.streak, coins: 0, state };
  const g = Math.max(0, Math.min(5, Math.floor(goals) || 0));
  const streak = state.lastDate !== '' && state.lastDate === previousDay(date) ? state.streak + 1 : 1;
  const results = { ...state.results, [date]: line };
  const keep = Object.keys(results).sort().slice(-DAILY_HISTORY_DAYS);
  const trimmed: Record<string, string> = {};
  for (const k of keep) trimmed[k] = results[k];
  return {
    already: false,
    streak,
    coins: g * DAILY_GOAL_COINS + (g === 5 ? DAILY_PERFECT_COINS : 0),
    state: { lastDate: date, streak, results: trimmed },
  };
}

/** The part of a ball the unlock rules read. */
export interface UnlockableSkin {
  id: string;
  need: number;
}

/** Balls the player has earned but has not been told about: open, not the free starter, not yet seen. */
export function unseenSkins<T extends UnlockableSkin>(total: number, skins: readonly T[], seen: readonly string[]): T[] {
  return skins.filter((s) => s.need > 0 && s.need <= total && !seen.includes(s.id));
}

/** Stars still missing for the next locked ball, or null when every ball is open. */
export function starsToNextSkin(total: number, skins: readonly UnlockableSkin[]): number | null {
  let best: number | null = null;
  for (const s of skins) if (s.need > total && (best === null || s.need < best)) best = s.need;
  return best === null ? null : best - total;
}

/** Rewarded help: misses on one houma before the "stuck" offer (a free MAGNET for an ad) appears. */
export const STUCK_MISSES = 4;
/** The pause-menu +30 coins ad, replaced by the moments above. Flip to true only if the owner wants it kept as a fallback. */
export const PAUSE_REWARD_ENABLED = false;

export const isStuck = (misses: number): boolean => misses >= STUCK_MISSES;
