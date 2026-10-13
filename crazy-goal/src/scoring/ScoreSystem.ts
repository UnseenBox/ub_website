import type { ShotResult } from './ShotAnalyzer';
import { headline, recognizeStyles, UNITS_PER_METRE, type StyleLine } from './StyleRecognizer';

/** Each bounce on the way in adds this much to the multiplier. */
const COMBO_STEP = 0.15;

/** What the result card shows after a goal. */
export interface ScoreCard {
  lines: StyleLine[];
  /** Bounces plus the goal itself: a one-bank goal is an x2 combo. */
  combo: number;
  multiplier: number;
  /** The Crazy Score. */
  total: number;
  /** 1 to 3. */
  stars: number;
  headline: string;
  bounces: number;
  metres: number;
  newBest: boolean;
  previousBest: number;
}

/** Any goal is one star; the level sets the scores for two and three. */
export function starsFor(total: number, thresholds: readonly [number, number]): number {
  if (total <= 0) return 0;
  return total >= thresholds[1] ? 3 : total >= thresholds[0] ? 2 : 1;
}

/**
 * Crazy Score = (goal + every style bonus) x combo multiplier.
 * A plain goal is worth about a thousand; the same goal off three walls is worth several times that.
 */
export function scoreShot(result: ShotResult, previousBest: number, thresholds: readonly [number, number]): ScoreCard {
  const lines = recognizeStyles(result);
  const combo = result.bounces + 1;
  const multiplier = 1 + COMBO_STEP * result.bounces;
  let sum = 0;
  for (const line of lines) sum += line.points;
  const total = Math.round((sum * multiplier) / 10) * 10;
  return {
    lines,
    combo,
    multiplier,
    total,
    stars: starsFor(total, thresholds),
    headline: headline(lines),
    bounces: result.bounces,
    metres: Math.round(result.distance / UNITS_PER_METRE),
    newBest: total > previousBest,
    previousBest,
  };
}
