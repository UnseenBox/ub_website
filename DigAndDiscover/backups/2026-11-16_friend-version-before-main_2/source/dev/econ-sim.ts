/**
 * Headless economy simulation: how much money does a reasonable player make from rocks per working day?
 * Used to balance household expenses and debt installments (src/data/economy.ts).
 *
 * Run (no extra dependencies, esbuild ships with vite):
 *   npx esbuild dev/econ-sim.ts --bundle --platform=node --format=cjs --outfile=%TEMP%/econ-sim.cjs && node %TEMP%/econ-sim.cjs
 *
 * The simulated player digs one shaft, cuts rocks in batches, and every evening buys the best tool and
 * the cheapest useful upgrade it can afford (respecting prospector level). It is a model, not a measurement.
 */
import { GAME_CONFIG } from '../src/config/GameConfig';
import { LAYERS } from '../src/data/layers';
import { TOOL_DEFS, UPGRADE_EFFECTS, type ToolDef } from '../src/data/tools';
import { ALL_TOOLS, ALL_UPGRADES, upgradePrice } from '../src/data/store';
import { ExcavationSystem } from '../src/systems/ExcavationSystem';
import { DiscoverySystem } from '../src/systems/DiscoverySystem';
import { StaminaSystem } from '../src/systems/StaminaSystem';
import { generateRock } from '../src/systems/RockGenerator';
import { xpToNext, ROCK_XP } from '../src/systems/ProgressSystem';
import { hardnessMult, valueMult, powerMult, relocationBonus } from '../src/data/deposits';
import { mulberry32 } from '../src/core/Random';
import type { Rock } from '../src/core/types';

const DAY_MS = (GAME_CONFIG.clock.endHour - GAME_CONFIG.clock.startHour) * GAME_CONFIG.clock.secondsPerHour * 1000;
/** Real time a player needs per rock at the workshop (place, saw, reveal, sell) and to walk there and back. */
const CUT_MS = 6500;
const TRIP_MS = 2500;
const BAG_TRIGGER = 4;
/** A human digs, aims, scrolls and cuts less efficiently than this bot. 1 = perfect bot, 0.65 = a decent player. */
const skill = (): number => Number(process.env.SKILL ?? 0.65);

/** Finance model used by the simulation (keep in sync with src/data/economy.ts). */
export const FIN = {
  monthDays: 30,
  expensePerDay: (m: number): number => Math.round(Number(process.env.EXP ?? 45) * Math.pow(Number(process.env.EXPG ?? 1.25), m)),
  installment: (m: number): number => Math.round(Number(process.env.INST ?? 1200) * Math.pow(Number(process.env.INSTG ?? 1.6), m)),
  interval: 7,
};

interface DayLog {
  day: number;
  income: number;
  rocks: number;
  worthless: number;
  layer: number;
  tool: string;
  level: number;
  money: number;
  deposit: number;
  bonus: number;
  dead: boolean;
  month: number;
}

function levelOf(xp: number): number {
  let level = 1;
  let rest = xp;
  while (rest >= xpToNext(level)) {
    rest -= xpToNext(level);
    level++;
  }
  return level;
}

