// How the game fills a screen. Everything is designed on 1280×720; on a screen of another
// shape the canvas grows to match it (wider on phones, taller on tablets), the design area
// stays centred, and scenery fills the margins. Pure, so it is unit-tested.

import { VIEW } from './config';

/** The canvas never grows past this: 2.5 : 1 sideways, 4 : 3 upright. */
export const MAX_SCREEN = { width: 1800, height: 960 } as const;

/** The widest margin on each side, and the tallest above and below. */
export const BLEED = { x: (MAX_SCREEN.width - VIEW.width) / 2, y: (MAX_SCREEN.height - VIEW.height) / 2 } as const;

export interface ScreenFit {
  /** Canvas size in game pixels. */
  width: number;
  height: number;
  /** Margin on each side of the design area, and above and below it. */
  mx: number;
  my: number;
  /** The part of a side margin a phone's notch may cover, in game pixels. */
  safe: number;
}

/** The current fit, shared by every scene. */
export const SCREEN: ScreenFit = { width: VIEW.width, height: VIEW.height, mx: 0, my: 0, safe: 0 };

const even = (n: number): number => 2 * Math.round(n / 2);
const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

/**
 * The canvas for a window of `vw` × `vh` CSS pixels whose sides lose `inset` CSS pixels to
 * a notch: the same shape as the window, with the design area as large as it can be while
 * staying clear of the notch.
 */
export function fitScreen(vw: number, vh: number, inset = 0): ScreenFit {
  if (vw <= 0 || vh <= 0) return { width: VIEW.width, height: VIEW.height, mx: 0, my: 0, safe: 0 };
  const scale = Math.min(vh / VIEW.height, Math.max(1, vw - inset * 2) / VIEW.width);
  const width = even(clamp(vw / scale, VIEW.width, MAX_SCREEN.width));
  const height = even(clamp(vh / scale, VIEW.height, MAX_SCREEN.height));
  const mx = (width - VIEW.width) / 2;
  return { width, height, mx, my: (height - VIEW.height) / 2, safe: Math.min(mx, Math.round(inset / scale)) };
}

/** How far a control pinned to a side edge moves out from its designed place. */
export function edgeShift(): number {
  return Math.max(0, SCREEN.mx - SCREEN.safe);
}

/** A canvas point (a pointer) as a point in the design area; margins come out negative or past it. */
export function designPoint(p: { x: number; y: number }): { x: number; y: number } {
  return { x: p.x - SCREEN.mx, y: p.y - SCREEN.my };
}
