import { describe, expect, it } from 'vitest';
import { STUCK_MISSES, isStuck, starsToNextSkin, unseenSkins, CHAPTERS, FIRST_CLEAR_MIN_COINS, GATE_PER_CHAPTER, STAR_COINS, chapterGate, chapterOf, chapterStart, chapterTitle, classicStars, coinsForGoal, gateStatus, isGateBlocked, isLevelUnlocked, matchInfo, nextStarTarget, starHint, totalStars } from './Progression';

const levels = Array.from({ length: 47 }, (_, i) => ({ id: `level-${String(i + 1).padStart(2, '0')}` }));
const rec = (goals: number, stars = goals > 0 ? 1 : 0) => ({ goals, stars });

describe('chapters', () => {
  it('numbers chapters from 1 along the worlds of the campaign', () => {
    expect(chapterOf(0)).toBe(1);
    expect(chapterOf(9)).toBe(1);
    expect(chapterOf(10)).toBe(2);
    expect(chapterOf(46)).toBe(8);
    expect(chapterOf(200)).toBe(8);
    expect(CHAPTERS).toHaveLength(8);
  });
  it('titles and starts line up', () => {
    expect(chapterTitle(1)).toBe('OPENING SEASON');
    expect(chapterTitle(8)).toBe('BIG MATCHES');
    expect(chapterStart(1)).toBe(0);
    expect(chapterStart(2)).toBe(10);
    expect(chapterStart(8)).toBe(42);
  });
});

describe('isLevelUnlocked inside a chapter: any goal on the previous level', () => {
  it('the first level is always open', () => {
    expect(isLevelUnlocked({ levels: {} }, levels, 0)).toBe(true);
  });
  it('a level opens once the one before it has a goal', () => {
    const save = { levels: { 'level-01': rec(1) } };
    expect(isLevelUnlocked(save, levels, 1)).toBe(true);
    expect(isLevelUnlocked(save, levels, 2)).toBe(false);
  });
  it('attempts without a goal do not open anything', () => {
    expect(isLevelUnlocked({ levels: { 'level-01': rec(0) } }, levels, 1)).toBe(false);
  });
});

describe('totalStars', () => {
  it('sums the level stars and adds Free Kicks stars', () => {
    const save = { levels: { 'level-01': rec(1, 2), 'level-02': rec(3, 3) } };
    expect(totalStars(save)).toBe(5);
    expect(totalStars(save, 4)).toBe(9);
  });
});

describe('coinsForGoal', () => {
  const pay = (firstClear: boolean, oldStars: number, newStars: number, total: number) => coinsForGoal({ firstClear, oldStars, newStars, total });
  it('pays the first clear about a hundredth of the score, never under the minimum, plus its stars', () => {
    expect(pay(true, 0, 1, 500)).toBe(FIRST_CLEAR_MIN_COINS + STAR_COINS);
    expect(pay(true, 0, 2, 1400)).toBe(14 + 2 * STAR_COINS);
    expect(pay(true, 0, 3, 5000)).toBe(50 + 3 * STAR_COINS);
  });
  it('pays only the stars not paid for yet on a replay', () => {
    expect(pay(false, 1, 3, 2600)).toBe(2 * STAR_COINS);
    expect(pay(false, 2, 3, 2600)).toBe(STAR_COINS);
  });
  it('pays nothing for a replay that wins nothing new', () => {
    expect(pay(false, 2, 2, 9000)).toBe(0);
    expect(pay(false, 3, 1, 1000)).toBe(0);
    expect(pay(false, 3, 3, 9000)).toBe(0);
  });
  it('scoring a level ten times pays once', () => {
    let paid = 0;
    let stars = 0;
    for (let i = 0; i < 10; i++) {
      paid += pay(i === 0, stars, 2, 1400);
      stars = Math.max(stars, 2);
    }
    expect(paid).toBe(14 + 2 * STAR_COINS);
  });
});

describe('nextStarTarget', () => {
  const level = { stars: [1400, 2600] as const };
  it('asks for the second star after the first', () => {
    expect(nextStarTarget(level, 1)).toEqual({ star: 2, target: 1400 });
    expect(nextStarTarget(level, 0)).toEqual({ star: 2, target: 1400 });
  });
  it('asks for the third star after the second', () => {
    expect(nextStarTarget(level, 2)).toEqual({ star: 3, target: 2600 });
  });
  it('has nothing to ask at three stars', () => {
    expect(nextStarTarget(level, 3)).toBeNull();
  });
});

describe('starHint', () => {
  it('sends a straight goal to the walls', () => {
    expect(starHint({ bounces: 0, street: false })).toBe('BOUNCE IT OFF A WALL');
    expect(starHint({ bounces: 0, street: true })).toBe('BOUNCE IT OFF A WALL');
  });
  it('sends a bank with no street to the street', () => {
    expect(starHint({ bounces: 2, street: false })).toBe('USE THE STREET');
  });
  it('otherwise says go crazier', () => {
    expect(starHint({ bounces: 2, street: true })).toBe('GO CRAZIER');
  });
});

