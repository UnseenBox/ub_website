import { describe, expect, it } from 'vitest';
import { ATTACHMENTS } from '../data/attachments';
import { ENEMIES } from '../data/enemies';
import { LOCATIONS } from '../data/locations';
import { ACT_STAR_GATE, MISSIONS, missionIndex } from '../data/missions';
import { RECRUITS } from '../data/squad';
import { MOUNTED_WEAPONS, WEAPONS, WEAPON_ORDER, weaponById } from '../data/weapons';
import {
  ATTACHMENTS_UNLOCK, MissionResult, applyResult, attachmentStatus, attachmentsOpen, buyAttachment, fitAttachment, fittedAttachment,
  isActFinale, isMissionUnlocked, missionArsenal, ownedWeapons, playerPower, playerWeapon, starsBeforeAct,
} from './Campaign';
import { ProfileData, defaultProfile, parseProfile } from './Profile';
import {
  CONTESTED_BONUS, CONTESTED_PER_DAY, claimContested, contestedMissions, dayKey, endlessWave, hqOpen, isContested,
  noteFinish, noteStart, playReport, refreshDay,
} from './Retention';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const T0 = new Date(2027, 2, 1, 12, 0, 0).getTime();

const win = (over: Partial<MissionResult> = {}): MissionResult => ({
  victory: true, wavesCleared: 3, totalWaves: 3, kills: 60, headshots: 100, accuracy: 0.6,
  bunkerFraction: 0.8, supportsUsed: [], earned: 3000, assetFraction: 1, saved: 4, vehicles: 4, ...over,
});

function wonThrough(id: string, stars = 3): ProfileData {
  const p = defaultProfile();
  for (const m of MISSIONS.slice(0, missionIndex(id) + 1)) {
    applyResult(p, m, win());
    p.missions[m.id].stars = stars;
  }
  return p;
}

describe('Act 3 content', () => {
  const act3 = MISSIONS.filter((m) => m.act === 3);

  it('has nine missions ending with the Heart', () => {
    expect(act3).toHaveLength(9);
    expect(isActFinale(act3[8])).toBe(true);
    expect(act3[8].objective).toEqual({ kind: 'boss', enemy: 'heart' });
    expect(ENEMIES.heart.boss).toBeDefined();
  });

  it('uses real locations, enemies and rewards', () => {
    for (const m of act3) {
      expect(LOCATIONS[m.location], m.id).toBeDefined();
      for (const w of m.waves) for (const g of w.groups) expect(ENEMIES[g.enemy], `${m.id} ${g.enemy}`).toBeDefined();
      for (const w of [...m.issue.weapons, ...m.firstClear.weapons]) expect(() => weaponById(w)).not.toThrow();
      for (const r of m.firstClear.recruits ?? []) expect(RECRUITS.some((x) => x.id === r)).toBe(true);
    }
  });

  it('threat keeps rising through the act', () => {
    for (let i = 1; i < act3.length; i++) expect(act3[i].threat).toBeGreaterThan(act3[i - 1].threat);
  });

  it('opens after the Choir with enough stars', () => {
    const p = wonThrough('a2m9', 1);
    expect(starsBeforeAct(p, 3)).toBeLessThan(ACT_STAR_GATE[3]);
    expect(isMissionUnlocked(p, 'a3m1')).toBe(false);
    const q = wonThrough('a2m9');
    expect(isMissionUnlocked(q, 'a3m1')).toBe(true);
  });

  it('a Ravager bursts into Fogborn, and the Heart holds back and spits', () => {
    expect(ENEMIES.ravager.special?.burstInto?.id).toBe('fogborn');
    const heart = ENEMIES.heart;
    expect(heart.special?.ranged?.stopRange[0]).toBeGreaterThan(heart.boss!.stopZ);
  });
});

describe('door gunner', () => {
  it('gives the gunner an M249 and leaves the squad behind', () => {
    const p = wonThrough('a3m2');
    p.squad = ['dot', 'mara'];
    const m = MISSIONS.find((x) => x.id === 'a3m3')!;
    const a = missionArsenal(p, m);
    expect(a.weapons).toContain('m249');
    expect(a.weapons.length).toBeLessThanOrEqual(4);
    expect(a.squad).toEqual([]);
  });

  it('never lets a mounted gun be owned or carried', () => {
    const p = wonThrough(MISSIONS[MISSIONS.length - 1].id);
    for (const w of MOUNTED_WEAPONS) {
      expect(ownedWeapons(p)).not.toContain(w);
      expect(WEAPON_ORDER).not.toContain(w);
    }
    for (const w of WEAPONS.filter((x) => !MOUNTED_WEAPONS.includes(x.id))) expect(WEAPON_ORDER).toContain(w.id);
  });
});

