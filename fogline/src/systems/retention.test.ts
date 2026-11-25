import { describe, expect, it } from 'vitest';
import { ENEMIES } from '../data/enemies';
import { MISSIONS, missionIndex } from '../data/missions';
import {
  CODEX_TIERS, CONTRACT_SET_BONUS, DEPOT_LEVELS, ENDLESS_MILESTONES, ENDLESS_UNLOCK, FIELD_NOTES, HQ_UNLOCK, LOGIN_REWARDS,
  SURGE_FIRST_WIN, SURGE_REPLAY, SURGE_UNLOCK,
} from '../data/retention';
import { WEAPONS } from '../data/weapons';
import { MissionResult, applyResult } from './Campaign';
import { parseMeta } from './MetaState';
import { ProfileData, defaultProfile, parseProfile } from './Profile';
import {
  ENDLESS_ID, RunStats, SURGE_ID, activeSkin, applyModeResult, buyDepotUpgrade, claimLogin, codexPages, collectDepot,
  contractText, dayKey, dayNumber, depotCap, depotStored, endlessMission, endlessOpen, endlessWave, hqOpen, hqWaiting,
  loginStatus, masteryStatus, metEnemies, ownedSkins, recordRun, refreshDay, rerollContract, resolveMission, rollContracts,
  setSkin, surgeMission, surgeModifiers, surgeOpen,
} from './Retention';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
/** Noon local time on 1 March 2027, so day arithmetic never crosses a DST edge at midnight. */
const T0 = new Date(2027, 2, 1, 12, 0, 0).getTime();

const win = (over: Partial<MissionResult> = {}): MissionResult => ({
  victory: true, wavesCleared: 3, totalWaves: 3, kills: 60, headshots: 20, accuracy: 0.6,
  bunkerFraction: 0.8, supportsUsed: [], earned: 3000, ...over,
});

const run = (over: Partial<RunStats> = {}): RunStats => ({
  mode: 'campaign', objective: 'hold', victory: true, kills: 0, headshots: 0, stars: 0, wavesCleared: 3,
  enemyKills: {}, weaponKills: {}, supportCalls: 0, bestStreak: 0, ...over,
});

function wonThrough(id: string): ProfileData {
  const p = defaultProfile();
  for (const m of MISSIONS.slice(0, missionIndex(id) + 1)) p.missions[m.id] = { stars: 3, wins: 1, plays: 1, bestKills: 0, veteran: false };
  return p;
}

describe('days', () => {
  it('keys days in local time and counts the gap between them', () => {
    expect(dayKey(T0)).toBe('2027-03-01');
    expect(dayNumber(dayKey(T0 + DAY)) - dayNumber(dayKey(T0))).toBe(1);
    expect(dayNumber('2027-03-01') - dayNumber('2027-02-28')).toBe(1);
  });
});

describe('unlocks', () => {
  it('opens the HQ, Fog Surge and Last Stand with their missions', () => {
    expect(hqOpen(defaultProfile())).toBe(false);
    expect(hqOpen(wonThrough(HQ_UNLOCK))).toBe(true);
    expect(surgeOpen(wonThrough(HQ_UNLOCK))).toBe(false);
    expect(surgeOpen(wonThrough(SURGE_UNLOCK))).toBe(true);
    expect(endlessOpen(wonThrough(SURGE_UNLOCK))).toBe(false);
    expect(endlessOpen(wonThrough(ENDLESS_UNLOCK))).toBe(true);
  });

  it('keeps dailies quiet before the HQ opens', () => {
    const p = wonThrough('a1m2');
    expect(refreshDay(p, T0)).toBe(false);
    expect(p.meta.daily.contracts).toEqual([]);
    expect(claimLogin(p, T0)).toBeNull();
    expect(hqWaiting(p, T0)).toEqual([]);
  });
});