describe('chapter star gates', () => {
  /** A save with goals on levels 0..upTo (inclusive) and `stars` stars each. */
  const progress = (upTo: number, starsEach: number | ((i: number) => number)) => {
    const save: { levels: Record<string, { goals: number; stars: number }> } = { levels: {} };
    for (let i = 0; i <= upTo; i++) save.levels[levels[i].id] = { goals: 1, stars: typeof starsEach === 'number' ? starsEach : starsEach(i) };
    return save;
  };

  it('asks ten stars per chapter after the first', () => {
    expect(GATE_PER_CHAPTER).toBe(10);
    expect(chapterGate(1)).toBe(0);
    expect(chapterGate(2)).toBe(10);
    expect(chapterGate(8)).toBe(70);
  });

  it('keeps the first level of a chapter locked one star short, and opens it at the gate', () => {
    const first = chapterStart(3);
    const need = chapterGate(3);
    const save = progress(first - 1, 1);
    expect(classicStars(save)).toBe(first);
    expect(first).toBeLessThan(need);
    expect(isLevelUnlocked(save, levels, first - 1)).toBe(true);
    expect(isLevelUnlocked(save, levels, first)).toBe(false);
    expect(isGateBlocked(save, levels, first)).toBe(true);
    expect(gateStatus(save, levels, 3)).toEqual({ need, have: first, open: false });
    // Style stars make up the difference.
    const better = progress(first - 1, (i) => (i < need - first ? 2 : 1));
    expect(classicStars(better)).toBe(need);
    expect(isLevelUnlocked(better, levels, first)).toBe(true);
    expect(isGateBlocked(better, levels, first)).toBe(false);
  });

  it('does not gate levels inside a chapter, only the first of the chapter', () => {
    const first = chapterStart(3);
    const save = progress(first, 1); // the first level scored on: grandfathered open, next level opens by the old rule
    expect(isLevelUnlocked(save, levels, first + 1)).toBe(true);
  });

  it('is not blocked by a gate while the previous level has no goal', () => {
    expect(isGateBlocked({ levels: {} }, levels, chapterStart(3))).toBe(false);
    expect(isLevelUnlocked({ levels: {} }, levels, chapterStart(3))).toBe(false);
  });

  it('grandfathers a chapter in which any level already has a goal', () => {
    // An old save with goals up to the last level of the 7th world, one star each: 42 stars, chapter 7 asks for 60.
    const save = progress(41, 1);
    expect(classicStars(save)).toBe(42);
    expect(isLevelUnlocked(save, levels, chapterStart(7))).toBe(true);
    // The finals have no goals yet and 42 < 70: that gate still applies.
    expect(isGateBlocked(save, levels, chapterStart(8))).toBe(true);
  });

  it('only counts level stars: Free Kicks stars do not open chapters', () => {
    const first = chapterStart(3);
    expect(isLevelUnlocked(progress(first - 1, 1), levels, first)).toBe(false);
    expect(totalStars(progress(first - 1, 1), 20)).toBe(first + 20);
  });
});




describe('ball unlocks', () => {
  const skins = [
    { id: 'classic', need: 0 },
    { id: 'orange', need: 3 },
    { id: 'algiers', need: 6 },
    { id: 'mint', need: 10 },
  ];
  it('names the balls that are open and not yet seen, never the free starter', () => {
    expect(unseenSkins(0, skins, []).map((s) => s.id)).toEqual([]);
    expect(unseenSkins(6, skins, []).map((s) => s.id)).toEqual(['orange', 'algiers']);
    expect(unseenSkins(6, skins, ['orange']).map((s) => s.id)).toEqual(['algiers']);
    expect(unseenSkins(6, skins, ['orange', 'algiers'])).toEqual([]);
  });
  it('counts the stars to the next locked ball', () => {
    expect(starsToNextSkin(0, skins)).toBe(3);
    expect(starsToNextSkin(4, skins)).toBe(2);
    expect(starsToNextSkin(10, skins)).toBeNull();
  });
});

describe('stuck assist', () => {
  it('offers help after four misses on one houma', () => {
    expect(STUCK_MISSES).toBe(4);
    expect(isStuck(3)).toBe(false);
    expect(isStuck(4)).toBe(true);
    expect(isStuck(9)).toBe(true);
  });
});

describe('matchInfo', () => {
  const levels = [{ guide: {} }, { guide: {} }, { guide: {} }, { guide: { series: 'abilities' } }, { guide: { series: 'dodge' } }, {}];
  it('numbers the tutorial lessons inside match 1 and every other level as the next match', () => {
    expect(matchInfo(levels, 0)).toEqual({ match: 1, lesson: 1 });
    expect(matchInfo(levels, 2)).toEqual({ match: 1, lesson: 3 });
    expect(matchInfo(levels, 3)).toEqual({ match: 1, lesson: 4 });
    expect(matchInfo(levels, 4)).toEqual({ match: 2, lesson: null });
    expect(matchInfo(levels, 5)).toEqual({ match: 3, lesson: null });
  });
});
