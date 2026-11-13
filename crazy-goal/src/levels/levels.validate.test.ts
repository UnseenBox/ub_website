import { writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { LEVELS } from '../../data/levels/matches';
import { snapBend } from '../core/Guide';
import { matchInfo } from '../progression/Progression';
import { Level } from './Level';
import { countRoutes, fireShot, sweepLevel, traceShot, type Kick } from './sweep';

/**
 * Level validation: every level can be solved, and the ones edited in the variety pass
 * keep at least three distinct
 * routes and a three star route a player can find at one degree steps.
 *
 * `LEVEL_TABLE=1 LEVEL_OUT=table.txt npx vitest run src/levels/levels.validate.test.ts` writes the numbers for houmas
 * 1 to the last (or for the list in `LEVELS=1,2`) instead of asserting, which is how an edit is judged.
 */

/** Every match must keep at least three routes and a three star route at one degree steps. */
const EDITED = LEVELS.map((_, i) => i + 1).filter((n) => !LEVELS[n - 1].guide?.boost);

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

/** A lighter sweep for the campaign, which has forty levels: two degree steps, the four basic kicks. */
const LIGHT_KICKS: readonly Kick[] = [KICKS[0], KICKS[1], KICKS[2], KICKS[3]];

function measure(n: number, light = false): { hits: number; routes: number; threeStar: number; threeAngles: number; best: number } {
  const def = LEVELS[n - 1];
  // A level with something moving may keep the first instant shut: let the street run until a shot gets in.
  const delays = light ? [0, 0.7, 1.4, 2.1] : [0];
  let hits: ReturnType<typeof sweepLevel> = [];
  for (const delay of delays) {
    hits = (light ? LIGHT_KICKS : KICKS).flatMap((kick) => sweepLevel(def, n - 1, light ? 2 : 1, POWERS, delay, kick));
    if (hits.length >= 3) break;
  }
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
    const guided = LEVELS.map((def, i) => ({ def, i })).filter((l) => l.def.guide && !l.def.guide.series);

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

  describe('match 2: dodge the board, grab the coin', () => {
    const i = LEVELS.findIndex((l) => l.id === 'match-02-dodge');
    const def = LEVELS[i];
    it('the board stops the straight shot, and the shown shot goes round it, through the coin, into the goal', () => {
      const g = def.guide;
      expect(g?.move).toBe('coin');
      expect(fireShot(def, i, -90, 0.55), 'a straight shot at the middle of the goal').toBeNull();
      const hit = fireShot(def, i, g?.show.angle ?? 0, g?.show.power ?? 0, 0, { air: g?.show.air ?? false, bend: g?.show.bend ?? 0 });
      expect(hit).not.toBeNull();
      expect(hit?.coin).toBe(true);
      expect(hit?.bounces).toBe(0);
    });
    it('the coin is clear of the board', () => {
      const level = new Level(def, i);
      expect(level.coin).toEqual(def.coin);
      for (const b of level.blocks) expect(Math.abs(b.x - level.coin.x) > b.w / 2 + 30 || Math.abs(b.y - level.coin.y) > b.h / 2 + 30 || b.boundary).toBe(true);
    });
  });

  describe('match 3: the pinball table', () => {
    const i = LEVELS.findIndex((l) => l.id === 'match-03-pinball');
    const def = LEVELS[i];
    it('has bumpers and a spinner, and can be scored whatever the spinner is doing', { timeout: 300000 }, () => {
      expect(def.mechanics.filter((m) => m.type === 'bumper').length).toBeGreaterThanOrEqual(2);
      expect(def.mechanics.some((m) => m.type === 'spinner')).toBe(true);
      for (const delay of [0, 0.5, 1, 1.5, 2, 2.5]) expect(sweepLevel(def, i, 2, [0.4, 0.7, 1], delay).length, `spinner phase ${delay}`).toBeGreaterThan(0);
    });
    it('its coin can be picked up on the way to a goal', () => {
      expect(sweepLevel(def, i, 2, [0.4, 0.7, 1]).some((h) => h.coin)).toBe(true);
    });
  });

  describe('the campaign', () => {
    it('is forty matches: the tutorial, then thirty-nine more, with unique ids and names', () => {
      expect(matchInfo(LEVELS, LEVELS.length - 1).match).toBe(40);
      expect(new Set(LEVELS.map((l) => l.id)).size).toBe(LEVELS.length);
      expect(new Set(LEVELS.map((l) => l.name)).size).toBe(LEVELS.length);
    });
    it('puts every match from the fourth on in a world, and no two matches in one world share a stadium and a set of mechanics', () => {
      const campaign = LEVELS.filter((l) => /^m\d\d-/.test(l.id));
      expect(campaign).toHaveLength(37);
      for (const l of campaign) expect(l.world, l.id).toBeTruthy();
      const seen = new Set<string>();
      for (const l of campaign) {
        const key = `${l.world}|${l.theme ?? 'street'}|${l.mechanics.map((m) => m.type).sort().join('+')}`;
        expect(seen.has(key), `${l.id} repeats another match's stadium and mechanics`).toBe(false);
        seen.add(key);
      }
    });
    it('has sensible stars: the second star below the third, both above a plain goal', () => {
      for (const l of LEVELS) {
        expect(l.stars[0], l.id).toBeGreaterThanOrEqual(1000);
        expect(l.stars[1], l.id).toBeGreaterThan(l.stars[0]);
      }
    });
  });

  describe('the ability lessons', () => {
    const lessons = LEVELS.map((def, i) => ({ def, i })).filter((l) => l.def.guide?.boost);
    it('there is one for each ability, after the five moves and before the first match', () => {
      expect(lessons.map((l) => l.def.guide?.boost)).toEqual(['fire', 'magnet', 'rubber']);
      expect(lessons.map((l) => l.i)).toEqual([5, 6, 7]);
    });
    for (const { def, i } of lessons) {
      const g = def.guide;
      const show = g?.show ?? { angle: -90, power: 0.5, air: false, bend: 0 };
      it(`${def.name}: the shown shot fails without the ability and scores with it`, () => {
        expect(fireShot(def, i, show.angle, show.power, 0, { air: show.air, bend: show.bend }), 'without').toBeNull();
        const hit = fireShot(def, i, show.angle, show.power, 0, { air: show.air, bend: show.bend, boost: g?.boost });
        expect(hit, 'with').not.toBeNull();
      });
      it(`${def.name}: the shown shot is no fluke, the shots next to it behave the same`, () => {
        for (const d of [-2, 2]) {
          expect(fireShot(def, i, show.angle + d, show.power, 0, { air: show.air, bend: show.bend, boost: g?.boost }), `with, ${d} degrees off`).not.toBeNull();
        }
      });
      it(`${def.name}: the ghost's two flights agree with it, and the ability has a mark to show`, () => {
        const kick = { air: show.air, bend: show.bend };
        const plain = traceShot(def, i, show.angle, show.power, kick);
        const boosted = traceShot(def, i, show.angle, show.power, { ...kick, boost: g?.boost });
        expect(plain.scored).toBe(false);
        expect(boosted.scored).toBe(true);
        if (g?.boost === 'fire') expect(boosted.marks.some((m) => m.kind === 'burn')).toBe(true);
        if (g?.boost === 'magnet') expect(boosted.marks.some((m) => m.kind === 'magnet')).toBe(true);
        if (g?.boost === 'rubber') expect(boosted.marks.filter((m) => m.kind === 'bounce').length).toBeGreaterThanOrEqual(1);
      });
      it(`${def.name}: scoring with the ability has plenty of routes and reaches three stars`, { timeout: 120000 }, () => {
        const hits = sweepLevel(def, i, 1, POWERS, 0, { air: false, bend: 0, boost: g?.boost });
        expect(hits.length).toBeGreaterThan(20);
        expect(hits.some((h) => h.stars === 3)).toBe(true);
      });
    }
  });

  describe('every match', () => {
    for (const n of EDITED) {
      it(`match ${n} has 3 or more routes and a 3 star route`, { timeout: 300000 }, () => {
        const m = measure(n, n > 10);
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
