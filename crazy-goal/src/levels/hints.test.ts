import { describe, expect, it } from 'vitest';
import { LEVELS } from '../../data/levels/matches';
import { matchInfo } from '../progression/Progression';
import { HINT_FOR, hintText } from './hints';

describe('hints after six misses', () => {
  it('every hint is for a real match (not a tutorial lesson), and the matches have one each', () => {
    const matches = LEVELS.map((d, i) => ({ id: d.id, lesson: matchInfo(LEVELS, i).lesson })).filter((m) => m.lesson === null);
    expect(matches).toHaveLength(39);
    for (const m of matches) expect(HINT_FOR[m.id], m.id).toBeDefined();
    for (const id of Object.keys(HINT_FOR)) expect(matches.some((m) => m.id === id), id).toBe(true);
  });

  it('a hint names the air shot or the bend, and a level without one has none', () => {
    expect(hintText('match-02-dodge')).toMatch(/^TRY (AN AIR SHOT|BENDING IT)$/);
    expect(hintText('match-01-straight')).toBeNull();
    expect(hintText('no-such-level')).toBeNull();
  });
});
