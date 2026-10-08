import { type Rect, segmentIntersectsRect } from '../core/Mathx';

/**
 * Line of sight against axis-aligned blockers.
 *
 * Deliberately simple: rooms are single-screen and authored, so a handful of
 * rect tests per enemy per step is far cheaper than any acceleration structure.
 */
export function isBlocked(
  blockers: readonly Rect[],
  ax: number,
  ay: number,
  bx: number,
  by: number,
): boolean {
  for (let i = 0; i < blockers.length; i++) {
    if (segmentIntersectsRect(ax, ay, bx, by, blockers[i])) return true;
  }
  return false;
}

export function hasLineOfSight(
  blockers: readonly Rect[],
  ax: number,
  ay: number,
  bx: number,
  by: number,
): boolean {
  return !isBlocked(blockers, ax, ay, bx, by);
}

/**
 * Fraction of the way from a to b before the first blocker, 1 when clear.
 * Used to draw the debug sight lines so a blocked line visibly stops at the wall.
 */
export function sightFraction(
  blockers: readonly Rect[],
  ax: number,
  ay: number,
  bx: number,
  by: number,
  steps = 16,
): number {
  if (!isBlocked(blockers, ax, ay, bx, by)) return 1;
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < steps; i++) {
    const mid = (lo + hi) * 0.5;
    const mx = ax + (bx - ax) * mid;
    const my = ay + (by - ay) * mid;
    if (isBlocked(blockers, ax, ay, mx, my)) hi = mid;
    else lo = mid;
  }
  return lo;
}
