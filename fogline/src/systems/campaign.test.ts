import { RETIRED_ENEMIES } from '../data/enemies';
import { CREATURES } from '../puppet/index';
import { FIGURES } from '../rendering/figures';
import { parseMeta } from './MetaState';
import { describe, expect, it } from 'vitest';
import { ACT_STAR_GATE, MISSIONS, STARTING_GEAR, missionById, newEnemiesInMissionWave, plural } from '../data/missions';
import { RECRUITS, SQUAD_SLOTS, recruitCost } from '../data/squad';
import { NEST_SPOTS } from './ObjectiveState';
import { ENEMIES } from '../data/enemies';
import { LOCATIONS } from '../data/locations';
import { WEAPONS, weaponById } from '../data/weapons';
import { DEFENSES, MODS, SUPPORT } from '../data/upgrades';
import { MAX_LEVEL, TRACKS, bunkerHealth, trackCost, upgradedWeapon } from '../data/workshop';
import { BUNKER, VIEW } from '../game/config';
import {
  actOpen, barracksOpen, currentAct, focusUnlocked, starsBeforeAct, toggleSquad, trainRecruit,
  LOADOUT_WEAPONS, MissionResult, applyResult, buyBunkerUpgrade, buyUpgrade, campaignComplete, isMissionUnlocked,
  missionAfter, missionArsenal, needsLoadout, nextMission, nextUnlockHint, ownedWeapons, playerPower, playerWeapon,
  resolveLoadout, starTotals, starsFor, suppliesFor, threatRating, workshopOpen,
} from './Campaign';
import { rangeFalloff } from './CombatRules';
import { ObjectiveState } from './ObjectiveState';
import {
  KeyValueStore, LEGACY_KEY, PROFILE_KEY, ProfileData, ProfileStore, defaultProfile, migrateLegacy, parseProfile, pickProfile,
} from './Profile';
import { WeaponManager } from './WeaponManager';
import { Abilities } from './Abilities';
import { BunkerManager } from './BunkerManager';
import { EconomyManager } from './EconomyManager';
import { buildCatalog } from './Shop';

const win = (over: Partial<MissionResult> = {}): MissionResult => ({
  victory: true, wavesCleared: 3, totalWaves: 3, kills: 60, headshots: 100, accuracy: 0.6,
  bunkerFraction: 0.8, supportsUsed: [], earned: 3000, assetFraction: 1, saved: 4, vehicles: 4, ...over,
});

class MemoryStore implements KeyValueStore {
  readonly map = new Map<string, string>();
  getItem(k: string): string | null {
    return this.map.get(k) ?? null;
  }
  setItem(k: string, v: string): void {
    this.map.set(k, v);
  }
}

/** A profile that has won the first `n` missions. */
function wonThrough(n: number): ProfileData {
  const p = defaultProfile();
  for (const m of MISSIONS.slice(0, n)) applyResult(p, m, win());
  return p;
}

