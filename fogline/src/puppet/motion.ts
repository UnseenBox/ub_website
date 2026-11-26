// Small building blocks shared by the creature animations.

import { clamp01 } from './solve';
import type { ActionState, BonePose, Pose, Rig } from './types';

/** Adds a movement to a part: turns and shifts add up, sizes and opacity multiply. */
export function move(pose: Pose, part: string, m: BonePose): void {
  const b = (pose[part] ??= {});
  if (m.r !== undefined) b.r = (b.r ?? 0) + m.r;
  if (m.x !== undefined) b.x = (b.x ?? 0) + m.x;
  if (m.y !== undefined) b.y = (b.y ?? 0) + m.y;
  if (m.k !== undefined) b.k = (b.k ?? 1) * m.k;
  if (m.sx !== undefined) b.sx = (b.sx ?? 1) * m.sx;
  if (m.sy !== undefined) b.sy = (b.sy ?? 1) * m.sy;
  if (m.a !== undefined) b.a = (b.a ?? 1) * m.a;
}

/** Turns image pixel coordinates (as drawn on the creature's picture) into figure units. */
export function tools(rig: Rig): {
  at: (x: number, y: number) => number[];
  joint: (part: string) => number[];
} {
  const byName = new Map(rig.parts.map((p) => [p.name, p]));
  return {
    at: (x, y) => [x - rig.origin[0], y - rig.origin[1]],
    joint: (name) => {
      const p = byName.get(name);
      if (!p) throw new Error(`${rig.name} has no part ${name}`);
      return p.pivot;
    },
  };
}

export interface Gait {
  /** How high each foot is in its swing, 0..1; the left leg leads. */
  left: number;
  right: number;
  /** 1 at each footfall, fading quickly: the body drops onto the leg. */
  land: number;
  /** -1..1: swings toward the standing leg (positive when the left foot is up). */
  sway: number;
}

/** A two-legged walk from the walk phase (one step every pi). */
export function gait(s: ActionState): Gait {
  const w = s.walk, m = s.moving;
  return {
    left: m * Math.max(0, Math.sin(w)) ** 1.2,
    right: m * Math.max(0, -Math.sin(w)) ** 1.2,
    land: m * Math.max(0, Math.cos(2 * w)) ** 4,
    sway: m * Math.sin(w),
  };
}

/** A deterministic value in -1..1 for a whole number. */
export function noise(n: number): number {
  const v = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return (v - Math.floor(v)) * 2 - 1;
}

/**
 * Sudden, held poses, like a bird's or an insect's head: a new value every `period` seconds,
 * reached in a fast flick and then held still.
 */
export function twitch(time: number, period: number, seed = 0): number {
  const n = Math.floor(time / period);
  const t = clamp01((time / period - n) / 0.14);
  const from = noise(n - 1 + seed), to = noise(n + seed);
  return from + (to - from) * t * t * (3 - 2 * t);
}

/** A short burst that repeats: 0 most of the time, a quick 0..1..0 pulse every `period` seconds. */
export function pulse(time: number, period: number, width = 0.18): number {
  const t = (time / period) % 1;
  return t < width ? Math.sin((t / width) * Math.PI) : 0;
}
