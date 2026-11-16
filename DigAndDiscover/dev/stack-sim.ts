/**
 * Skill stacking investigation: what happens when the prospecting upgrades and skills are bought TOGETHER,
 * how that changes tool progression, how three stacking models compare, and whether a new price list lands
 * the milestones in the right month. dev/skills-sim.ts tests each upgrade alone; players buy many.
 *
 * Nothing here changes the game: the engine (dev/sim-engine.ts) reads the live data and logic, and applies
 * stacking models and price lists only inside the simulation.
 *
 * Run (Windows; esbuild ships with vite):
 *   npx esbuild dev/stack-sim.ts --bundle --platform=node --format=cjs --outfile=%TEMP%/stack-sim.cjs && node %TEMP%/stack-sim.cjs
 *
 * Options (environment): PHASE = A | B | C | D | E (default A), SEEDS (default 30), DAYS (default 120),
 * SKILL (play skill, default 0.65), TOOL (default tool-pickaxe), MODEL (preferred model of phases D and E:
 * current | reduced | strongest | diminishing | recommended | trimmed, default trimmed), GROWTH (price growth
 * of the proposed price list, default 2.5; the report uses 2.9), L3 (level-3 budget, default 1500000).
 *
 *  A  all 12 upgrades and skills together at levels 1, 2, 3 and max over DAYS days (current game rules).
 *  B  every tool under the same skill configurations, income, depth, finds, payback of the tool's price.
 *  C  stacking models side by side on every tool, with how often the exciting effects still fire.
 *  D  size of the whole stack per model, leave-one-out value of each item, price proposal.
 *  E  Phase D plus a purchase walk (a player earning, shopping and levelling for 150 days) with today's and the
 *     proposed prices: when do the milestones arrive.
 */
import { ALL_TOOLS, ALL_UPGRADES, upgradePrice, type UpgradeItem } from '../src/data/store';
import { TOOL_DEFS } from '../src/data/tools';
import {
  MODELS, agg, depthPerDay, fixedRuns, perDay, simulate,
  type DayStats, type Levels, type Player, type Runs, type StackModel,
} from './sim-engine';

const num = (name: string, fallback: number): number => Number(process.env[name] ?? fallback);
const seeds = num('SEEDS', 30);
const days = num('DAYS', 120);
const skill = num('SKILL', 0.65);
const toolId = process.env.TOOL ?? 'tool-pickaxe';
const phase = (process.env.PHASE ?? 'A').toUpperCase();

const SKILLS = ALL_UPGRADES.filter((u) => u.id.startsWith('trait-'));
const PROSPECTING = ALL_UPGRADES.filter((u) => ['up-find-chance', 'up-instant-crack', 'up-bag', 'up-double-find', 'up-lucky-cut'].includes(u.id));
const DIG3 = SKILLS.filter((u) => ['trait-big-hole', 'trait-angry', 'trait-afterimage'].includes(u.id));
const ALL12 = [...SKILLS, ...PROSPECTING];
const TOOL_ORDER = ['tool-old-shovel', 'tool-iron-shovel', 'tool-steel-shovel', 'tool-hand-axe', 'tool-gold-shovel', 'tool-pickaxe', 'tool-jackhammer', 'tool-diamond-shovel', 'tool-drill'];
const toolPrice = (id: string): number => ALL_TOOLS.find((t) => t.id === id)?.price ?? 0;
const toolName = (id: string): string => TOOL_DEFS[id].name;

/** The five older upgrades at about 30% of their maximum: a mid-game player (same as skills-sim). */
function midGame(): Levels {
  const levels: Levels = {};
  for (const id of ['up-stamina-tank', 'up-stamina-regen', 'up-stamina-efficiency', 'up-dig-damage', 'up-dig-speed']) {
    const item = ALL_UPGRADES.find((u) => u.id === id);
    if (item) levels[id] = Math.round(item.maxLevel * 0.3);
  }
  return levels;
}

const at = (items: UpgradeItem[], level: number | 'max', extra: Levels = midGame()): Levels => {
  const lv = { ...extra };
  for (const u of items) lv[u.id] = level === 'max' ? u.maxLevel : Math.min(level, u.maxLevel);
  return lv;
};

