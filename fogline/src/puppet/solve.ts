// Turns a pose into where every part sits: forward kinematics down the skeleton, two-bone
// inverse kinematics for planted feet and reaching hands, and small keyframe helpers.

import type { Animation, BonePose, IkChain, Placed, Rig, RigPart } from './types';

export type Solved = Map<string, Placed>;

const TAU = Math.PI * 2;

/** Wraps an angle into -pi..pi. */
export function wrap(a: number): number {
  return a - TAU * Math.floor((a + Math.PI) / TAU);
}

export const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export type Ease = 'linear' | 'in' | 'out' | 'inOut' | 'snap' | 'back';

function ease(t: number, kind: Ease): number {
  switch (kind) {
    case 'linear': return t;
    case 'in': return t * t * t;
    case 'out': return 1 - (1 - t) ** 3;
    case 'snap': return t ** 5;
    case 'back': return 1 + 2.7 * (t - 1) ** 3 + 1.7 * (t - 1) ** 2;
    default: return t * t * (3 - 2 * t);
  }
}

/** A track of keyframes: [time, value, ease into this key]. Holds the ends. */
export type Key = [number, number, Ease?];

export function keys(t: number, track: Key[]): number {
  if (t <= track[0][0]) return track[0][1];
  for (let i = 1; i < track.length; i++) {
    const [t1, v1, how] = track[i];
    if (t <= t1) {
      const [t0, v0] = track[i - 1];
      return lerp(v0, v1, ease((t - t0) / (t1 - t0 || 1), how ?? 'inOut'));
    }
  }
  return track[track.length - 1][1];
}

/** The parts in an order where every parent comes before its children. */
export function skeletonOrder(rig: Rig): RigPart[] {
  const done = new Set<string>();
  const out: RigPart[] = [];
  const byName = new Map(rig.parts.map((p) => [p.name, p]));
  const visit = (p: RigPart): void => {
    if (done.has(p.name)) return;
    if (p.parent) {
      const parent = byName.get(p.parent);
      if (!parent) throw new Error(`${rig.name}: ${p.name} hangs from a missing part ${p.parent}`);
      visit(parent);
    }
    done.add(p.name);
    out.push(p);
  };
  rig.parts.forEach(visit);
  return out;
}

/** Where a point given at rest on `part` (figure units) ends up. */
export function pointOn(part: RigPart, placed: Placed, at: number[]): [number, number] {
  const dx = (at[0] - part.pivot[0]) * placed.k * placed.sx;
  const dy = (at[1] - part.pivot[1]) * placed.k * placed.sy;
  const c = Math.cos(placed.r), s = Math.sin(placed.r);
  return [placed.x + dx * c - dy * s, placed.y + dx * s + dy * c];
}

/** Where a child's joint sits, given its parent's placement. */
function jointOf(part: RigPart, parent: RigPart | null, p: Placed, bone: BonePose): [number, number] {
  const px = parent ? parent.pivot[0] : 0;
  const py = parent ? parent.pivot[1] : 0;
  const dx = (part.pivot[0] - px + (bone.x ?? 0)) * p.k * p.sx;
  const dy = (part.pivot[1] - py + (bone.y ?? 0)) * p.k * p.sy;
  const c = Math.cos(p.r), s = Math.sin(p.r);
  return [p.x + dx * c - dy * s, p.y + dx * s + dy * c];
}

const angle = (x: number, y: number): number => Math.atan2(y, x);

/**
 * Turns for the two upper bones of a chain so that the end reaches (tx, ty). Returns world
 * turns. A target out of reach is pulled in along its own direction.
 */
