import { describe, expect, it } from 'vitest';
import { SHAMBLER_HEIGHT, SHEET_PARTS } from './zombieSheetFrames';

describe('shambler parts', () => {
  it('has the eight joint parts the rig needs', () => {
    expect(Object.keys(SHEET_PARTS).sort()).toEqual(
      ['armL', 'armR', 'head', 'shinL', 'shinR', 'thighL', 'thighR', 'torso'],
    );
  });

  it('gives every part a real size and a pivot inside its box', () => {
    for (const p of Object.values(SHEET_PARTS)) {
      expect(p.w).toBeGreaterThan(0);
      expect(p.h).toBeGreaterThan(0);
      expect(p.ox).toBeGreaterThanOrEqual(0);
      expect(p.ox).toBeLessThanOrEqual(1);
      expect(p.oy).toBeGreaterThanOrEqual(0);
      expect(p.oy).toBeLessThanOrEqual(1);
    }
  });

  it('stacks head, torso, thigh, then shin, with both feet on the ground', () => {
    expect(SHEET_PARTS.head.py).toBeLessThan(SHEET_PARTS.torso.py);
    expect(SHEET_PARTS.thighL.py).toBeLessThan(SHEET_PARTS.shinL.py);
    expect(SHEET_PARTS.thighR.py).toBeLessThan(SHEET_PARTS.shinR.py);
    expect(SHEET_PARTS.shinL.py + SHEET_PARTS.shinL.h).toBeCloseTo(0, -1);
    expect(SHEET_PARTS.shinR.py + SHEET_PARTS.shinR.h).toBeCloseTo(0, -1);
  });

  it('joins each thigh to its shin at the knee, with the knee sitting on the thigh', () => {
    for (const [thigh, shin] of [[SHEET_PARTS.thighL, SHEET_PARTS.shinL], [SHEET_PARTS.thighR, SHEET_PARTS.shinR]]) {
      // The knee is the shin's top pivot; it must lie at the thigh's bottom edge.
      expect(Math.abs(shin.py - (thigh.py + thigh.h))).toBeLessThan(2);
    }
  });

  it('matches the stated figure height from neck pivot to the top of the head', () => {
    expect(Math.abs(SHAMBLER_HEIGHT - (-SHEET_PARTS.head.py + SHEET_PARTS.head.h))).toBeLessThan(2);
  });
});
