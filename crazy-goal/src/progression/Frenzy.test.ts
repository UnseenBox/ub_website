import { describe, expect, it } from 'vitest';
import { FRENZY_LIVES, frenzyPool, frenzyUnlocked, livesAfterGoal, newFrenzyRun } from './Frenzy';

/** Worlds of 10 levels, as the campaign has them (level index 0 is world 1). */
const chapter = (i: number): number => Math.floor(i / 10) + 1;

describe('FRENZY unlock', () => {
  it('opens once match 4 has been scored on, and not before', () => {
    expect(frenzyUnlocked(() => 0)).toBe(false);
    expect(frenzyUnlocked((id) => (id === 'm04-ice-rink' ? 1 : 0))).toBe(true);
    expect(frenzyUnlocked((id) => (id === 'match-03-pinball' ? 3 : 0))).toBe(false);
  });
});

describe('FRENZY lives', () => {
  it('a run starts with three lives', () => {
    expect(newFrenzyRun()).toMatchObject({ lives: FRENZY_LIVES, goals: 0, streak: 0, score: 0, over: false });
    expect(FRENZY_LIVES).toBe(3);
  });

  it('every five goals give a bonus life, but never more than three', () => {
    expect(livesAfterGoal(2, 1)).toBe(2);
    expect(livesAfterGoal(2, 5)).toBe(3);
    expect(livesAfterGoal(3, 10)).toBe(3);
    expect(livesAfterGoal(3, 0)).toBe(3);
  });
});

describe('FRENZY pool of matches', () => {
  it('starts in world 1 with the cleared matches of that world', () => {
    const cleared = [2, 5, 13];
    expect(frenzyPool(cleared, chapter, 0)).toEqual([2, 5]);
  });

  it('every five goals the pool moves up a world, as far as a match has been cleared there', () => {
    const cleared = [2, 5, 13];
    expect(frenzyPool(cleared, chapter, 5)).toEqual([13]);
    // Nothing cleared in world 3 at all: the pool stays on the highest cleared world below.
    expect(frenzyPool(cleared, chapter, 10)).toEqual([13]);
  });

  it('never goes above the highest cleared world', () => {
    expect(frenzyPool([2, 5], chapter, 50)).toEqual([2, 5]);
  });

  it('with nothing cleared below the target, it falls back to the lowest cleared world', () => {
    expect(frenzyPool([25, 27], chapter, 0)).toEqual([25, 27]);
  });

  it('an empty pool stays empty', () => {
    expect(frenzyPool([], chapter, 3)).toEqual([]);
  });
});
