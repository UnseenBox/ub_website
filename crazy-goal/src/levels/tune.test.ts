import { writeFileSync } from 'node:fs';
import { it } from 'vitest';
import { LEVELS } from '../../data/levels/matches';
import { countRoutes, sweepLevel, type Kick } from './sweep';

/** TUNE=m30-night-watch,m36-league-night npx vitest run src/levels/tune.test.ts : prints how many shots score. */
it.skipIf(!process.env.TUNE)('tune', { timeout: 3600000 }, () => {
  const ids = (process.env.TUNE ?? '').split(',').filter(Boolean);
  const kicks: Kick[] = [{ air: false, bend: 0 }, { air: false, bend: -1 }, { air: false, bend: 1 }, { air: true, bend: 0 }];
  const powers = [0.1, 0.2, 0.3, 0.45, 0.6, 0.8, 1];
  const out: string[] = [];
  for (const id of ids) {
    const i = LEVELS.findIndex((l) => l.id === id);
    const def = LEVELS[i];
    // TUNE_DELAYS=0,0.7,1.4 averages over the moment of the shot (spinners, scooters, the cat).
    const delays = (process.env.TUNE_DELAYS ?? '0').split(',').map(Number);
    const hits = delays.flatMap((d) => kicks.flatMap((k) => sweepLevel(def, i, 1, powers, d, k)));
    const t = hits.map((h) => h.total).sort((a, b) => a - b);
    const q = (p: number): number => t[Math.min(t.length - 1, Math.floor(t.length * p))] ?? 0;
    out.push(`${id}: hits/delay ${Math.round(hits.length / delays.length)} hits ${hits.length} routes ${countRoutes(hits)} ground ${hits.filter((h) => !h.air && h.bend === 0).length} bend ${hits.filter((h) => !h.air && h.bend !== 0).length} air ${hits.filter((h) => h.air).length} p35 ${q(0.35)} p75 ${q(0.75)} max ${t[t.length - 1] ?? 0}`);
  }
  writeFileSync('node_modules/.cache/tune.txt', out.join('\n'));
});