describe('mission data', () => {
  it('Acts 1 and 2 have nine missions each, ending with their bosses', () => {
    for (const [act, boss] of [[1, 'colossus'], [2, 'choir']] as const) {
      const ms = MISSIONS.filter((m) => m.act === act);
      expect(ms).toHaveLength(9);
      const last = ms[ms.length - 1];
      expect(last.objective).toEqual({ kind: 'boss', enemy: boss });
      expect(last.waves.some((w) => w.groups.some((g) => g.enemy === boss))).toBe(true);
    }
  });

  it('every mission refers only to things that exist', () => {
    const gearIds = new Set([...MODS.map((m) => `mod:${m.id}`), ...SUPPORT.map((s) => `support:${s.id}`), ...DEFENSES.map((d) => `defense:${d.id}`)]);
    const ids = new Set<string>();
    for (const m of MISSIONS) {
      expect(ids.has(m.id)).toBe(false);
      ids.add(m.id);
      expect(m.waves.length).toBeGreaterThan(0);
      expect(LOCATIONS[m.location]).toBeDefined();
      for (const w of m.waves) for (const g of w.groups) expect(ENEMIES[g.enemy], g.enemy).toBeDefined();
      for (const g of [...m.issue.gear, ...m.firstClear.gear]) expect(gearIds.has(g), g).toBe(true);
      for (const id of [...m.issue.weapons, ...m.firstClear.weapons]) expect(WEAPONS.some((w) => w.id === id), id).toBe(true);
    }
  });

  it('a weapon a mission awards is lent in that mission first, so it can be tried', () => {
    for (const m of MISSIONS) for (const w of m.firstClear.weapons) expect(m.issue.weapons).toContain(w);
  });

  it('threat rises through the campaign and pay rises through each act', () => {
    for (let i = 1; i < MISSIONS.length; i++) {
      expect(MISSIONS[i].threat).toBeGreaterThan(MISSIONS[i - 1].threat);
      if (MISSIONS[i].act === MISSIONS[i - 1].act) expect(MISSIONS[i].supplies).toBeGreaterThanOrEqual(MISSIONS[i - 1].supplies);
    }
  });

  it('mixes monsters from the very first wave: no early wave is shamblers alone', () => {
    for (const m of MISSIONS.filter((x) => x.act <= 2)) {
      m.waves.forEach((w, i) => {
        const kinds = new Set(w.groups.map((g) => g.enemy));
        // The very first mission meets its monsters one or two at a time.
        expect(kinds.size, `${m.id} wave ${i + 1}`).toBeGreaterThanOrEqual(m.id === 'a1m1' ? 2 : 3);
        const all = w.groups.reduce((n, g) => n + g.count, 0);
        const plain = w.groups.filter((g) => g.enemy === 'shambler').reduce((n, g) => n + g.count, 0);
        expect(plain / all, `${m.id} wave ${i + 1}`).toBeLessThanOrEqual(m.id === 'a1m1' ? 0.85 : 0.76);
      });
    }
  });

  it('the Hollow Hound is by far the fastest, and a leg shot barely checks it', () => {
    const hound = ENEMIES.hollow_hound;
    for (const other of Object.values(ENEMIES)) if (other !== hound) expect(hound.speed).toBeGreaterThanOrEqual(other.speed * 2);
    expect(hound.legSlow).toBeGreaterThanOrEqual(0.8);
  });

  it('protect and evacuate objectives sit inside the field', () => {
    for (const m of MISSIONS) {
      const o = m.objective;
      if (o.kind === 'protect') {
        expect(o.z).toBeGreaterThan(8);
        expect(o.share).toBeGreaterThan(0);
      }
      if (o.kind === 'evacuate') expect(o.mustSave).toBeLessThanOrEqual(o.vehicles);
    }
  });

  it('new-enemy banners count enemies met in earlier missions', () => {
    expect(newEnemiesInMissionWave('a1m1', 1)).toEqual(['shambler', 'hollow_hound']);
    expect(newEnemiesInMissionWave('a1m2', 1)).toEqual(['stalker']);
    expect(newEnemiesInMissionWave('a1m3', 1)).toEqual(['wraith']);
    expect(newEnemiesInMissionWave('a1m4', 1)).toEqual(['brute']);
    expect(newEnemiesInMissionWave('a1m9', 2)).toEqual(['colossus']);
  });
});

