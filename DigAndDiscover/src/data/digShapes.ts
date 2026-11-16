/**
 * The hole each tool leaves. A swing is not one ellipse any more but a small set of parts (a main bite
 * plus optional shoulders, cracks or rubble), and every part has a profile: how the sides curve.
 * The ground simulation and the painted hole read the same numbers, so what you see is what you stand on.
 */

/** Outline of one part: round (ellipse), scoop (flat bottom), vee (pointed), tube (straight walls), ragged (rough). */
export type Profile = 'round' | 'scoop' | 'vee' | 'tube' | 'ragged';

/** How deep the part is at a given sideways position, 0..1, where dx is -1 (left edge) .. 1 (right edge). */
export function profileHalf(profile: Profile, dx: number): number {
  const a = Math.abs(dx);
  if (a >= 1) return 0;
  switch (profile) {
    case 'scoop':
      return Math.pow(1 - a * a * a, 1 / 3);
    case 'vee':
      return 1 - a;
    case 'tube':
      return Math.pow(1 - Math.pow(a, 8), 1 / 8);
    default:
      return Math.sqrt(1 - a * a);
  }
}

export interface ShapePart {
  profile: Profile;
  /** Sideways offset from the aim point, in crater radii. */
  dx: number;
  /** Half-width in crater radii. */
  rx: number;
  /** How deep the part reaches below its own ground, as a fraction of the swing's depth. 1 = the full bite. */
  depth: number;
  /** Flip to the other side on every swing (chopping tools). */
  alt?: boolean;
  /** Random sideways jitter, in crater radii (rough tools). */
  wobble?: number;
}

export interface DigShape {
  name: string;
  /** The first part is the main bite: it always reaches the full swing depth in the aimed column. */
  parts: readonly ShapePart[];
}

const part = (profile: Profile, dx: number, rx: number, depth: number, extra: Partial<ShapePart> = {}): ShapePart => ({
  profile, dx, rx, depth, ...extra,
});

export const SHAPES = {
  /** Old Shovel: the plain round bowl everything started with. */
  bowl: { name: 'Round bowl', parts: [part('round', 0, 1, 1)] },
  /** Iron Shovel: a wide dish with a flat bottom. */
  scoop: { name: 'Wide scoop', parts: [part('scoop', 0, 1.05, 1)] },
  /** Steel Shovel: the scoop plus a shallow shoulder on each side. */
  shouldered: {
    name: 'Shouldered scoop',
    parts: [part('scoop', 0, 0.95, 1), part('scoop', -1.0, 0.5, 0.4), part('scoop', 1.0, 0.5, 0.4)],
  },
  /** Hand Axe: a narrow wedge with a chip knocked out on alternating sides. */
  wedge: {
    name: 'Chop wedge',
    parts: [part('vee', 0, 0.55, 1), part('vee', 0.8, 0.65, 0.55, { alt: true })],
  },
  /** Golden Shovel: a deep scoop in the middle of a wide shallow terrace. */
  terrace: {
    name: 'Terraced pit',
    parts: [part('scoop', 0, 0.9, 1), part('scoop', 0, 1.55, 0.35)],
  },
  /** Pickaxe: a narrow pointed spike with a hairline crack on each side. */
  spike: {
    name: 'Spike and cracks',
    parts: [part('vee', 0, 0.45, 1), part('vee', -0.95, 0.3, 0.35), part('vee', 0.95, 0.3, 0.35)],
  },
  /** Jackhammer: a rough shaft with shattered rubble around the top. */
  rubble: {
    name: 'Rubble shaft',
    parts: [
      part('ragged', 0, 0.6, 1, { wobble: 0.05 }),
      part('ragged', -0.55, 0.35, 0.55, { wobble: 0.1 }),
      part('ragged', 0.55, 0.35, 0.5, { wobble: 0.1 }),
      part('ragged', 0, 1.25, 0.22),
    ],
  },
  /** Diamond Shovel: a clean scoop between two side scoops, a wide trench. */
  trench: {
    name: 'Triple scoop',
    parts: [part('scoop', 0, 1, 1), part('scoop', -1.15, 0.6, 0.7), part('scoop', 1.15, 0.6, 0.7)],
  },
  /** Power Drill: a narrow, perfectly straight bore. */
  bore: { name: 'Clean bore', parts: [part('tube', 0, 0.42, 1)] },
} as const satisfies Record<string, DigShape>;
