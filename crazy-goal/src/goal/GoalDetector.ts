import type { ShotResult } from '../scoring/ShotAnalyzer';

/** How a failed shot is described to the player, from nowhere near to agonising. */
export type MissKind = 'miss' | 'nearly' | 'close' | 'post' | 'saved';

export const MISS_LABEL: Readonly<Record<MissKind, string>> = {
  miss: 'MISS',
  nearly: 'NEARLY!',
  close: 'SO CLOSE!',
  post: 'OFF THE POST!',
  saved: 'MIMI SAYS NO',
};

/** Near misses are what make a player go again, so they get named. */
export function classifyMiss(result: ShotResult): MissKind {
  if (result.did.has('save')) return 'saved';
  if (result.touched.post) return 'post';
  if (result.minGoalDist < 48) return 'close';
  if (result.minGoalDist < 135) return 'nearly';
  return 'miss';
}
