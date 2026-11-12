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

/** A level is open once the one before it has been scored on. */
export function isLevelUnlocked(save: ProgressSave, levels: readonly ProgressLevel[], index: number): boolean {
  return index === 0 || goalsOf(save, levels[index - 1].id) > 0;
}

/** Stars across the whole career: every houma, plus whatever Free Kicks has earned. */
export function totalStars(save: ProgressSave, fkStars = 0): number {
  let sum = fkStars;
  for (const rec of Object.values(save.levels)) sum += rec?.stars ?? 0;
  return sum;
}

/** Coins for a solo goal: always at least a little, more for a crazier score. */
export function coinsForGoal(input: { total: number }): number {
  return Math.max(5, Math.round(input.total / 100));
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
