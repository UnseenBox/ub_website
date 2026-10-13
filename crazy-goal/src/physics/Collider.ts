export type Shape =
  | { readonly kind: 'circle'; readonly r: number }
  | { readonly kind: 'box'; readonly hw: number; readonly hh: number };

/** What a body is made of. Sound, particles and scoring all key off this. */
export type Surface =
  | 'ball'
  | 'rail'
  | 'kerb'
  | 'wall'
  | 'crate'
  | 'car'
  | 'post'
  | 'net'
  | 'tyre'
  | 'bumper'
  | 'spinner'
  | 'hedge'
  | 'scooter'
  | 'glass'
  | 'bell'
  | 'gate'
  | 'cat';

export const Layer = {
  Ball: 1,
  Solid: 2,
  Net: 4,
} as const;

export const circle = (r: number): Shape => ({ kind: 'circle', r });
export const box = (w: number, h: number): Shape => ({ kind: 'box', hw: w / 2, hh: h / 2 });
