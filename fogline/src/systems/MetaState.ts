// The retention part of the profile: daily drop, contracts, depot, Fog Surge,
// Last Stand, Field Notes and mastery. Kept apart from Profile.ts so the save
// format stays readable; Profile stores it under `meta`.

import type { ContractKind, SkinId } from '../data/retention';
import { DEPOT_LEVELS, SKINS } from '../data/retention';

export interface Contract {
  kind: ContractKind;
  /** Enemy id, weapon id or objective kind, for the kinds that need one. */
  param?: string;
  target: number;
  progress: number;
  reward: number;
  done: boolean;
}

export interface MetaData {
  login: {
    /** Day key (YYYY-MM-DD, local time) of the last claimed drop. */
    last: string | null;
    /** Calendar day (1–7) of the last claimed drop. */
    streak: number;
  };
  daily: {
    /** The day these contracts belong to. */
    day: string | null;
    contracts: Contract[];
    rerolled: boolean;
    bonusPaid: boolean;
  };
  depot: {
    level: number;
    /** ms since epoch the stored Supplies are counted from; 0 until the depot is built. */
    since: number;
  };
  surge: {
    day: string | null;
    best: number;
    won: boolean;
  };
  endless: {
    best: number;
    milestones: number[];
  };
  /** Lifetime kills per enemy, and the Field Notes pages already paid. */
  codex: Record<string, number>;
  codexPaid: Record<string, number>;
  /** Lifetime kills per weapon (mastery). */
  mastery: Record<string, number>;
  /** Skins earned outside mastery (the day-7 Crimson). */
  skins: Record<string, SkinId[]>;
  /** The skin each weapon wears ('' or missing = factory finish). */
  skinOn: Record<string, string>;
  /** Won missions the fog has taken back today, and the ones already retaken. */
  contested: { day: string | null; retaken: string[] };
  /** Playtest numbers per mission: runs started, won, lost and seconds played. */
  play: Record<string, PlayStats>;
}

export interface PlayStats {
  starts: number;
  wins: number;
  fails: number;
  seconds: number;
}

export function defaultMeta(): MetaData {
  return {
    login: { last: null, streak: 0 },
    daily: { day: null, contracts: [], rerolled: false, bonusPaid: false },
    depot: { level: 1, since: 0 },
    surge: { day: null, best: 0, won: false },
    endless: { best: 0, milestones: [] },
    codex: {},
    codexPaid: {},
    mastery: {},
    skins: {},
    skinOn: {},
    contested: { day: null, retaken: [] },
    play: {},
  };
}

const num = (v: unknown, fallback = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
const int = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): number => Math.min(max, Math.max(min, Math.floor(num(v, min))));
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const dayKeyOrNull = (v: unknown): string | null => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);

function counts(v: unknown, max = Number.MAX_SAFE_INTEGER): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, n] of Object.entries(obj(v))) out[k] = int(n, 0, max);
  return out;
}

/** Reads the stored meta block, repairing anything missing or malformed. */
export function parseMeta(raw: unknown): MetaData {
  const m = defaultMeta();
  const d = obj(raw);
  const login = obj(d.login);
  m.login = { last: dayKeyOrNull(login.last), streak: int(login.streak, 0, 7) };
  const daily = obj(d.daily);
  m.daily.day = dayKeyOrNull(daily.day);
  m.daily.rerolled = daily.rerolled === true;
  m.daily.bonusPaid = daily.bonusPaid === true;
  if (Array.isArray(daily.contracts)) {
    for (const c of daily.contracts.slice(0, 5)) {
      const o = obj(c);
      if (typeof o.kind !== 'string') continue;
      const target = int(o.target, 1);
      const progress = int(o.progress, 0, target);
      m.daily.contracts.push({
        kind: o.kind as ContractKind,
        param: typeof o.param === 'string' ? o.param : undefined,
        target, progress, reward: int(o.reward), done: o.done === true || progress >= target,
      });
    }
  }
  const depot = obj(d.depot);
  m.depot = { level: int(depot.level ?? 1, 1, DEPOT_LEVELS.length), since: Math.max(0, num(depot.since)) };
  const surge = obj(d.surge);
  m.surge = { day: dayKeyOrNull(surge.day), best: int(surge.best), won: surge.won === true };
  const endless = obj(d.endless);
  m.endless = {
    best: int(endless.best),
    milestones: Array.isArray(endless.milestones) ? [...new Set(endless.milestones.filter((n): n is number => typeof n === 'number'))] : [],
  };
  m.codex = counts(d.codex);
  m.codexPaid = counts(d.codexPaid, 3);
  m.mastery = counts(d.mastery);
  for (const [w, list] of Object.entries(obj(d.skins))) {
    if (Array.isArray(list)) m.skins[w] = [...new Set(list.filter((s): s is SkinId => typeof s === 'string' && s in SKINS))];
  }
  for (const [w, s] of Object.entries(obj(d.skinOn))) if (typeof s === 'string' && (s === '' || s in SKINS)) m.skinOn[w] = s;
  const con = obj(d.contested);
  m.contested = {
    day: dayKeyOrNull(con.day),
    retaken: Array.isArray(con.retaken) ? [...new Set(con.retaken.filter((x): x is string => typeof x === 'string'))] : [],
  };
  for (const [id, raw] of Object.entries(obj(d.play))) {
    const s = obj(raw);
    m.play[id] = { starts: int(s.starts), wins: int(s.wins), fails: int(s.fails), seconds: Math.max(0, num(s.seconds)) };
  }
  return m;
}