describe('stars and supplies', () => {
  const m = MISSIONS[0];

  it('a loss earns no stars; a win earns one, plus bunker and bonus stars', () => {
    expect(starsFor(m.bonus, win({ victory: false }))).toBe(0);
    expect(starsFor(m.bonus, win({ bunkerFraction: 0.2, headshots: 0 }))).toBe(1);
    expect(starsFor(m.bonus, win({ bunkerFraction: 0.5, headshots: 0 }))).toBe(2);
    expect(starsFor(m.bonus, win())).toBe(3);
  });

  it('protect and evacuate bonuses read the objective result', () => {
    const protect = MISSIONS.find((x) => x.bonus.kind === 'assetHealth')!;
    expect(starsFor(protect.bonus, win({ assetFraction: 0.2 }))).toBe(2);
    const evac = MISSIONS.find((x) => x.bonus.kind === 'saveAll')!;
    expect(starsFor(evac.bonus, win({ saved: 2, vehicles: 3 }))).toBe(2);
    expect(starsFor(evac.bonus, win({ saved: 3, vehicles: 3 }))).toBe(3);
  });

  it('more stars and a first clear pay more; a loss still pays something', () => {
    const one = suppliesFor(m, win(), 1, false);
    const three = suppliesFor(m, win(), 3, false);
    expect(three).toBeGreaterThan(one);
    expect(suppliesFor(m, win(), 3, true)).toBeGreaterThan(three);
    const lostEarly = suppliesFor(m, win({ victory: false, wavesCleared: 0 }), 0, false);
    const lostLate = suppliesFor(m, win({ victory: false, wavesCleared: 2 }), 0, false);
    expect(lostEarly).toBeGreaterThan(0);
    expect(lostLate).toBeGreaterThan(lostEarly);
    expect(lostLate).toBeLessThan(one);
  });
});

describe('campaign progress', () => {
  it('starts at mission 1 with the starter rifle and repair crew', () => {
    const p = defaultProfile();
    expect(nextMission(p).id).toBe('a1m1');
    expect(isMissionUnlocked(p, 'a1m2')).toBe(false);
    expect(ownedWeapons(p)).toEqual(['service']);
    expect(p.gear).toEqual(STARTING_GEAR);
    expect(workshopOpen(p)).toBe(false);
    expect(nextUnlockHint(p)).toContain('Overpressure');
  });

  it('a first win pays, awards weapons and gear once, and opens the next mission', () => {
    const p = wonThrough(1);
    expect(workshopOpen(p)).toBe(true);
    expect(p.gear).toContain('mod:double');
    const o = applyResult(p, MISSIONS[1], win());
    expect(o.firstClear).toBe(true);
    expect(o.unlockedWeapons).toEqual(['m4']);
    expect(ownedWeapons(p)).toEqual(['service', 'm4']);
    const again = applyResult(p, MISSIONS[1], win({ bunkerFraction: 0.1, headshots: 0 }));
    expect(again.unlockedWeapons).toEqual([]);
    expect(p.missions.a1m2.stars).toBe(3);
    expect(p.missions.a1m2.plays).toBe(2);
    expect(nextMission(p).id).toBe('a1m3');
  });

  it('a loss counts as a play but opens nothing', () => {
    const p = defaultProfile();
    const o = applyResult(p, MISSIONS[0], win({ victory: false, wavesCleared: 1 }));
    expect(o.stars).toBe(0);
    expect(o.unlockedGear).toEqual([]);
    expect(isMissionUnlocked(p, 'a1m2')).toBe(false);
    expect(p.missions.a1m1.plays).toBe(1);
  });

  it('winning Act 1 owns the first five guns and every support, and opens Act 2', () => {
    const p = wonThrough(9);
    expect(ownedWeapons(p)).toEqual(['service', 'm4', 'shotgun', 'm249', 'm32']);
    for (const sp of SUPPORT) expect(p.gear).toContain(`support:${sp.id}`);
    expect(starTotals(p, 1)).toEqual({ earned: 27, total: 27 });
    expect(missionAfter('a1m9')!.id).toBe('a2m1');
    expect(isMissionUnlocked(p, 'a2m1')).toBe(true);
    expect(campaignComplete(p)).toBe(false);
  });

  it('winning everything completes the campaign', () => {
    const p = wonThrough(MISSIONS.length);
    expect(campaignComplete(p)).toBe(true);
    expect(nextUnlockHint(p)).toBeNull();
    expect(missionAfter(MISSIONS[MISSIONS.length - 1].id)).toBeNull();
    expect(ownedWeapons(p)).toEqual(['service', 'm4', 'shotgun', 'tesla', 'm249', 'm82', 'm32']);
    expect([...p.recruits].sort()).toEqual(['brick', 'dot', 'kestrel', 'mara', 'rook', 'vesna']);
  });

  it('Act 2 needs enough Act 1 stars, not just the boss', () => {
    const p = defaultProfile();
    for (const m of MISSIONS.filter((x) => x.act === 1)) applyResult(p, m, win({ headshots: 0, bunkerFraction: 0.1, assetFraction: 0, saved: 0 }));
    expect(starsBeforeAct(p, 2)).toBe(9);
    expect(isMissionUnlocked(p, 'a2m1')).toBe(false);
    expect(actOpen(p, 2)).toBe(false);
    for (const m of MISSIONS.filter((x) => x.act === 1).slice(0, 3)) applyResult(p, m, win());
    expect(starsBeforeAct(p, 2)).toBeGreaterThanOrEqual(ACT_STAR_GATE[2]);
    expect(isMissionUnlocked(p, 'a2m1')).toBe(true);
    expect(currentAct(p)).toBe(2);
  });
});

