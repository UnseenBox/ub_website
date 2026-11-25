// Retention rules (Phase 3): daily supply drop, daily contracts, Supply Depot,
// Fog Surge, Last Stand, Field Notes and weapon mastery. Pure functions over the
// profile and a timestamp, so every rule is unit-tested without Phaser or a clock.

import { ENEMIES } from '../data/enemies';
import { MISSIONS, MissionDef, TRAINING, missionById, plural } from '../data/missions';
import {
  CODEX_TIERS, CONTRACTS_PER_DAY, CONTRACT_RULES, CONTRACT_SET_BONUS, ContractKind, DEPOT_LEVELS, DEPOT_UPGRADE_COST,
  ENDLESS_CASH, ENDLESS_MILESTONES, ENDLESS_PER_WAVE, ENDLESS_UNLOCK, ENDLESS_WAVES, ENEMY_CONTRACT_TARGET, HQ_UNLOCK,
  LOGIN_REWARDS, LOGIN_SKIN_FALLBACK, LoginReward, MASTERY_TIERS, OBSIDIAN_MEDALS, SKINS, SURGE_FIRST_WIN, SURGE_MODIFIERS, SURGE_NAMES_A,
  SURGE_NAMES_B, SURGE_REPLAY, SURGE_UNLOCK, SkinId, SurgeModifierId,
} from '../data/retention';
import type { WaveDef } from '../data/waves';
import { weaponById } from '../data/weapons';
import {
  BuyResult, MissionOutcome, MissionResult, focusUnlocked, isWon, ownedSupports, ownedWeapons,
} from './Campaign';
import type { Contract } from './MetaState';
import type { ProfileData } from './Profile';

export const SURGE_ID = 'surge';
export const ENDLESS_ID = 'endless';
const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

// ------------------------------------------------------------------ days and dice

/** The local calendar day of a timestamp, as YYYY-MM-DD. */
export function dayKey(now: number): string {
  const d = new Date(now);
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Whole days since 1970 for a day key (so the gap between two keys is exact). */
export function dayNumber(key: string): number {
  const [y, m, d] = key.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / DAY_MS);
}

