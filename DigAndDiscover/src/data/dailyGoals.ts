import { GAME_CONFIG } from '../config/GameConfig';
import { LAYERS } from './layers';
import { mulberry32, pick } from '../core/Random';
import { ICON_SAW } from '../art/IconArt';
import { uiIcon } from '../art/UiIcons';

/**
 * Daily goals: three small targets for every in-game working day.
 *
 * The same wording is used for every player; only the number changes. The numbers
 * are derived from the prospector level (expected income, tool reach), so a new
 * player gets small goals and a veteran gets goals that still take a few minutes.
 *
 * This module is pure data + maths. No Phaser and no game state, which keeps it
 * easy to test in `dev/daily-goals-sim.ts`.
 */

export type DailyMetric = 'dig' | 'find' | 'rare' | 'cut' | 'earn' | 'depth' | 'sale';
export type DailyTier = 'easy' | 'medium' | 'hard';

export interface DailyGoalDef {
  metric: DailyMetric;
  tier: DailyTier;
  /** The number shown in the goal text (rocks, swings, dollars or metres). */
  target: number;
  /** Cash paid the moment the goal completes. */
  cash: number;
}

export interface DailyGoal extends DailyGoalDef {
  progress: number;
  done: boolean;
}

/** What the player can do today. GameState builds this from the live systems. */
export interface DailyStrength {
  level: number;
  /** Tool power with store upgrades applied. */
  toolPower: number;
  toolId: string;
  day: number;
  /** Deepest point of the current deposit, in metres. */
  bestDepth: number;
}

/** Everything needed to restore today's goals after a reload. */
export interface DailyGoalsSave {
  day: number;
  goals: DailyGoal[];
  /** Cash paid when all three are done. */
  bonus: number;
  /** Cash already paid by today's goals (including the all-three bonus). */
  earned: number;
  /** All three goals are done (the bonus was paid). */
  done: boolean;
  /** The tier:metric signature, used to avoid repeating the same trio. */
  signature: string;
}

export interface DailyGoals {
  goals: DailyGoal[];
  bonus: number;
  signature: string;
}

/** Expected money per working day by prospector level. Interpolated between stops. */
const INCOME_STOPS: ReadonlyArray<readonly [number, number]> = [
  [1, 1_000], // a brand-new player makes a few hundred dollars on day 1: small rewards, still a real boost
  [2, 2_000],
  [3, 4_200],
  [4, 5_500],
  [5, 7_500],
  [6, 10_000],
  [7, 13_000],
  [8, 17_000],
  [9, 22_000],
  [10, 28_000],
  [12, 42_000],
  [15, 68_000],
  [20, 120_000],
  [25, 190_000],
  [30, 280_000],
  [40, 460_000],
];

/** Typical and best rock values in RARITIES order: common, uncommon, rare, epic, legendary, worthless. */
const RARITY_AVG = [10, 38, 130, 400, 1_800, 0] as const;
const RARITY_MAX = [17, 56, 175, 500, 2_500, 0] as const;

/** Rock size bonus in RockGenerator: a rock can be up to 15% above its mineral range. */
const SIZE_BONUS = 1.15;
const UNITS_PER_METER = GAME_CONFIG.world.unitsPerMeter;

/** Bottom of every layer in metres (cumulative thickness). */
const LAYER_BOTTOMS: readonly number[] = (() => {
  let units = 0;
  return LAYERS.map((layer) => {
    units += layer.thickness;
    return units / UNITS_PER_METER;
  });
})();

/** Which metrics can appear in each tier. */
const TIER_METRICS: Record<DailyTier, readonly DailyMetric[]> = {
  easy: ['dig', 'find'],
  medium: ['find', 'cut', 'earn'],
  hard: ['depth', 'earn', 'sale', 'rare'],
};

/** Share of expected daily income paid by each tier and by the all-three bonus. */
const TIER_CASH: Record<DailyTier, number> = { easy: 0.02, medium: 0.04, hard: 0.08 };
const ALL_DONE_BONUS = 0.06;

/** Expected money for one working day at this level. */
export function expectedDailyIncome(level: number): number {
  const l = Math.max(1, level);
  const last = INCOME_STOPS[INCOME_STOPS.length - 1];
  if (l >= last[0]) return last[1];
  for (let i = 1; i < INCOME_STOPS.length; i++) {
    const [hiLevel, hiIncome] = INCOME_STOPS[i];
    if (l > hiLevel) continue;
    const [loLevel, loIncome] = INCOME_STOPS[i - 1];
    const t = (l - loLevel) / (hiLevel - loLevel);
    return Math.round(loIncome + (hiIncome - loIncome) * t);
  }
  return last[1];
}