describe('loadout and arsenal', () => {
  it('no choice is needed until the player owns more than fits', () => {
    expect(needsLoadout(wonThrough(3))).toBe(false); // M1A + M4, gunship
    expect(needsLoadout(wonThrough(6))).toBe(true); // four guns
  });

  it('the saved loadout is cleaned up and topped up', () => {
    const p = wonThrough(8);
    p.loadout = { weapons: ['m32', 'bogus', 'm4'], supports: ['nuke'] };
    const lo = resolveLoadout(p);
    expect(lo.weapons).toHaveLength(LOADOUT_WEAPONS);
    expect(lo.weapons).toContain('m32');
    expect(lo.weapons).toContain('m4');
    expect(lo.weapons).not.toContain('bogus');
    expect(lo.supports).toContain('nuke');
    expect(lo.supports).toHaveLength(2);
  });

  it('a mission adds its lent weapon and gear on top of the loadout', () => {
    const p = wonThrough(1);
    const a = missionArsenal(p, MISSIONS[1]); // Orchard Road lends the M4
    expect(a.weapons).toEqual(['service', 'm4']);
    expect(a.lent.has('weapon:m4')).toBe(true);
    const radio = missionArsenal(wonThrough(2), MISSIONS[2]); // lends the gunship
    expect(radio.gear.has('support:gunship')).toBe(true);
    expect(radio.lent.has('support:gunship')).toBe(true);
    expect(radio.gear.has('support:nuke')).toBe(false);
  });

  it('only gear the player owns or is lent reaches the armory', () => {
    const p = wonThrough(1);
    const a = missionArsenal(p, MISSIONS[1]);
    const weapons = new WeaponManager({ owned: a.weapons, unlockAfterWave: {} });
    const catalog = buildCatalog({
      economy: new EconomyManager(1e5), weapons, abilities: new Abilities(), bunker: new BunkerManager(), upgrades: { reinforceLevel: 0 }, gear: a.gear,
    });
    const ids = catalog.map((i) => i.id);
    expect(ids).toContain('defense:repair');
    expect(ids).toContain('mod:double');
    expect(ids).toContain('ammo:m4');
    expect(ids).not.toContain('weapon:m4'); // carried already, nothing to buy
    expect(ids).not.toContain('support:nuke');
    expect(ids).not.toContain('upgrade:reinforce');
  });
});

