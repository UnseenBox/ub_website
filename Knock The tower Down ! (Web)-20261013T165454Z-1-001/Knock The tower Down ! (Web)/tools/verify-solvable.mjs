// Headless playability check. Runs the real game pipeline (fire -> settle ->
// resolve) against every campaign level and tries to clear it within the
// level's own shot budget using a greedy shot chooser (tools/greedy-play.mjs).
//
// This is not a proof of solvability — it verifies that a reasonable,
// angle-by-angle plan can finish each level inside the shots the level
// actually gives the player. A level that only falls to a pixel-perfect
// trick shot will fail here and be tuned.
//
//   node tools/verify-solvable.mjs          # all levels
//   node tools/verify-solvable.mjs 9 13     # levels 9..13
import { LEVELS } from '../src/levels.js';
import { greedyPlan, confirm } from './greedy-play.mjs';

const onlyFrom = process.argv[2] ? parseInt(process.argv[2], 10) : null;
const onlyTo = process.argv[3] ? parseInt(process.argv[3], 10) : onlyFrom;
let fails = 0;
console.log('level                shots used   result    cores   smashed  replay wins  verdict');
console.log('-'.repeat(84));
LEVELS.forEach((def, i) => {
  if (onlyFrom !== null && (i + 1 < onlyFrom || i + 1 > onlyTo)) return;
  const start = (g) => g.startPlay(i);
  const { chosen, trace } = greedyPlan(start, def.shots.length);
  const { wins, replays, game } = confirm(start, chosen);
  const s = game.state;
  const ok = wins > 0;
  if (!ok) fails++;
  console.log(
    `${String(i + 1).padStart(2)} ${def.name.padEnd(17)} ${s.shotsUsed}/${def.shots.length}          ` +
    `${(s.result || '-').padEnd(9)} ${String(s.targetsDown).padStart(3)}/${def.targets.length}    ` +
    `${String(s.destroyedCount).padStart(5)}        ${wins}/${replays}       ${ok ? 'CLEARED' : 'NOT CLEARED'}`
  );
  console.log(`${' '.repeat(22)}plan: ${trace.join('  ')}`);
});
console.log(fails ? `\n${fails} level(s) not cleared by the greedy plan.` : '\nEvery level clears inside its shot budget.');
