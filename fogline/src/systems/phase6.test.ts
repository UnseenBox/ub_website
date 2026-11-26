import { describe, expect, it } from 'vitest';
import { ENEMIES } from '../data/enemies';
import { LOCATIONS } from '../data/locations';
import { ACT_STAR_GATE, MISSIONS, missionIndex } from '../data/missions';
import { OBSIDIAN_MEDALS } from '../data/retention';
import { RECRUITS } from '../data/squad';
import { weaponById } from '../data/weapons';
import {
  MissionResult, VETERAN, applyResult, isActFinale, isMissionUnlocked, missionArsenal, ownedWeapons, veteranMedals,
  veteranMission, veteranOpen,
} from './Campaign';
import { ProfileData, defaultProfile, parseProfile } from './Profile';
import { endlessWave, ownedSkins } from './Retention';

const win = (over: Partial<MissionResult> = {}): MissionResult => ({
  victory: true, wavesCleared: 3, totalWaves: 3, kills: 60, headshots: 100, accuracy: 0.6,
  bunkerFraction: 0.8, supportsUsed: [], earned: 3000, assetFraction: 1, saved: 4, vehicles: 4, ...over,
});

function wonThrough(id: string): ProfileData {
  const p = defaultProfile();
  for (const m of MISSIONS.slice(0, missionIndex(id) + 1)) applyResult(p, m, win());
  return p;
}

describe('Act 4: The Fog Returns', () => {
  const act4 = MISSIONS.filter((m) => m.act === 4);

  it('has ten coastal missions: the Bloom, then the Gorger at the gate', () => {
    expect(act4).toHaveLength(10);
    expect(act4[8].objective).toEqual({ kind: 'boss', enemy: 'bloom' });
    expect(act4[9].objective).toEqual({ kind: 'boss', enemy: 'gorger' });
    expect(isActFinale(act4[9])).toBe(true);
    for (const m of act4) {
      expect(LOCATIONS[m.location], m.id).toBeDefined();
      for (const w of m.waves) for (const g of w.groups) expect(ENEMIES[g.enemy], `${m.id} ${g.enemy}`).toBeDefined();
    }
    for (let i = 1; i < act4.length; i++) expect(act4[i].threat).toBeGreaterThan(act4[i - 1].threat);
  });

  it('opens after the Heart with enough stars', () => {
    const p = wonThrough('a3m9');
    expect(isMissionUnlocked(p, 'a4m1')).toBe(true);
    for (const m of MISSIONS.filter((x) => x.act < 4)) p.missions[m.id].stars = 1;
    expect(isMissionUnlocked(p, 'a4m1')).toBe(false);
    expect(ACT_STAR_GATE[4]).toBeGreaterThan(ACT_STAR_GATE[3]);
  });

  it('never mixes night and storm (both darken the field)', () => {
    for (const m of MISSIONS) expect(!!(m.modifiers?.night && m.modifiers?.storm), m.id).toBe(false);
    expect(act4.filter((m) => m.modifiers?.storm).length).toBeGreaterThanOrEqual(2);
  });

  it('Lurkers come up near the wire; Sporelings leave a cloud; the Bloom has pods', () => {
    const b = ENEMIES.lurker.special!.burrow!;
    expect(b.near).toBeGreaterThan(10);
    expect(b.far).toBeLessThan(40);
    expect(ENEMIES.sporeling.special?.sporeCloud?.seconds).toBeGreaterThan(0);
    expect(ENEMIES.bloom.boss?.pods).toBe(4);
    // Its pods stand in front of where it stops, so the head stays visible.
    expect(ENEMIES.bloom.special!.ranged!.stopRange[0]).toBeGreaterThan(ENEMIES.bloom.boss!.stopZ);
  });

  it('pays the Tesla gun and Vesna on the way', () => {
    const p = wonThrough('a4m6');
    expect(ownedWeapons(p)).toContain('tesla');
    expect(weaponById('tesla').chain?.jumps).toBeGreaterThan(0);
    expect(p.recruits).toContain('vesna');
    expect(RECRUITS).toHaveLength(6);
  });

  it('lends Vesna on her mission', () => {
    const p = wonThrough('a4m5');
    expect(missionArsenal(p, MISSIONS.find((m) => m.id === 'a4m6')!).lent.has('recruit:vesna')).toBe(true);
  });

  it('Last Stand brings Lurkers and Sporelings late, once met', () => {
    const met = new Set(['shambler', 'runner', 'crawler', 'brute', 'plated', 'carrier', 'lurker', 'sporeling']);
    expect(endlessWave(12, met).groups.some((g) => g.enemy === 'lurker')).toBe(false);
    expect(endlessWave(14, met).groups.some((g) => g.enemy === 'lurker' || g.enemy === 'sporeling')).toBe(true);
  });
});

describe('Veteran', () => {
  const m = MISSIONS[4];

  it('opens once a mission is won, and makes it tougher and bigger', () => {
    const p = wonThrough(MISSIONS[3].id);
    expect(veteranOpen(p, m.id)).toBe(false);
    applyResult(p, m, win());
    expect(veteranOpen(p, m.id)).toBe(true);
    const v = veteranMission(m);
    expect(v.id).toBe(m.id);
    expect(v.veteran).toBe(true);
    expect(v.threat).toBe(m.threat + VETERAN.threat);
    expect(v.waves[0].healthMul).toBeCloseTo(m.waves[0].healthMul * VETERAN.health);
    expect(v.waves[0].groups[0].count).toBeGreaterThan(m.waves[0].groups[0].count);
    expect(m.veteran).toBeUndefined();
  });

  it('pays 1.5× Supplies and a medal for the first Veteran win only', () => {
    const p = wonThrough(m.id);
    const normal = applyResult(p, m, win());
    const vet = applyResult(p, veteranMission(m), win());
    expect(vet.supplies).toBe(Math.round(normal.supplies * VETERAN.supplies));
    expect(vet.veteranMedal).toBe(true);
    expect(p.missions[m.id].veteran).toBe(true);
    expect(applyResult(p, veteranMission(m), win()).veteranMedal).toBe(false);
    expect(applyResult(p, veteranMission(m), win({ victory: false })).veteranMedal).toBe(false);
    expect(veteranMedals(p)).toBe(1);
  });

  it('nine medals paint every gun Obsidian', () => {
    const p = wonThrough(MISSIONS[OBSIDIAN_MEDALS].id);
    for (const x of MISSIONS.slice(0, OBSIDIAN_MEDALS - 1)) applyResult(p, veteranMission(x), win());
    expect(ownedSkins(p, 'service')).not.toContain('obsidian');
    applyResult(p, veteranMission(MISSIONS[OBSIDIAN_MEDALS - 1]), win());
    expect(ownedSkins(p, 'service')).toContain('obsidian');
    expect(ownedSkins(p, 'm4')).toContain('obsidian');
  });

  it('survives a save round trip', () => {
    const p = wonThrough(m.id);
    applyResult(p, veteranMission(m), win());
    expect(parseProfile(JSON.stringify(p))!.missions[m.id].veteran).toBe(true);
  });
});
