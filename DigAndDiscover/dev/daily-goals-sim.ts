/**
 * Headless check of the daily goals (retention update).
 * Run (esbuild ships with vite):
 *   npx esbuild dev/daily-goals-sim.ts --bundle --platform=node --format=cjs --define:import.meta.env='{"MODE":"crazygames-basic"}' --outfile=%TEMP%/dg-sim.cjs
 *   node %TEMP%/dg-sim.cjs
 */
import {
  dailyGoalText,
  expectedDailyIncome,
  generateDailyGoals,
  maxRockValue,
  reachLayer,
  reachMeters,
  type DailyStrength,
} from '../src/data/dailyGoals';

let failures = 0;
function check(name: string, ok: boolean, detail = ''): void {
  if (!ok) failures++;
  if (!ok) console.log('FAIL ' + name + (detail ? ' -> ' + detail : ''));
}

/** Player strengths: prospector level, tool power (see src/data/tools.ts). */
const STRENGTHS: Array<{ name: string; level: number; power: number }> = [
  { name: 'new (Old Shovel)', level: 1, power: 1 },
  { name: 'level 5 (Golden Shovel)', level: 5, power: 6 },
  { name: 'level 10 (Diamond Shovel)', level: 10, power: 11 },
  { name: 'level 20 (Power Drill)', level: 20, power: 15 },
  { name: 'level 30 (Power Drill)', level: 30, power: 15 },
];

let total = 0;
for (const s of STRENGTHS) {
  console.log('\n== ' + s.name + ': expected income per day $' + expectedDailyIncome(s.level));
  let previous = '';
  let bestDepth = 0;
  for (let day = 1; day <= 120; day++) {
    const strength: DailyStrength = { level: s.level, toolPower: s.power, toolId: 'x', day, bestDepth };
    const set = generateDailyGoals(day, strength, previous);
    const income = expectedDailyIncome(s.level);
    check('three goals ' + s.name + ' day ' + day, set.goals.length === 3);
    check('different trio than yesterday ' + s.name + ' day ' + day, set.signature !== previous || day === 1);
    for (const g of set.goals) {
      total++;
      check('target >= 1 (' + g.metric + ')', g.target >= 1);
      const share = g.cash / income;
      check('reward between 1% and 12% of a day (' + g.tier + ' ' + g.metric + ' day ' + day + ' ' + s.name + ')', share >= 0.01 && share <= 0.12, (share * 100).toFixed(1) + '%');
      if (g.metric === 'depth') check('depth target within reach', g.target <= Math.floor(reachMeters(s.power)), g.target + ' vs ' + reachMeters(s.power));
      if (g.metric === 'sale') check('sale target within the best rock of the layer', g.target <= Math.max(5, maxRockValue(reachLayer(s.power))), String(g.target));
    }
    const bonusShare = set.bonus / income;
    check('bonus between 1% and 12% of a day', bonusShare >= 0.01 && bonusShare <= 0.12, (bonusShare * 100).toFixed(1) + '%');
    if (day <= 4) console.log('day ' + day + ': ' + set.goals.map((g) => g.tier + ' "' + dailyGoalText(g) + '" $' + g.cash).join(' | ') + ' | bonus $' + set.bonus);
    previous = set.signature;
    bestDepth = Math.min(reachMeters(s.power), bestDepth + 2); // the player digs a little deeper over time
  }
}

console.log('\n' + total + ' goals checked. ' + (failures === 0 ? 'ALL PASSED' : failures + ' FAILED'));
process.exit(failures === 0 ? 0 : 1);
