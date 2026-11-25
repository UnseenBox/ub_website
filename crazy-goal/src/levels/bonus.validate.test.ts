import { writeFileSync } from 'node:fs';
import { afterAll, describe, expect, it } from 'vitest';
import { LEVELS } from '../../data/levels/matches';
import { matchInfo } from '../progression/Progression';
import { BONUS_OBJECTIVES, bonusMet, type BonusId, type BonusKick } from '../scoring/Bonus';
import { BONUS_FOR } from './bonus';
import { sweepLevel } from './sweep';

/**
 * Every match from 2 on has a bonus objective, and at least three scoring shots of the full sweep meet it, with
 * the control the objective needs (a lofted shot for an air shot, a bent one for a bend; a bend can go either way).
 */
const MATCHES = LEVELS.map((def, i) => ({ def, i })).filter(({ i }) => matchInfo(LEVELS, i).lesson === null);

const KICKS: Record<BonusKick, Array<{ air: boolean; bend: number }>> = {
  ground: [{ air: false, bend: 0 }],
  air: [{ air: true, bend: 0 }],
  bend: [
    { air: false, bend: 1 },
    { air: false, bend: -1 },
  ],
};

/** How many scoring shots of the full sweep meet `id`, with the control it needs. */
function countFor(id: BonusId, def: (typeof LEVELS)[number], i: number): number {
  let n = 0;
  for (const kick of KICKS[BONUS_OBJECTIVES[id].kick]) {
    for (const hit of sweepLevel(def, i, 1, [0.4, 0.55, 0.7, 0.85, 1], 0, kick)) if (bonusMet(id, hit.facts)) n++;
  }
  return n;
}

/** The counts, for the report: match, level id, objective, its kind of control, and the scoring shots that meet it. */
const report: Array<{ match: number; id: string; bonus: string; kick: string; shots: number }> = [];

describe('bonus objectives on the matches', () => {
  afterAll(() => {
    // BONUS_REPORT=<file> writes the counts out (for the step's report).
    if (process.env.BONUS_REPORT) writeFileSync(process.env.BONUS_REPORT, JSON.stringify(report, null, 1));
  });

  it('every key of the table is a real match, and every match from 2 on has an objective', () => {
    const ids = new Set(LEVELS.map((d) => d.id));
    for (const key of Object.keys(BONUS_FOR)) expect(ids.has(key), key).toBe(true);
    for (const { def } of MATCHES) expect(BONUS_FOR[def.id], def.id).toBeDefined();
    expect(MATCHES).toHaveLength(39);
  });

  it.each(MATCHES.map(({ def, i }) => [def.id, def, i] as const))('%s has an objective that at least three shots meet', (_id, def, i) => {
    const bonus = BONUS_FOR[def.id];
    const n = countFor(bonus, def, i);
    report.push({ match: matchInfo(LEVELS, i).match, id: def.id, bonus, kick: BONUS_OBJECTIVES[bonus].kick, shots: n });
    expect(n, `${bonus} on ${def.id}`).toBeGreaterThanOrEqual(3);
  }, 120_000);
});
