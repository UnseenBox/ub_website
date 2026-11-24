// Brute (the fat zombie), cut from the supplied full-figure image and packed into
// assets/brute-parts.png. Same joint layout as the shambler: each part rotates around its
// pivot (px, py); (ox, oy) is that pivot as a fraction of the part.
// Figure units: x = 0 on the centre line, y = 0 at the feet, one unit per texture px.

export const BRUTE_SHEET_TEXTURE = 'brute_sheet';

/** Head top to feet, in figure units. */
export const BRUTE_HEIGHT = 653;

export const BRUTE_PARTS = {
  head: { name: 'head', x: 584, y: 0, w: 205, h: 107, ox: 0.5000, oy: 1.0000, px: 0.00, py: -545.78 },
  torso: { name: 'torso', x: 0, y: 0, w: 366, h: 361, ox: 0.5008, oy: 1.0000, px: 0.00, py: -185.02 },
  armL: { name: 'armL', x: 368, y: 0, w: 106, h: 226, ox: 0.6923, oy: -0.0051, px: -150.22, py: -412.38 },
  armR: { name: 'armR', x: 476, y: 0, w: 106, h: 222, ox: 0.3132, oy: -0.0209, px: 150.22, py: -412.38 },
  thighL: { name: 'thighL', x: 791, y: 0, w: 146, h: 103, ox: 0.5159, oy: 0.0000, px: -70.76, py: -185.02 },
  thighR: { name: 'thighR', x: 0, y: 363, w: 143, h: 103, ox: 0.4919, oy: 0.0000, px: 70.18, py: -185.02 },
  shinL: { name: 'shinL', x: 145, y: 363, w: 117, h: 82, ox: 0.6020, oy: 0.0000, px: -96.28, py: -81.78 },
  shinR: { name: 'shinR', x: 264, y: 363, w: 115, h: 82, ox: 0.3819, oy: 0.0000, px: 88.16, py: -81.78 },
} as const;
