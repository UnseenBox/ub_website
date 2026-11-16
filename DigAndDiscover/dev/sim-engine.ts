/**
 * The simulation engine behind dev/stack-sim.ts: plays whole working days with the REAL game logic
 * (TraitSystem, ExcavationSystem, DiscoverySystem, the live formulas and prices) and reports what happened
 * each day. It is the same loop as dev/skills-sim.ts, extended for the stacking investigation:
 *
 *  - per-day statistics (income split into raw value, Master Cutter and Haggler gains, rocks found and cut,
 *    depth, activation counts, how big a swing gets);
 *  - the player (tool and upgrade levels) can change in the evening, so a purchase "walk" over 120+ days works;
 *  - a StackModel decides how the dig boosts (Big Hole, Angry Shoveler, After Image) combine on one swing and
 *    can override their trigger chances. The game's own TraitSystem and data files are NOT changed: the model
 *    is applied to the swing roll afterwards, and the chance overrides are put back after every run.
 *
 * Seeds are repeatable: run N uses seed (N + 1) * 7919, so two configurations compared on the same seed start
 * from the same random stream (common random numbers) and differences are not just luck.
 */
import { GAME_CONFIG } from '../src/config/GameConfig';
import { LAYERS } from '../src/data/layers';
import { TOOL_DEFS } from '../src/data/tools';
import { PROSPECT_EFFECTS, TRAIT_EFFECTS } from '../src/data/traits';
import { hardnessMult, relocationBonus, valueMult } from '../src/data/deposits';
import { mulberry32 } from '../src/core/Random';
import type { Rock } from '../src/core/types';
import { DiscoverySystem } from '../src/systems/DiscoverySystem';
import { ExcavationSystem } from '../src/systems/ExcavationSystem';
import { ROCK_XP, xpToNext } from '../src/systems/ProgressSystem';
import { generateRock, upgradeRock } from '../src/systems/RockGenerator';
import { StaminaSystem } from '../src/systems/StaminaSystem';
import { staminaUpgrades, toolWithUpgrades } from '../src/systems/ToolStats';
import { TraitSystem, type SwingRoll } from '../src/systems/TraitSystem';

export const DAY_MS = (GAME_CONFIG.clock.endHour - GAME_CONFIG.clock.startHour) * GAME_CONFIG.clock.secondsPerHour * 1000;
/** Real time at the workshop per rock (place, saw, reveal, sell) and the walk there and back (same as econ-sim). */
const CUT_MS = 6500;
const TRIP_MS = 2500;
const X = 600;

export type Levels = Record<string, number>;

/** How boosts that land on the same swing combine. */
export type Stacking =
  /** The live game: depth multipliers multiply, and the ghost swing is a full extra dig. */
  | 'free'
  /** Only the strongest boost applies to a swing (Big Hole, else After Image, else Angry's depth). */
  | 'strongest'
  /** Every boost applies, but the second counts half and the third a quarter (sorted by size). */
  | 'diminishing';

export interface StackModel {
  name: string;
  stacking: Stacking;
  /** Replacement chance per skill level. Skills left out keep the live value. */
  chance?: { angry?: number; afterimage?: number; bigHole?: number };
  /**
   * Any other number from src/data/traits.ts, by path: 'trait.haggler.perLevel', 'trait.secondWind.restoreBase',
   * 'prospect.luckyCutPerLevel' ... (only inside the simulation; the data files are not touched).
   */
  tweak?: Record<string, number>;
}

export const MODELS = {
  current: { name: 'Current', stacking: 'free' } as StackModel,
  reduced: { name: 'Reduced chances', stacking: 'free', chance: { angry: 0.04, afterimage: 0.035 } } as StackModel,
  strongest: { name: 'Controlled: strongest only', stacking: 'strongest' } as StackModel,
  diminishing: { name: 'Controlled: diminishing', stacking: 'diminishing' } as StackModel,
  /** Controlled stacking plus calmer Angry Shoveler and After Image chances. */
  recommended: { name: 'Recommended: diminishing + calmer chances', stacking: 'diminishing', chance: { angry: 0.04, afterimage: 0.035 } } as StackModel,
  /** The same, plus lighter Second Wind, Master Cutter and Haggler (the items the stack test found strongest). */
  trimmed: {
    name: 'Recommended + lighter economy skills',
    stacking: 'diminishing',
    chance: { angry: 0.04, afterimage: 0.035 },
    tweak: { 'trait.secondWind.restoreBase': 0.15, 'trait.secondWind.restorePerLevel': 0.12, 'prospect.luckyCutPerLevel': 0.04, 'trait.haggler.perLevel': 0.03 },
  } as StackModel,
};

