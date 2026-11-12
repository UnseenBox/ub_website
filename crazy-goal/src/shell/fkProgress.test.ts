import { describe, expect, it } from 'vitest';
import { fkPlayed, fkStarMax, fkStars, parseFkStages } from './fkProgress';

const raw = JSON.stringify({
  v: 1,
  stages: {
    'stage-1-x': { stars: 2, goals: 4, plays: 3 },
    'stage-5-pressure': { stars: 1, goals: 3, plays: 1 },
    junk: 'nope',
  },
  quick: { plays: 9, bestGoals: 5, bestStars: 3 },
});

describe('fkProgress', () => {
  it('sums stage stars and ignores Quick Five and junk', () => {
    const stages = parseFkStages(raw);
    expect(fkStars(stages)).toBe(3);
    expect(fkPlayed(stages)).toBe(true);
  });
  it('treats missing or corrupt storage as no progress', () => {
    expect(fkStars(parseFkStages(null))).toBe(0);
    expect(fkStars(parseFkStages('{oops'))).toBe(0);
    expect(fkPlayed(parseFkStages('[]'))).toBe(false);
  });
  it('raises the maximum from 15 to 18 once stage 5 has a star (Legend opens)', () => {
    expect(fkStarMax({})).toBe(15);
    expect(fkStarMax(parseFkStages(raw))).toBe(18);
  });
});