function cost(items: UpgradeItem[], level: number | 'max', price: (u: UpgradeItem, l: number) => number = upgradePrice): number {
  let total = 0;
  for (const u of items) {
    const top = level === 'max' ? u.maxLevel : Math.min(level, u.maxLevel);
    for (let l = 0; l < top; l++) total += price(u, l);
  }
  return total;
}

// ---------- formatting ----------
const n0 = (v: number): string => Math.round(v).toLocaleString('en-US');
const money = (v: number): string => (v >= 1e6 ? `${(v / 1e6).toFixed(2)}M` : v >= 1e3 ? `${Math.round(v / 1e3)}K` : String(Math.round(v)));
const x2 = (v: number): string => `x${v.toFixed(2)}`;
const table = (head: string[], rows: string[][]): void => {
  console.log(`| ${head.join(' | ')} |`);
  console.log(`|${head.map(() => '---').join('|')}|`);
  for (const r of rows) console.log(`| ${r.join(' | ')} |`);
  console.log('');
};
const range = (a: { median: number; p10: number; p90: number }): string => `${n0(a.median)} (${n0(a.p10)}-${n0(a.p90)})`;

const income = (s: DayStats): number => s.income;

/** One summary line of a fixed run. */
function summary(runs: Runs, base?: Runs): { money: number; depth: number; cells: string[] } {
  const m = perDay(runs, income);
  const d = depthPerDay(runs);
  const found = perDay(runs, (s) => s.found).median;
  const cut = perDay(runs, (s) => s.cut).median;
  const raw = perDay(runs, (s) => s.raw).median;
  const lucky = perDay(runs, (s) => s.luckyGain).median;
  const hag = perDay(runs, (s) => s.haggleGain).median;
  const bm = base ? perDay(base, income).median : m.median;
  const bd = base ? depthPerDay(base).median : d.median;
  return {
    money: m.median,
    depth: d.median,
    cells: [range(m), x2(m.median / bm), d.median.toFixed(3), x2(d.median / bd), found.toFixed(1), cut > 0 ? n0(raw / cut) : '-', n0(lucky), n0(hag)],
  };
}
const SUMMARY_HEAD = ['money/day median (p10-p90)', 'x money', 'deposits/day', 'x depth', 'rocks found/day', 'avg rock value', 'Master Cutter +/day', 'Haggler +/day'];

// ---------- Phase A ----------
function phaseA(): void {
  const model = MODELS.current;
  console.log(`## Phase A: stacking under the current rules (${toolName(toolId)}, ${days} days, ${seeds} seeds, play skill ${skill})\n`);
  const base = fixedRuns(seeds, toolId, midGame(), days, skill, model);
  const b = summary(base);
  console.log(`Baseline (mid-game base upgrades, no skills): ${n0(b.money)} money/day, ${b.depth.toFixed(3)} deposits/day.\n`);
  const groups: Array<[string, UpgradeItem[]]> = [
    ['3 dig skills (Big Hole, Angry, After Image)', DIG3],
    ['7 skills', SKILLS],
    ['5 prospecting upgrades', PROSPECTING],
    ['all 12', ALL12],
  ];
  const rows: string[][] = [];
  for (const [name, items] of groups) {
    for (const level of [1, 2, 3, 'max'] as const) {
      const r = fixedRuns(seeds, toolId, at(items, level), days, skill, model);
      rows.push([name, String(level), ...summary(r, base).cells, money(cost(items, level))]);
    }
  }
  table(['group', 'level', ...SUMMARY_HEAD, 'cost of the set'], rows);

  console.log('### Month by month (median money/day)\n');
  const monthRows: string[][] = [];
  const lines: Array<[string, Runs]> = [
    ['no skills', base],
    ['all 12 at level 3', fixedRuns(seeds, toolId, at(ALL12, 3), days, skill, model)],
    ['all 12 at max', fixedRuns(seeds, toolId, at(ALL12, 'max'), days, skill, model)],
  ];
  for (const [name, r] of lines) {
    const cells: string[] = [];
    for (let from = 1; from + 29 <= days; from += 30) cells.push(n0(perDay(r, income, from, from + 29).median));
    monthRows.push([name, ...cells]);
  }
  const heads = ['config'];
  for (let m = 1; m * 30 <= days; m++) heads.push(`days ${m * 30 - 29}-${m * 30}`);
  table(heads, monthRows);
}