describe('attachments', () => {
  it('open with the explosives store and cost Supplies once', () => {
    const before = wonThrough('a3m1');
    expect(attachmentsOpen(before)).toBe(false);
    expect(attachmentStatus(before, 'extended').status).toBe('locked');
    const p = wonThrough(ATTACHMENTS_UNLOCK);
    p.supplies = 1000;
    expect(buyAttachment(p, 'extended')).toBe('owned');
    expect(p.supplies).toBe(1000 - ATTACHMENTS[0].cost);
    expect(buyAttachment(p, 'extended')).toBe('owned');
    expect(p.supplies).toBe(1000 - ATTACHMENTS[0].cost);
    p.supplies = 10;
    expect(buyAttachment(p, 'hollow')).toBe('supplies');
  });

  it('change the weapon when fitted, one per weapon, and add power', () => {
    const p = wonThrough(ATTACHMENTS_UNLOCK);
    p.supplies = 5000;
    for (const a of ATTACHMENTS) buyAttachment(p, a.id);
    const base = playerWeapon(p, 'm4');
    const power = playerPower(p);
    expect(fitAttachment(p, 'm4', 'extended')).toBe(true);
    expect(playerWeapon(p, 'm4').magazine).toBeGreaterThan(base.magazine);
    expect(playerPower(p)).toBe(power + 1);
    fitAttachment(p, 'm4', 'quickdraw');
    expect(fittedAttachment(p, 'm4')).toBe('quickdraw');
    expect(playerWeapon(p, 'm4').reloadTime).toBeLessThan(base.reloadTime);
    fitAttachment(p, 'm4', '');
    expect(playerWeapon(p, 'm4')).toEqual(base);
    expect(fitAttachment(defaultProfile(), 'm4', 'hollow')).toBe(false);
  });

  it('survive a save round trip and drop unknown ids', () => {
    const p = wonThrough(ATTACHMENTS_UNLOCK);
    p.supplies = 1000;
    buyAttachment(p, 'hollow');
    fitAttachment(p, 'service', 'hollow');
    const raw = JSON.parse(JSON.stringify(p));
    raw.attachments.push('laser');
    raw.fitted.m4 = 'laser';
    const back = parseProfile(JSON.stringify(raw))!;
    expect(back.attachments).toEqual(['hollow']);
    expect(back.fitted).toEqual({ service: 'hollow' });
  });
});

describe('contested nodes', () => {
  it('re-fog two won missions a day, never a boss or the newest win', () => {
    const p = wonThrough('a2m4');
    for (let d = 0; d < 20; d++) {
      const list = contestedMissions(p, dayKey(T0 + d * DAY));
      expect(list).toHaveLength(CONTESTED_PER_DAY);
      for (const id of list) {
        const m = MISSIONS.find((x) => x.id === id)!;
        expect(m.objective.kind).not.toBe('boss');
        expect(id).not.toBe('a2m4');
      }
    }
    expect(contestedMissions(wonThrough('a1m3'), dayKey(T0))).toEqual([]);
    expect(hqOpen(p)).toBe(true);
  });

  it('pay a bonus for the first retake of the day only', () => {
    const p = wonThrough('a2m4');
    refreshDay(p, T0);
    const id = contestedMissions(p, dayKey(T0))[0];
    const m = MISSIONS.find((x) => x.id === id)!;
    expect(claimContested(p, m, false, T0)).toBe(0);
    expect(claimContested(p, m, true, T0)).toBe(Math.round(m.supplies * CONTESTED_BONUS));
    expect(isContested(p, id, T0)).toBe(false);
    expect(claimContested(p, m, true, T0 + HOUR)).toBe(0);
  });
});

describe('playtest numbers', () => {
  it('count starts, wins, fails and time per mission', () => {
    const p = defaultProfile();
    noteStart(p, 'a1m2');
    noteFinish(p, 'a1m2', false, 120);
    noteStart(p, 'a1m2');
    noteFinish(p, 'a1m2', true, 240);
    noteStart(p, 'a1m1');
    noteFinish(p, 'a1m1', true, 180);
    const rows = playReport(p);
    expect(rows.map((r) => r.id)).toEqual(['a1m1', 'a1m2']);
    expect(rows[1]).toMatchObject({ starts: 2, wins: 1, fails: 1, failRate: 0.5, minutes: 3 });
    expect(parseProfile(JSON.stringify(p))!.meta.play).toEqual(p.meta.play);
  });
});

describe('last stand with Act 3 enemies', () => {
  it('brings Fogborn and Ravagers late, once they have been met', () => {
    const met = new Set(['shambler', 'runner', 'crawler', 'brute', 'plated', 'carrier', 'fogborn', 'ravager']);
    expect(endlessWave(10, met).groups.some((g) => g.enemy === 'fogborn')).toBe(false);
    expect(endlessWave(12, met).groups.some((g) => g.enemy === 'fogborn')).toBe(true);
    expect(endlessWave(16, met).groups.some((g) => g.enemy === 'ravager')).toBe(true);
    expect(endlessWave(16, new Set(['shambler'])).groups.some((g) => g.enemy === 'ravager')).toBe(false);
  });
});
