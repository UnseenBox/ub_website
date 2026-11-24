import { describe, expect, it } from 'vitest';
import { FIGURES } from './figures';

describe.each(Object.entries(FIGURES))('cut figure: %s', (_name, fig) => {
  const P = fig.parts;

  it('has the eight joint parts the rig needs', () => {
    expect(Object.keys(P).sort()).toEqual(['armL', 'armR', 'head', 'shinL', 'shinR', 'thighL', 'thighR', 'torso']);
  });

  it('gives every part a real size and a pivot inside its box', () => {
    for (const p of Object.values(P)) {
      expect(p.w).toBeGreaterThan(0);
      expect(p.h).toBeGreaterThan(0);
      expect(Number.isFinite(p.ox) && Number.isFinite(p.oy)).toBe(true);
    }
  });

  it('stacks head above torso, with legs below the hips and both feet on the ground', () => {
    expect(P.head.py).toBeLessThan(P.torso.py);
    expect(P.thighL.py).toBeLessThan(0);
    expect(P.shinL.py + P.shinL.h).toBeCloseTo(0, -1);
    expect(P.shinR.py + P.shinR.h).toBeCloseTo(0, -1);
  });

  it('joins each thigh to its shin at the knee', () => {
    expect(Math.abs(P.shinL.py - (P.thighL.py + P.thighL.h))).toBeLessThan(2);
    expect(Math.abs(P.shinR.py - (P.thighR.py + P.thighR.h))).toBeLessThan(2);
  });

  it('matches its height from the neck pivot to the top of the head', () => {
    expect(Math.abs(fig.height - (-P.head.py + P.head.h))).toBeLessThan(2);
  });

  it('has arms long enough to reach the knees', () => {
    expect(fig.armReach).toBeGreaterThan(P.thighL.h);
  });
});