// ---------- Phase B ----------
function phaseB(): void {
  const model = MODELS.current;
  console.log(`## Phase B: all tools under identical skill configurations (current rules, ${days} days, ${seeds} seeds)\n`);
  const configs: Array<[string, Levels]> = [
    ['no skills', midGame()],
    ['all 12 at level 3', at(ALL12, 3)],
    ['all 12 at max', at(ALL12, 'max')],
  ];
  const results: Record<string, Record<string, Runs>> = {};
  for (const [label, lv] of configs) {
    results[label] = {};
    for (const t of TOOL_ORDER) results[label][t] = fixedRuns(seeds, t, lv, days, skill, model);
  }
  for (const [label] of configs) {
    console.log(`### ${label}\n`);
    const rows: string[][] = [];
    let prev: string | null = null;
    for (const t of TOOL_ORDER) {
      const r = results[label][t];
      const m = perDay(r, income).median;
      const d = depthPerDay(r).median;
      const found = perDay(r, (s) => s.found).median;
      const cut = perDay(r, (s) => s.cut).median;
      const raw = perDay(r, (s) => s.raw).median;
      let payback = '-';
      let step = '-';
      if (prev) {
        const pm = perDay(results[label][prev], income).median;
        step = x2(m / pm);
        payback = m > pm ? `${((toolPrice(t) / (m - pm))).toFixed(1)} d` : 'never';
      }
      rows.push([toolName(t), n0(toolPrice(t)), n0(m), step, d.toFixed(3), found.toFixed(1), cut > 0 ? n0(raw / cut) : '-', payback]);
      prev = t;
    }
    table(['tool', 'price', 'money/day', 'vs previous tool', 'deposits/day', 'rocks found/day', 'avg rock value', 'payback vs previous tool'], rows);
  }
  console.log('### Does the Old Shovel with skills beat the Pickaxe with the same skills?\n');
  const rows: string[][] = [];
  for (const [label] of configs) {
    const o = perDay(results[label]['tool-old-shovel'], income).median;
    const p = perDay(results[label]['tool-pickaxe'], income).median;
    const dr = perDay(results[label]['tool-drill'], income).median;
    rows.push([label, n0(o), n0(p), n0(dr), x2(p / o), x2(dr / p)]);
  }
  table(['config (same for all tools)', 'Old Shovel', 'Pickaxe', 'Power Drill', 'Pickaxe / Old Shovel', 'Drill / Pickaxe'], rows);
  console.log('### Old Shovel with ALL skills vs other tools WITHOUT skills (different configurations, the comparison that caused the worry)\n');
  const o3 = perDay(results['all 12 at level 3']['tool-old-shovel'], income).median;
  const rows2: string[][] = [];
  for (const t of TOOL_ORDER) rows2.push([toolName(t), n0(perDay(results['no skills'][t], income).median), n0(o3), perDay(results['no skills'][t], income).median < o3 ? 'Old Shovel + skills earns more' : 'tool alone earns more']);
  table(['tool without skills', 'its money/day', 'Old Shovel with all 12 at level 3', 'result'], rows2);
}

// ---------- Phase C ----------
const MODEL_LIST: StackModel[] = [
  MODELS.current,
  MODELS.reduced,
  MODELS.strongest,
  MODELS.diminishing,
  { name: 'Reduced + strongest', stacking: 'strongest', chance: MODELS.reduced.chance },
  { name: 'Reduced + diminishing', stacking: 'diminishing', chance: MODELS.reduced.chance },
];

