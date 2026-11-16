/**
 * Headless balance test for the prospecting upgrades and the store's skills (Skills tab).
 *
 * It plays whole working days the way dev/econ-sim.ts does (dig one shaft, cut rocks in batches, relocate at
 * bedrock) with the REAL game logic: TraitSystem for the skills, ExcavationSystem for the holes, the live
 * upgrade formulas and the live prices. The measure is money from rocks per working day over a fixed number
 * of days. More money per day = more useful = should cost more.
 *
 * Run (no extra dependencies, esbuild ships with vite):
 *   npx esbuild dev/skills-sim.ts --bundle --platform=node --format=cjs --outfile=%TEMP%/skills-sim.cjs && node %TEMP%/skills-sim.cjs
 *
 * Options (environment): TOOL (default tool-pickaxe), DAYS (default 12), SEEDS (default 40), SKILL (default 0.65).
 */
import { GAME_CONFIG } from '../src/config/GameConfig';
import { LAYERS } from '../src/data/layers';
import { TOOL_DEFS } from '../src/data/tools';
import { ALL_UPGRADES, upgradePrice, type UpgradeItem } from '../src/data/store';
import { PROSPECT_EFFECTS, TRAIT_EFFECTS } from '../src/data/traits';
import { hardnessMult, relocationBonus, valueMult } from '../src/data/deposits';
import { mulberry32 } from '../src/core/Random';
import type { Rock } from '../src/core/types';
import { DiscoverySystem } from '../src/systems/DiscoverySystem';
import { ExcavationSystem } from '../src/systems/ExcavationSystem';
import { generateRock, upgradeRock } from '../src/systems/RockGenerator';
import { StaminaSystem } from '../src/systems/StaminaSystem';
import { staminaUpgrades, toolWithUpgrades } from '../src/systems/ToolStats';
import { TraitSystem } from '../src/systems/TraitSystem';

const DAY_MS = (GAME_CONFIG.clock.endHour - GAME_CONFIG.clock.startHour) * GAME_CONFIG.clock.secondsPerHour * 1000;
/** Real time at the workshop per rock (place, saw, reveal, sell) and the walk there and back (same as econ-sim). */
const CUT_MS = 6500;
const TRIP_MS = 2500;
const X = 600;

const num = (name: string, fallback: number): number => Number(process.env[name] ?? fallback);

export interface DayResult {
  income: number;
  rocks: number;
  /** Deposits finished plus the part of the current one dug, per day: how fast the shaft goes down. */
  depth: number;
}

/** Plays `days` working days with the given upgrade and skill levels. Returns the average per day. */
export function play(toolId: string, levels: Record<string, number>, days: number, seed: number, skill: number): DayResult {
  const rng = mulberry32(seed);
  const lv = (id: string): number => levels[id] ?? 0;
  const traits = new TraitSystem(lv, rng);
  const stamina = new StaminaSystem(GAME_CONFIG.stamina);
  const su = staminaUpgrades(lv);
  stamina.setUpgrades(su.maxBonus, su.regenBonus, su.costMult);
  const dig = new ExcavationSystem(GAME_CONFIG.world, LAYERS, () => {});
  const discovery = new DiscoverySystem();
  discovery.findBonus = lv('up-find-chance') * PROSPECT_EFFECTS.findChancePerLevel;
  const capacity = GAME_CONFIG.inventory.slots + lv('up-bag') * PROSPECT_EFFECTS.bagSlotsPerLevel;
  // The bot walks to the workshop when one slot is left (the econ simulation uses 4 of 5).
  const trigger = capacity - 1;

  let deposit = 1;
  let income = 0;
  let rocks = 0;
  let now = 0;
  const bag: Rock[] = [];
  let embedded: Array<{ rock: Rock; hits: number }> = [];

  const cutAll = (): void => {
    for (const rock of bag) {
      if (traits.rollLuckyCut(rock)) upgradeRock(rock, rng);
      income += Math.round(rock.value * traits.sellMult);
      if (rock.value <= 0) traits.onWorthlessThrown();
    }
    bag.length = 0;
  };

  for (let day = 1; day <= days; day++) {
    stamina.reset();
    let t = 0;
    while (t < DAY_MS * skill) {
      if (bag.length >= trigger) {
        t += TRIP_MS + bag.length * CUT_MS;
        cutAll();
        continue;
      }
      const tool = toolWithUpgrades(TOOL_DEFS[toolId], lv, deposit);
      const layerIdx = dig.layerIndexAtY(dig.floorAt(X) + 1);
      const layer = LAYERS[layerIdx];
      if (dig.atBottom) {
        deposit++;
        dig.reset();
        dig.hardnessMult = hardnessMult(deposit);
        embedded = [];
        t += 4000;
        continue;
      }
      now = day * 1e7 + t;
      const cost = tool.staminaMult * layer.staminaMult * traits.staminaMult(now);
      let paid = stamina.trySpend(cost);
      if (!paid) {
        const wind = traits.trySecondWind(day);
        if (wind > 0) {
          stamina.restore(stamina.max * wind);
          paid = stamina.trySpend(cost);
        }
      }
      if (!paid) {
        stamina.update(100);
        t += 100;
        continue;
      }
      const roll = traits.rollSwing(X, now);
      const boost = roll.depth !== 1 || roll.width !== 1 ? roll : undefined;
      const res = dig.dig(X, tool, boost);
      const cooldown = tool.swingCooldownMs * (1 + 0.5 * layer.feel.clang) * traits.cooldownMult(now);
      stamina.update(cooldown);
      t += cooldown;

      const swingAt = (r: typeof res): void => {
        if (embedded.length > 0) {
          const target = embedded[0];
          target.hits = traits.rollInstantCrack() ? 0 : target.hits - 1;
          if (target.hits <= 0) {
            embedded.shift();
            const rock = target.rock;
            if (traits.rollHotRock(rock)) {
              // A hot rock blasts a big hole and never reaches the bag.
              dig.dig(X, tool, { depth: TRAIT_EFFECTS.hotRock.depthMult, width: TRAIT_EFFECTS.hotRock.widthMult });
              rocks++;
            } else {
              bag.push(rock);
              rocks++;
            }
          }
        } else if (r.dug && discovery.roll(r.layer, rng)) {
          const value = (r.layer.discovery.valueMult ?? 1) * valueMult(deposit);
          const { min, max } = r.layer.discovery.freeHits;
          const make = (): { rock: Rock; hits: number } => ({
            rock: generateRock(rng, r.layer.discovery.rarityWeights, value, r.layerIndex),
            hits: min + Math.floor(rng() * (max - min + 1)),
          });
          embedded.push(make());
          if (traits.rollDoubleFind()) embedded.push(make());
        }
      };
      swingAt(res);
      if (roll.afterimage) {
        // The ghost swing digs again at the same spot for free (and can hit or find like any swing).
        const echo = dig.dig(X, tool);
        swingAt(echo);
      }
      if (roll.shots > 0) {
        const step = res.floorAfter - res.floorBefore;
        for (let i = 0; i < roll.shots; i++) {
          const offset = (rng() * 2 - 1) * TRAIT_EFFECTS.scrapShot.spread * tool.craterRadius;
          dig.miniHole(X, offset, step * TRAIT_EFFECTS.scrapShot.depthSteps, tool.craterRadius * TRAIT_EFFECTS.scrapShot.widthMult);
        }
      }
    }
    // The day ends: everything left in the bag is cut and sold.
    cutAll();
    income += relocationBonus(1) * 0; // cash bonuses are not rock income
  }
  return { income: income / days, rocks: rocks / days, depth: (deposit - 1 + dig.progress) / days };
}

