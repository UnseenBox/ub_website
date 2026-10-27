import { describe, expect, it } from 'vitest';
import { wallAvoidance } from './Navigation';

const room = { x0: 0, y0: 0, x1: 1000, y1: 600 };

describe('wall avoidance', () => {
  it('leaves a body in open floor alone', () => {
    const out = { x: 9, y: 9 };
    expect(wallAvoidance(500, 300, 20, room, out)).toBe(false);
    expect(out).toEqual({ x: 0, y: 0 });
  });

  it('pushes away from the nearest wall, harder the closer it gets', () => {
    const near = { x: 0, y: 0 };
    const far = { x: 0, y: 0 };
    wallAvoidance(10, 300, 20, room, near);
    wallAvoidance(40, 300, 20, room, far);
    expect(near.x).toBeGreaterThan(0);
    expect(far.x).toBeGreaterThan(0);
    expect(near.x).toBeGreaterThan(far.x);
    expect(near.y).toBe(0);
  });

  it('pushes out of a corner on both axes', () => {
    const out = { x: 0, y: 0 };
    expect(wallAvoidance(4, 4, 24, room, out)).toBe(true);
    expect(out.x).toBeGreaterThan(0);
    expect(out.y).toBeGreaterThan(0);
  });
});
