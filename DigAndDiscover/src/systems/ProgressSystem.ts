import { ALL_TOOLS } from '../data/store';
import { ONBOARDING, rollGoal, type GoalContext, type GoalDef, type GoalMetric } from '../data/goals';
import { TOOL_DEFS } from '../data/tools';

export interface Goal extends GoalDef {
  progress: number;
}

export interface SaveData {
  v: 1;
  money: number;
  day: number;
  found: number;
  cut: number;
  xp: number;
  owned: string[];
  upgrades: Record<string, number>;
  goals: Goal[];
  goalSeq: number;
  bestDepth: number;
}

export interface ProgressHooks {
  /** Something visible changed (level, XP, goals, owned tools, upgrades). */
  changed: () => void;
  levelUp: (level: number, bonus: number) => void;
  goalDone: (goal: Goal) => void;
  /** Hand out cash (goal and level rewards). */
  grant: (cash: number) => void;
}

const SAVE_KEY = 'dig-and-discover-save-v1';
const GOAL_SLOTS = 3;

/** XP needed to climb from `level` to `level + 1`. */
export const xpToNext = (level: number): number => Math.round(40 * Math.pow(level, 1.35));
/** Cash for reaching a level. */
export const levelBonus = (level: number): number => 40 * level;
/** XP for cutting a rock, by rarity tier. */
export const ROCK_XP = [3, 8, 20, 50, 150] as const;

/**
 * Long-term progress: prospector level and XP, owned tools, upgrade levels,
 * the three active goals and the save file. Framework-free; GameState wires it up.
 */
export class ProgressSystem {
  xp = 0;
  bestDepth = 0;
  goals: Goal[] = [];
  private goalSeq = 0;
  private readonly owned = new Set<string>(['tool-old-shovel']);
  private readonly upgrades: Record<string, number> = {};
  private totalDepth = 30;

  constructor(private readonly hooks: ProgressHooks) {}

  setTotalDepth(meters: number): void {
    this.totalDepth = meters;
  }

  private get context(): GoalContext {
    return { level: this.level, bestDepth: this.bestDepth, totalDepth: this.totalDepth };
  }

  // ---------- level ----------

  get level(): number {
    return this.levelProgress.level;
  }

  /** XP gathered inside the current level, and what the level needs in total. */
  get levelProgress(): { level: number; into: number; need: number; fraction: number } {
    let level = 1;
    let rest = this.xp;
    while (rest >= xpToNext(level)) {
      rest -= xpToNext(level);
      level++;
    }
    const need = xpToNext(level);
    return { level, into: rest, need, fraction: rest / need };
  }

  addXp(amount: number): void {
    const before = this.level;
    this.xp += Math.max(0, Math.round(amount));
    const after = this.level;
    for (let l = before + 1; l <= after; l++) {
      const bonus = levelBonus(l);
      this.hooks.grant(bonus);
      this.hooks.levelUp(l, bonus);
    }
    this.hooks.changed();
  }

  // ---------- tools & upgrades ----------

  owns(id: string): boolean {
    return this.owned.has(id);
  }

  own(id: string): void {
    this.owned.add(id);
    this.hooks.changed();
  }

  upgradeLevel(id: string): number {
    return this.upgrades[id] ?? 0;
  }

  setUpgradeLevel(id: string, level: number): void {
    this.upgrades[id] = level;
    this.hooks.changed();
  }

  /** The owned digging tool with the most power is the one in your hands. */
  get equippedToolId(): string {
    let best = 'tool-old-shovel';
    for (const id of this.owned) {
      const def = TOOL_DEFS[id];
      if (def && def.power > TOOL_DEFS[best].power) best = id;
    }
    return best;
  }

  /** Every owned scanner id. */
  get scanners(): string[] {
    return ALL_TOOLS.filter((t) => t.kind === 'scanner' && this.owned.has(t.id)).map((t) => t.id);
  }

  // ---------- goals ----------

  /** Fills any empty goal slot (a save may already have restored them). */
  ensureGoals(): void {
    while (this.goals.length < GOAL_SLOTS) this.goals.push({ ...this.nextGoalDef(), progress: 0 });
  }

  private nextGoalDef(): GoalDef {
    const active = this.goals.map((g) => g.metric);
    const scripted = ONBOARDING[this.goalSeq];
    if (scripted && !active.includes(scripted.metric)) {
      this.goalSeq++;
      return scripted;
    }
    return rollGoal(this.context, active);
  }

  /** Report progress. `absolute` metrics (depth) keep the maximum instead of adding up. */
  note(metric: GoalMetric, amount = 1, absolute = false): void {
    if (metric === 'depth' && amount > this.bestDepth) this.bestDepth = amount;
    let changed = false;
    for (const goal of [...this.goals]) {
      if (goal.metric !== metric) continue;
      const next = absolute ? Math.max(goal.progress, amount) : goal.progress + amount;
      if (next === goal.progress) continue;
      goal.progress = Math.min(goal.target, next);
      changed = true;
      if (goal.progress >= goal.target) this.complete(goal);
    }
    if (changed) this.hooks.changed();
  }

  private complete(goal: Goal): void {
    const index = this.goals.indexOf(goal);
    if (index < 0) return;
    this.hooks.grant(goal.cash);
    this.hooks.goalDone(goal);
    this.goals.splice(index, 1);
    // The replacement may already be satisfied (e.g. a depth goal): it starts from the current best.
    const next: Goal = { ...this.nextGoalDef(), progress: 0 };
    this.goals.splice(index, 0, next);
    this.addXp(goal.xp);
  }

  // ---------- save ----------

  toSave(extra: { money: number; day: number; found: number; cut: number }): SaveData {
    return {
      v: 1,
      ...extra,
      xp: this.xp,
      owned: [...this.owned],
      upgrades: { ...this.upgrades },
      goals: this.goals.map((g) => ({ ...g })),
      goalSeq: this.goalSeq,
      bestDepth: this.bestDepth,
    };
  }

  restore(data: SaveData): void {
    this.xp = Math.max(0, data.xp | 0);
    this.bestDepth = Math.max(0, data.bestDepth || 0);
    this.owned.clear();
    this.owned.add('tool-old-shovel');
    for (const id of data.owned ?? []) if (typeof id === 'string') this.owned.add(id);
    for (const [id, lv] of Object.entries(data.upgrades ?? {})) this.upgrades[id] = Math.max(0, lv | 0);
    this.goalSeq = Math.max(0, data.goalSeq | 0);
    this.goals = (data.goals ?? []).slice(0, GOAL_SLOTS).map((g) => ({ ...g }));
  }
}

export function readSave(): SaveData | null {
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.has('reset')) {
      localStorage.setItem(SAVE_KEY, '');
      return null;
    }
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as SaveData;
    return data && data.v === 1 ? data : null;
  } catch {
    return null;
  }
}

export function writeSave(data: SaveData): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch {
    /* private mode or full storage: progress simply will not persist */
  }
}