function average(toolId: string, levels: Record<string, number>, days: number, seeds: number, skill: number): DayResult {
  let income = 0;
  let rocks = 0;
  let depth = 0;
  for (let i = 0; i < seeds; i++) {
    const r = play(toolId, levels, days, (i + 1) * 7919, skill);
    income += r.income;
    rocks += r.rocks;
    depth += r.depth;
  }
  return { income: income / seeds, rocks: rocks / seeds, depth: depth / seeds };
}

/** Levels of the older upgrades at about 30% of their maximum: a mid-game player. */
function midGame(): Record<string, number> {
  const levels: Record<string, number> = {};
  for (const id of ['up-stamina-tank', 'up-stamina-regen', 'up-stamina-efficiency', 'up-dig-damage', 'up-dig-speed']) {
    const item = ALL_UPGRADES.find((u) => u.id === id);
    if (item) levels[id] = Math.round(item.maxLevel * 0.3);
  }
  return levels;
}

const money = (n: number): string => (n >= 1e9 ? `${(n / 1e9).toFixed(1)}B` : n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : n.toLocaleString('en-US'));

export function cumulativeCost(up: UpgradeItem, levels = up.maxLevel): number {
  let total = 0;
  for (let level = 0; level < levels; level++) total += upgradePrice(up, level);
  return total;
}

if (typeof process !== 'undefined') {
  const toolId = process.env.TOOL ?? 'tool-pickaxe';
  const days = num('DAYS', 12);
  const seeds = num('SEEDS', 40);
  const skill = num('SKILL', 0.65);
  const base = average(toolId, midGame(), days, seeds, skill);
  console.log(`Tool ${toolId}, mid-game base upgrades, ${days} days x ${seeds} seeds, play skill ${skill}.`);
  console.log(`Baseline: ${Math.round(base.income)} money per day, ${base.rocks.toFixed(1)} rocks per day, ${(base.depth * days).toFixed(2)} deposits dug in total.`);
  console.log('');
  console.log('upgrade / skill       lv   money/day   money gain   depth gain   cost level 1   cost to max   $ per 1% of best gain');
  const ids = ALL_UPGRADES.filter((u) => u.id.startsWith('up-find') || u.id.startsWith('up-instant') || u.id.startsWith('up-bag') || u.id.startsWith('up-double') || u.id.startsWith('up-lucky') || u.id.startsWith('trait-'));
  const rows: Array<{ id: string; gain: number; cost: number }> = [];
  void rows;
  for (const up of ids) {
    const lvls = { ...midGame(), [up.id]: up.maxLevel };
    const r = average(toolId, lvls, days, seeds, skill);
    const moneyGain = (r.income / base.income - 1) * 100;
    const depthGain = (r.depth / base.depth - 1) * 100;
    const gain = Math.max(moneyGain, depthGain);
    const cost = cumulativeCost(up);
    rows.push({ id: up.id, gain, cost });
    console.log(
      `${up.id.padEnd(22)}${String(up.maxLevel).padStart(3)}${String(Math.round(r.income)).padStart(12)}${(moneyGain.toFixed(1) + '%').padStart(13)}${(depthGain.toFixed(1) + '%').padStart(13)}${('$' + upgradePrice(up, 0).toLocaleString('en-US')).padStart(15)}${money(cost).padStart(14)}${(gain > 1 ? Math.round(cost / gain).toLocaleString('en-US') : '-').padStart(22)}`,
    );
  }
  console.log('');
  console.log('Order by gain (best first):   ' + [...rows].sort((a, b) => b.gain - a.gain).map((r) => `${r.id} ${r.gain.toFixed(0)}%`).join('  >  '));
  console.log('Order by cost (dearest first): ' + [...rows].sort((a, b) => b.cost - a.cost).map((r) => `${r.id} ${money(r.cost)}`).join('  >  '));
}
