import { describe, expect, it } from 'vitest';
import { LEVELS } from '../../data/levels/matches';
import { CHAPTERS } from './Progression';
import { WORLD_COUNT, bossIndices, isBossIndex, nextWorld, worldOf, worldRange, worldStars } from './Worlds';

describe('worlds', () => {
  it('there are eight worlds, and the last one is the next world of none', () => {
    expect(WORLD_COUNT).toBe(CHAPTERS.length);
    expect(WORLD_COUNT).toBe(8);
    expect(nextWorld(1)).toBe(2);
    expect(nextWorld(WORLD_COUNT)).toBeNull();
  });

  it('the boss match is the last level of each world, with the last world ending on the final level', () => {
    // 47 levels: the tutorial, the ability lessons, then 39 matches.
    const boss = bossIndices(47);
    expect(boss).toHaveLength(8);
    expect(boss).toEqual([9, 14, 20, 26, 31, 36, 41, 46]);
    expect(isBossIndex(9, 47)).toBe(true);
    expect(isBossIndex(8, 47)).toBe(false);
    expect(isBossIndex(46, 47)).toBe(true);
  });

  it('match 3 is the boss of the first world', () => {
    expect(worldOf(9)).toBe(1);
    expect(isBossIndex(9, 47)).toBe(true);
    expect(worldRange(1, 47)).toEqual([0, 10]);
  });

  it('a world covers its own levels, and the worlds fill the whole campaign', () => {
    let covered = 0;
    for (let w = 1; w <= WORLD_COUNT; w++) {
      const [from, to] = worldRange(w, 47);
      expect(from).toBe(covered);
      covered = to;
    }
    expect(covered).toBe(47);
  });

  it('stars in a world count out of three for each of its levels', () => {
    const [from, to] = worldRange(1, 47);
    const stars = (i: number) => (i === from ? 3 : i === from + 1 ? 1 : 0);
    expect(worldStars(1, 47, stars)).toEqual({ stars: 4, max: 3 * (to - from) });
  });
});

describe('the campaign', () => {
  it('has 47 levels, and its boss matches are the last level of each world', () => {
    expect(LEVELS).toHaveLength(47);
    const bosses = LEVELS.map((l, i) => (l.boss ? i : -1)).filter((i) => i >= 0);
    expect(bosses).toEqual([9, 14, 20, 26, 31, 36, 41, 46]);
    expect(LEVELS[9].id).toBe('match-03-pinball');
  });
});