describe('workshop', () => {
  it('levels make weapons stronger, faster and roomier', () => {
    const base = weaponById('m4');
    const up = upgradedWeapon(base, { damage: 5, handling: 5, magazine: 5, reload: 5 });
    expect(up.damage).toBeCloseTo(base.damage * 1.4);
    expect(up.fireRate).toBeGreaterThan(base.fireRate);
    expect(up.spread).toBeLessThan(base.spread);
    expect(up.magazine).toBeGreaterThan(base.magazine);
    expect(up.reloadTime).toBeLessThan(base.reloadTime);
    expect(upgradedWeapon(weaponById('service'), { damage: 0, handling: 0, magazine: 1, reload: 0 }).magazine).toBe(11);
  });

  it('costs grow per level and stop at the max', () => {
    expect(trackCost('service', 1)!).toBeGreaterThan(trackCost('service', 0)!);
    expect(trackCost('service', MAX_LEVEL)).toBeNull();
  });

  it('buying spends Supplies once, refuses when short, and raises power', () => {
    const p = wonThrough(1);
    const before = playerPower(p);
    p.supplies = 1000;
    expect(buyUpgrade(p, 'service', 'damage')).toBe('ok');
    expect(p.supplies).toBe(1000 - trackCost('service', 0)!);
    expect(p.workshop.service.damage).toBe(1);
    expect(playerWeapon(p, 'service').damage).toBeGreaterThan(weaponById('service').damage);
    expect(playerPower(p)).toBe(before + 1);
    expect(buyUpgrade(p, 'm249', 'damage')).toBe('notOwned');
    p.supplies = 0;
    expect(buyUpgrade(p, 'service', 'reload')).toBe('supplies');
    expect(p.workshop.service.reload).toBe(0);
    for (const t of TRACKS) expect(p.workshop.service[t.id]).toBeLessThanOrEqual(MAX_LEVEL);
  });

  it('the bunker track adds health', () => {
    const p = defaultProfile();
    p.supplies = 10_000;
    expect(buyBunkerUpgrade(p)).toBe('ok');
    expect(bunkerHealth(p.bunkerLevel)).toBe(BUNKER.maxHealth + 150);
    while (buyBunkerUpgrade(p) === 'ok');
    expect(p.bunkerLevel).toBe(MAX_LEVEL);
  });

  it('a player who upgrades as they go stays close to each mission threat', () => {
    // Simulate: win each mission with two stars, then spend Supplies on the cheapest levels.
    const p = defaultProfile();
    for (const m of MISSIONS) {
      const rating = threatRating(playerPower(p), m.threat);
      expect(rating, `${m.id}: power ${playerPower(p)} vs threat ${m.threat}`).not.toBe('hard');
      applyResult(p, m, win({ headshots: 0 }));
      for (;;) {
        const options = ownedWeapons(p).flatMap((w) => TRACKS.map((t) => ({ w, t: t.id, cost: trackCost(w, p.workshop[w]?.[t.id] ?? 0) })))
          .filter((o): o is { w: string; t: typeof o.t; cost: number } => o.cost !== null && o.cost <= p.supplies)
          .sort((a, b) => a.cost - b.cost);
        if (!options.length) break;
        buyUpgrade(p, options[0].w, options[0].t);
      }
    }
  });
});

describe('field objectives', () => {
  it('protect: the asset takes damage and its loss fails the mission', () => {
    const m = MISSIONS.find((x) => x.objective.kind === 'protect')!;
    const o = new ObjectiveState(m.objective);
    const t = o.current!;
    expect(o.share).toBeGreaterThan(0);
    expect(o.damage(t, 100)).toBeNull();
    expect(o.summary().assetFraction).toBeCloseTo((t.max - 100) / t.max);
    expect(o.failed).toBe(false);
    expect(o.damage(t, 1e6)?.type).toBe('assetDestroyed');
    expect(o.failed).toBe(true);
    expect(o.current).toBeNull();
  });

  it('evacuate: vehicles leave one at a time during waves and cross the field', () => {
    const m = MISSIONS.find((x) => x.objective.kind === 'evacuate')!;
    const obj = m.objective as Extract<typeof m.objective, { kind: 'evacuate' }>;
    const o = new ObjectiveState(obj);
    expect(o.update(30, false)).toEqual([]); // nothing leaves between waves
    const events = o.update(10, true);
    expect(events.map((e) => e.type)).toEqual(['vehicleStart']);
    expect(o.pending).toBe(true);
    let saved = 0;
    for (let i = 0; i < 400 && saved === 0; i++) saved = o.update(0.1, true).filter((e) => e.type === 'vehicleSaved').length;
    expect(o.saved).toBe(1);
  });

  it('evacuate: losing too many vehicles fails; after the waves the rest are rushed out', () => {
    const m = MISSIONS.find((x) => x.objective.kind === 'evacuate')!;
    const obj = m.objective as Extract<typeof m.objective, { kind: 'evacuate' }>;
    const o = new ObjectiveState(obj);
    for (let i = 0; i < 400 && !o.current; i++) o.update(0.1, true);
    o.damage(o.current!, 1e6);
    expect(o.lost).toBe(1);
    expect(o.failed).toBe(obj.vehicles - obj.mustSave < 1);
    o.rush();
    for (let i = 0; i < 4000 && o.pending; i++) o.update(0.1, false);
    expect(o.pending).toBe(false);
    expect(o.saved + o.lost).toBe(obj.vehicles);
  });
});