describe('daily supply drop', () => {
  it('walks the seven-day calendar and wraps', () => {
    const p = wonThrough(HQ_UNLOCK);
    let total = 0;
    for (let d = 0; d < 8; d++) {
      const c = claimLogin(p, T0 + d * DAY)!;
      expect(c.day).toBe((d % 7) + 1);
      total += c.supplies;
      expect(claimLogin(p, T0 + d * DAY + HOUR)).toBeNull();
    }
    expect(total).toBe(LOGIN_REWARDS.reduce((n, r) => n + r.supplies, 0) + LOGIN_REWARDS[0].supplies);
  });

  it('forgives one missed day and resets after two', () => {
    const p = wonThrough(HQ_UNLOCK);
    claimLogin(p, T0);
    claimLogin(p, T0 + DAY);
    expect(loginStatus(p, T0 + 3 * DAY).day).toBe(3);
    claimLogin(p, T0 + 3 * DAY);
    const late = loginStatus(p, T0 + 6 * DAY);
    expect(late.day).toBe(1);
    expect(late.reset).toBe(true);
  });

  it('does not pay again when the clock goes back', () => {
    const p = wonThrough(HQ_UNLOCK);
    claimLogin(p, T0 + 5 * DAY);
    expect(loginStatus(p, T0).ready).toBe(false);
  });

  it('paints a weapon Crimson on day 7, then pays Supplies once every gun has it', () => {
    const p = wonThrough(HQ_UNLOCK);
    p.weapons = [];
    for (let d = 0; d < 6; d++) claimLogin(p, T0 + d * DAY);
    const c = claimLogin(p, T0 + 6 * DAY)!;
    expect(c.skin).toEqual({ weapon: 'service', skin: 'crimson' });
    expect(ownedSkins(p, 'service')).toContain('crimson');
    for (let d = 7; d < 13; d++) claimLogin(p, T0 + d * DAY);
    const again = claimLogin(p, T0 + 13 * DAY)!;
    expect(again.skin).toBeUndefined();
    expect(again.supplies).toBeGreaterThan(LOGIN_REWARDS[6].supplies);
  });
});