export function simulate(days: number, seed: number): DayLog[] {
  const rng = mulberry32(seed);
  let xp = 0;
  let money = 0;
  let deposit = 1;
  let overdue = 0;
  let bills = 0;
  let dead = false;
  const owned = new Set<string>(['tool-old-shovel']);
  const ups: Record<string, number> = {};
  const dig = new ExcavationSystem(GAME_CONFIG.world, LAYERS, (index) => {
    if (index > 0) xp += 25 * index;
  });
  const discovery = new DiscoverySystem();
  const stamina = new StaminaSystem(GAME_CONFIG.stamina);
  const logs: DayLog[] = [];
  const X = 600;

  const bestToolId = (): string => {
    let best = 'tool-old-shovel';
    for (const id of owned) if (TOOL_DEFS[id] && TOOL_DEFS[id].power > TOOL_DEFS[best].power) best = id;
    return best;
  };
  const scanners = (): number => (owned.has('tool-deep-scanner') ? 0.5 : 0) + (owned.has('tool-scanner') ? 0.25 : 0);
  const tool = (): ToolDef => {
    const base = TOOL_DEFS[bestToolId()];
    return {
      ...base,
      power: base.power * powerMult(deposit),
      digDepth: base.digDepth * (1 + UPGRADE_EFFECTS.digDepthPerLevel * (ups['up-dig-damage'] ?? 0)),
      swingCooldownMs: base.swingCooldownMs * (1 - UPGRADE_EFFECTS.cooldownReductionPerLevel * (ups['up-dig-speed'] ?? 0)),
    };
  };
  const applyUpgrades = (): void => {
    stamina.setUpgrades(
      (ups['up-stamina-tank'] ?? 0) * UPGRADE_EFFECTS.staminaPerLevel,
      (ups['up-stamina-regen'] ?? 0) * UPGRADE_EFFECTS.regenPerLevel,
      1 - (ups['up-stamina-efficiency'] ?? 0) * UPGRADE_EFFECTS.costReductionPerLevel,
    );
    discovery.findBonus = scanners();
  };

  for (let day = 1; day <= days && !dead; day++) {
    const month = Math.floor((day - 1) / FIN.monthDays);
    const dayInMonth = ((day - 1) % FIN.monthDays) + 1;
    stamina.reset();
    applyUpgrades();
    let t = 0;
    let income = 0;
    let found = 0;
    let worthless = 0;
    let bonus = 0;
    const bag: Rock[] = [];
    let embedded: { rock: Rock; hits: number } | null = null;

    const cutAll = (): void => {
      for (const r of bag) {
        income += r.value;
        if (r.value === 0) worthless++;
        xp += ROCK_XP[r.rarity.tier] ?? 3;
        xp += 0; // goals are ignored; add a flat 30% later
      }
      bag.length = 0;
    };

    while (t < DAY_MS * skill()) {
      if (bag.length >= BAG_TRIGGER) {
        t += TRIP_MS + bag.length * CUT_MS;
        cutAll();
        continue;
      }
      const tl = tool();
      const layerIdx = dig.layerIndexAtY(dig.floorAt(X) + 1);
      const layer = LAYERS[layerIdx];
      if (dig.atBottom) {
        // Bedrock: relocate to a fresh, harder and richer deposit (cash bonus is not rock income).
        bonus += relocationBonus(deposit);
        deposit++;
        dig.reset();
        dig.hardnessMult = hardnessMult(deposit);
        embedded = null;
        t += 4000;
        continue;
      }
      if (!stamina.trySpend(layer.staminaMult * tl.staminaMult)) {
        const wait = 100;
        stamina.update(wait);
        t += wait;
        continue;
      }
      dig.dig(X, tl);
      stamina.update(tl.swingCooldownMs);
      t += tl.swingCooldownMs;
      if (embedded) {
        embedded.hits--;
        if (embedded.hits <= 0 && bag.length < GAME_CONFIG.inventory.slots) {
          bag.push(embedded.rock);
          embedded = null;
        }
      } else if (discovery.roll(layer, rng)) {
        const rock = generateRock(rng, layer.discovery.rarityWeights, (layer.discovery.valueMult ?? 1) * valueMult(deposit), layerIdx);
        found++;
        const { min, max } = layer.discovery.freeHits;
        embedded = { rock, hits: min + Math.floor(rng() * (max - min + 1)) };
      }
    }
    // The day ends: everything left in the bag is cut (the real game forces it after 5 PM).
    cutAll();
    xp = Math.round(xp * 1); // keep integer
    money += income + bonus;
    // Evening: household expenses first (shortfall carries over), then any instalment that became due.
    const due = FIN.expensePerDay(month) + bills;
    const paid = Math.min(money, due);
    money -= paid;
    bills = due - paid;
    if (dayInMonth % FIN.interval === 0) overdue += FIN.installment(month);
    const payNow = Math.min(money, overdue);
    money -= payNow;
    overdue -= payNow;
    if (dayInMonth === FIN.monthDays && overdue > 0) dead = true;
    // Keep the next instalment in reserve when it is about to fall due.
    const daysToDue = FIN.interval - (dayInMonth % FIN.interval);
    const reserve = overdue + (daysToDue <= 3 ? FIN.installment(month) : 0);

    // Evening shopping: best affordable tool by level, then the cheapest useful upgrade.
    const level = levelOf(Math.round(xp * 1.3));
    for (let pass = 0; pass < 6; pass++) {
      const current = TOOL_DEFS[bestToolId()].power;
      const next = ALL_TOOLS
        .filter((t) => !t.placeholder && !owned.has(t.id) && level >= t.minLevel && (t.kind === 'scanner' || (TOOL_DEFS[t.id] && TOOL_DEFS[t.id].power > current)))
        .sort((a, b) => a.price - b.price)[0];
      if (next && money - reserve >= next.price) {
        money -= next.price;
        owned.add(next.id);
        continue;
      }
      const up = ALL_UPGRADES
        .filter((u) => u.id !== 'up-mastery' && (ups[u.id] ?? 0) < u.maxLevel)
        .map((u) => ({ u, price: upgradePrice(u, ups[u.id] ?? 0) }))
        .sort((a, b) => a.price - b.price)[0];
      if (up && money - reserve >= up.price && (!next || money - up.price >= next.price * 0.5 || up.price < money * 0.4)) {
        money -= up.price;
        ups[up.u.id] = (ups[up.u.id] ?? 0) + 1;
        continue;
      }
      break;
    }
    logs.push({ day, income, rocks: found, worthless, layer: dig.deepestLayerIndex + 1, tool: bestToolId().replace('tool-', ''), level, money: Math.round(money), deposit, bonus, dead, month });
  }
  return logs;
}

function avg(nums: number[]): number {
  return nums.reduce((a, b) => a + b, 0) / Math.max(1, nums.length);
}

if (typeof process !== 'undefined') {
  const days = Number(process.env.DAYS ?? 120);
  const seeds = 12;
  console.log('Finance check: share of simulated players still alive at the end of each month, by play skill (1 = perfect bot).');
  console.log('skill   m1    m2    m3    m4    | avg income/day (m1, m2, m3, m4)');
  for (const skill of (process.env.SKILLS ?? "0.35,0.5,0.65,0.9").split(",").map(Number)) {
    process.env.SKILL = String(skill);
    const runs = Array.from({ length: seeds }, (_, i) => simulate(days, (i + 1) * 7919));
    const alive = (m: number): string => {
      const n = runs.filter((r) => !(r.some((d) => d.dead && d.month <= m))).length;
      return String(Math.round((100 * n) / seeds)).padStart(3) + '%';
    };
    const inc = (m: number): string => {
      const v = runs.flatMap((r) => r.filter((d) => d.month === m).map((d) => d.income));
      return String(Math.round(avg(v))).padStart(6);
    };
    console.log(`${skill.toFixed(2)}  ${alive(0)}  ${alive(1)}  ${alive(2)}  ${alive(3)}    | ${inc(0)} ${inc(1)} ${inc(2)} ${inc(3)}`);
  }
}
