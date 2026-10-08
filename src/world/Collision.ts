import { VIEW } from '../core/Tuning';
import { circleRectOverlap, clamp, type Rect } from '../core/Mathx';

export interface Body {
  x: number;
  y: number;
  radius: number;
}

/**
 * Move a circular body by (dx, dy) against axis-aligned solids, resolving each
 * axis separately so sliding along a wall feels right instead of sticking.
 *
 * This is all the physics the game needs for characters. Pushable props use
 * `pushBody` below. Nothing here needs a solver.
 */
export function moveBody(body: Body, dx: number, dy: number, solids: readonly Rect[]): void {
  if (dx !== 0) {
    const nx = body.x + dx;
    if (!collides(nx, body.y, body.radius, solids)) {
      body.x = nx;
    } else {
      // Try to slide: step the body as close to the wall as we can.
      const step = Math.sign(dx);
      let moved = 0;
      while (Math.abs(moved) < Math.abs(dx)) {
        const test = body.x + step;
        if (collides(test, body.y, body.radius, solids)) break;
        body.x = test;
        moved += step;
      }
    }
  }

  if (dy !== 0) {
    const ny = body.y + dy;
    if (!collides(body.x, ny, body.radius, solids)) {
      body.y = ny;
    } else {
      const step = Math.sign(dy);
      let moved = 0;
      while (Math.abs(moved) < Math.abs(dy)) {
        const test = body.y + step;
        if (collides(body.x, test, body.radius, solids)) break;
        body.y = test;
        moved += step;
      }
    }
  }

  body.x = clamp(body.x, body.radius, VIEW.width - body.radius);
  body.y = clamp(body.y, body.radius, VIEW.height - body.radius);
}

export function collides(x: number, y: number, radius: number, solids: readonly Rect[]): boolean {
  for (let i = 0; i < solids.length; i++) {
    if (circleRectOverlap(x, y, radius, solids[i])) return true;
  }
  return false;
}

/**
 * Nudge a light prop out of the way of a body. Just enough physics for a chair
 * to scrape when you walk into it, which is a noise, which is a mistake.
 */
export function pushBody(
  prop: { x: number; y: number; vx: number; vy: number },
  byX: number,
  byY: number,
  strength: number,
): void {
  prop.vx += byX * strength;
  prop.vy += byY * strength;
}

/** Apply and damp prop velocity. Returns the distance moved this step. */
export function integrateProp(
  prop: { x: number; y: number; vx: number; vy: number },
  dt: number,
  damping: number,
  solids: readonly Rect[],
  radius: number,
): number {
  if (prop.vx === 0 && prop.vy === 0) return 0;
  const body: Body = { x: prop.x, y: prop.y, radius };
  const dx = prop.vx * dt;
  const dy = prop.vy * dt;
  moveBody(body, dx, dy, solids);
  const moved = Math.hypot(body.x - prop.x, body.y - prop.y);
  prop.x = body.x;
  prop.y = body.y;
  const damp = Math.exp(-damping * dt);
  prop.vx *= damp;
  prop.vy *= damp;
  if (Math.abs(prop.vx) < 1 && Math.abs(prop.vy) < 1) {
    prop.vx = 0;
    prop.vy = 0;
  }
  return moved;
}
