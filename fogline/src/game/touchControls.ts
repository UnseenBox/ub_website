// Phone touch helpers: an aim pad on the left, firing on the right. The crosshair moves
// with the aiming thumb, at once and only while the thumb moves. Only that thumb moves it,
// so the firing thumb can never disturb the aim. There is no aim assistance.

import { isDesktop, isHandheld } from '../portal/flags';
import { VIEW } from './config';
import { SCREEN, edgeShift } from './screen';

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

/** The aim pad: where it rests, how far its knob sits from its middle, and how far the crosshair goes. */
export const STICK = {
  home: { x: 160, y: 432, r: 76 } as TouchCircle,
  /** Crosshair pixels for each pixel the thumb moves: a short swipe crosses half the field. */
  gain: 2.2,
};

export interface TouchPoint { x: number; y: number }

export type TouchButton = 'fire' | 'reload' | 'pause' | 'shop' | 'deploy';

/**
 * The buttons on this screen: on a wide one the side buttons sit by the edges, under the
 * thumbs (clear of a notch); on a tall one the top buttons rise to the top.
 */
export function touchLayout(): typeof TOUCH_LAYOUT {
  const L = TOUCH_LAYOUT, x = edgeShift(), y = SCREEN.my;
  return {
    fire: { ...L.fire, x: L.fire.x + x },
    reload: { ...L.reload, x: L.reload.x + x },
    pause: { ...L.pause, x: L.pause.x - x, y: L.pause.y - y },
    shop: { ...L.shop, x: L.shop.x - x, y: L.shop.y - y },
    deploy: L.deploy,
  };
}

/** Where the idle stick sits: out by the left edge on a wide screen, under the thumb. */
export function stickHome(): TouchCircle {
  return { ...STICK.home, x: STICK.home.x - edgeShift() };
}

const onBattlefield = (y: number): boolean => y >= -SCREEN.my && y < VIEW.hudTop;

/** Left half of the battlefield (above the HUD), out to the screen edge, works the aim pad. */
export function isAimTouch(x: number, y: number): boolean {
  return x >= -SCREEN.mx && x < VIEW.width / 2 && onBattlefield(y);
}

/** Right half of the battlefield, out to the screen edge, fires. It never aims. */
export function isFireTouch(x: number, y: number): boolean {
  return x >= VIEW.width / 2 && x <= VIEW.width + SCREEN.mx && onBattlefield(y);
}

/**
 * The pad under a thumb at `thumb`: the knob is on the thumb, and once the thumb passes the
 * rim the ring is dragged along behind it.
 */
export function followThumb(base: TouchPoint, thumb: TouchPoint): { base: TouchPoint; knob: TouchPoint } {
  const dx = thumb.x - base.x, dy = thumb.y - base.y;
  const far = Math.hypot(dx, dy);
  if (far <= STICK.home.r) return { base, knob: thumb };
  const k = (far - STICK.home.r) / far;
  return { base: { x: base.x + dx * k, y: base.y + dy * k }, knob: thumb };
}

/** The crosshair after the thumb moved from `from` to `to`, clamped to the battlefield. */
export function dragAim(cursor: TouchPoint, from: TouchPoint, to: TouchPoint): TouchPoint {
  return {
    x: clamp(cursor.x + (to.x - from.x) * STICK.gain, 0, VIEW.width),
    y: clamp(cursor.y + (to.y - from.y) * STICK.gain, 0, VIEW.hudTop),
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
  const L = touchLayout();
  if (inCircle(L.fire, x, y, 14)) return 'fire';
  if (inCircle(L.reload, x, y, 10)) return 'reload';
  if (inCircle(L.pause, x, y, 10)) return 'pause';
  if (inCircle(L.shop, x, y, 10)) return 'shop';
  if (deployVisible && inPill(L.deploy, x, y)) return 'deploy';
  return null;
}

/** True on phones/tablets (coarse primary pointer) or once a touch has been seen. */
export function isTouchDevice(): boolean {
  if (typeof document === 'undefined' || isDesktop()) return false;
  if (document.body.classList.contains('touched')) return true;
  return isHandheld();
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
