import { writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { LEVELS } from '../../data/levels/houma';
import { countRoutes, sweepLevel } from './sweep';

/**
 * Level validation: every level can be solved, and the ones edited in the variety pass
 * (docs/2026-11-07-level-overhaul-validation.md, "Variety pass") keep at least three distinct
 * routes and a three star route a player can find at one degree steps.
 *
 * `LEVEL_TABLE=1 LEVEL_OUT=table.txt npx vitest run src/levels/levels.validate.test.ts` writes the numbers for houmas
 * 2 to 24 (or for the list in `LEVELS=3,5,8`) instead of asserting, which is how an edit is judged.
 */

/** Houmas whose goal or ball start moved in the variety pass. */
const EDITED = [3, 5, 8, 10, 13, 15, 21];

const ball = (n: number): { x: number; y: number } => LEVELS[n - 1].ballStart;

function measure(n: number): { hits: number; routes: number; threeStar: number; threeAngles: number; best: number } {
  const hits = sweepLevel(LEVELS[n - 1], n - 1, 1);
  const three = hits.filter((h) => h.stars === 3);
  return {
    hits: hits.length,
    routes: countRoutes(hits),
    threeStar: three.length,
    threeAngles: new Set(three.map((h) => h.angle)).size,
    best: Math.max(0, ...hits.map((h) => h.total)),
  };
}

if (process.env.LEVEL_TABLE) {
  describe('level table', () => {
    it('prints', { timeout: 600000 }, () => {
      const list = process.env.LEVELS ? process.env.LEVELS.split(',').map(Number) : Array.from({ length: 23 }, (_, i) => i + 2);
      const rows = list.map((n) => {
        const m = measure(n);
        const def = LEVELS[n - 1];
        return `${String(n).padStart(3)} | ${def.name.padEnd(16)} | start ${ball(n).x},${ball(n).y} | goal ${def.goal.x} | hits ${String(m.hits).padStart(3)} | routes ${String(m.routes).padStart(2)} | 3* ${String(m.threeStar).padStart(3)} (${m.threeAngles} angles) | best ${m.best} | stars ${def.stars.join('/')}`;
      });
      const text = rows.join('\n');
      // The reporter swallows console output of a passing test, so the table can also go to a file.
      if (process.env.LEVEL_OUT) writeFileSync(process.env.LEVEL_OUT, text + '\n');
      else console.log('\n' + text);
    });
  });
} else {
  describe('variety pass levels', () => {
    for (const n of EDITED) {
      it(`houma ${n} has 3 or more routes and a 3 star route at 1 degree steps`, { timeout: 120000 }, () => {
        const m = measure(n);
        expect(m.hits).toBeGreaterThan(0);
        expect(m.routes).toBeGreaterThanOrEqual(3);
        expect(m.threeStar).toBeGreaterThan(0);
      });
    }
  });

  describe('every level has a way in', () => {
    // A coarse sweep over all hundred: cheap, and it catches a level an edit made impossible.
    it.skipIf(!process.env.LEVELS_ALL)('all 100 houmas can be scored at 3 degree steps', { timeout: 900000 }, () => {
      for (let n = 1; n <= LEVELS.length; n++) {
        const hits = sweepLevel(LEVELS[n - 1], n - 1, 3, [0.5, 0.75, 1]);
        expect(hits.length, `houma ${n}`).toBeGreaterThan(0);
      }
    });
  });
}
