import { writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { LEVELS } from '../../data/levels/matches';
import { snapBend } from '../core/Guide';
import { countRoutes, fireShot, sweepLevel, type Kick } from './sweep';

/**
 * Level validation: every level can be solved, and the ones edited in the variety pass
 * keep at least three distinct
 * routes and a three star route a player can find at one degree steps.
 *
 * `LEVEL_TABLE=1 LEVEL_OUT=table.txt npx vitest run src/levels/levels.validate.test.ts` writes the numbers for houmas
 * 1 to the last (or for the list in `LEVELS=1,2`) instead of asserting, which is how an edit is judged.
 */

/** Every match must keep at least three routes and a three star route at one degree steps. */
const EDITED = LEVELS.map((_, i) => i + 1);

const ball = (n: number): { x: number; y: number } => LEVELS[n - 1].ballStart;

/** The ways a shot can be struck: along the ground, with bend either way, and lofted. */
const KICKS: readonly Kick[] = [
  { air: false, bend: 0 },
  { air: false, bend: -1 },
  { air: false, bend: 1 },
  { air: true, bend: 0 },
  { air: true, bend: -0.5 },
  { air: true, bend: 0.5 },
];
const POWERS = [0.1, 0.18, 0.26, 0.35, 0.45, 0.55, 0.7, 0.85, 1];

function measure(n: number): { hits: number; routes: number; threeStar: number; threeAngles: number; best: number } {
  const hits = KICKS.flatMap((kick) => sweepLevel(LEVELS[n - 1], n - 1, 1, POWERS, 0, kick));
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
      const list = process.env.LEVELS ? process.env.LEVELS.split(',').map(Number) : LEVELS.map((_, i) => i + 1);
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
  describe('the tutorial lessons', () => {
    // A real shot at goal: no bounce, aimed forward (not a boomerang looped round behind the ball).
    const forward = (h: { angle: number; lines: string }): boolean => h.angle > -165 && h.angle < -20 && !h.lines.includes('BOOMERANG');
    const clean = (n: number, kick: Kick): number =>
      sweepLevel(LEVELS[n - 1], n - 1, 1, POWERS, 0, kick).filter((h) => h.bounces === 0 && forward(h)).length;
    const guided = LEVELS.map((def, i) => ({ def, i })).filter((l) => l.def.guide);

    it('match 1 is the tutorial, five lessons, the ball at the bottom centre every time', () => {
      expect(guided.map((l) => l.def.guide?.move)).toEqual(['straight', 'bend', 'air', 'bank', 'free']);
      for (const { def } of guided) {
        expect(def.ballStart.x).toBe(def.goal.x);
        expect(def.ballStart.y).toBeGreaterThan(def.arena.y + def.arena.h - 120);
      }
    });

    for (const { def, i } of guided) {
      const g = def.guide;
      if (!g) continue;
      it(`${def.name}: the shot the ghost shows scores${g.move === 'bank' ? ' off a board' : ' with no bounce'}`, { timeout: 60000 }, () => {
        const hit = fireShot(def, i, g.show.angle, g.show.power, 0, { air: g.show.air, bend: g.show.bend });
        expect(hit, 'the guide shot misses').not.toBeNull();
        if (g.move === 'bank') expect(hit?.bounces).toBeGreaterThanOrEqual(1);
        else expect(hit?.bounces).toBe(0);
      });
    }

    it('BEND IT: bending the other way works too, mirrored', () => {
      const { def, i } = guided[1];
      const g = def.guide;
      if (!g) return;
      const hit = fireShot(def, i, -180 - g.show.angle, g.show.power, 0, { air: false, bend: -g.show.bend });
      expect(hit).not.toBeNull();
      expect(hit?.bounces).toBe(0);
    });

    it('the wall stops a straight ground shot in every lesson after the first', { timeout: 300000 }, () => {
      expect(clean(1, { air: false, bend: 0 })).toBeGreaterThan(0);
      for (const n of [2, 3, 4, 5]) expect(clean(n, { air: false, bend: 0 }), `lesson ${n}`).toBe(0);
    });

    it('the free kick can be beaten by a lob, a curler and a bank', { timeout: 300000 }, () => {
      expect(clean(5, { air: true, bend: 0 })).toBeGreaterThan(0);
      expect(Math.max(clean(5, { air: false, bend: 1 }), clean(5, { air: false, bend: -1 }))).toBeGreaterThan(0);
      const banks = sweepLevel(LEVELS[4], 4, 1, POWERS, 0, { air: false, bend: 0 }).filter((h) => h.bounces >= 1 && forward(h));
      expect(banks.length).toBeGreaterThan(0);
    });

    it('snapBend snaps to straight and to full bend', () => {
      expect(snapBend(0.08)).toBe(0);
      expect(snapBend(-0.9)).toBe(-1);
      expect(snapBend(0.5)).toBe(0.5);
    });
  });

  describe('every match', () => {
    for (const n of EDITED) {
      it(`match ${n} has 3 or more routes and a 3 star route at 1 degree steps`, { timeout: 120000 }, () => {
        const m = measure(n);
        expect(m.hits).toBeGreaterThan(0);
        expect(m.routes).toBeGreaterThanOrEqual(3);
        expect(m.threeStar).toBeGreaterThan(0);
      });
    }
  });

  describe('every level has a way in', () => {
    // The real sweep (1 degree, five powers) over all hundred, a couple of minutes: opt in with LEVELS_ALL=1.
    // Some exam levels (houma 36) have only a handful of scoring shots, so a coarser sweep would call them impossible.
    it.skipIf(!process.env.LEVELS_ALL)('every match can be scored at 1 degree steps', { timeout: 1200000 }, () => {
      for (let n = 1; n <= LEVELS.length; n++) {
        // Movers (a cat, a scooter) change what is open as the street runs, so a level may only open up when the shot waits.
        let found = sweepLevel(LEVELS[n - 1], n - 1, 1).length;
        for (const delay of [0.4, 0.8, 1.2, 1.6, 2]) if (found === 0) found = sweepLevel(LEVELS[n - 1], n - 1, 1, [0.4, 0.55, 0.7, 0.85, 1], delay).length;
        expect(found, `match ${n}`).toBeGreaterThan(0);
      }
    });
  });
}