describe('the Colossus', () => {
  it('keeps its head (the weak point) on screen at its stop line', () => {
    const c = ENEMIES.colossus;
    const ppm = VIEW.focal / c.boss!.stopZ;
    const feet = VIEW.horizonY + VIEW.camHeight * ppm;
    expect(feet - c.height * ppm).toBeGreaterThan(60);
    expect(c.zoneMultiplier.head).toBeGreaterThan(c.zoneMultiplier.torso);
    expect(c.boss!.nukeShare).toBeLessThan(0.5);
  });
});

describe('shotgun', () => {
  it('fires a pellet pattern that weakens with range', () => {
    const sg = weaponById('shotgun');
    expect(sg.pellets).toBeGreaterThan(1);
    expect(rangeFalloff(sg, 5)).toBe(1);
    expect(rangeFalloff(sg, 25)).toBeLessThan(1);
    expect(rangeFalloff(sg, 80)).toBe(sg.falloff!.min);
    expect(rangeFalloff(weaponById('m4'), 80)).toBe(1);
  });
});

describe('profile save', () => {
  it('migrates the old save, keeping settings and crediting old progress', () => {
    const p = migrateLegacy(JSON.stringify({ volumes: { master: 0.3, sfx: 0.5, music: 0.1 }, bestWave: 6, bestKills: 90, tutorialSeen: true }));
    expect(p.volumes).toEqual({ master: 0.3, sfx: 0.5, music: 0.1 });
    expect(p.tutorialSeen).toBe(true);
    expect(p.bestKills).toBe(90);
    expect(Object.keys(p.missions)).toEqual(['a1m1', 'a1m2']);
    expect(p.weapons).toEqual(['m4']);
    expect(p.gear).toContain('mod:double');
    expect(migrateLegacy(null)).toEqual(defaultProfile());
    expect(migrateLegacy('not json')).toEqual(defaultProfile());
  });

  it('repairs a damaged profile instead of crashing', () => {
    const p = parseProfile(JSON.stringify({
      version: 2, supplies: -5, weapons: ['m4', 'm4', 3], missions: { a1m1: { stars: 9 } }, volumes: { master: 4 },
      workshop: { m4: { damage: 99, handling: 'x' } }, bunkerLevel: -2, gear: [],
    }))!;
    expect(p.supplies).toBe(0);
    expect(p.weapons).toEqual(['m4']);
    expect(p.missions.a1m1.stars).toBe(3);
    expect(p.volumes.master).toBe(1);
    expect(p.workshop.m4).toEqual({ damage: MAX_LEVEL, handling: 0, magazine: 0, reload: 0 });
    expect(p.bunkerLevel).toBe(0);
    expect(p.gear).toEqual(STARTING_GEAR);
    expect(parseProfile('{')).toBeNull();
    expect(parseProfile(JSON.stringify({ version: 1 }))).toBeNull();
  });

  it('loads the legacy save once, then saves and reloads the new profile', () => {
    const local = new MemoryStore();
    local.setItem(LEGACY_KEY, JSON.stringify({ bestWave: 3, tutorialSeen: true }));
    const store = new ProfileStore(() => local);
    expect(store.get().missions.a1m1.wins).toBe(1);
    store.update((d) => { d.supplies = 77; });
    expect(new ProfileStore(() => local).get().supplies).toBe(77);
    expect(parseProfile(local.getItem(PROFILE_KEY))!.supplies).toBe(77);
  });

  it('keeps the cloud copy when it has more progress, and mirrors saves to it', () => {
    const local = new MemoryStore();
    const cloud = new MemoryStore();
    const ahead = wonThrough(1);
    cloud.setItem(PROFILE_KEY, JSON.stringify(ahead));
    const store = new ProfileStore(() => local);
    expect(store.get().missions.a1m1).toBeUndefined();
    store.attachCloud(cloud);
    expect(store.get().missions.a1m1.wins).toBe(1);
    store.update((d) => { d.supplies += 1; });
    expect(parseProfile(cloud.getItem(PROFILE_KEY))!.supplies).toBe(ahead.supplies + 1);
    expect(parseProfile(local.getItem(PROFILE_KEY))!.supplies).toBe(ahead.supplies + 1);
  });

  it('prefers progress over recency, then recency', () => {
    const a = wonThrough(1);
    const b = defaultProfile();
    b.savedAt = Date.now();
    expect(pickProfile(a, b)).toBe(a);
    const c = defaultProfile();
    c.savedAt = b.savedAt + 1;
    expect(pickProfile(b, c)).toBe(c);
  });
});