function phaseC(): void {
  console.log(`## Phase C: stacking models (${days} days, ${seeds} seeds, play skill ${skill})\n`);
  const tools = ['tool-old-shovel', 'tool-steel-shovel', 'tool-pickaxe', 'tool-diamond-shovel', 'tool-drill'];
  for (const [label, lv] of [['all 12 at level 3', at(ALL12, 3)], ['all 12 at max', at(ALL12, 'max')]] as Array<[string, Levels]>) {
    console.log(`### Money per day multiplier over the same tool with no skills: ${label}\n`);
    const rows: string[][] = [];
    for (const model of MODEL_LIST) {
      const cells: string[] = [];
      for (const t of tools) {
        const b = fixedRuns(seeds, t, midGame(), days, skill, model);
        const r = fixedRuns(seeds, t, lv, days, skill, model);
        cells.push(`${x2(perDay(r, income).median / perDay(b, income).median)} / ${x2(depthPerDay(r).median / depthPerDay(b).median)}`);
      }
      rows.push([model.name, ...cells]);
    }
    table(['model (money / depth)', ...tools.map(toolName)], rows);
  }
  console.log(`### Dig skills alone (3 dig skills) at level 3 and max, ${toolName(toolId)}, multiplier of money / depth\n`);
  const baseP = fixedRuns(seeds, toolId, midGame(), days, skill, MODELS.current);
  const rowsD: string[][] = [];
  for (const model of MODEL_LIST) {
    const b = fixedRuns(seeds, toolId, midGame(), days, skill, model);
    const r3 = fixedRuns(seeds, toolId, at(DIG3, 3), days, skill, model);
    const rm = fixedRuns(seeds, toolId, at(DIG3, 'max'), days, skill, model);
    rowsD.push([model.name, `${x2(perDay(r3, income).median / perDay(b, income).median)} / ${x2(depthPerDay(r3).median / depthPerDay(b).median)}`, `${x2(perDay(rm, income).median / perDay(b, income).median)} / ${x2(depthPerDay(rm).median / depthPerDay(b).median)}`]);
  }
  void baseP;
  table(['model', 'level 3', 'max'], rowsD);

  console.log(`### How often the exciting effects still fire (${toolName(toolId)}, 3 dig skills at level 3 / at max, per working day)\n`);
  const rowsF: string[][] = [];
  for (const model of MODEL_LIST) {
    const cells: string[] = [];
    for (const level of [3, 'max'] as const) {
      const r = fixedRuns(seeds, toolId, at(DIG3, level), days, skill, model);
      const sw = perDay(r, (s) => s.swings).median;
      cells.push(
        `${perDay(r, (s) => s.big).median.toFixed(0)} big holes, ${perDay(r, (s) => s.rages).median.toFixed(1)} rages, ${perDay(r, (s) => s.ghosts).median.toFixed(0)} ghosts; ` +
        `${n0(perDay(r, (s) => s.boosted).median / sw * 100)}% of swings boosted, biggest swing ${perDay(r, (s) => s.maxMult).median.toFixed(1)}x, ${perDay(r, (s) => s.over3).median.toFixed(1)} swings of 3x+`,
      );
    }
    rowsF.push([model.name, ...cells]);
  }
  table(['model', 'level 3', 'max'], rowsF);
}

// ---------- Phase D ----------
/** Leave-one-out: how much does each item add to a stack where everything else is at the same level? */
function leaveOneOut(model: StackModel, level: number, t = toolId): Array<{ item: UpgradeItem; value: number }> {
  const full = perDay(fixedRuns(seeds, t, at(ALL12, level), days, skill, model), income).median;
  return ALL12.map((item) => {
    const lv = at(ALL12, level);
    lv[item.id] = 0;
    const without = perDay(fixedRuns(seeds, t, lv, days, skill, model), income).median;
    return { item, value: full / without };
  });
}

// ---------- Phase E: purchase walk ----------
export interface PriceBook {
  [id: string]: { base: number; growth: number };
}
const priceOf = (u: UpgradeItem, level: number, book?: PriceBook): number => {
  const p = book?.[u.id];
  return Math.round(((p ? p.base : u.basePrice) * Math.pow(p ? p.growth : u.priceGrowth, level)) / 5) * 5;
};

