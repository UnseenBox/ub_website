// Phone touch helpers. Touch aim is stored in the same virtual "gun aim"
// space as the mouse, so the crosshair and muzzle keep their fixed offset.

import { VIEW } from './config';

/** Screen offset from the gun aim point to the crosshair. */
export const AIM_LEFT_OFFSET = -150;
export const AIM_VERT_OFFSET = -80;

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

/** Convert a finger position into the gun-aim position that puts the crosshair there. */
export function touchGunAim(x: number, y: number): { x: number; y: number } {
  return {
    x: clamp(x - AIM_LEFT_OFFSET, 0, VIEW.width),
    y: clamp(y - AIM_VERT_OFFSET, 0, VIEW.hudTop),
  };
}

/** Convert a gun-aim position back into its crosshair position. */
export function crosshairFromGun(x: number, y: number): { x: number; y: number } {
  return {
    x: clamp(x + AIM_LEFT_OFFSET, 0, VIEW.width),
    y: clamp(y + AIM_VERT_OFFSET, 0, VIEW.hudTop),
  };
}

/** Left half of the battlefield is the aim zone. */
export function isAimTouch(x: number, y: number): boolean {
  return x >= 0 && x < VIEW.width / 2 && y >= 0 && y < VIEW.hudTop;
}

/** Right half of the battlefield above the HUD is the fire zone. */
export function isFireTouch(x: number, y: number): boolean {
  return x >= VIEW.width / 2 && x <= VIEW.width && y >= 0 && y < VIEW.hudTop;
}
