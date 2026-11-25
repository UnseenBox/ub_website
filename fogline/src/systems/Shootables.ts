// Things in the field that bullets can hit besides the dead: fog nests, supply
// crates and fuel drums. Each one is a screen-space box at a world distance, so
// a shot hits whichever is nearer, the thing or a zombie in front of it.

import { project } from '../game/perspective';

export interface Shootable {
  /** World position (metres) of the base, and size. */
  x: number;
  z: number;
  widthM: number;
  heightM: number;
  /** Extra lift off the ground in metres (a crate still under its parachute). */
  liftM?: number;
  alive: boolean;
  /** A bullet (or pellet) landed: `damage` already includes falloff. */
  onHit(damage: number, px: number, py: number): void;
}

export class Shootables {
  private readonly items: Shootable[] = [];

  add(s: Shootable): Shootable {
    this.items.push(s);
    return s;
  }

  remove(s: Shootable): void {
    const i = this.items.indexOf(s);
    if (i >= 0) this.items.splice(i, 1);
  }

  clear(): void {
    this.items.length = 0;
  }

  /** The nearest live shootable under a screen point, or null. */
  at(px: number, py: number): Shootable | null {
    let best: Shootable | null = null;
    for (const s of this.items) {
      if (!s.alive || (best && s.z >= best.z)) continue;
      if (contains(s, px, py)) best = s;
    }
    return best;
  }

  /** Live shootables within `radius` metres of a ground point (blasts). */
  inRadius(x: number, z: number, radius: number): Shootable[] {
    return this.items.filter((s) => s.alive && Math.hypot(s.x - x, s.z - z) <= radius + s.widthM / 2);
  }
}

/** Is a screen point inside the shootable's box? */
export function contains(s: Shootable, px: number, py: number): boolean {
  const p = project(s.x, s.z);
  const halfW = (s.widthM / 2) * p.ppm;
  const bottom = p.sy - (s.liftM ?? 0) * p.ppm;
  const top = bottom - s.heightM * p.ppm;
  return px >= p.sx - halfW && px <= p.sx + halfW && py >= top && py <= bottom;
}
