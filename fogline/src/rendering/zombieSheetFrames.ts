// Shambler parts, cut from the supplied full-figure image and packed into
// assets/zombie-parts.png. Each entry is one joint of the figure: the part rotates
// around its pivot (px, py), and (ox, oy) is that pivot as a fraction of the part.
// A thigh pivots at the hip and a shin at the knee, where it meets the thigh.
// Figure units: x = 0 on the centre line, y = 0 at the feet, one unit per texture px.

export const ZOMBIE_SHEET_TEXTURE = 'zombie_sheet';

/** Head top to feet, in figure units. Sets the shambler's on-screen scale. */
export const SHAMBLER_HEIGHT = 543;

export interface SheetPart {
  name: string;
  x: number; y: number; w: number; h: number;
  ox: number; oy: number;
  px: number; py: number;
}

export const SHEET_PARTS = {
  head: { name: 'head', x: 416, y: 0, w: 71, h: 78, ox: 0.4961, oy: 1.0000, px: 0.00, py: -465.30 },
  torso: { name: 'torso', x: 93, y: 0, w: 106, h: 221, ox: 0.4792, oy: 0.9975, px: 0.00, py: -245.30 },
  armL: { name: 'armL', x: 0, y: 0, w: 49, h: 281, ox: 0.8539, oy: 0.0646, px: -57.75, py: -440.55 },
  armR: { name: 'armR', x: 51, y: 0, w: 40, h: 281, ox: 0.0822, oy: 0.0607, px: 58.30, py: -440.55 },
  thighL: { name: 'thighL', x: 302, y: 0, w: 62, h: 112, ox: 0.5268, oy: 0.0000, px: -24.75, py: -256.30 },
  thighR: { name: 'thighR', x: 366, y: 0, w: 48, h: 112, ox: 0.4659, oy: 0.0000, px: 26.95, py: -256.30 },
  shinL: { name: 'shinL', x: 201, y: 0, w: 46, h: 145, ox: 0.5238, oy: 0.0000, px: -39.60, py: -144.10 },
  shinR: { name: 'shinR', x: 249, y: 0, w: 51, h: 145, ox: 0.4565, oy: 0.0000, px: 33.00, py: -144.10 },
} as const;

export type SheetPartName = keyof typeof SHEET_PARTS;