describe('daily contracts', () => {
  it('rolls three different contracts, the same all day, new tomorrow', () => {
    const p = wonThrough(ENDLESS_UNLOCK);
    refreshDay(p, T0);
    const today = p.meta.daily.contracts;
    expect(today).toHaveLength(3);
    expect(new Set(today.map((c) => c.kind)).size).toBe(3);
    expect(rollContracts(p, dayKey(T0))).toEqual(today);
    refreshDay(p, T0 + HOUR);
    expect(p.meta.daily.contracts).toBe(today);
    const days = new Set<string>();
    for (let d = 0; d < 10; d++) days.add(JSON.stringify(rollContracts(p, dayKey(T0 + d * DAY)).map((c) => c.kind)));
    expect(days.size).toBeGreaterThan(3);
  });

  it('only asks for things the player has', () => {
    const p = wonThrough(HQ_UNLOCK);
    const met = metEnemies(p);
    for (let d = 0; d < 40; d++) {
      for (const c of rollContracts(p, dayKey(T0 + d * DAY))) {
        expect(['surge', 'endless', 'streak']).not.toContain(c.kind);
        if (c.kind === 'enemy') expect(met.has(c.param!)).toBe(true);
        if (c.kind === 'weapon') expect(WEAPONS.find((w) => w.id === c.param)!.price === 0 || p.weapons.includes(c.param!)).toBe(true);
        expect(contractText(c).length).toBeGreaterThan(8);
      }
    }
  });

  it('counts runs, pays each contract once, and pays the set bonus', () => {
    const p = wonThrough(HQ_UNLOCK);
    refreshDay(p, T0);
    p.meta.daily.contracts = [
      { kind: 'kills', target: 100, progress: 0, reward: 70, done: false },
      { kind: 'enemy', param: 'runner', target: 10, progress: 0, reward: 70, done: false },
      { kind: 'wins', target: 2, progress: 0, reward: 80, done: false },
    ];
    const before = p.supplies;
    const r1 = recordRun(p, run({ kills: 60, enemyKills: { runner: 12 } }), T0);
    expect(r1.contracts.map((c) => c.reward)).toEqual([70]);
    const r2 = recordRun(p, run({ kills: 60 }), T0 + HOUR);
    expect(r2.contracts.map((c) => c.reward)).toEqual([70, 80]);
    expect(r2.setBonus).toBe(CONTRACT_SET_BONUS);
    const r3 = recordRun(p, run({ kills: 60 }), T0 + 2 * HOUR);
    expect(r3.contracts).toEqual([]);
    expect(r3.setBonus).toBe(0);
    expect(p.supplies - before).toBe(70 + 70 + 80 + CONTRACT_SET_BONUS + r1.codex.reduce((n, c) => n + c.supplies, 0));
  });

  it('tracks best-of contracts by the best single run', () => {
    const p = wonThrough(ENDLESS_UNLOCK);
    refreshDay(p, T0);
    p.meta.daily.contracts = [
      { kind: 'streak', target: 25, progress: 0, reward: 90, done: false },
      { kind: 'endless', target: 8, progress: 0, reward: 100, done: false },
    ];
    recordRun(p, run({ bestStreak: 15 }), T0);
    recordRun(p, run({ bestStreak: 12 }), T0);
    expect(p.meta.daily.contracts[0].progress).toBe(15);
    recordRun(p, run({ mode: 'endless', victory: false, wavesCleared: 5 }), T0);
    recordRun(p, run({ mode: 'endless', victory: false, wavesCleared: 4 }), T0);
    expect(p.meta.daily.contracts[1].progress).toBe(5);
    recordRun(p, run({ mode: 'endless', victory: false, wavesCleared: 9 }), T0);
    expect(p.meta.daily.contracts[1].done).toBe(true);
  });

  it('rerolls one unfinished contract a day into a new kind', () => {
    const p = wonThrough(ENDLESS_UNLOCK);
    refreshDay(p, T0);
    const kinds = p.meta.daily.contracts.map((c) => c.kind);
    expect(rerollContract(p, 1, T0)).toBe(true);
    expect(kinds).not.toContain(p.meta.daily.contracts[1].kind);
    expect(rerollContract(p, 0, T0)).toBe(false);
    refreshDay(p, T0 + DAY);
    p.meta.daily.contracts[0].done = true;
    expect(rerollContract(p, 0, T0 + DAY)).toBe(false);
    expect(rerollContract(p, 2, T0 + DAY)).toBe(true);
  });
});

describe('supply depot', () => {
  it('starts counting when the HQ opens, fills at its rate and stops at the cap', () => {
    const p = wonThrough(HQ_UNLOCK);
    refreshDay(p, T0);
    const rate = DEPOT_LEVELS[0].rate;
    expect(depotStored(p, T0)).toBe(0);
    expect(depotStored(p, T0 + 2 * HOUR)).toBe(2 * rate);
    expect(depotStored(p, T0 + 100 * HOUR)).toBe(depotCap(p));
  });

  it('collects without losing part-made Supplies, and ignores a clock set back', () => {
    const p = wonThrough(HQ_UNLOCK);
    refreshDay(p, T0);
    const s0 = p.supplies;
    expect(collectDepot(p, T0 + 1.5 * HOUR)).toBe(Math.floor(1.5 * DEPOT_LEVELS[0].rate));
    expect(depotStored(p, T0 + 3 * HOUR)).toBe(3 * DEPOT_LEVELS[0].rate - Math.floor(1.5 * DEPOT_LEVELS[0].rate));
    expect(collectDepot(p, T0 - 10 * HOUR)).toBe(0);
    expect(depotStored(p, T0 - 9 * HOUR)).toBe(DEPOT_LEVELS[0].rate);
    expect(p.supplies).toBeGreaterThan(s0);
  });

  it('upgrades for Supplies after collecting what is waiting', () => {
    const p = wonThrough(HQ_UNLOCK);
    refreshDay(p, T0);
    expect(buyDepotUpgrade(p, T0)).toBe('supplies');
    p.supplies = 10_000;
    expect(buyDepotUpgrade(p, T0 + 4 * HOUR)).toBe('ok');
    expect(p.meta.depot.level).toBe(2);
    expect(depotStored(p, T0 + 4 * HOUR)).toBe(0);
    for (let i = 0; i < 10; i++) buyDepotUpgrade(p, T0 + 5 * HOUR);
    expect(p.meta.depot.level).toBe(DEPOT_LEVELS.length);
    expect(buyDepotUpgrade(p, T0 + 5 * HOUR)).toBe('maxed');
  });

  it('shows on the HQ badge when half full', () => {
    const p = wonThrough(HQ_UNLOCK);
    refreshDay(p, T0);
    claimLogin(p, T0);
    expect(hqWaiting(p, T0 + HOUR)).toEqual([]);
    expect(hqWaiting(p, T0 + 5 * HOUR)).toEqual(['DEPOT']);
  });
});