function walkOnce(seed: number, model: StackModel, book: PriceBook | undefined, policy: 'cheapest' | 'value', weights: Record<string, number>, horizon: number): {
  l3: number | null; max: number | null; firstSkill: number | null; tools: Record<string, number | null>; income: number[]; money: number[];
} {
  const owned = new Set<string>(['tool-old-shovel']);
  const player: Player = { tool: 'tool-old-shovel', levels: {} };
  let money = 0;
  let overdue = 0;
  let bills = 0;
  const log = { l3: null as number | null, max: null as number | null, firstSkill: null as number | null, tools: {} as Record<string, number | null>, income: [] as number[], money: [] as number[] };
  const gated = ALL_UPGRADES.filter((u) => u.id !== 'up-mastery');
  const bestTool = (): string => {
    let best = 'tool-old-shovel';
    for (const id of owned) if (TOOL_DEFS[id] && TOOL_DEFS[id].power > TOOL_DEFS[best].power) best = id;
    return best;
  };
  simulate({
    player, days: horizon, seed, skill, model,
    evening: (s, p) => {
      const month = Math.floor((s.day - 1) / 30);
      const dayInMonth = ((s.day - 1) % 30) + 1;
      money += s.income + s.bonus;
      const due = Math.round(45 * Math.pow(1.25, month)) + bills;
      const paid = Math.min(money, due);
      money -= paid;
      bills = due - paid;
      if (dayInMonth % 7 === 0) overdue += Math.round(1200 * Math.pow(1.6, month));
      const payNow = Math.min(money, overdue);
      money -= payNow;
      overdue -= payNow;
      const daysToDue = 7 - (dayInMonth % 7);
      const reserve = overdue + (daysToDue <= 3 ? Math.round(1200 * Math.pow(1.6, month)) : 0);

      for (let pass = 0; pass < 40; pass++) {
        const current = TOOL_DEFS[bestTool()].power;
        const next = ALL_TOOLS
          .filter((t) => !t.placeholder && !owned.has(t.id) && s.level >= t.minLevel && t.kind === 'dig' && TOOL_DEFS[t.id] && TOOL_DEFS[t.id].power > current)
          .sort((a, b) => a.price - b.price)[0];
        if (next && money - reserve >= next.price) {
          money -= next.price;
          owned.add(next.id);
          p.tool = bestTool();
          if (log.tools[next.id] == null) log.tools[next.id] = s.day;
          continue;
        }
        const cands = gated
          .filter((u) => (p.levels[u.id] ?? 0) < u.maxLevel && s.level >= (u.minLevel ?? 1))
          .map((u) => ({ u, price: priceOf(u, p.levels[u.id] ?? 0, book), group: u.id.startsWith('trait-') || PROSPECTING.some((q) => q.id === u.id) ? 'skill' : 'base' }))
          .filter((c) => money - reserve >= c.price && (!next || money - c.price >= next.price * 0.5 || c.price < money * 0.4));
        if (cands.length === 0) break;
        let pick;
        if (policy === 'cheapest') {
          pick = cands.sort((a, b) => a.price - b.price)[0];
        } else {
          const base = cands.filter((c) => c.group === 'base').sort((a, b) => a.price - b.price)[0];
          pick = base ?? cands.sort((a, b) => (weights[b.u.id] ?? 1) / b.price - (weights[a.u.id] ?? 1) / a.price)[0];
        }
        money -= pick.price;
        p.levels[pick.u.id] = (p.levels[pick.u.id] ?? 0) + 1;
        if (pick.group === 'skill' && log.firstSkill == null && pick.u.id.startsWith('trait-')) log.firstSkill = s.day;
      }
      if (log.l3 == null && ALL12.every((u) => (p.levels[u.id] ?? 0) >= Math.min(3, u.maxLevel))) log.l3 = s.day;
      if (log.max == null && ALL12.every((u) => (p.levels[u.id] ?? 0) >= u.maxLevel)) log.max = s.day;
      log.income.push(s.income);
      log.money.push(Math.round(money));
    },
  });
  return log;
}

