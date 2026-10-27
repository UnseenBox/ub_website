import { describe, expect, it } from 'vitest';
import { angleDiff, lerpAngle } from './math';

describe('angle interpolation', () => {
  it('takes the short way across the wrap point', () => {
    const mid = lerpAngle(Math.PI * 0.9, -Math.PI * 0.9, 0.5);
    expect(Math.abs(angleDiff(Math.PI, mid))).toBeLessThan(0.2);
  });

  it('does not take the long way when the angle is snapped past PI', () => {
    const mid = lerpAngle(3, -3, 0.5);
    expect(Math.abs(mid)).toBeGreaterThan(3);
    expect(Math.abs(angleDiff(Math.PI, mid))).toBeLessThan(0.2);
  });

  it('is exact at both ends', () => {
    expect(lerpAngle(0.3, 1.2, 0)).toBe(0.3);
    expect(lerpAngle(0.3, 1.2, 1)).toBe(1.2);
  });
});
