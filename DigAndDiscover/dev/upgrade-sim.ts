/**
 * Headless balance test for digging tools and store upgrades. It uses the live game's own
 * formulas (src/systems/ToolStats.ts) and prices (src/data/store.ts), so it cannot drift from the game.
 *
 * Each run digs one shaft from the surface, day after day (stamina refills each morning), until bedrock.
 * The measure is in-game days to bedrock: fewer days means more useful.
 *
 * Run (no extra dependencies, esbuild ships with vite):
 *   npx esbuild dev/upgrade-sim.ts --bundle --platform=node --format=cjs --outfile=%TEMP%/upgrade-sim.cjs && node %TEMP%/upgrade-sim.cjs
 */
import { GAME_CONFIG } from '../src/config/GameConfig';
import { LAYERS } from '../src/data/layers';
import { TOOL_DEFS, UPGRADE_EFFECTS, type ToolDef } from '../src/data/tools';
import { ALL_TOOLS, ALL_UPGRADES, upgradePrice, type UpgradeItem } from '../src/data/store';
import { hardnessMult } from '../src/data/deposits';
import { ExcavationSystem } from '../src/systems/ExcavationSystem';
import { StaminaSystem } from '../src/systems/StaminaSystem';
import { staminaUpgrades, toolWithUpgrades } from '../src/systems/ToolStats';

/** Every digging tool, the starter first. */
export const DIG_TOOLS = [
  'tool-old-shovel',
  'tool-iron-shovel',
  'tool-steel-shovel',
  'tool-hand-axe',
  'tool-gold-shovel',
  'tool-pickaxe',
  'tool-jackhammer',
  'tool-diamond-shovel',
  'tool-drill',
];
const DAY_MS = (GAME_CONFIG.clock.endHour - GAME_CONFIG.clock.startHour) * GAME_CONFIG.clock.secondsPerHour * 1000;
const SHAFT_X = Math.round(GAME_CONFIG.world.width / 2);
const TICK_MS = 100;
const MAX_DAYS = 60;

/** Levels for every upgrade at `percent` of its own maximum (rounded to whole levels). */
export function levelsAtPercent(percent: number): Record<string, number> {
  const levels: Record<string, number> = {};
  for (const up of ALL_UPGRADES) levels[up.id] = Math.round(percent * up.maxLevel);
  return levels;
}

/** Digs from the surface until bedrock. Returns in-game days taken and swings made. */
export function daysToBedrock(toolId: string, levels: Record<string, number>): { days: number; swings: number; reached: boolean } {
  const lv = (id: string): number => levels[id] ?? 0;
  const tool: ToolDef = toolWithUpgrades(TOOL_DEFS[toolId], lv, 1);
  const stamina = new StaminaSystem(GAME_CONFIG.stamina);
  const st = staminaUpgrades(lv);
  stamina.setUpgrades(st.maxBonus, st.regenBonus, st.costMult);
  const dig = new ExcavationSystem(GAME_CONFIG.world, LAYERS, () => {});
  dig.hardnessMult = hardnessMult(1);

  let swings = 0;
  for (let day = 0; day < MAX_DAYS; day++) {
    stamina.refill();
    let t = 0;
    while (t < DAY_MS && !dig.atBottom) {
      const layer = dig.layerAt(SHAFT_X);
      if (!stamina.trySpend(tool.staminaMult * layer.staminaMult)) {
        stamina.update(TICK_MS);
        t += TICK_MS;
        continue;
      }
      const res = dig.dig(SHAFT_X, tool);
      // Hard ground makes each swing slower, exactly as DigScene does.
      const cooldown = tool.swingCooldownMs * (1 + 0.5 * layer.feel.clang);
      stamina.update(cooldown);
      t += cooldown;
      if (res.dug) swings++;
    }
    if (dig.atBottom) return { days: day + t / DAY_MS, swings, reached: true };
  }
  return { days: MAX_DAYS, swings, reached: false };
}

const fmtDays = (r: { days: number; reached: boolean }): string => (r.reached ? r.days.toFixed(2) : `>${MAX_DAYS}`).padStart(8);

/** Cumulative cost of buying every level of one upgrade, from the live price formula. */
export function cumulativeCost(up: UpgradeItem): number {
  let total = 0;
  for (let level = 0; level < up.maxLevel; level++) total += upgradePrice(up, level);
  return total;
}

const money = (n: number): string => (n >= 1e9 ? `${(n / 1e9).toFixed(1)}B` : n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n.toLocaleString('en-US'));

/** Current prices, read from the store so the report always matches the live game. */
const ALL_TOOLS_PRICE: Record<string, number> = Object.fromEntries(ALL_TOOLS.map((t) => [t.id, t.price]));

// ---- 1. Tools, no upgrades and half upgrades ----
console.log(`One working day = ${(DAY_MS / 1000).toFixed(0)} real seconds. Shaft at x=${SHAFT_X}.`);
console.log('');
console.log('TOOL USEFULNESS (in-game days to bedrock)');
console.log('tool                                    0% upgrades   50% upgrades   price');
for (const id of DIG_TOOLS) {
  const none = daysToBedrock(id, levelsAtPercent(0));
  const half = daysToBedrock(id, levelsAtPercent(0.5));
  const price = (ALL_TOOLS_PRICE[id] ?? 0).toLocaleString('en-US');
  console.log(`${id.padEnd(40)}${fmtDays(none)}${fmtDays(half).padStart(15)}${price.padStart(10)}`);
}

// ---- 2. Upgrades, one at a time at max, on a mid-game tool ----
const REFERENCE_TOOL = 'tool-pickaxe';
const base = daysToBedrock(REFERENCE_TOOL, levelsAtPercent(0));
console.log('');
console.log(`UPGRADE VALUE (alone, at max level, on ${REFERENCE_TOOL}; base ${base.days.toFixed(2)} days)`);
console.log('upgrade                  max    days saved   price per level (base)   cost to max');
for (const up of ALL_UPGRADES) {
  const only: Record<string, number> = {};
  only[up.id] = up.maxLevel;
  const r = daysToBedrock(REFERENCE_TOOL, only);
  const saved = r.reached ? `${Math.round((1 - r.days / base.days) * 100)}%` : '-';
  console.log(
    `${up.id.padEnd(25)}${String(up.maxLevel).padStart(3)}${saved.padStart(12)}${('$' + upgradePrice(up, 0).toLocaleString('en-US')).padStart(18)}${money(cumulativeCost(up)).padStart(18)}`,
  );
}

// ---- 3. Everything together ----
console.log('');
console.log('ALL UPGRADES TOGETHER (days to bedrock)');
const percents = [0, 0.1, 0.2, 0.3, 0.5, 0.7, 1];
console.log('tool                                    ' + percents.map((p) => `${Math.round(p * 100)}%`.padStart(7)).join(''));
for (const id of DIG_TOOLS) {
  console.log(id.padEnd(40) + percents.map((p) => daysToBedrock(id, levelsAtPercent(p))).map((r) => (r.reached ? r.days.toFixed(2) : '>60').padStart(7)).join(''));
}