function phaseE(book: PriceBook | undefined, label: string, model: StackModel, weights: Record<string, number>): void {
  const horizon = Math.max(days, 150);
  console.log(`### Walk: ${label}, model "${model.name}", ${horizon} days, ${seeds} seeds, policy cheapest-first vs value-first\n`);
  const rows: string[][] = [];
  for (const policy of ['cheapest', 'value'] as const) {
    const logs = [];
    for (let i = 0; i < seeds; i++) logs.push(walkOnce((i + 1) * 7919, model, book, policy, weights, horizon));
    const med = (vals: Array<number | null>): string => {
      const done = vals.filter((v): v is number => v != null);
      if (done.length < vals.length / 2) return `not in ${horizon} d (${done.length}/${vals.length} runs)`;
      return `day ${n0(agg(done).median)} (${n0(agg(done).p10)}-${n0(agg(done).p90)})`;
    };
    const inc = (a: number, b: number): string => n0(agg(logs.map((l) => l.income.slice(a - 1, b).reduce((x, y) => x + y, 0) / (b - a + 1))).median);
    rows.push([
      policy,
      med(logs.map((l) => l.firstSkill)),
      med(logs.map((l) => l.l3)),
      med(logs.map((l) => l.max)),
      med(logs.map((l) => l.tools['tool-pickaxe'] ?? null)),
      med(logs.map((l) => l.tools['tool-drill'] ?? null)),
      `${inc(1, 30)} / ${inc(31, 60)} / ${inc(61, 90)} / ${inc(91, 120)}`,
    ]);
  }
  table(['policy', 'first skill bought', 'all 12 at level 3', 'all 12 at max', 'Pickaxe bought', 'Drill bought', 'money/day, months 1-4'], rows);
}


// ---------- Phase D: value in the stack and price proposals ----------
/** Items that keep today's prices: the cheap everyday upgrades and the two fun junk skills. */
const KEEP_CHEAP = ['up-find-chance', 'up-instant-crack', 'up-bag', 'trait-hot-rock', 'trait-scrap-shot'];
/** The owner asked for these to be expensive whatever they measure, so they get a weight floor. */
const WEIGHT_FLOOR: Record<string, number> = { 'up-double-find': 0.08 };
const PREFERRED: StackModel = MODELS[(process.env.MODEL ?? 'trimmed') as keyof typeof MODELS] ?? MODELS.trimmed;
const L3_TARGET = num('L3', 1.5e6);
const GROWTH = num('GROWTH', 2.5);

/** Average log-value of every item over several models (leave-one-out is noisy, the average calms it). */
function stackWeights(): { weights: Record<string, number>; raw: Record<string, number[]> } {
  const raw: Record<string, number[]> = {};
  for (const model of [MODELS.current, MODELS.diminishing, PREFERRED]) {
    for (const r of leaveOneOut(model, 3)) (raw[r.item.id] ??= []).push(r.value);
  }
  const weights: Record<string, number> = {};
  for (const u of ALL12) {
    const logs = raw[u.id].map((v) => Math.log(v));
    weights[u.id] = Math.max(WEIGHT_FLOOR[u.id] ?? 0.03, logs.reduce((a, b) => a + b, 0) / logs.length);
  }
  return { weights, raw };
}

const niceRound = (v: number): number => {
  const step = v < 10000 ? 500 : v < 100000 ? 1000 : 5000;
  return Math.max(step, Math.round(v / step) * step);
};

/** Splits the level-3 budget of the strong items by their measured weight; growth makes the top levels dear. */
function proposeBook(weights: Record<string, number>): PriceBook {
  const book: PriceBook = {};
  const fixed = ALL12.filter((u) => KEEP_CHEAP.includes(u.id));
  const variable = ALL12.filter((u) => !KEEP_CHEAP.includes(u.id));
  const budget = L3_TARGET - cost(fixed, 3);
  const sumW = variable.reduce((a, u) => a + weights[u.id], 0);
  const unit = 1 + GROWTH + GROWTH * GROWTH;
  for (const u of variable) {
    book[u.id] = { base: niceRound(((weights[u.id] / sumW) * budget) / unit), growth: GROWTH };
  }
  return book;
}