describe('Act 2 enemies', () => {
  it('each new enemy has its one clear job', () => {
    const sp = ENEMIES.spitter.special!.ranged!;
    expect(sp.stopRange[0]).toBeLessThan(sp.stopRange[1]);
    expect(sp.windup).toBeGreaterThan(0.4); // readable tell
    const howl = ENEMIES.carrion_screamer.special!.howl!;
    expect(howl.speedMul).toBeGreaterThan(1);
    expect(ENEMIES.crimson_brute.armoredZones).toEqual(['torso', 'legs']);
    expect(ENEMIES.crimson_brute.zoneMultiplier.head).toBeGreaterThanOrEqual(1);
    for (const id of ['spitter', 'carrion_screamer', 'crimson_brute', 'choir']) expect(ENEMIES[id].intel, id).toBeTruthy();
  });

  it('they debut in Act 2 in order, one new threat at a time', () => {
    expect(newEnemiesInMissionWave('a2m1', 1)).toContain('spitter');
    expect(newEnemiesInMissionWave('a2m2', 1)).toContain('carrion_screamer');
    expect(newEnemiesInMissionWave('a2m6', 1)).toContain('crimson_brute');
  });

  it('the Choir keeps its head on screen at its stop line', () => {
    const c = ENEMIES.choir;
    const ppm = VIEW.focal / c.boss!.stopZ;
    expect(VIEW.horizonY + VIEW.camHeight * ppm - c.height * ppm).toBeGreaterThan(60);
  });
});

