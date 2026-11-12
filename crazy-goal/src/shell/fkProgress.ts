/**
 * A read-only window onto Free Kicks' own progress (localStorage `crazy-kora-fk-progress`),
 * so the star total and the menu can count what was won there. Free Kicks is the only writer;
 * this file never writes. The shape is `{ v: 1, stages: { "<stage id>": { stars, goals, plays } }, quick: {...} }`.
 */

import { FK_CAMPAIGN_STAR_MAX, FK_LEGEND_STAR_MAX, FK_LAST_CAMPAIGN_STAGE } from '../progression/Progression';

export const FK_PROGRESS_KEY = 'crazy-kora-fk-progress';

export interface FkStageRecord {
  stars: number;
  goals: number;
  plays: number;
}

/** Stage records from a stored JSON string; anything unreadable is "no progress". */
export function parseFkStages(raw: string | null): Record<string, FkStageRecord> {
  const out: Record<string, FkStageRecord> = {};
  if (!raw) return out;
  try {
    const data: unknown = JSON.parse(raw);
    if (typeof data !== 'object' || data === null) return out;
    const stages = (data as { stages?: unknown }).stages;
    if (typeof stages !== 'object' || stages === null) return out;
    for (const [id, rec] of Object.entries(stages)) {
      if (typeof rec !== 'object' || rec === null) continue;
      const r = rec as Record<string, unknown>;
      const n = (v: unknown, max: number): number => (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(max, Math.floor(v))) : 0);
      out[id] = { stars: n(r.stars, 3), goals: n(r.goals, 5), plays: n(r.plays, 1e9) };
    }
  } catch {
    /* corrupt entry: Free Kicks will replace it on its next save */
  }
  return out;
}

export function readFkStages(): Record<string, FkStageRecord> {
  try {
    return parseFkStages(localStorage.getItem(FK_PROGRESS_KEY));
  } catch {
    return {};
  }
}

/** Stars won in Free Kicks stages (the Street Cup and, once open, the Legend stage). Quick Five stars do not count. */
export function fkStars(stages: Record<string, FkStageRecord> = readFkStages()): number {
  let sum = 0;
  for (const rec of Object.values(stages)) sum += rec.stars;
  return sum;
}

/** Whether Free Kicks has been played at all (grandfathers the menu tile open). */
export const fkPlayed = (stages: Record<string, FkStageRecord> = readFkStages()): boolean => Object.values(stages).some((r) => r.plays > 0);

/** The most stars Free Kicks can add right now: the five stages, plus the Legend stage once a star on stage 5 opens it. */
export function fkStarMax(stages: Record<string, FkStageRecord> = readFkStages()): number {
  const legendOpen = (stages[FK_LAST_CAMPAIGN_STAGE]?.stars ?? 0) >= 1;
  return FK_CAMPAIGN_STAR_MAX + (legendOpen ? FK_LEGEND_STAR_MAX : 0);
}