describe('fog surge', () => {
  it('is the same mission all day and changes between days', () => {
    const p = wonThrough('a2m4');
    const a = surgeMission(p, '2027-03-01');
    expect(surgeMission(p, '2027-03-01')).toEqual(a);
    expect(a.id).toBe(SURGE_ID);
    expect(a.objective.kind).toBe('hold');
    expect(a.modifiers?.tags).toHaveLength(2);
    const names = new Set(Array.from({ length: 10 }, (_, d) => surgeMission(p, dayKey(T0 + d * DAY)).name + surgeModifiers(dayKey(T0 + d * DAY)).join()));
    expect(names.size).toBeGreaterThan(5);
  });

  it('builds from recent won missions and applies its modifiers', () => {
    const p = wonThrough('a1m8');
    for (let d = 0; d < 30; d++) {
      const day = dayKey(T0 + d * DAY);
      const m = surgeMission(p, day);
      const mods = surgeModifiers(day);
      const base = MISSIONS.find((x) => x.place === m.place && missionIndex(x.id) <= missionIndex('a1m8'))!;
      expect(base).toBeDefined();
      if (mods.includes('horde')) expect(m.waves[0].groups[0].count).toBeGreaterThan(base.waves[0].groups[0].count);
      expect(!!m.modifiers?.night).toBe(mods.includes('night'));
      expect(m.modifiers?.bunkerMul !== undefined).toBe(mods.includes('glass'));
    }
  });

  it('pays the big reward for the first win of the day only, and keeps the best score', () => {
    const p = wonThrough(SURGE_UNLOCK);
    const m = surgeMission(p, dayKey(T0));
    const first = applyModeResult(p, m, win(), T0);
    expect(first.supplies).toBe(SURGE_FIRST_WIN);
    expect(first.newBest).toBe(true);
    const second = applyModeResult(p, m, win({ kills: 10 }), T0 + HOUR);
    expect(second.supplies).toBe(SURGE_REPLAY);
    expect(second.newBest).toBe(false);
    expect(second.best).toBe(first.score);
    const tomorrow = applyModeResult(p, m, win(), T0 + DAY);
    expect(tomorrow.supplies).toBe(SURGE_FIRST_WIN);
  });

  it('resolves by id for the battle', () => {
    const p = wonThrough(ENDLESS_UNLOCK);
    expect(resolveMission(SURGE_ID, p, T0)!.name).toBe(surgeMission(p, dayKey(T0)).name);
    expect(resolveMission(ENDLESS_ID, p, T0)!.mode).toBe('endless');
    expect(resolveMission('a1m3', p, T0)!.id).toBe('a1m3');
    expect(resolveMission('training', p, T0)!.id).toBe('training');
  });
});

