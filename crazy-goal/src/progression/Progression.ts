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

/**
 * The chapters are the worlds of the campaign (`world` in `data/levels/campaign.ts`): the first holds the
 * tutorial and matches 2 and 3, then one for each world of the campaign, five or six matches each.
 */
export const CHAPTERS: ReadonlyArray<{ until: number; title: string }> = [
  { until: 10, title: 'OPENING SEASON' },
  { until: 15, title: 'GROUND RULES' },
  { until: 21, title: 'STREET OBJECTS' },
  { until: 27, title: 'KEEPERS AND MOVERS' },
  { until: 32, title: 'WEATHER' },
  { until: 37, title: 'AFTER DARK' },
  { until: 42, title: 'ROOFTOPS AND HARBOUR' },
  { until: Number.POSITIVE_INFINITY, title: 'BIG MATCHES' },
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

/** Stars needed per chapter after the first: chapter `c` opens at `GATE_PER_CHAPTER * (c - 1)`. A world has about five matches, so a star and a half each is enough. */
export const GATE_PER_CHAPTER = 10;

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

/** Onboarding: the boost shop stays hidden until the ability lessons are done (0-based level index: the first match after them). */
export const BOOST_INTRO_LEVEL = 8;
/** The free MAGNET handed over with the boost introduction. */
export const BOOST_INTRO_FREE_MAGNETS = 1;
/** The houma where the scoring tip about banks is shown, before its first shot (0-based). */
export const BANK_TIP_LEVEL = 1;

/** Keys of the one-time tips kept in `save.tips`. */
export type TipKey = 'bank' | 'labels' | 'chain';

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

/** The part of a level definition the numbering reads. */
export interface NumberedLevel {
  guide?: { series?: string };
}

/** Where a level sits in the stadium: the tutorial lessons are MATCH 1, every other level is the next match. */
export interface MatchInfo {
  /** 1-based match number. */
  match: number;
  /** 1-based lesson number inside the tutorial, or null for a match of its own. */
  lesson: number | null;
}

/** The tutorial is the five moves and the three abilities; every other level with a guide is a match of its own. */
const isLesson = (l: NumberedLevel | undefined): boolean => !!l?.guide && (!l.guide.series || l.guide.series === 'abilities');

export function matchInfo(levels: readonly NumberedLevel[], index: number): MatchInfo {
  if (isLesson(levels[index])) {
    let lesson = 0;
    for (let i = 0; i <= index; i++) if (isLesson(levels[i])) lesson++;
    return { match: 1, lesson };
  }
  // The tutorial counts as match 1, so the first other level is match 2.
  let match = isLesson(levels[0]) ? 1 : 0;
  for (let i = 0; i <= index; i++) if (!isLesson(levels[i])) match++;
  return { match, lesson: null };
}