export interface Player {
  tool: string;
  levels: Levels;
}

export interface DayStats {
  day: number;
  /** Money from selling rocks (after Master Cutter and Haggler). */
  income: number;
  /** What the rocks were worth as dug (before Master Cutter and Haggler). */
  raw: number;
  luckyGain: number;
  haggleGain: number;
  /** Cash for relocating to a new deposit (not rock income). */
  bonus: number;
  found: number;
  cut: number;
  worthless: number;
  swings: number;
  /** Swings that had any dig boost. */
  boosted: number;
  big: number;
  rages: number;
  ghosts: number;
  shots: number;
  hot: number;
  instant: number;
  doubles: number;
  /** Sum of every swing's depth multiplier (a plain swing is 1, a ghost adds its own depth). */
  digTotal: number;
  /** The biggest single-swing depth multiplier of the day. */
  maxMult: number;
  /** Swings that dug at least 3x a plain swing. */
  over3: number;
  /** Deposits finished so far plus the share of the current one dug. */
  depth: number;
  deposit: number;
  xp: number;
  level: number;
}

export interface SimInput {
  player: Player;
  days: number;
  seed: number;
  /** 1 = perfect bot, 0.65 = a decent player. */
  skill: number;
  model: StackModel;
  /** Called after each day. It may change player.tool and player.levels (buy things). */
  evening?: (stats: DayStats, player: Player) => void;
}

/** Prospector level from experience (same rule as dev/econ-sim.ts, with the 30% goal bonus). */
export function prospectorLevel(xp: number): number {
  let level = 1;
  let rest = Math.round(xp * 1.3);
  while (rest >= xpToNext(level)) {
    rest -= xpToNext(level);
    level++;
  }
  return level;
}

const TWEAK_ROOTS: Record<string, Record<string, unknown>> = {
  trait: TRAIT_EFFECTS as unknown as Record<string, unknown>,
  prospect: PROSPECT_EFFECTS as unknown as Record<string, unknown>,
};

/** Puts the model's number overrides into the (shared) data objects and returns the function that puts them back. */
function applyModel(model: StackModel): () => void {
  const undo: Array<() => void> = [];
  const set = (path: string, value: number | undefined): void => {
    if (value === undefined) return;
    const parts = path.split('.');
    let obj = TWEAK_ROOTS[parts[0]] as Record<string, unknown>;
    for (let i = 1; i < parts.length - 1; i++) obj = obj[parts[i]] as Record<string, unknown>;
    const key = parts[parts.length - 1];
    const old = obj[key];
    obj[key] = value;
    undo.push(() => {
      obj[key] = old;
    });
  };
  set('trait.angry.chancePerLevel', model.chance?.angry);
  set('trait.afterimage.chancePerLevel', model.chance?.afterimage);
  set('trait.bigHole.chancePerLevel', model.chance?.bigHole);
  for (const [path, value] of Object.entries(model.tweak ?? {})) set(path, value);
  return () => {
    for (const f of undo.reverse()) f();
  };
}

interface Shaped {
  depth: number;
  width: number;
  /** Depth of the ghost swing (0 = no ghost). */
  ghost: number;
  big: boolean;
  ghostOn: boolean;
  mult: number;
}

