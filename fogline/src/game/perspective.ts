import { FIELD, VIEW } from './config';

export interface Projected {
  sx: number;
  sy: number;
  /** Screen pixels per world metre at this distance. */
  ppm: number;
}

/** Project a ground point (x lateral metres, z distance metres) to the screen. */
export function project(x: number, z: number, out: Projected = { sx: 0, sy: 0, ppm: 0 }): Projected {
  const ppm = VIEW.focal / z;
  out.ppm = ppm;
  out.sx = VIEW.centerX + x * ppm;
  out.sy = VIEW.horizonY + VIEW.camHeight * ppm;
  return out;
}

/** Inverse of project() for a screen point assumed to lie on the ground plane. */
export function groundAt(sx: number, sy: number): { x: number; z: number } {
  const dy = sy - VIEW.horizonY;
  const z = dy <= VIEW.camHeight * VIEW.focal / FIELD.maxZ ? FIELD.maxZ : (VIEW.camHeight * VIEW.focal) / dy;
  const x = ((sx - VIEW.centerX) * z) / VIEW.focal;
  return { x, z };
}

export function screenYOfGround(z: number): number {
  return VIEW.horizonY + (VIEW.camHeight * VIEW.focal) / z;
}
