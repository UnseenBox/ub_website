// Phone touch helpers: a drag-to-aim zone on the left, on-screen buttons on the
// right. Aim is relative (trackpad style) so the thumb never covers the target.

import { VIEW } from './config';

/** Crosshair pixels moved per pixel the aim thumb drags. */
export const TOUCH_AIM_SENSITIVITY = 1.8;

/** Aim assistance: enemies within this many pixels of the crosshair pull it toward them. */
export const AIM_ASSIST_RADIUS = 120;
/** Share of the remaining distance the crosshair closes each frame toward a target. */
export const AIM_ASSIST_PULL = 0.8;
/** Most the assistance can move the crosshair in one step, in pixels. */
export const AIM_ASSIST_MAX = 70;
/** Within this many pixels of a target point, the crosshair locks straight onto it. */
export const AIM_ASSIST_SNAP = 40;

/**
 * How far to nudge the crosshair toward the nearest target point (an enemy's head or
 * chest) within reach, so a slightly off-target tap still hits. Returns (0, 0) when no
 * point is close enough.
 */
export function aimAssistOffset(
  cursor: { x: number; y: number },
  points: ReadonlyArray<{ x: number; y: number }>,
  radius = AIM_ASSIST_RADIUS,
  pull = AIM_ASSIST_PULL,
  maxPull = AIM_ASSIST_MAX,
  snap = AIM_ASSIST_SNAP,
): { x: number; y: number } {
  let best: { x: number; y: number } | null = null;
  let bestDist = radius;
  for (const p of points) {
    const d = Math.hypot(p.x - cursor.x, p.y - cursor.y);
    if (d < bestDist) {
      bestDist = d;
      best = p;
    }
  }
  if (!best || bestDist < 0.5) return { x: 0, y: 0 };
  // Close enough that the shot would otherwise miss a body: lock onto it.
  const amount = bestDist <= snap ? bestDist : Math.min(maxPull, bestDist * pull);
  return {
    x: ((best.x - cursor.x) / bestDist) * amount,
    y: ((best.y - cursor.y) / bestDist) * amount,
  };
}

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

export interface TouchCircle { x: number; y: number; r: number }
export interface TouchPill { x: number; y: number; w: number; h: number }

/** Button layout in the 1280×720 game space. Everything sits above the HUD. */
export const TOUCH_LAYOUT = {
  fire: { x: 1150, y: 448, r: 78 } as TouchCircle,
  reload: { x: 990, y: 440, r: 40 } as TouchCircle,
  pause: { x: 46, y: 46, r: 28 } as TouchCircle,
  shop: { x: 120, y: 46, r: 28 } as TouchCircle,
  deploy: { x: 640, y: 528, w: 320, h: 58 } as TouchPill,
};

export type TouchButton = 'fire' | 'reload' | 'pause' | 'shop' | 'deploy';

/** Left half of the battlefield (above the HUD) is the aim zone. */
export function isAimTouch(x: number, y: number): boolean {
  return x >= 0 && x < VIEW.width / 2 && y >= 0 && y < VIEW.hudTop;
}

/** Move the crosshair by a finger drag, clamped to the battlefield. */
export function stepTouchAim(
  cursor: { x: number; y: number }, dx: number, dy: number, sensitivity = TOUCH_AIM_SENSITIVITY,
): { x: number; y: number } {
  return {
    x: clamp(cursor.x + dx * sensitivity, 0, VIEW.width),
    y: clamp(cursor.y + dy * sensitivity, 0, VIEW.hudTop),
  };
}

export function inCircle(c: TouchCircle, x: number, y: number, slack = 0): boolean {
  const dx = x - c.x, dy = y - c.y;
  return dx * dx + dy * dy <= (c.r + slack) * (c.r + slack);
}

export function inPill(p: TouchPill, x: number, y: number): boolean {
  return Math.abs(x - p.x) <= p.w / 2 && Math.abs(y - p.y) <= p.h / 2;
}

/** Which on-screen button (if any) is under a point. `deployVisible` gates the next-wave pill. */
export function touchButtonAt(x: number, y: number, deployVisible: boolean): TouchButton | null {
  const L = TOUCH_LAYOUT;
  if (inCircle(L.fire, x, y, 14)) return 'fire';
  if (inCircle(L.reload, x, y, 10)) return 'reload';
  if (inCircle(L.pause, x, y, 10)) return 'pause';
  if (inCircle(L.shop, x, y, 10)) return 'shop';
  if (deployVisible && inPill(L.deploy, x, y)) return 'deploy';
  return null;
}

/** True on phones/tablets (coarse primary pointer) or once a touch has been seen. */
export function isTouchDevice(): boolean {
  if (typeof document === 'undefined') return false;
  if (document.body.classList.contains('touched')) return true;
  return typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
}

/** Button label with its keyboard shortcut, dropped on touch devices that have no keyboard. */
export function keyHint(label: string, key: string): string {
  return isTouchDevice() ? label : `${label}  [${key}]`;
}

export interface TouchPointerIds {
  aimPointerId: number | null;
  firePointerId: number | null;
}

/** Clear stale touch slots when a run restarts with a finger still held. */
export function resetTouchPointerIds(state: TouchPointerIds): void {
  state.aimPointerId = null;
  state.firePointerId = null;
}