describe('last stand', () => {
  it('grows every wave and only brings enemies the player has met', () => {
    const met = new Set(['shambler', 'runner', 'crawler', 'brute', 'plated', 'carrier']);
    let last = 0;
    for (let n = 1; n <= 40; n++) {
      const w = endlessWave(n, met);
      const size = w.groups.reduce((s, g) => s + g.count, 0) * w.healthMul;
      expect(size).toBeGreaterThan(last);
      last = size;
      for (const g of w.groups) {
        expect(met.has(g.enemy)).toBe(true);
        expect(ENEMIES[g.enemy]).toBeDefined();
      }
    }
    expect(endlessWave(12, new Set([...met, 'sapper', 'juggernaut'])).groups.some((g) => g.enemy === 'juggernaut')).toBe(true);
  });

  it('pays per wave, pays milestones once, and keeps the best wave', () => {
    const p = wonThrough(ENDLESS_UNLOCK);
    const m = endlessMission(p);
    const a = applyModeResult(p, m, win({ victory: false, wavesCleared: 11 }), T0);
    expect(a.milestones.map((x) => x.wave)).toEqual([5, 10]);
    expect(a.supplies).toBe(11 * 8 + ENDLESS_MILESTONES[0].supplies + ENDLESS_MILESTONES[1].supplies);
    const b = applyModeResult(p, m, win({ victory: false, wavesCleared: 7 }), T0);
    expect(b.milestones).toEqual([]);
    expect(b.best).toBe(11);
    expect(b.newBest).toBe(false);
  });
});

describe('field notes and mastery', () => {
  it('has notes for every enemy', () => {
    for (const id of Object.keys(ENEMIES)) expect(FIELD_NOTES[id], id).toBeDefined();
  });

  it('pays each page once as kills add up', () => {
    const p = wonThrough('a1m2');
    const a = recordRun(p, run({ enemyKills: { shambler: 120 } }), T0);
    expect(a.codex.map((c) => c.page)).toEqual([1, 2]);
    expect(codexPages(p, 'shambler')).toBe(2);
    const b = recordRun(p, run({ enemyKills: { shambler: 5 } }), T0);
    expect(b.codex).toEqual([]);
    const c = recordRun(p, run({ enemyKills: { shambler: 400 } }), T0);
    expect(c.supplies).toBe(CODEX_TIERS[2].supplies);
  });

  it('unlocks mastery skins at kill counts; only owned skins can be worn', () => {
    const p = wonThrough('a1m2');
    expect(setSkin(p, 'm4', 'desert')).toBe(false);
    const r = recordRun(p, run({ weaponKills: { m4: 320 } }), T0);
    expect(r.skins).toEqual([{ weapon: 'm4', skin: 'desert' }, { weapon: 'm4', skin: 'winter' }]);
    expect(masteryStatus(p, 'm4').next?.skin).toBe('fogline');
    expect(setSkin(p, 'm4', 'winter')).toBe(true);
    expect(activeSkin(p, 'm4')).toBe('winter');
    expect(setSkin(p, 'm4', '')).toBe(true);
    expect(activeSkin(p, 'm4')).toBe('');
  });
});

describe('save', () => {
  it('round-trips the meta block and repairs junk', () => {
    const p = wonThrough(ENDLESS_UNLOCK);
    refreshDay(p, T0);
    claimLogin(p, T0);
    recordRun(p, run({ enemyKills: { runner: 20 }, weaponKills: { service: 150 } }), T0);
    const back = parseProfile(JSON.stringify(p))!;
    expect(back.meta).toEqual(p.meta);
    const junk = parseMeta({ login: { last: 'yesterday', streak: 99 }, depot: { level: 40, since: -5 }, codex: { x: 'many' }, skinOn: { m4: 'neon' } });
    expect(junk.login).toEqual({ last: null, streak: 7 });
    expect(junk.depot).toEqual({ level: DEPOT_LEVELS.length, since: 0 });
    expect(junk.codex).toEqual({ x: 0 });
    expect(junk.skinOn).toEqual({});
  });

  it('loads an older v2 save without a meta block', () => {
    const p = defaultProfile();
    const raw = JSON.parse(JSON.stringify(p));
    delete raw.meta;
    expect(parseProfile(JSON.stringify(raw))!.meta.depot.level).toBe(1);
  });

  it('campaign results still pay as before alongside run records', () => {
    const p = wonThrough('a1m4');
    const out = applyResult(p, MISSIONS[3], win());
    expect(out.firstClear).toBe(false);
    expect(applyResult(p, MISSIONS[4], win()).firstClear).toBe(true);
    expect(hqOpen(p)).toBe(true);
  });
});