function phaseD(): { weights: Record<string, number>; book: PriceBook } {
  console.log(`## Phase D: stacking models, value of each item, price proposal (${days} days, ${seeds} seeds, play skill ${skill})\n`);
  const lineup: StackModel[] = [MODELS.current, MODELS.diminishing, MODELS.recommended, MODELS.trimmed];
  console.log('### How big is the whole stack? Multiplier of money / depth over the same tool without skills\n');
  const tools = ['tool-old-shovel', 'tool-pickaxe', 'tool-drill'];
  const rows: string[][] = [];
  for (const model of lineup) {
    for (const [label, level] of [['level 3', 3], ['max', 'max']] as Array<[string, number | 'max']>) {
      const cells: string[] = [];
      for (const t of tools) {
        const b = fixedRuns(seeds, t, midGame(), days, skill, model);
        const r = fixedRuns(seeds, t, at(ALL12, level), days, skill, model);
        cells.push(`${x2(perDay(r, income).median / perDay(b, income).median)} / ${x2(depthPerDay(r).median / depthPerDay(b).median)}`);
      }
      rows.push([model.name, label, ...cells]);
    }
  }
  table(['model', 'all 12 at', ...tools.map(toolName)], rows);

  const { weights, raw } = stackWeights();
  console.log(`### Value of each item inside the level-3 stack (money lost if it is removed), ${toolName(toolId)}\n`);
  const book = proposeBook(weights);
  const vrows: string[][] = [];
  for (const u of ALL12) {
    const cur = `${n0(u.basePrice)} x${u.priceGrowth}`;
    const prop = book[u.id] ? `${n0(book[u.id].base)} x${book[u.id].growth}` : 'kept';
    const priceNow = (x: UpgradeItem, l: number): number => upgradePrice(x, l);
    const priceNew = (x: UpgradeItem, l: number): number => priceOf(x, l, book);
    vrows.push([
      u.name, raw[u.id].map((v) => x2(v)).join(' / '), weights[u.id].toFixed(3), cur, prop,
      `${money(cost([u], 3, priceNow))} -> ${money(cost([u], 3, priceNew))}`,
      `${money(cost([u], 'max', priceNow))} -> ${money(cost([u], 'max', priceNew))}`,
    ]);
  }
  table(['item', 'value (current / diminishing / preferred)', 'weight', 'price now (base xgrowth)', 'proposed', 'cost to level 3', 'cost to max'], vrows);
  const sets: Array<[string, UpgradeItem[]]> = [['all 12', ALL12], ['7 skills', SKILLS], ['5 prospecting', PROSPECTING]];
  table(
    ['set', 'level 3 now', 'level 3 proposed', 'max now', 'max proposed'],
    sets.map(([name, items]) => [
      name,
      money(cost(items, 3)), money(cost(items, 3, (u, l) => priceOf(u, l, book))),
      money(cost(items, 'max')), money(cost(items, 'max', (u, l) => priceOf(u, l, book))),
    ]),
  );
  return { weights, book };
}

// ---------- Phase E: purchase walk ----------
function phaseEAll(): void {
  console.log('## Phase E: purchase walk (a player earns, shops and levels for 150 days)\n');
  console.log('Tools and base upgrades follow dev/econ-sim.ts (best affordable tool, cheapest useful upgrade); household costs included; Master Digger left out (it is the endless sink). Prospector level gates tools and skills.\n');
  const { weights, book } = phaseD();
  phaseE(undefined, 'GAME TODAY (current rules, current prices)', MODELS.current, weights);
  phaseE(undefined, 'preferred rules, current prices', PREFERRED, weights);
  phaseE(book, 'preferred rules, PROPOSED prices', PREFERRED, weights);
}

if (phase === 'A') phaseA();
else if (phase === 'B') phaseB();
else if (phase === 'C') phaseC();
else if (phase === 'D') phaseD();
else if (phase === 'E') phaseEAll();
