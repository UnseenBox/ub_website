import { describe, expect, it } from 'vitest';
import { CHAPTERS, chapterOf, chapterStart, chapterTitle, coinsForGoal, isLevelUnlocked, totalStars } from './Progression';

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

describe('coinsForGoal (current rule)', () => {
  it('pays at least 5 and about a hundredth of the score', () => {
    expect(coinsForGoal({ total: 0 })).toBe(5);
    expect(coinsForGoal({ total: 1180 })).toBe(12);
    expect(coinsForGoal({ total: 2400 })).toBe(24);
  });
});