describe('squad', () => {
  it('a recruit joins on a first clear, takes a window, and opens the Barracks', () => {
    const p = wonThrough(9);
    expect(barracksOpen(p)).toBe(false);
    expect(focusUnlocked(p)).toBe(true);
    const o = applyResult(p, missionById('a2m1')!, win());
    expect(o.unlockedRecruits).toEqual(['dot']);
    expect(p.squad).toEqual(['dot']);
    expect(p.recruitLevels.dot).toBe(1);
    expect(barracksOpen(p)).toBe(true);
  });

  it('a mission lends its recruit on top of the squad', () => {
    const p = wonThrough(11);
    const a = missionArsenal(p, missionById('a2m3')!);
    expect(a.squad.map((s) => s.id)).toEqual(['dot', 'mara']);
    expect(a.lent.has('recruit:mara')).toBe(true);
  });

  it('training costs Supplies and stops at the max; only two can hold the windows', () => {
    const p = wonThrough(14);
    expect([...p.recruits].sort()).toEqual(['brick', 'dot', 'mara']);
    expect(p.squad).toHaveLength(SQUAD_SLOTS);
    p.supplies = 100_000;
    const before = playerPower(p);
    expect(trainRecruit(p, 'mara')).toBe('ok');
    expect(p.recruitLevels.mara).toBe(2);
    expect(playerPower(p)).toBe(before + 1);
    while (trainRecruit(p, 'mara') === 'ok');
    expect(recruitCost(p.recruitLevels.mara)).toBeNull();
    const out = p.squad[0];
    const benched = RECRUITS.map((r) => r.id).find((id) => !p.squad.includes(id))!;
    expect(toggleSquad(p, benched)).toBe(false); // windows full
    expect(toggleSquad(p, out)).toBe(true);
    expect(toggleSquad(p, benched)).toBe(true);
    expect(p.squad).toContain(benched);
  });
});

describe('nests', () => {
  it('nests breed during waves, block the win until destroyed, then let it go', () => {
    const m = missionById('a2m2')!;
    const o = new ObjectiveState(m.objective);
    const obj = m.objective as Extract<typeof m.objective, { kind: 'nests' }>;
    expect(o.nestsLeft).toBe(obj.count);
    expect(obj.count).toBeLessThanOrEqual(NEST_SPOTS.length);
    expect(o.current).toBeNull(); // the dead never guard nests
    expect(o.update(60, false)).toEqual([]);
    expect(o.update(obj.spawn.every * 2, true).some((e) => e.type === 'nestSpawn')).toBe(true);
    expect(o.pending).toBe(true);
    for (const t of [...o.targets]) o.damage(t, 1e6);
    expect(o.nestsLeft).toBe(0);
    expect(o.pending).toBe(false);
    expect(o.failed).toBe(false);
  });
});

describe('Act 2 weapons', () => {
  it('the .50 pierces and ignores armour', () => {
    const m82 = weaponById('m82');
    expect(m82.pierce).toBeGreaterThan(1);
    expect(m82.armorPiercing).toBe(true);
  });

  it('names vehicles in plural correctly', () => {
    expect(plural('BUS')).toBe('BUSES');
    expect(plural('TRUCK')).toBe('TRUCKS');
  });
});

describe('monsters', () => {
  it('only come from supplied pictures', () => {
    const everyone = new Set(Object.keys(ENEMIES));
    for (const [gone, stand] of Object.entries(RETIRED_ENEMIES)) {
      expect(everyone.has(gone), gone).toBe(false);
      expect(everyone.has(stand), stand).toBe(true);
    }
    for (const e of Object.values(ENEMIES)) expect(FIGURES[e.look] ?? CREATURES[e.look], e.id).toBeTruthy();
  });

  it('are all that any wave, nest or boss can call for', () => {
    for (const m of MISSIONS) {
      for (const w of m.waves) for (const g of w.groups) expect(ENEMIES[g.enemy], `${m.id} ${g.enemy}`).toBeDefined();
      if (m.objective.kind === 'nests') expect(ENEMIES[m.objective.spawn.id], m.id).toBeDefined();
      if (m.objective.kind === 'boss') expect(ENEMIES[m.objective.enemy], m.id).toBeDefined();
    }
    for (const e of Object.values(ENEMIES)) {
      for (const id of [e.boss?.summon.id, e.special?.burstInto?.id, e.special?.howl?.summon?.id]) {
        if (id) expect(ENEMIES[id], `${e.id} calls ${id}`).toBeDefined();
      }
    }
  });

  it('move an old save’s contract to the monster that took its place', () => {
    const meta = parseMeta({ daily: { day: '2026-11-26', contracts: [{ kind: 'enemy', param: 'runner', target: 35, progress: 4, reward: 70 }] } });
    expect(meta.daily.contracts[0]).toMatchObject({ param: 'hollow_hound', progress: 4 });
  });
});
