import { GAME_CONFIG } from '../config/GameConfig';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Circle {
  x: number;
  y: number;
  r: number;
}

/** Screen layout shared by every scene, recomputed on resize. */
export interface Layout {
  w: number;
  h: number;
  compact: boolean;
  topH: number;
  /** Area left for the dig field / workshop stage. */
  play: Rect;
  /** The bag panel picture (art/ui/rocks-tray.png), drawn at this rectangle. */
  tray: Rect;
  /** The dark track of the stamina bar inside the panel. */
  stamina: Rect;
  /** The round socket at the left end of the stamina bar (the bolt sits in it). */
  badge: Circle;
  depth: Rect;
  slotSize: number;
  /** Centre of each bag slot. */
  slotXs: number[];
  slotY: number;
  /** The round craft medallion at the right end of the panel: the main action button. */
  craft: Circle;
}

/**
 * Where things sit on the panel picture, as fractions of its width and height
 * (the picture is 789 x 273; measured on the artwork "Rocks Collected Bar 2").
 */
export const TRAY_ART = {
  aspect: 273 / 789,
  slotCx: [138.5 / 789, 261.5 / 789, 384.5 / 789, 507.5 / 789, 630.5 / 789],
  slotCy: 140 / 273,
  slotInner: 100 / 789,
  /** The dark stamina track; its left end runs under the round socket (which ends at x = 143). */
  track: { x0: 112 / 789, y0: 20 / 273, x1: 655 / 789, y1: 49 / 273 },
  /** Share of the track hidden under the socket. */
  trackCover: (143 - 112) / (655 - 112),
  /** Region of the picture holding the round socket, in picture pixels (drawn again above the fill). */
  badgeCrop: { x: 80, y: 0, w: 64, h: 70 },
  badge: { x: 112 / 789, y: 34 / 273, r: 26 / 789 },
  craft: { x: 738 / 789, y: 137 / 273, r: 47 / 789 },
} as const;

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

/**
 * The bag panel is one picture along the bottom of the screen: the stamina bar, five slots and the
 * craft medallion are all placed on it, so every size follows the panel's width.
 */
export function computeLayout(w: number, h: number): Layout {
  const compact = w < 720;
  const topH = Math.round(clamp(h * 0.085, 54, 74));
  // Short (landscape phone) screens give the panel a little more of the height so slots stay tappable.
  const pw = Math.floor(Math.min(w - 8, 820, (h * (h < 480 ? 0.34 : 0.3)) / TRAY_ART.aspect));
  const ph = Math.round(pw * TRAY_ART.aspect);
  const px = Math.round((w - pw) / 2);
  const py = h - ph - 2;
  const T = TRAY_ART;
  const depthW = compact ? 14 : 20;
  return {
    w, h, compact, topH,
    play: { x: 0, y: topH, w, h: py - topH },
    tray: { x: px, y: py, w: pw, h: ph },
    stamina: { x: px + T.track.x0 * pw, y: py + T.track.y0 * ph, w: (T.track.x1 - T.track.x0) * pw, h: (T.track.y1 - T.track.y0) * ph },
    badge: { x: px + T.badge.x * pw, y: py + T.badge.y * ph, r: T.badge.r * pw },
    depth: { x: w - depthW, y: topH, w: depthW, h: py - topH },
    slotSize: Math.round(T.slotInner * pw),
    slotXs: T.slotCx.map((f) => px + f * pw),
    slotY: py + T.slotCy * ph,
    craft: { x: px + T.craft.x * pw, y: py + T.craft.y * ph, r: T.craft.r * pw },
  };
}

export function slotCenter(L: Layout, index: number): { x: number; y: number } {
  return { x: L.slotXs[index] ?? L.slotXs[0], y: L.slotY };
}

// The number of slots is fixed by the panel picture.
if (GAME_CONFIG.inventory.slots !== TRAY_ART.slotCx.length) {
  console.warn('The bag panel picture has', TRAY_ART.slotCx.length, 'slots but the game wants', GAME_CONFIG.inventory.slots);
}