/** Turns the skills' roll for a swing into what the swing digs, under a stacking model. */
function shapeRoll(roll: SwingRoll, stacking: Stacking): Shaped {
  const E = TRAIT_EFFECTS;
  const bigX = roll.bigHole ? E.bigHole.depthMult - 1 : 0;
  const rageX = roll.raging ? E.angry.depthMult - 1 : 0;
  const ghostX = roll.afterimage ? 1 : 0;
  if (stacking === 'free') {
    return { depth: roll.depth, width: roll.width, ghost: ghostX, big: roll.bigHole, ghostOn: roll.afterimage, mult: roll.depth + ghostX };
  }
  if (stacking === 'strongest') {
    if (bigX > 0) return { depth: E.bigHole.depthMult, width: E.bigHole.widthMult, ghost: 0, big: true, ghostOn: false, mult: E.bigHole.depthMult };
    if (ghostX > 0) return { depth: 1, width: 1, ghost: 1, big: false, ghostOn: true, mult: 2 };
    return { depth: 1 + rageX, width: 1, ghost: 0, big: false, ghostOn: false, mult: 1 + rageX };
  }
  const list = [
    { k: 'big', x: bigX },
    { k: 'ghost', x: ghostX },
    { k: 'rage', x: rageX },
  ].filter((b) => b.x > 0).sort((a, b) => b.x - a.x);
  const factor = [1, 0.5, 0.25];
  let main = 1;
  let ghost = 0;
  list.forEach((b, i) => {
    if (b.k === 'ghost') ghost = factor[i];
    else main += b.x * factor[i];
  });
  return { depth: main, width: roll.bigHole ? E.bigHole.widthMult : 1, ghost, big: roll.bigHole, ghostOn: roll.afterimage, mult: main + ghost };
}

