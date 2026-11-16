/**
 * Goals: three are always active. Finishing one pays cash + XP and a new one takes
 * its place, scaled to the player's level - an endless "one more goal" loop.
 * The first few are a gentle tutorial that walks the player into the store.
 */
import { ICON_SAW } from '../art/IconArt';
import { uiIcon } from '../art/UiIcons';

export type GoalMetric = 'find' | 'cut' | 'earn' | 'depth' | 'rare' | 'buy' | 'curio';

export interface GoalDef {
  metric: GoalMetric;
  target: number;
  cash: number;
  xp: number;
}

export interface GoalContext {
  level: number;
  /** Deepest point reached so far, in metres. */
  bestDepth: number;
  totalDepth: number;
}

export const ONBOARDING: readonly GoalDef[] = [
  { metric: 'find', target: 3, cash: 30, xp: 25 },
  { metric: 'cut', target: 2, cash: 35, xp: 30 },
  { metric: 'earn', target: 60, cash: 40, xp: 30 },
  { metric: 'depth', target: 4, cash: 45, xp: 35 },
  { metric: 'buy', target: 1, cash: 60, xp: 50 },
  // Collectibles never pay cash, not even through a goal: XP only.
  { metric: 'curio', target: 1, cash: 0, xp: 60 },
];

interface Template {
  metric: GoalMetric;
  weight: number;
  make: (c: GoalContext) => GoalDef | null;
}

const reward = (c: GoalContext, mult = 1) => ({ cash: Math.round((25 + 20 * c.level) * mult), xp: Math.round((20 + 6 * c.level) * mult) });
const round5 = (n: number) => Math.max(5, Math.round(n / 5) * 5);

const TEMPLATES: readonly Template[] = [
  { metric: 'find', weight: 3, make: (c) => ({ metric: 'find', target: 4 + c.level * 2, ...reward(c) }) },
  { metric: 'cut', weight: 3, make: (c) => ({ metric: 'cut', target: 3 + c.level * 2, ...reward(c) }) },
  { metric: 'earn', weight: 3, make: (c) => ({ metric: 'earn', target: round5(60 * Math.pow(c.level, 1.5)), ...reward(c, 1.2) }) },
  { metric: 'curio', weight: 3, make: (c) => ({ metric: 'curio', target: 1 + Math.floor(c.level / 3), ...reward(c, 1.4), cash: 0 }) },
  { metric: 'rare', weight: 2, make: (c) => ({ metric: 'rare', target: 1 + Math.floor(c.level / 4), ...reward(c, 1.6) }) },
  {
    metric: 'depth',
    weight: 2,
    make: (c) => (c.bestDepth >= c.totalDepth - 1 ? null : { metric: 'depth', target: Math.min(Math.floor(c.totalDepth), Math.floor(c.bestDepth) + 3), ...reward(c, 1.5) }),
  },
];

/** One painted icon per goal kind: goals are read at a glance, not read. */
export function goalIcon(metric: GoalMetric): string {
  switch (metric) {
    case 'find': return uiIcon('pickaxe');
    case 'cut': return ICON_SAW;
    case 'earn': return uiIcon('cash');
    case 'depth': return uiIcon('ruler');
    case 'rare': return uiIcon('gem');
    case 'buy': return uiIcon('store');
    case 'curio': return uiIcon('album');
  }
}

export function goalText(g: { metric: GoalMetric; target: number }): string {
  const n = g.target;
  switch (g.metric) {
    case 'find': return `Find ${n} rocks`;
    case 'cut': return `Cut open ${n} rocks`;
    case 'earn': return `Earn $${n} from sales`;
    case 'depth': return `Dig down to ${n} m`;
    case 'rare': return n === 1 ? 'Cut open a Rare (or better) rock' : `Cut open ${n} Rare+ rocks`;
    case 'buy': return 'Buy something in the store';
    case 'curio': return n === 1 ? 'Dig up a collectible' : `Dig up ${n} collectibles`;
  }
}

/** A random goal that is not one of `avoid` (metrics already active). */
export function rollGoal(ctx: GoalContext, avoid: readonly GoalMetric[], rng: () => number = Math.random): GoalDef {
  const options = TEMPLATES.filter((t) => !avoid.includes(t.metric)).map((t) => ({ t, def: t.make(ctx) })).filter((o) => o.def);
  const pool = options.length > 0 ? options : TEMPLATES.map((t) => ({ t, def: t.make(ctx) })).filter((o) => o.def);
  const total = pool.reduce((a, o) => a + o.t.weight, 0);
  let roll = rng() * total;
  for (const o of pool) {
    roll -= o.t.weight;
    if (roll <= 0) return o.def as GoalDef;
  }
  return pool[0].def as GoalDef;
}