/**
 * The deepest layer this tool can work through. A layer is "reachable" while its
 * hardness is at most five times the tool's power (a very rough but readable rule
 * that matches the store's progression).
 */
export function reachLayer(toolPower: number): number {
  const power = Math.max(1, toolPower) * 5;
  let reach = 0;
  for (let i = 0; i < LAYERS.length; i++) {
    if (LAYERS[i].hardness > power) break;
    reach = i;
  }
  return reach;
}

/** Depth in metres that the current tool can reasonably reach. */
export function reachMeters(toolPower: number): number {
  return LAYER_BOTTOMS[reachLayer(toolPower)] ?? LAYER_BOTTOMS[0];
}

/** Weight of rare + epic + legendary rocks in this layer (percent). */
export function rareWeightAt(layerIndex: number): number {
  const w = LAYERS[layerIndex]?.discovery.rarityWeights;
  if (!w) return 0;
  return w[2] + w[3] + w[4];
}

/** A rare-rock goal only makes sense when rare rocks can actually appear. */
function rareAvailable(strength: DailyStrength): boolean {
  return strength.level >= 2 && rareWeightAt(reachLayer(strength.toolPower)) >= 10;
}

/** Average value of one rock in a layer, weighted by its rarity table. */
export function expectedRockValue(layerIndex: number): number {
  const layer = LAYERS[layerIndex] ?? LAYERS[0];
  const mult = layer.discovery.valueMult ?? 1;
  let total = 0;
  for (let i = 0; i < RARITY_AVG.length; i++) total += (layer.discovery.rarityWeights[i] / 100) * RARITY_AVG[i];
  return total * mult;
}

/** Best possible rock value in a layer (a maximum-size rock of the best rarity that can appear). */
export function maxRockValue(layerIndex: number): number {
  const layer = LAYERS[layerIndex] ?? LAYERS[0];
  const mult = layer.discovery.valueMult ?? 1;
  let best = 0;
  for (let i = 0; i < RARITY_MAX.length; i++) {
    if (layer.discovery.rarityWeights[i] > 0) best = Math.max(best, RARITY_MAX[i]);
  }
  return best * SIZE_BONUS * mult;
}

/** Money values always end in 0 or 5, and never below $5. */
export function roundMoney(value: number): number {
  return Math.max(5, Math.round(value / 5) * 5);
}

/**
 * The target for a metric, or null when this player cannot complete it today.
 * `bestDepth` is in metres; depth goals are always a little deeper than the
 * current hole but never below the tool's reach.
 */
function targetFor(metric: DailyMetric, tier: DailyTier, strength: DailyStrength, income: number): number | null {
  switch (metric) {
    case 'dig':
      return 8 + strength.level * 2;
    case 'find':
      return tier === 'easy'
        ? 4 + Math.floor((strength.level - 1) * 1.1)
        : 6 + Math.floor((strength.level - 1) * 1.4);
    case 'cut':
      return 4 + Math.floor((strength.level - 1) * 1.3);
    case 'earn':
      return roundMoney(income * (tier === 'hard' ? 0.09 : 0.05));
    case 'rare':
      return rareAvailable(strength) ? Math.max(1, Math.min(6, 1 + Math.floor((strength.level - 3) / 5))) : null;
    case 'depth': {
      const reach = Math.floor(reachMeters(strength.toolPower));
      const target = Math.min(Math.floor(strength.bestDepth) + Math.max(6, Math.round(strength.bestDepth * 0.25)), reach);
      return target >= 1 && target > strength.bestDepth ? target : null;
    }
    case 'sale': {
      const layer = reachLayer(strength.toolPower);
      const cap = Math.max(5, Math.floor(maxRockValue(layer) * 0.8));
      const want = roundMoney(expectedRockValue(layer) * 2.2);
      return Math.max(5, Math.min(want, cap));
    }
  }
}

/** Builds one goal, with the reward taken from the tier's share of expected income. */
function buildGoal(
  metric: DailyMetric,
  tier: DailyTier,
  strength: DailyStrength,
  income: number,
  day: number,
): DailyGoal {
  let target = targetFor(metric, tier, strength, income) ?? 1;
  // Day one must be finishable in the first few minutes: 10 digs, 4 rocks, 3 m.
  if (day === 1 && metric === 'find') target = 4;
  return {
    metric,
    tier,
    target: Math.max(1, Math.round(target)),
    cash: roundMoney(income * TIER_CASH[tier]),
    progress: 0,
    done: false,
  };
}

