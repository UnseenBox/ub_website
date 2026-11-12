import { describe, expect, it } from 'vitest';
import { CHAPTERS, FIRST_CLEAR_MIN_COINS, STAR_COINS, chapterOf, chapterStart, chapterTitle, coinsForGoal, isLevelUnlocked, nextStarTarget, starHint, totalStars } from './Progression';

const levels = Array.from({ length: 100 }, (_, i) => ({ id: `houma-${String(i + 1).padStart(2, '0')}` }));
const rec = (goals: number, stars = goals > 0 ? 1 : 0) => ({ goals, stars });

describe('chapters', () => {
  it('numbers chapters from 1 in twelves, with four finals', () => {
    expect(chapterOf(0)).toBe(1);
    expect(chapterOf(11)).toBe(1);
    expect(chapterOf(12)).toBe(2);
    expect(chapterOf(95)).toBe(8);
    expect(chapterOf(96)).toBe(9);
    expect(chapterOf(99)).toBe(9);
    expect(CHAPTERS).toHaveLength(9);
  });
  it('titles and starts line up', () => {
    expect(chapterTitle(1)).toBe('THE HOUMA');
    expect(chapterTitle(9)).toBe('THE FINALS');
    expect(chapterStart(1)).toBe(0);
    expect(chapterStart(2)).toBe(12);
    expect(chapterStart(9)).toBe(96);
  });
});

describe('isLevelUnlocked (current rule: any goal on the previous level)', () => {
  it('the first level is always open', () => {
    expect(isLevelUnlocked({ levels: {} }, levels, 0)).toBe(true);
  });
  it('a level opens once the one before it has a goal', () => {
    const save = { levels: { 'houma-01': rec(1) } };
    expect(isLevelUnlocked(save, levels, 1)).toBe(true);
    expect(isLevelUnlocked(save, levels, 2)).toBe(false);
  });
  it('attempts without a goal do not open anything', () => {
    expect(isLevelUnlocked({ levels: { 'houma-01': rec(0) } }, levels, 1)).toBe(false);
  });
});

describe('totalStars', () => {
  it('sums the level stars and adds Free Kicks stars', () => {
    const save = { levels: { 'houma-01': rec(1, 2), 'houma-02': rec(3, 3) } };
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