export function twoBone(
  ux: number, uy: number, v1: number[], v2: number[], k: number, tx: number, ty: number, bend: number,
): [number, number] {
  const l1 = Math.hypot(v1[0], v1[1]) * k;
  const l2 = Math.hypot(v2[0], v2[1]) * k;
  const base = angle(tx - ux, ty - uy);
  const d = Math.max(Math.abs(l1 - l2) + 0.5, Math.min(l1 + l2 - 0.5, Math.hypot(tx - ux, ty - uy)));
  const cos = (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d);
  const th1 = base + bend * Math.acos(Math.max(-1, Math.min(1, cos)));
  const ex = ux + Math.cos(th1) * l1, ey = uy + Math.sin(th1) * l1;
  const gx = ux + Math.cos(base) * d, gy = uy + Math.sin(base) * d;
  const th2 = angle(gx - ex, gy - ey);
  return [wrap(th1 - angle(v1[0], v1[1])), wrap(th2 - angle(v2[0], v2[1]))];
}

const sub = (a: number[], b: number[]): number[] => [a[0] - b[0], a[1] - b[1]];

/** Which side a chain's middle joint sits on at rest: +1 or -1, as `twoBone` takes it. */
export function restBend(upper: number[], middle: number[], end: number[]): 1 | -1 {
  const toEnd = sub(end, upper), toMid = sub(middle, upper);
  return toEnd[0] * toMid[1] - toEnd[1] * toMid[0] >= 0 ? 1 : -1;
}

export function solve(rig: Rig, anim: Animation, order: RigPart[] = skeletonOrder(rig)): Solved {
  const byName = new Map(order.map((p) => [p.name, p]));
  const out: Solved = new Map();
  const rootBone = anim.root ?? {};
  const root: Placed = {
    x: rootBone.x ?? 0, y: rootBone.y ?? 0, r: rootBone.r ?? 0, k: rootBone.k ?? 1,
    sx: rootBone.sx ?? 1, sy: rootBone.sy ?? 1, a: rootBone.a ?? 1,
  };
  // World turns decided by an IK chain, found when its upper bone is reached.
  const forced = new Map<string, number>();
  const chains = new Map<string, IkChain>((anim.ik ?? []).map((c) => [c.upper, c]));

  for (const part of order) {
    const parent = part.parent ? byName.get(part.parent)! : null;
    const from = part.parent ? out.get(part.parent)! : root;
    const bone = anim.pose[part.name] ?? {};
    const [x, y] = jointOf(part, parent, from, bone);
    const k = from.k * (bone.k ?? 1);

    const chain = chains.get(part.name);
    if (chain) {
      const lower = byName.get(chain.lower)!;
      const tip = chain.tip ? byName.get(chain.tip)! : null;
      const mid = chain.mid ? byName.get(chain.mid)! : null;
      const endPoint = mid ? mid.pivot : tip ? tip.pivot : chain.endAt!;
      let tx = chain.target[0], ty = chain.target[1];
      // The IK target is given for the standing creature; the root carries it along.
      const rootPoint = pointOn({ pivot: [0, 0] } as RigPart, root, [tx, ty]);
      tx = rootPoint[0];
      ty = rootPoint[1];
      if (mid && tip) {
        const turn = chain.midTurn ?? 0;
        const v3 = sub(tip.pivot, mid.pivot);
        tx -= (v3[0] * Math.cos(turn) - v3[1] * Math.sin(turn)) * k;
        ty -= (v3[0] * Math.sin(turn) + v3[1] * Math.cos(turn)) * k;
        forced.set(mid.name, turn);
      }
      if (tip) forced.set(tip.name, chain.tipTurn ?? 0);
      const bend = chain.bend ?? restBend(part.pivot, lower.pivot, endPoint);
      const [r1, r2] = twoBone(x, y, sub(lower.pivot, part.pivot), sub(endPoint, lower.pivot), k, tx, ty, bend);
      forced.set(part.name, r1);
      forced.set(lower.name, r2);
    }

    const turn = forced.get(part.name);
    out.set(part.name, {
      x, y, k,
      r: turn !== undefined ? turn : from.r + (bone.r ?? 0),
      sx: bone.sx ?? 1,
      sy: bone.sy ?? 1,
      a: from.a * (bone.a ?? 1),
    });
  }
  return out;
}