function signatureOf(goals: readonly DailyGoalDef[]): string {
  return goals.map((g) => `${g.tier}:${g.metric}`).join('|');
}

/**
 * Picks today's three goals from the day number alone. The same day, strength and
 * previous signature always produce the same trio, so a reload never re-rolls.
 */
export function generateDailyGoals(day: number, strength: DailyStrength, previousSignature = ''): DailyGoals {
  const safeDay = Math.max(1, Math.floor(day));
  const safeStrength: DailyStrength = {
    ...strength,
    level: Math.max(1, Math.floor(strength.level)),
    toolPower: Math.max(1, strength.toolPower),
    bestDepth: Math.max(0, strength.bestDepth),
  };
  const income = expectedDailyIncome(safeStrength.level);
  const rng = mulberry32(((safeDay * 2_654_435_761) ^ (safeDay << 11)) >>> 0);
  for (let i = 0; i < 6; i++) rng(); // warm up: neighbouring days must not give neighbouring picks
  const tiers: readonly DailyTier[] = ['easy', 'medium', 'hard'];
  const goals: DailyGoal[] = [];
  const used: DailyMetric[] = [];

  for (const tier of tiers) {
    let metric: DailyMetric | null = null;
    // Day one has a hand-picked, very gentle trio (depth falls back if unavailable).
    if (safeDay === 1) {
      const forced: DailyMetric = tier === 'easy' ? 'dig' : tier === 'medium' ? 'find' : 'depth';
      if (!used.includes(forced) && targetFor(forced, tier, safeStrength, income) !== null) metric = forced;
    }
    if (!metric) {
      const pool = TIER_METRICS[tier].filter((m) => !used.includes(m) && targetFor(m, tier, safeStrength, income) !== null);
      metric = pool.length > 0 ? pick(rng, pool) : (['dig', 'find', 'cut', 'earn', 'depth', 'sale', 'rare'] as DailyMetric[]).find((m) => !used.includes(m) && targetFor(m, tier, safeStrength, income) !== null) ?? 'earn';
    }
    goals.push(buildGoal(metric, tier, safeStrength, income, safeDay));
    used.push(metric);
  }

  // Never show the exact same trio two days in a row. Rotate the hardest tier
  // first, then medium, then easy, until the signature changes.
  if (signatureOf(goals) === previousSignature) {
    for (const tier of ['hard', 'medium', 'easy'] as const) {
      const index = goals.findIndex((g) => g.tier === tier);
      if (index < 0) continue;
      const others = goals.filter((_, i) => i !== index).map((g) => g.metric);
      const pool = TIER_METRICS[tier].filter(
        (m) => !others.includes(m) && m !== goals[index].metric && targetFor(m, tier, safeStrength, income) !== null,
      );
      if (pool.length === 0) continue;
      goals[index] = buildGoal(pool[0], tier, safeStrength, income, safeDay);
      break;
    }
  }

  return {
    goals,
    bonus: roundMoney(income * ALL_DONE_BONUS),
    signature: signatureOf(goals),
  };
}

/** Player-facing wording. The same sentence is used at every level. */
export function dailyGoalText(goal: DailyGoalDef): string {
  const n = goal.target;
  switch (goal.metric) {
    case 'dig':
      return `Dig ${n} times`;
    case 'find':
      return `Find ${n} rocks`;
    case 'rare':
      return n === 1 ? 'Find a rare rock' : `Find ${n} rare rocks`;
    case 'cut':
      return `Cut open ${n} rocks`;
    case 'earn':
      return `Earn $${n} today`;
    case 'depth':
      return `Dig down to ${n} m`;
    case 'sale':
      return `Sell a rock worth $${n} or more`;
  }
}

/** Texture key of the little icon shown next to a daily goal. */
export function dailyGoalIcon(metric: DailyMetric): string {
  switch (metric) {
    case 'dig':
      return uiIcon('swing');
    case 'find':
      return uiIcon('pickaxe');
    case 'rare':
      return uiIcon('gem');
    case 'cut':
      return ICON_SAW;
    case 'earn':
      return uiIcon('cash');
    case 'depth':
      return uiIcon('ruler');
    case 'sale':
      return uiIcon('cash');
  }
}
