import { writeFileSync } from 'node:fs';
import { it } from 'vitest';
import { LEVELS } from '../../data/levels/matches';
import { sweepLevel, type Kick } from './sweep';

/** Sweeps every campaign level and writes where the star thresholds should sit (opt in: `STARS=1 npx vitest run src/levels/stars.test.ts`, about ten minutes; the numbers land in node_modules/.cache/stars.json). */
it.skipIf(!process.env.STARS)('stars', { timeout: 3600000 }, () => {
  const kicks: Kick[] = [{ air: false, bend: 0 }, { air: false, bend: -1 }, { air: false, bend: 1 }, { air: true, bend: 0 }];
  const powers = [0.1, 0.2, 0.3, 0.45, 0.6, 0.8, 1];
  const out: Record<string, { p35: number; p75: number; hits: number }> = {};
  LEVELS.forEach((def, i) => {
    if (!/^m\d\d-/.test(def.id)) return;
    let hits = kicks.flatMap((k) => sweepLevel(def, i, 1, powers, 0, k));
    // A mover may keep the first instant shut: wait for it.
    for (const d of [0.7, 1.4, 2.1]) if (hits.length < 5) hits = kicks.flatMap((k) => sweepLevel(def, i, 1, powers, d, k));
    const t = hits.map((h) => h.total).sort((a, b) => a - b);
    const q = (p: number): number => t[Math.min(t.length - 1, Math.floor(t.length * p))] ?? 0;
    out[def.id] = { p35: q(0.35), p75: q(0.75), hits: hits.length };
    writeFileSync('node_modules/.cache/stars.json', JSON.stringify(out));
  });
});