export function simulate(input: SimInput): DayStats[] {
  const { days, seed, skill, model, player } = input;
  const rng = mulberry32(seed);
  const lv = (id: string): number => player.levels[id] ?? 0;
  const traits = new TraitSystem(lv, rng);
  const stamina = new StaminaSystem(GAME_CONFIG.stamina);
  let xp = 0;
  const dig = new ExcavationSystem(GAME_CONFIG.world, LAYERS, (index) => {
    if (index > 0) xp += 25 * index;
  });
  const discovery = new DiscoverySystem();
  let deposit = 1;
  const bag: Rock[] = [];
  let embedded: Array<{ rock: Rock; hits: number }> = [];
  const out: DayStats[] = [];
  const restore = applyModel(model);
  try {
    for (let day = 1; day <= days; day++) {
      const su = staminaUpgrades(lv);
      stamina.setUpgrades(su.maxBonus, su.regenBonus, su.costMult);
      stamina.reset();
      discovery.findBonus = lv('up-find-chance') * PROSPECT_EFFECTS.findChancePerLevel;
      const capacity = GAME_CONFIG.inventory.slots + lv('up-bag') * PROSPECT_EFFECTS.bagSlotsPerLevel;
      // The bot walks to the workshop when one slot is left.
      const trigger = capacity - 1;
      const s: DayStats = {
        day, income: 0, raw: 0, luckyGain: 0, haggleGain: 0, bonus: 0, found: 0, cut: 0, worthless: 0, swings: 0, boosted: 0,
        big: 0, rages: 0, ghosts: 0, shots: 0, hot: 0, instant: 0, doubles: 0, digTotal: 0, maxMult: 1, over3: 0,
        depth: 0, deposit, xp: 0, level: 1,
      };

      const cutAll = (): void => {
        for (const rock of bag) {
          const before = rock.value;
          if (traits.rollLuckyCut(rock)) {
            upgradeRock(rock, rng);
            s.luckyGain += rock.value - before;
          }
          const sold = Math.round(rock.value * traits.sellMult);
          s.income += sold;
          s.haggleGain += sold - rock.value;
          s.raw += before;
          s.cut++;
          xp += ROCK_XP[rock.rarity.tier] ?? 3;
          if (rock.value <= 0) {
            s.worthless++;
            traits.onWorthlessThrown();
          }
        }
        bag.length = 0;
      };

      let t = 0;
      while (t < DAY_MS * skill) {
        if (bag.length >= trigger) {
          t += TRIP_MS + bag.length * CUT_MS;
          cutAll();
          continue;
        }
        const tool = toolWithUpgrades(TOOL_DEFS[player.tool], lv, deposit);
        const layerIdx = dig.layerIndexAtY(dig.floorAt(X) + 1);
        const layer = LAYERS[layerIdx];
        if (dig.atBottom) {
          s.bonus += relocationBonus(deposit);
          deposit++;
          dig.reset();
          dig.hardnessMult = hardnessMult(deposit);
          embedded = [];
          t += 4000;
          continue;
        }
        const now = day * 1e7 + t;
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
        const shaped = shapeRoll(roll, model.stacking);
        const boost = shaped.depth !== 1 || shaped.width !== 1 ? { depth: shaped.depth, width: shaped.width } : undefined;
        const res = dig.dig(X, tool, boost);
        const cooldown = tool.swingCooldownMs * (1 + 0.5 * layer.feel.clang) * traits.cooldownMult(now);
        stamina.update(cooldown);
        t += cooldown;

        s.swings++;
        s.digTotal += shaped.mult;
        if (shaped.mult > s.maxMult) s.maxMult = shaped.mult;
        if (shaped.mult >= 3) s.over3++;
        if (shaped.mult > 1) s.boosted++;
        if (shaped.big) s.big++;
        if (shaped.ghostOn) s.ghosts++;
        if (roll.rageStarted) s.rages++;
        if (roll.shots > 0) s.shots += roll.shots;

        const swingAt = (r: typeof res): void => {
          if (embedded.length > 0) {
            const target = embedded[0];
            if (traits.rollInstantCrack()) {
              s.instant++;
              target.hits = 0;
            } else {
              target.hits--;
            }
            if (target.hits <= 0) {
              embedded.shift();
              const rock = target.rock;
              if (traits.rollHotRock(rock)) {
                // A hot rock blasts a big hole and never reaches the bag.
                s.hot++;
                dig.dig(X, tool, { depth: TRAIT_EFFECTS.hotRock.depthMult, width: TRAIT_EFFECTS.hotRock.widthMult });
              } else {
                bag.push(rock);
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
            s.found++;
            if (traits.rollDoubleFind()) {
              embedded.push(make());
              s.found++;
              s.doubles++;
            }
          }
        };
        swingAt(res);
        if (shaped.ghost > 0) {
          // The ghost swing digs the same spot again (and can hit or find like any swing).
          swingAt(dig.dig(X, tool, shaped.ghost !== 1 ? { depth: shaped.ghost, width: 1 } : undefined));
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
      s.depth = deposit - 1 + dig.progress;
      s.deposit = deposit;
      s.xp = xp;
      s.level = prospectorLevel(xp);
      out.push(s);
      input.evening?.(s, player);
    }
  } finally {
    restore();
  }
  return out;
}

// ---------- statistics over seeds ----------

export interface Agg {
  median: number;
  p10: number;
  p90: number;
  mean: number;
}

export function agg(values: number[]): Agg {
  const v = [...values].sort((a, b) => a - b);
  const at = (q: number): number => v[Math.min(v.length - 1, Math.max(0, Math.round(q * (v.length - 1))))];
  return { median: at(0.5), p10: at(0.1), p90: at(0.9), mean: v.reduce((a, b) => a + b, 0) / Math.max(1, v.length) };
}

export type Runs = DayStats[][];

export function runSeeds(seeds: number, make: (seed: number) => SimInput): Runs {
  const out: Runs = [];
  for (let i = 0; i < seeds; i++) out.push(simulate(make((i + 1) * 7919)));
  return out;
}

/** Fixed configuration: one tool, fixed upgrade levels, `days` days, several seeds. */
export function fixedRuns(
  seeds: number, tool: string, levels: Levels, days: number, skill: number, model: StackModel,
): Runs {
  return runSeeds(seeds, (seed) => ({ player: { tool, levels: { ...levels } }, days, seed, skill, model }));
}

const window = (d: DayStats[], from: number, to: number): DayStats[] => d.slice(from - 1, to);

/** Average per day of a field of the daily stats over days from..to, aggregated over seeds. */
export function perDay(runs: Runs, f: (s: DayStats) => number, from = 1, to = runs[0].length): Agg {
  return agg(runs.map((d) => window(d, from, to).reduce((a, s) => a + f(s), 0) / (to - from + 1)));
}

/** Deposits dug per day over from..to (depth is cumulative). */
export function depthPerDay(runs: Runs, from = 1, to = runs[0].length): Agg {
  return agg(runs.map((d) => (d[to - 1].depth - (from > 1 ? d[from - 2].depth : 0)) / (to - from + 1)));
}
