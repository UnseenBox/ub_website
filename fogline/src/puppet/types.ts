// A puppet is a creature picture cut into jointed parts. Everything here is plain data and
// maths (no Phaser), so the same animation runs in the game, the preview page and the tests.
//
// Coordinates are "figure units": picture pixels, x = 0 on the creature's centre line,
// y = 0 at its feet, y growing downward (so the body is at negative y). Angles are radians,
// clockwise on screen.

export interface RigPart {
  name: string;
  /** The part this one hangs from; null hangs from the root at the feet. */
  parent: string | null;
  /** Draw order, back to front. */
  z: number;
  /** The joint this part turns about, where it sits at rest. */
  pivot: number[];
  /** Top-left of the part's picture at rest. */
  offset: number[];
  /** The part's rectangle in the atlas: x, y, width, height. */
  frame: number[];
}

export interface Rig {
  name: string;
  /** Feet to the top of the creature. */
  height: number;
  /** The centre line and feet row, in the pixels of the source picture. */
  origin: number[];
  parts: RigPart[];
}

/** How one part is moved from rest this frame. Everything is optional. */
export interface BonePose {
  /** Turn about the joint, added to the parent's turn. */
  r?: number;
  /** Shift of the joint, in the parent's frame. */
  x?: number;
  y?: number;
  /** Uniform size, passed on to children: used to bring a limb toward the viewer. */
  k?: number;
  /** Squash and stretch of this part alone (children move with it but keep their shape). */
  sx?: number;
  sy?: number;
  /** Opacity, 0 to 1. */
  a?: number;
}

export type Pose = Record<string, BonePose>;

/**
 * Two-bone inverse kinematics: turns `upper` and `lower` so the joint of `tip` lands on
 * `target`. With a third bone (`mid`, as in a bird's leg) `upper` and `lower` reach the top of
 * `mid`, and `mid` is held at `midTurn` so that `tip` lands on the target.
 */
export interface IkChain {
  upper: string;
  lower: string;
  mid?: string;
  /** The part whose joint is the end of the chain; or give `endAt` for a bare tip. */
  tip?: string;
  /** A point on the lower bone (given at rest) that is the end, for legs with no foot part. */
  endAt?: number[];
  target: number[];
  /** World turn of the end part (a foot stays flat at 0). */
  tipTurn?: number;
  midTurn?: number;
  /** Which side the knee or elbow bends to; defaults to the side it bends at rest. */
  bend?: 1 | -1;
}

/** A part's placement on screen, in figure units. */
export interface Placed {
  x: number;
  y: number;
  r: number;
  k: number;
  sx: number;
  sy: number;
  a: number;
}

/** What a creature is doing, as the animation sees it. Times that are not running are -1. */
export interface ActionState {
  /** Seconds since it appeared, for idle motion. */
  time: number;
  /** Walk cycle in radians: one step every pi. */
  walk: number;
  /** 0 standing still, 1 walking; eased by the caller. */
  moving: number;
  /** Melee attack progress 0..1 (the blow lands at STRIKE_AT), or -1. */
  attack: number;
  /** Wind-up of a ranged spit or a shriek, 0..1, or -1. */
  channel: number;
  /** Just after the wind-up fires, 0..1, or -1. */
  release: number;
  /** Flinch from a hit, fading from 1 to 0. */
  hit: number;
  /** Side the flinch pushes to, -1 or 1. */
  hitDir: number;
  /** Death progress 0..1, or -1 while alive. */
  death: number;
  /** Side it falls to, -1 or 1. */
  deathDir: number;
}

export interface Animation {
  pose: Pose;
  ik?: IkChain[];
  /** Moves the whole creature, about its feet. */
  root?: BonePose;
}

/** A hit shape carried by a part: points are given at rest, in figure units. */
export interface PartHit {
  part: string;
  a: number[];
  b: number[];
  r: number;
  zone: 'head' | 'torso' | 'legs';
}

export interface Glow {
  part: string;
  at: number[];
  r: number;
  colour: number;
}

export interface Creature {
  rig: Rig;
  /** Widest reach from the centre line, for quick hit rejection. */
  halfWidth: number;
  animate(s: ActionState): Animation;
  /** Seven shapes, in the zombie's order: arm, arm, leg, leg, torso, shin, shin. */
  hits: PartHit[];
  head: { part: string; at: number[]; r: number };
  /** Named spots effects come from: mouths, claws, fists. */
  anchors: Record<string, { part: string; at: number[] }>;
  glows?: Glow[];
}

/** The moment in an attack when the blow lands. */
export const STRIKE_AT = 0.68;