/** ms until the next local midnight (when dailies roll over). */
export function msToNextDay(now: number): number {
  const d = new Date(now);
  d.setHours(24, 0, 0, 0);
  return d.getTime() - now;
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Deterministic dice: the same day always rolls the same contracts and surge. */
function dice(seed: string): () => number {
  let a = hash(seed);
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = <T>(r: () => number, list: readonly T[]): T => list[Math.floor(r() * list.length)];

function shuffle<T>(r: () => number, list: T[]): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ------------------------------------------------------------------ what is open

/** The HQ (daily drop, contracts, depot, Field Notes) opens with mission 5. */
export const hqOpen = (p: ProfileData): boolean => isWon(p, HQ_UNLOCK);
export const surgeOpen = (p: ProfileData): boolean => isWon(p, SURGE_UNLOCK);
export const endlessOpen = (p: ProfileData): boolean => isWon(p, ENDLESS_UNLOCK);

/** Enemies the player has faced in a won mission (or killed anywhere). */
export function metEnemies(p: ProfileData): Set<string> {
  const met = new Set<string>(Object.keys(p.meta.codex).filter((id) => p.meta.codex[id] > 0));
  for (const m of MISSIONS) {
    if (!isWon(p, m.id)) continue;
    for (const w of m.waves) for (const g of w.groups) met.add(g.enemy);
    if (m.objective.kind === 'boss') met.add(m.objective.enemy);
    if (m.objective.kind === 'nests') met.add(m.objective.spawn.id);
  }
  return met;
}

/**
 * Brings the daily state up to today: new contracts and a fresh Fog Surge after
 * midnight, and the depot starts counting the first time the HQ is open.
 * Returns true when anything changed (so the caller saves).
 */
export function refreshDay(p: ProfileData, now: number): boolean {
  if (!hqOpen(p)) return false;
  const today = dayKey(now);
  const meta = p.meta;
  let changed = false;
  if (meta.daily.day !== today) {
    meta.daily = { day: today, contracts: rollContracts(p, today), rerolled: false, bonusPaid: false };
    changed = true;
  }
  if (meta.surge.day !== today) {
    meta.surge = { day: today, best: 0, won: false };
    changed = true;
  }
  if (meta.contested.day !== today) {
    meta.contested = { day: today, retaken: [] };
    changed = true;
  }
  if (meta.depot.since === 0) {
    meta.depot.since = now;
    changed = true;
  }
  return changed;
}

// ------------------------------------------------------------------ daily supply drop

export interface LoginStatus {
  /** A drop is waiting today. */
  ready: boolean;
  /** Calendar day (1–7) of today's drop, or of the one already claimed today. */
  day: number;
  reward: LoginReward;
  /** The streak was broken (two or more days missed) and starts again at day 1. */
  reset: boolean;
}

export function loginStatus(p: ProfileData, now: number): LoginStatus {
  const today = dayKey(now);
  const { last, streak } = p.meta.login;
  if (last === today) return { ready: false, day: streak, reward: LOGIN_REWARDS[Math.max(0, streak - 1)], reset: false };
  const gap = last ? dayNumber(today) - dayNumber(last) : Infinity;
  // A clock set back before the last claim waits for that day to come round again.
  if (gap <= 0) return { ready: false, day: streak, reward: LOGIN_REWARDS[Math.max(0, streak - 1)], reset: false };
  // One missed day is forgiven; two start the calendar over.
  const keeps = gap <= 2;
  const day = keeps ? (streak % LOGIN_REWARDS.length) + 1 : 1;
  return { ready: true, day, reward: LOGIN_REWARDS[day - 1], reset: !!last && !keeps && streak > 0 };
}

export interface LoginClaim {
  day: number;
  supplies: number;
  skin?: { weapon: string; skin: SkinId };
}

/** Claims today's drop (mutates the profile). Null when there is nothing to claim. */
export function claimLogin(p: ProfileData, now: number): LoginClaim | null {
  if (!hqOpen(p)) return null;
  const s = loginStatus(p, now);
  if (!s.ready) return null;
  let supplies = s.reward.supplies;
  let skin: LoginClaim['skin'];
  if (s.reward.skin) {
    const weapon = ownedWeapons(p).find((w) => !(p.meta.skins[w] ?? []).includes('crimson'));
    if (weapon) {
      (p.meta.skins[weapon] ??= []).push('crimson');
      skin = { weapon, skin: 'crimson' };
    } else supplies += LOGIN_SKIN_FALLBACK;
  }
  addSupplies(p, supplies);
  p.meta.login = { last: dayKey(now), streak: s.day };
  return { day: s.day, supplies, skin };
}

// ------------------------------------------------------------------ daily contracts

interface ContractOption {
  kind: ContractKind;
  params: string[];
}

/** The contracts this player can be given today (only for things they have). */
export function contractOptions(p: ProfileData): ContractOption[] {
  const opts: ContractOption[] = [
    { kind: 'kills', params: [] },
    { kind: 'headshots', params: [] },
    { kind: 'wins', params: [] },
    { kind: 'stars', params: [] },
  ];
  const enemies = [...metEnemies(p)].filter((id) => ENEMY_CONTRACT_TARGET[id] !== undefined);
  if (enemies.length) opts.push({ kind: 'enemy', params: enemies });
  opts.push({ kind: 'weapon', params: ownedWeapons(p) });
  const objectives = [...new Set(MISSIONS.filter((m) => isWon(p, m.id)).map((m) => m.objective.kind))]
    .filter((k) => k === 'protect' || k === 'evacuate' || k === 'nests');
  if (objectives.length) opts.push({ kind: 'objective', params: objectives });
  if (ownedSupports(p).length) opts.push({ kind: 'supports', params: [] });
  if (focusUnlocked(p)) opts.push({ kind: 'streak', params: [] });
  if (surgeOpen(p)) opts.push({ kind: 'surge', params: [] });
  if (endlessOpen(p)) opts.push({ kind: 'endless', params: [] });
  return opts;
}

function makeContract(kind: ContractKind, param?: string): Contract {
  const rule = CONTRACT_RULES[kind];
  const target = kind === 'enemy' ? ENEMY_CONTRACT_TARGET[param!] ?? 20 : rule.target;
  return { kind, param, target, progress: 0, reward: rule.reward, done: false };
}

/** Today's three contracts: different kinds, the same for the whole day. */
export function rollContracts(p: ProfileData, day: string, exclude: ContractKind[] = [], salt = ''): Contract[] {
  const r = dice(`contracts:${day}${salt}`);
  const opts = shuffle(r, contractOptions(p).filter((o) => !exclude.includes(o.kind)));
  return opts.slice(0, CONTRACTS_PER_DAY).map((o) => makeContract(o.kind, o.params.length ? pick(r, o.params) : undefined));
}

/** Swaps one unfinished contract for a different kind, once a day. */
export function rerollContract(p: ProfileData, index: number, now: number, extra = false): boolean {
  refreshDay(p, now);
  const d = p.meta.daily;
  const c = d.contracts[index];
  // `extra`: a swap paid for with a rewarded ad, on top of the free one.
  if (!c || c.done || (d.rerolled && !extra)) return false;
  const [fresh] = rollContracts(p, d.day ?? dayKey(now), d.contracts.map((x) => x.kind), ':reroll');
  if (!fresh) return false;
  d.contracts[index] = fresh;
  d.rerolled = true;
  return true;
}

const OBJECTIVE_NAMES: Record<string, string> = { protect: 'Protect', evacuate: 'Evacuate', nests: 'Nest' };

export function contractText(c: Contract): string {
  switch (c.kind) {
    case 'kills': return `Kill ${c.target} of the dead`;
    case 'headshots': return `Land ${c.target} headshot kills`;
    case 'enemy': return `Kill ${c.target} ${plural(ENEMIES[c.param!]?.name ?? 'enemy')}`;
    case 'weapon': return `Kill ${c.target} with the ${weaponById(c.param!).shortName}`;
    case 'wins': return `Win ${c.target} missions`;
    case 'objective': return `Win a${c.param === 'evacuate' ? 'n' : ''} ${OBJECTIVE_NAMES[c.param!] ?? c.param} mission`;
    case 'stars': return `Earn ${c.target} stars in mission results`;
    case 'supports': return `Call in ${c.target} support strikes`;
    case 'streak': return `Reach a ${c.target}-kill streak`;
    case 'surge': return "Win today's Fog Surge";
    case 'endless': return `Reach wave ${c.target} in Last Stand`;
  }
}

// ------------------------------------------------------------------ supply depot

export function depotLevel(p: ProfileData): (typeof DEPOT_LEVELS)[number] {
  return DEPOT_LEVELS[Math.min(DEPOT_LEVELS.length, Math.max(1, p.meta.depot.level)) - 1];
}

export function depotCap(p: ProfileData): number {
  const l = depotLevel(p);
  return l.rate * l.capHours;
}

/** Supplies waiting in the depot right now. */
export function depotStored(p: ProfileData, now: number): number {
  const since = p.meta.depot.since;
  if (!hqOpen(p) || since <= 0 || now <= since) return 0;
  return Math.min(depotCap(p), Math.floor(((now - since) / HOUR_MS) * depotLevel(p).rate));
}

/** Moves the depot's Supplies into the player's (mutates). Returns how many. */
export function collectDepot(p: ProfileData, now: number): number {
  const amount = depotStored(p, now);
  const d = p.meta.depot;
  if (now < d.since) d.since = now;
  if (amount <= 0) return 0;
  addSupplies(p, amount);
  // A full depot starts over; otherwise the part of an unfinished Supply keeps counting.
  if (amount >= depotCap(p)) d.since = now;
  else d.since += (amount / depotLevel(p).rate) * HOUR_MS;
  return amount;
}

export function depotUpgradeStatus(p: ProfileData): { cost: number | null; status: BuyResult } {
  const lv = p.meta.depot.level;
  if (lv >= DEPOT_LEVELS.length) return { cost: null, status: 'maxed' };
  const cost = DEPOT_UPGRADE_COST[lv - 1];
  return { cost, status: p.supplies >= cost ? 'ok' : 'supplies' };
}

/** Collects what is waiting, then raises the depot one level. */
export function buyDepotUpgrade(p: ProfileData, now: number): BuyResult {
  const { cost, status } = depotUpgradeStatus(p);
  if (status !== 'ok' || cost === null) return status;
  collectDepot(p, now);
  p.supplies -= cost;
  p.meta.depot.level += 1;
  return 'ok';
}

// ------------------------------------------------------------------ fog surge

/** Today's two surge modifiers. */
export function surgeModifiers(day: string): SurgeModifierId[] {
  const r = dice(`surge-mods:${day}`);
  return shuffle(r, Object.keys(SURGE_MODIFIERS) as SurgeModifierId[]).slice(0, 2);
}

/** Applies surge modifiers to a mission's waves (more, faster or tougher dead). */
function surgeWaves(waves: WaveDef[], mods: SurgeModifierId[]): WaveDef[] {
  return waves.map((w) => ({
    ...w,
    speedMul: w.speedMul + (mods.includes('fast') ? 0.12 : 0),
    healthMul: w.healthMul * (mods.includes('armoured') ? 1.3 : 1),
    groups: w.groups.map((g) => ({ ...g, count: mods.includes('horde') ? Math.ceil(g.count * 1.35) : g.count })),
  }));
}

/**
 * Today's Fog Surge: a hold mission built from one of the player's recently won
 * missions, with two modifiers. Same all day; a new one after midnight.
 */
export function surgeMission(p: ProfileData, day: string): MissionDef {
  const r = dice(`surge:${day}`);
  const won = MISSIONS.filter((m) => isWon(p, m.id) && m.objective.kind !== 'boss');
  const recent = won.slice(-4);
  const base = recent.length ? pick(r, recent) : MISSIONS[0];
  const mods = surgeModifiers(day);
  const hard = mods.filter((m) => m === 'horde' || m === 'fast' || m === 'armoured' || m === 'glass' || m === 'night').length;
  const name = `${pick(r, SURGE_NAMES_A)} ${pick(r, SURGE_NAMES_B)}`;
  return {
    id: SURGE_ID, mode: 'surge', act: base.act, number: 0, name, location: base.location, place: base.place,
    objective: { kind: 'hold' },
    waves: surgeWaves(base.waves, mods),
    startCash: base.startCash + 100,
    threat: base.threat + hard * 3,
    issue: { weapons: [], gear: [] },
    modifiers: {
      night: mods.includes('night') || undefined,
      drops: mods.includes('drops') ? 30 : undefined,
      cashMul: mods.includes('bounty') ? 1.5 : undefined,
      bunkerMul: mods.includes('glass') ? 0.65 : undefined,
      tags: mods.map((m) => SURGE_MODIFIERS[m].name),
    },
    bonus: { kind: 'headshots', count: 25 },
    supplies: SURGE_FIRST_WIN,
    firstClear: { weapons: [], gear: [] },
    brief: [
      { who: 'HALE', text: `Fog surge at ${base.place}, Warden. ${mods.map((m) => SURGE_MODIFIERS[m].text).join('. ')}.` },
      { who: 'VARGA', text: 'It pushes like this once a day. Break it and the line holds until tomorrow.' },
    ],
    debrief: [{ who: 'HALE', text: 'Surge broken. Same time tomorrow, Warden.' }],
    map: { x: 0, y: 0 },
  };
}

export function surgeScore(r: MissionResult): number {
  return r.kills * 10 + r.headshots * 15 + r.wavesCleared * 250 + (r.victory ? Math.round(r.bunkerFraction * 1000) : 0);
}

// ------------------------------------------------------------------ last stand

const ENDLESS_NAMES = ['Contact', 'Pressure', 'Crawl Space', 'The Column', 'Giants', 'Grey Wall', 'Rush', 'Black Water', 'No Sleep', 'The Tide'];

/** One Last Stand wave (1-based): bigger, faster and tougher every time, with every enemy the player has met. */
export function endlessWave(n: number, met: ReadonlySet<string>): WaveDef {
  const k = n - 1;
  const has = (id: string): boolean => met.has(id);
  const groups: WaveDef['groups'] = [
    { enemy: 'shambler', count: Math.min(60, 14 + 3 * k), delay: 0, interval: Math.max(0.45, 1.8 - 0.05 * k), burst: k >= 6 ? 2 : undefined },
  ];
  if (n >= 2) groups.push({ enemy: 'runner', count: Math.round(3 + k * 1.2), delay: 6, interval: Math.max(0.6, 3.5 - 0.1 * k) });
  if (n >= 3) groups.push({ enemy: 'crawler', count: 6 + k, delay: 10, interval: 1.6, burst: 2 });
  if (n >= 4) groups.push({ enemy: 'brute', count: 1 + Math.floor(k / 4), delay: 8, interval: Math.max(8, 22 - k * 0.6) });
  if (n >= 5) groups.push({ enemy: 'plated', count: 2 + Math.floor(k / 2), delay: 12, interval: Math.max(2.5, 6 - k * 0.12) });
  if (n >= 6 && has('spitter')) groups.push({ enemy: 'spitter', count: 2 + Math.floor(k / 4), delay: 14, interval: 7 });
  if (n >= 7) groups.push({ enemy: 'carrier', count: 1 + Math.floor(k / 5), delay: 16, interval: 9 });
  if (n >= 8 && has('sapper')) groups.push({ enemy: 'sapper', count: 2 + Math.floor(k / 3), delay: 18, interval: 5 });
  if (n >= 9 && has('howler')) groups.push({ enemy: 'howler', count: 1 + Math.floor(k / 6), delay: 20, interval: 12 });
  if (n >= 13 && has('lurker')) groups.push({ enemy: 'lurker', count: 2 + Math.floor(k / 3), delay: 11, interval: 2.8 });
  if (n >= 14 && has('sporeling')) groups.push({ enemy: 'sporeling', count: 1 + Math.floor(k / 5), delay: 15, interval: 6 });
  if (n >= 12 && has('fogborn')) groups.push({ enemy: 'fogborn', count: 2 + Math.floor(k / 3), delay: 9, interval: 2.5 });
  if (n >= 15 && has('ravager')) groups.push({ enemy: 'ravager', count: 1 + Math.floor(k / 10), delay: 26, interval: 16 });
  if (n >= 11 && has('juggernaut')) groups.push({ enemy: 'juggernaut', count: 1 + Math.floor(k / 6), delay: 22, interval: 14 });
  // Every fifth wave ends with a pack of giants.
  if (n % 5 === 0) groups.push({ enemy: 'brute', count: 2 + Math.floor(n / 10), delay: 34, interval: 3 });
  return {
    name: n % 5 === 0 ? 'Giants' : ENDLESS_NAMES[k % ENDLESS_NAMES.length],
    speedMul: Math.min(1.25, 1 + 0.01 * k),
    healthMul: 1 + 0.045 * k,
    groups,
  };
}

/** Last Stand: the farm bunker, wave after wave, until it falls. */
export function endlessMission(p: ProfileData): MissionDef {
  const met = metEnemies(p);
  return {
    id: ENDLESS_ID, mode: 'endless', act: 1, number: 0, name: 'Last Stand', location: 'farm', place: 'Harlow farm bunker',
    objective: { kind: 'hold' },
    waves: Array.from({ length: ENDLESS_WAVES }, (_, i) => endlessWave(i + 1, met)),
    startCash: ENDLESS_CASH, threat: 0,
    issue: { weapons: [], gear: [] },
    bonus: { kind: 'headshots', count: 50 },
    supplies: 0,
    firstClear: { weapons: [], gear: [] },
    brief: [
      { who: 'HALE', text: 'No convoy to cover this time, Warden. Just you, the farm and the fog. See how long you last.' },
    ],
    debrief: [],
    map: { x: 0, y: 0 },
  };
}

// ------------------------------------------------------------------ missions by id

/** Any playable mission: campaign, training, today's Fog Surge or Last Stand. */
export function resolveMission(id: string | undefined, p: ProfileData, now: number): MissionDef | undefined {
  if (!id) return undefined;
  if (id === 'training') return TRAINING;
  if (id === SURGE_ID) return surgeMission(p, dayKey(now));
  if (id === ENDLESS_ID) return endlessMission(p);
  return missionById(id);
}

// ------------------------------------------------------------------ results of a surge or last stand

export interface ModeOutcome extends MissionOutcome {
  score: number;
  best: number;
  newBest: boolean;
  milestones: { wave: number; supplies: number }[];
}

/** Records a Fog Surge or Last Stand run (mutates) and returns what it earned. */
export function applyModeResult(p: ProfileData, m: MissionDef, r: MissionResult, now: number): ModeOutcome {
  refreshDay(p, now);
  p.bestKills = Math.max(p.bestKills, r.kills);
  const base: ModeOutcome = {
    stars: 0, previousStars: 0, supplies: 0, firstClear: false, unlockedWeapons: [], unlockedGear: [], unlockedRecruits: [],
    bonusMet: false, bunkerStar: false, score: 0, best: 0, newBest: false, milestones: [],
  };
  if (m.mode === 'surge') {
    const s = p.meta.surge;
    const firstWin = r.victory && !s.won;
    base.firstClear = firstWin;
    base.supplies = firstWin ? SURGE_FIRST_WIN : SURGE_REPLAY;
    if (r.victory) s.won = true;
    base.score = surgeScore(r);
    base.newBest = base.score > s.best;
    s.best = Math.max(s.best, base.score);
    base.best = s.best;
  } else {
    const e = p.meta.endless;
    const wave = r.wavesCleared;
    base.score = wave;
    base.newBest = wave > e.best;
    e.best = Math.max(e.best, wave);
    base.best = e.best;
    base.supplies = wave * ENDLESS_PER_WAVE;
    for (const ms of ENDLESS_MILESTONES) {
      if (wave >= ms.wave && !e.milestones.includes(ms.wave)) {
        e.milestones.push(ms.wave);
        base.milestones.push(ms);
        base.supplies += ms.supplies;
      }
    }
  }
  addSupplies(p, base.supplies);
  return base;
}

// ------------------------------------------------------------------ every run: contracts, notes, mastery

/** What one battle did, as reported by the game, for contracts, Field Notes and mastery. */
export interface RunStats {
  mode: 'campaign' | 'surge' | 'endless';
  objective: string;
  victory: boolean;
  kills: number;
  headshots: number;
  stars: number;
  wavesCleared: number;
  enemyKills: Record<string, number>;
  weaponKills: Record<string, number>;
  supportCalls: number;
  bestStreak: number;
}

export interface RunRewards {
  contracts: { text: string; reward: number }[];
  setBonus: number;
  codex: { enemy: string; page: number; supplies: number }[];
  skins: { weapon: string; skin: SkinId }[];
  supplies: number;
}

function contractGain(c: Contract, run: RunStats): number {
  switch (c.kind) {
    case 'kills': return run.kills;
    case 'headshots': return run.headshots;
    case 'enemy': return run.enemyKills[c.param!] ?? 0;
    case 'weapon': return run.weaponKills[c.param!] ?? 0;
    case 'wins': return run.victory && run.mode !== 'endless' ? 1 : 0;
    case 'objective': return run.victory && run.mode === 'campaign' && run.objective === c.param ? 1 : 0;
    case 'stars': return run.stars;
    case 'supports': return run.supportCalls;
    // Best-of kinds: progress is the best single run, not a sum.
    case 'streak': return Math.max(0, run.bestStreak - c.progress);
    case 'surge': return run.mode === 'surge' && run.victory ? 1 : 0;
    case 'endless': return run.mode === 'endless' ? Math.max(0, run.wavesCleared - c.progress) : 0;
  }
}

/** Counts a finished battle toward contracts, Field Notes and mastery (mutates) and pays for it. */
export function recordRun(p: ProfileData, run: RunStats, now: number): RunRewards {
  refreshDay(p, now);
  const out: RunRewards = { contracts: [], setBonus: 0, codex: [], skins: [], supplies: 0 };
  const meta = p.meta;

  if (hqOpen(p)) {
    for (const c of meta.daily.contracts) {
      if (c.done) continue;
      c.progress = Math.min(c.target, c.progress + contractGain(c, run));
      if (c.progress >= c.target) {
        c.done = true;
        out.contracts.push({ text: contractText(c), reward: c.reward });
        out.supplies += c.reward;
      }
    }
    const all = meta.daily.contracts.length > 0 && meta.daily.contracts.every((c) => c.done);
    if (all && !meta.daily.bonusPaid) {
      meta.daily.bonusPaid = true;
      out.setBonus = CONTRACT_SET_BONUS;
      out.supplies += CONTRACT_SET_BONUS;
    }
  }

  for (const [enemy, n] of Object.entries(run.enemyKills)) {
    if (n <= 0) continue;
    const total = (meta.codex[enemy] = (meta.codex[enemy] ?? 0) + n);
    let paid = meta.codexPaid[enemy] ?? 0;
    while (paid < CODEX_TIERS.length && total >= CODEX_TIERS[paid].kills) {
      out.codex.push({ enemy, page: paid + 1, supplies: CODEX_TIERS[paid].supplies });
      out.supplies += CODEX_TIERS[paid].supplies;
      paid++;
    }
    meta.codexPaid[enemy] = paid;
  }

  for (const [weapon, n] of Object.entries(run.weaponKills)) {
    if (n <= 0) continue;
    const before = meta.mastery[weapon] ?? 0;
    const after = (meta.mastery[weapon] = before + n);
    for (const t of MASTERY_TIERS) if (before < t.kills && after >= t.kills) out.skins.push({ weapon, skin: t.skin });
  }

  addSupplies(p, out.supplies);
  return out;
}

// ------------------------------------------------------------------ field notes

/** Pages of an enemy's notes unlocked by kills (0–3). */
export function codexPages(p: ProfileData, enemy: string): number {
  const kills = p.meta.codex[enemy] ?? 0;
  return CODEX_TIERS.filter((t) => kills >= t.kills).length;
}

// ------------------------------------------------------------------ mastery and skins

/** Kills with a weapon and the next skin it is working toward. */
export function masteryStatus(p: ProfileData, weapon: string): { kills: number; next: { kills: number; skin: SkinId } | null } {
  const kills = p.meta.mastery[weapon] ?? 0;
  return { kills, next: MASTERY_TIERS.find((t) => kills < t.kills) ?? null };
}

export function ownedSkins(p: ProfileData, weapon: string): SkinId[] {
  const kills = p.meta.mastery[weapon] ?? 0;
  const set = new Set<SkinId>(MASTERY_TIERS.filter((t) => kills >= t.kills).map((t) => t.skin));
  for (const s of p.meta.skins[weapon] ?? []) set.add(s);
  // Veteran medals paint every gun black.
  if (Object.values(p.missions).filter((r) => r.veteran).length >= OBSIDIAN_MEDALS) set.add('obsidian');
  return (Object.keys(SKINS) as SkinId[]).filter((s) => set.has(s));
}

/** The skin a weapon wears, if the player still owns it ('' = factory finish). */
export function activeSkin(p: ProfileData, weapon: string): SkinId | '' {
  const s = p.meta.skinOn[weapon] as SkinId | undefined;
  return s && ownedSkins(p, weapon).includes(s) ? s : '';
}

export function setSkin(p: ProfileData, weapon: string, skin: SkinId | ''): boolean {
  if (skin && !ownedSkins(p, weapon).includes(skin)) return false;
  p.meta.skinOn[weapon] = skin;
  return true;
}

// ------------------------------------------------------------------ contested nodes

/** Won missions the fog takes back each day. */
export const CONTESTED_PER_DAY = 2;
/** A retaken node pays this share of the mission's Supplies on top, once a day. */
export const CONTESTED_BONUS = 0.6;

/**
 * Today's contested missions: up to two won campaign missions (never a boss) that
 * the fog has re-taken. Same all day, new ones at midnight. Opens with the HQ.
 */
export function contestedMissions(p: ProfileData, day: string): string[] {
  if (!hqOpen(p)) return [];
  const won = MISSIONS.filter((m) => isWon(p, m.id) && m.objective.kind !== 'boss').map((m) => m.id);
  if (won.length < 4) return [];
  // The newest win stays clear: the player just took it.
  return shuffle(dice(`contested:${day}`), won.slice(0, -1)).slice(0, CONTESTED_PER_DAY);
}

export function isContested(p: ProfileData, missionId: string, now: number): boolean {
  const day = dayKey(now);
  const done = p.meta.contested.day === day && p.meta.contested.retaken.includes(missionId);
  return !done && contestedMissions(p, day).includes(missionId);
}

/** Pays the retake bonus for a won contested mission (mutates). Returns the Supplies paid (0 if none). */
export function claimContested(p: ProfileData, m: MissionDef, victory: boolean, now: number): number {
  refreshDay(p, now);
  if (!victory || !isContested(p, m.id, now)) return 0;
  p.meta.contested.retaken.push(m.id);
  const bonus = Math.round(m.supplies * CONTESTED_BONUS);
  addSupplies(p, bonus);
  return bonus;
}

// ------------------------------------------------------------------ playtest numbers

/** A mission was deployed (mutates). */
export function noteStart(p: ProfileData, missionId: string): void {
  const s = (p.meta.play[missionId] ??= { starts: 0, wins: 0, fails: 0, seconds: 0 });
  s.starts += 1;
}

/** A mission ended (mutates). */
export function noteFinish(p: ProfileData, missionId: string, victory: boolean, seconds: number): void {
  const s = (p.meta.play[missionId] ??= { starts: 0, wins: 0, fails: 0, seconds: 0 });
  if (victory) s.wins += 1;
  else s.fails += 1;
  s.seconds += Math.max(0, seconds);
}

export interface PlayRow {
  id: string;
  name: string;
  starts: number;
  wins: number;
  fails: number;
  /** Losses / finished runs, 0–1. */
  failRate: number;
  /** Average minutes per finished run. */
  minutes: number;
}

/** One row per mission played, in campaign order, then the modes. */
export function playReport(p: ProfileData): PlayRow[] {
  const order = [...MISSIONS.map((m) => m.id), SURGE_ID, ENDLESS_ID, 'training'];
  return Object.entries(p.meta.play)
    .sort(([a], [b]) => (order.indexOf(a) + 1 || 999) - (order.indexOf(b) + 1 || 999))
    .map(([id, s]) => {
      const done = s.wins + s.fails;
      const m = missionById(id);
      return {
        id, name: m ? m.name : id === SURGE_ID ? 'Fog Surge' : id === ENDLESS_ID ? 'Last Stand' : id,
        starts: s.starts, wins: s.wins, fails: s.fails,
        failRate: done ? s.fails / done : 0,
        minutes: done ? s.seconds / done / 60 : 0,
      };
    });
}

// ------------------------------------------------------------------ HQ badge

/** Things waiting at the HQ: today's drop, and a depot at least half full. */
export function hqWaiting(p: ProfileData, now: number): string[] {
  if (!hqOpen(p)) return [];
  const out: string[] = [];
  if (loginStatus(p, now).ready) out.push('DAILY DROP');
  if (depotStored(p, now) >= depotCap(p) / 2) out.push('DEPOT');
  if (surgeOpen(p) && !(p.meta.surge.day === dayKey(now) && p.meta.surge.won)) out.push('FOG SURGE');
  return out;
}

function addSupplies(p: ProfileData, n: number): void {
  if (n <= 0) return;
  p.supplies += n;
  p.suppliesEarned += n;
}
