import { GAME_CONFIG } from '../config/GameConfig';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
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
  depth: Rect;
  slotSize: number;
  /** Centre of each bag slot. */
  slotXs: number[];
  slotY: number;
  /** The plank along the bottom of the panel: the main action button. */
  button: Rect;
  /** Where the two hanging lanterns of the panel are. */
  lanterns: { x: number; y: number; r: number }[];
}

/**
 * Where things sit on the panel picture, as fractions of its width and height
 * (the picture is 1000 x 385; measured on the artwork).
 */
export const TRAY_ART = {
  aspect: 385 / 1000,
  slotCx: [0.1944, 0.3475, 0.5, 0.6525, 0.805],
  slotCy: 0.4922,
  slotInner: 0.127,
  /** The dark stamina track; its left end runs under the bolt badge (which ends at x = 0.207). */
  track: { x0: 0.19, y0: 36 / 385, x1: 0.844, y1: 70 / 385 },
  /** Share of the track hidden under the badge. */
  trackCover: (0.207 - 0.19) / (0.844 - 0.19),
  /** Region of the picture holding the bolt badge, in picture pixels (drawn again above the fill). */
  badgeCrop: { x: 138, y: 14, w: 69, h: 77 },
  plank: { x0: 0.16, y0: 0.7616, x1: 0.84, y1: 0.9368 },
  lanterns: [{ x: 0.04, y: 0.44 }, { x: 0.96, y: 0.44 }],
} as const;

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

/**
 * The bag panel is one picture along the bottom of the screen: the stamina bar, five slots and the
 * action plank are all placed on it, so every size follows the panel's width.
 */
export function computeLayout(w: number, h: number): Layout {
  const compact = w < 720;
  const topH = Math.round(clamp(h * 0.085, 54, 74));
  // Short (landscape phone) screens give the panel a little more of the height so slots stay tappable.
  const pw = Math.floor(Math.min(w - 8, 900, (h * (h < 480 ? 0.38 : 0.34)) / TRAY_ART.aspect));
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
    depth: { x: w - depthW, y: topH, w: depthW, h: py - topH },
    slotSize: Math.round(T.slotInner * pw),
    slotXs: T.slotCx.map((f) => px + f * pw),
    slotY: py + T.slotCy * ph,
    button: { x: px + T.plank.x0 * pw, y: py + T.plank.y0 * ph, w: (T.plank.x1 - T.plank.x0) * pw, h: (T.plank.y1 - T.plank.y0) * ph },
    lanterns: T.lanterns.map((l) => ({ x: px + l.x * pw, y: py + l.y * ph, r: pw * 0.07 })),
  };
}

export function slotCenter(L: Layout, index: number): { x: number; y: number } {
  return { x: L.slotXs[index] ?? L.slotXs[0], y: L.slotY };
}

// The number of slots is fixed by the panel picture.
if (GAME_CONFIG.inventory.slots !== TRAY_ART.slotCx.length) {
  console.warn('The bag panel picture has', TRAY_ART.slotCx.length, 'slots but the game wants', GAME_CONFIG.inventory.slots);
}
