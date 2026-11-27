// Campaign rules: stars, Supplies, unlocks, the Workshop, loadouts, power and what
// to play next. Pure functions over the profile and the data files, so they are
// unit-tested without Phaser.

import { ACT_STAR_GATE, BonusGoal, GearId, MISSIONS, MissionDef, missionIndex } from '../data/missions';
import { MAX_RECRUIT_LEVEL, RECRUITS, RecruitId, SQUAD_SLOTS, recruitById, recruitCost } from '../data/squad';
import { SUPPORT, SupportId } from '../data/upgrades';
import { MOUNTED_WEAPONS, WEAPONS, WEAPON_ORDER, WeaponDef, weaponById } from '../data/weapons';
import { ATTACHMENTS, attachmentById } from '../data/attachments';
import {
  MAX_LEVEL, TrackId, WeaponLevels, bunkerCost, bunkerHealth, emptyLevels, trackCost, upgradedWeapon,
} from '../data/workshop';
import type { ProfileData } from './Profile';

/** What happened in one mission, as reported by the battle. */
export interface MissionResult {
  victory: boolean;
  wavesCleared: number;
  totalWaves: number;
  kills: number;
  headshots: number;
  /** Hits / shots, 0–1. */
  accuracy: number;
  /** Bunker health / max at the end, 0–1. */
  bunkerFraction: number;
  supportsUsed: SupportId[];
  /** Cash earned during the mission. */
  earned: number;
  /** Protect missions: the asset's health / max at the end. */
  assetFraction?: number;
  /** Evacuate missions: vehicles that got through, and how many there were. */
  saved?: number;
  vehicles?: number;
}

export interface MissionOutcome {
  /** A Veteran medal won for the first time with this result. */
  veteranMedal?: boolean;
  stars: number;
  /** The best rating before this mission. */
  previousStars: number;
  supplies: number;
  firstClear: boolean;
  /** Weapons and gear that became permanently owned with this result. */
  unlockedWeapons: string[];
  unlockedGear: GearId[];
  unlockedRecruits: RecruitId[];
  bonusMet: boolean;
  bunkerStar: boolean;
}

/** The second star: the bunker still has at least this much of its health. */
export const BUNKER_STAR_FRACTION = 0.5;
/** Extra Supplies per star above one. */
export const SUPPLIES_PER_STAR = 0.25;
/** Extra Supplies for the first win of a mission. */
export const FIRST_CLEAR_BONUS = 0.5;
/** A lost mission still pays this share of its Supplies, scaled by the waves cleared. */
export const DEFEAT_SHARE = 0.4;
/** Weapons and supports a loadout carries (lent items come on top). */
export const LOADOUT_WEAPONS = 3;
export const LOADOUT_SUPPORTS = 2;

// ------------------------------------------------------------------ stars and Supplies

export function bonusMet(goal: BonusGoal, r: MissionResult): boolean {
  switch (goal.kind) {
    case 'headshots':
      return r.headshots >= goal.count;
    case 'accuracy':
      return r.accuracy >= goal.fraction;
    case 'noSupport':
      return !r.supportsUsed.includes(goal.id);
    case 'assetHealth':
      return (r.assetFraction ?? 0) >= goal.fraction;
    case 'saveAll':
      return r.vehicles !== undefined && r.saved === r.vehicles;
  }
}

export function bonusText(goal: BonusGoal): string {
  switch (goal.kind) {
    case 'headshots':
      return `${goal.count} headshot kills`;
    case 'accuracy':
      return `${Math.round(goal.fraction * 100)}% accuracy`;
    case 'noSupport':
      return goal.id === 'nuke' ? 'Hold without the nuke' : goal.id === 'gunship' ? 'Hold without the gunship' : 'Hold without the orbital lance';
    case 'assetHealth':
      return `Keep it above ${Math.round(goal.fraction * 100)}%`;
    case 'saveAll':
      return 'Save every vehicle';
  }
}

/** 0 for a loss. A win is 1 star, +1 for keeping the bunker above half, +1 for the bonus goal. */
export function starsFor(goal: BonusGoal, r: MissionResult): number {
  if (!r.victory) return 0;
  return 1 + (r.bunkerFraction >= BUNKER_STAR_FRACTION ? 1 : 0) + (bonusMet(goal, r) ? 1 : 0);
}

export function suppliesFor(m: MissionDef, r: MissionResult, stars: number, firstClear: boolean): number {
  if (!r.victory) {
    const progress = r.totalWaves > 0 ? r.wavesCleared / r.totalWaves : 0;
    return Math.round(m.supplies * DEFEAT_SHARE * Math.max(0.25, progress));
  }
  const starMul = 1 + SUPPLIES_PER_STAR * Math.max(0, stars - 1);
  const firstMul = firstClear ? 1 + FIRST_CLEAR_BONUS : 1;
  return Math.round(m.supplies * starMul * firstMul);
}

// ------------------------------------------------------------------ progress

export function isWon(p: ProfileData, id: string): boolean {
  return (p.missions[id]?.wins ?? 0) > 0;
}

/**
 * The first mission is always open; every other one opens when the one before it is won.
 * The first mission of a new act also needs enough stars from the acts before it.
 */
export function isMissionUnlocked(p: ProfileData, id: string): boolean {
  const i = missionIndex(id);
  if (i < 0) return false;
  if (i === 0) return true;
  if (!isWon(p, MISSIONS[i - 1].id)) return false;
  const m = MISSIONS[i];
  if (m.act !== MISSIONS[i - 1].act) return starsBeforeAct(p, m.act) >= (ACT_STAR_GATE[m.act] ?? 0);
  return true;
}

/** Stars earned in every act before `act`. */
export function starsBeforeAct(p: ProfileData, act: number): number {
  return MISSIONS.filter((m) => m.act < act).reduce((n, m) => n + (p.missions[m.id]?.stars ?? 0), 0);
}

/** Acts that exist, and which of them the player can open on the map. */
export function acts(): number[] {
  return [...new Set(MISSIONS.map((m) => m.act))];
}

export function actOpen(p: ProfileData, act: number): boolean {
  const first = MISSIONS.find((m) => m.act === act);
  return !!first && isMissionUnlocked(p, first.id);
}

/** The act the next mission belongs to (the map opens on it). */
export function currentAct(p: ProfileData): number {
  return nextMission(p).act;
}

/** True when `m` is the last mission of its act. */
export function isActFinale(m: MissionDef): boolean {
  const i = missionIndex(m.id);
  return i >= 0 && (i === MISSIONS.length - 1 || MISSIONS[i + 1].act !== m.act);
}

/** The first mission not yet won, or the last one when the campaign is complete. */
export function nextMission(p: ProfileData): MissionDef {
  return MISSIONS.find((m) => !isWon(p, m.id)) ?? MISSIONS[MISSIONS.length - 1];
}

export function missionAfter(id: string): MissionDef | null {
  const i = missionIndex(id);
  return i >= 0 && i + 1 < MISSIONS.length ? MISSIONS[i + 1] : null;
}

export function campaignComplete(p: ProfileData): boolean {
  return MISSIONS.every((m) => isWon(p, m.id));
}

export function starTotals(p: ProfileData, act?: number): { earned: number; total: number } {
  const ms = act === undefined ? MISSIONS : MISSIONS.filter((m) => m.act === act);
  return {
    earned: ms.reduce((n, m) => n + (p.missions[m.id]?.stars ?? 0), 0),
    total: ms.length * 3,
  };
}

/** The Workshop opens once the first mission is won. */
export function workshopOpen(p: ProfileData): boolean {
  return isWon(p, MISSIONS[0].id);
}

const gearName = (g: GearId): string => {
  const [kind, id] = g.split(':');
  if (kind === 'support') return SUPPORT.find((s) => s.id === id)?.name ?? id;
  return { double: 'Overpressure rounds', ap: 'Armour-piercing rounds', fire: 'Incendiary rounds', cryo: 'Cryo rounds', repair: 'Repair crew', wall: 'Blast shutters' }[id] ?? id;
};

export function rewardNames(m: MissionDef): string[] {
  return [
    ...m.firstClear.weapons.map((w) => weaponById(w).name),
    ...m.firstClear.gear.map(gearName),
    ...(m.firstClear.recruits ?? []).map((r) => `${recruitById(r)!.name} joins`),
  ];
}

/** One line about the next reward and what earns it, or null when nothing is left. */
export function nextUnlockHint(p: ProfileData): string | null {
  const m = MISSIONS.find((x) => !isWon(p, x.id));
  if (!m) return null;
  // The next act is waiting on stars, not on a win.
  if (!isMissionUnlocked(p, m.id)) {
    const need = (ACT_STAR_GATE[m.act] ?? 0) - starsBeforeAct(p, m.act);
    return `Earn ${need} more stars to open Act ${m.act}: replay missions for a better rating`;
  }
  const names = rewardNames(m);
  return names.length ? `Win ${m.name} to keep: ${names.join(', ')}` : `Win ${m.name} to push on`;
}

/** Records a finished mission in the profile (mutates it) and returns what it earned. */
export function applyResult(p: ProfileData, m: MissionDef, r: MissionResult): MissionOutcome {
  const rec = (p.missions[m.id] ??= { stars: 0, wins: 0, plays: 0, bestKills: 0, veteran: false });
  const previousStars = rec.stars;
  const firstClear = r.victory && rec.wins === 0;
  const stars = starsFor(m.bonus, r);
  const supplies = Math.round(suppliesFor(m, r, stars, firstClear) * (m.veteran ? VETERAN.supplies : 1));
  const veteranMedal = !!m.veteran && r.victory && !rec.veteran;
  if (veteranMedal) rec.veteran = true;

  rec.plays += 1;
  if (r.victory) rec.wins += 1;
  rec.stars = Math.max(rec.stars, stars);
  rec.bestKills = Math.max(rec.bestKills, r.kills);
  p.bestKills = Math.max(p.bestKills, r.kills);
  p.supplies += supplies;
  p.suppliesEarned += supplies;

  const unlockedWeapons: string[] = [];
  const unlockedGear: GearId[] = [];
  const unlockedRecruits: RecruitId[] = [];
  if (r.victory) {
    for (const id of m.firstClear.recruits ?? []) {
      if (!p.recruits.includes(id)) {
        p.recruits.push(id);
        p.recruitLevels[id] = 1;
        if (p.squad.length < SQUAD_SLOTS) p.squad.push(id);
        unlockedRecruits.push(id);
      }
    }
    for (const w of m.firstClear.weapons) {
      if (!p.weapons.includes(w)) {
        p.weapons.push(w);
        unlockedWeapons.push(w);
      }
    }
    for (const g of m.firstClear.gear) {
      if (!p.gear.includes(g)) {
        p.gear.push(g);
        unlockedGear.push(g);
      }
    }
  }
  return {
    veteranMedal, stars, previousStars, supplies, firstClear, unlockedWeapons, unlockedGear, unlockedRecruits,
    bonusMet: r.victory && bonusMet(m.bonus, r),
    bunkerStar: r.victory && r.bunkerFraction >= BUNKER_STAR_FRACTION,
  };
}

// ------------------------------------------------------------------ veteran

/** Veteran replays: tougher and bigger waves, more Supplies, and a medal for the first win. */
export const VETERAN = { health: 1.35, count: 1.2, speed: 0.05, threat: 12, supplies: 1.5 };

/** Veteran opens for a mission once it has been won. */
export function veteranOpen(p: ProfileData, id: string): boolean {
  return isWon(p, id);
}

/** The Veteran version of a campaign mission (same id, so the result lands on the same record). */
export function veteranMission(m: MissionDef): MissionDef {
  return {
    ...m,
    veteran: true,
    threat: m.threat + VETERAN.threat,
    waves: m.waves.map((w) => ({
      ...w,
      healthMul: w.healthMul * VETERAN.health,
      speedMul: w.speedMul + VETERAN.speed,
      groups: w.groups.map((g) => ({ ...g, count: Math.ceil(g.count * VETERAN.count) })),
    })),
  };
}

export function veteranMedals(p: ProfileData): number {
  return Object.values(p.missions).filter((r) => r.veteran).length;
}

// ------------------------------------------------------------------ arsenal and loadout

/** Weapons the player owns: the free starter plus everything earned, in catalogue order. */
export function ownedWeapons(p: ProfileData): string[] {
  return sortWeapons(WEAPONS.filter((w) => w.price === 0 || p.weapons.includes(w.id)).map((w) => w.id));
}

/** How much of the campaign has been won, as a percentage. */
export function completionPercent(p: ProfileData): number {
  return Math.round((100 * MISSIONS.filter((m) => isWon(p, m.id)).length) / MISSIONS.length);
}

/** The mission whose first win hands the player a weapon (undefined for the one they start with). */
export function weaponUnlockMission(id: string): MissionDef | undefined {
  return MISSIONS.find((m) => m.firstClear.weapons.includes(id));
}

export function ownedSupports(p: ProfileData): SupportId[] {
  return SUPPORT.filter((s) => p.gear.includes(`support:${s.id}`)).map((s) => s.id);
}

/** A choice of loadout is needed only when the player owns more than fits. */
export function needsLoadout(p: ProfileData): boolean {
  return ownedWeapons(p).length > LOADOUT_WEAPONS || ownedSupports(p).length > LOADOUT_SUPPORTS;
}

/** The saved loadout, cleaned up: only owned items, within the limits, topped up in catalogue order. */
export function resolveLoadout(p: ProfileData): { weapons: string[]; supports: SupportId[] } {
  const owned = ownedWeapons(p);
  const weapons = p.loadout.weapons.filter((w) => owned.includes(w)).slice(0, LOADOUT_WEAPONS);
  for (const w of owned) if (weapons.length < LOADOUT_WEAPONS && !weapons.includes(w)) weapons.push(w);
  const ownedS = ownedSupports(p);
  const supports = p.loadout.supports.filter((s): s is SupportId => ownedS.includes(s as SupportId)).slice(0, LOADOUT_SUPPORTS);
  for (const s of ownedS) if (supports.length < LOADOUT_SUPPORTS && !supports.includes(s)) supports.push(s);
  return { weapons: sortWeapons(weapons), supports: SUPPORT.map((s) => s.id).filter((s) => supports.includes(s)) };
}

function sortWeapons(ids: string[]): string[] {
  return WEAPON_ORDER.filter((id) => ids.includes(id));
}

/** Everything a battle offers: the loadout plus what this mission lends. */
export interface Arsenal {
  /** Weapon ids in HUD order (keys 1–4). */
  weapons: string[];
  /** Squad members at the side windows, with their levels. */
  squad: { id: RecruitId; level: number }[];
  /** Gear ids usable and on sale in this mission. */
  gear: Set<string>;
  /** Items lent for this mission only. */
  lent: Set<string>;
}

export function missionArsenal(p: ProfileData, m: MissionDef): Arsenal {
  const lo = resolveLoadout(p);
  const lent = new Set<string>();
  const weapons = [...lo.weapons];
  for (const w of m.issue.weapons) {
    if (!weapons.includes(w)) {
      weapons.push(w);
      if (!p.weapons.includes(w)) lent.add(`weapon:${w}`);
    }
  }
  const gear = new Set<string>();
  for (const g of p.gear) if (!g.startsWith('support:')) gear.add(g);
  for (const s of lo.supports) gear.add(`support:${s}`);
  for (const g of m.issue.gear) {
    if (!gear.has(g)) {
      gear.add(g);
      if (!p.gear.includes(g)) lent.add(g);
    }
  }
  const squad: { id: RecruitId; level: number }[] = [];
  for (const id of p.squad) if (recruitById(id) && squad.length < SQUAD_SLOTS) squad.push({ id: id as RecruitId, level: p.recruitLevels[id] ?? 1 });
  for (const id of m.issue.recruits ?? []) {
    if (squad.some((s) => s.id === id)) continue;
    // A lent recruit fights at level 1 and takes a free slot, or a third position.
    squad.push({ id, level: p.recruitLevels[id] ?? 1 });
    if (!p.recruits.includes(id)) lent.add(`recruit:${id}`);
  }
  // A mounted gun (the helicopter door gun) comes first; the rest of the loadout fills the other keys.
  const mounted = m.issue.weapons.filter((w) => MOUNTED_WEAPONS.includes(w));
  const slots = [...mounted, ...sortWeapons(weapons)].slice(0, 4);
  // In Kestrel's helicopter there are no side windows: the door gun is the whole defence.
  return { weapons: slots, gear, lent, squad: m.modifiers?.chopper ? [] : squad.slice(0, SQUAD_SLOTS + 1) };
}

// ------------------------------------------------------------------ squad

/** The Barracks opens with the first recruit. */
export function barracksOpen(p: ProfileData): boolean {
  return p.recruits.length > 0;
}

/** Focus and kill streaks arrive with Act 2 (after the Colossus). */
export function focusUnlocked(p: ProfileData): boolean {
  return isWon(p, 'a1m9');
}

export function recruitTrainStatus(p: ProfileData, id: string): { cost: number | null; status: BuyResult } {
  if (!p.recruits.includes(id)) return { cost: null, status: 'notOwned' };
  const cost = recruitCost(p.recruitLevels[id] ?? 1);
  if (cost === null) return { cost, status: 'maxed' };
  return { cost, status: p.supplies >= cost ? 'ok' : 'supplies' };
}

export function trainRecruit(p: ProfileData, id: string): BuyResult {
  const { cost, status } = recruitTrainStatus(p, id);
  if (status !== 'ok' || cost === null) return status;
  p.supplies -= cost;
  p.recruitLevels[id] = Math.min(MAX_RECRUIT_LEVEL, (p.recruitLevels[id] ?? 1) + 1);
  return 'ok';
}

/** Post a recruit to a window, or stand them down. Returns false when the windows are full. */
export function toggleSquad(p: ProfileData, id: string): boolean {
  if (!p.recruits.includes(id)) return false;
  if (p.squad.includes(id)) {
    p.squad = p.squad.filter((r) => r !== id);
    return true;
  }
  if (p.squad.length >= SQUAD_SLOTS) return false;
  p.squad = RECRUITS.map((r) => r.id).filter((r) => r === id || p.squad.includes(r));
  return true;
}

// ------------------------------------------------------------------ workshop and power

export function weaponLevels(p: ProfileData, id: string): WeaponLevels {
  return p.workshop[id] ?? emptyLevels();
}

/** A weapon's battle stats with the player's Workshop levels. */
export function playerWeapon(p: ProfileData, id: string): WeaponDef {
  const w = upgradedWeapon(weaponById(id), p.workshop[id]);
  const a = fittedAttachment(p, id);
  return a ? attachmentById(a)!.apply(w) : w;
}

// ------------------------------------------------------------------ attachments

/** The mission whose first win opens attachments in the Workshop. */
export const ATTACHMENTS_UNLOCK = 'a3m2';

export function attachmentsOpen(p: ProfileData): boolean {
  return isWon(p, ATTACHMENTS_UNLOCK);
}

/** The attachment fitted to a weapon, if the player still owns it. */
export function fittedAttachment(p: ProfileData, weaponId: string): string | null {
  const a = p.fitted[weaponId];
  return a && p.attachments.includes(a) && attachmentById(a) ? a : null;
}

export type AttachmentStatus = 'owned' | 'ok' | 'supplies' | 'locked';

export function attachmentStatus(p: ProfileData, id: string): { cost: number; status: AttachmentStatus } {
  const def = attachmentById(id);
  if (!def) return { cost: 0, status: 'locked' };
  if (p.attachments.includes(id)) return { cost: def.cost, status: 'owned' };
  if (!attachmentsOpen(p)) return { cost: def.cost, status: 'locked' };
  return { cost: def.cost, status: p.supplies >= def.cost ? 'ok' : 'supplies' };
}

/** Buys an attachment once, for every weapon. */
export function buyAttachment(p: ProfileData, id: string): AttachmentStatus {
  const { cost, status } = attachmentStatus(p, id);
  if (status !== 'ok') return status;
  p.supplies -= cost;
  p.attachments.push(id);
  return 'owned';
}

/** Fits an owned attachment to a weapon ('' takes it off). One per weapon. */
export function fitAttachment(p: ProfileData, weaponId: string, id: string): boolean {
  if (id && !p.attachments.includes(id)) return false;
  if (id) p.fitted[weaponId] = id;
  else delete p.fitted[weaponId];
  return true;
}

export { ATTACHMENTS };

export function playerBunkerHealth(p: ProfileData): number {
  return bunkerHealth(p.bunkerLevel);
}

export type BuyResult = 'ok' | 'maxed' | 'supplies' | 'notOwned';

export function upgradeStatus(p: ProfileData, weaponId: string, track: TrackId): { cost: number | null; status: BuyResult } {
  const level = weaponLevels(p, weaponId)[track];
  const cost = trackCost(weaponId, level);
  if (!ownedWeapons(p).includes(weaponId)) return { cost, status: 'notOwned' };
  if (cost === null) return { cost, status: 'maxed' };
  return { cost, status: p.supplies >= cost ? 'ok' : 'supplies' };
}

/** Buys one level of a weapon track (mutates the profile). */
export function buyUpgrade(p: ProfileData, weaponId: string, track: TrackId): BuyResult {
  const { cost, status } = upgradeStatus(p, weaponId, track);
  if (status !== 'ok' || cost === null) return status;
  p.supplies -= cost;
  const lv = (p.workshop[weaponId] ??= emptyLevels());
  lv[track] += 1;
  return 'ok';
}

export function bunkerUpgradeStatus(p: ProfileData): { cost: number | null; status: BuyResult } {
  const cost = bunkerCost(p.bunkerLevel);
  if (cost === null) return { cost, status: 'maxed' };
  return { cost, status: p.supplies >= cost ? 'ok' : 'supplies' };
}

export function buyBunkerUpgrade(p: ProfileData): BuyResult {
  const { cost, status } = bunkerUpgradeStatus(p);
  if (status !== 'ok' || cost === null) return status;
  p.supplies -= cost;
  p.bunkerLevel += 1;
  return 'ok';
}

/**
 * One number for how strong the player is, compared with each mission's threat:
 * 10 to start, +3 per extra weapon owned, +1 per Workshop level (weapons and bunker),
 * +2 per recruit and +1 per recruit training level.
 */
export function playerPower(p: ProfileData): number {
  const weapons = ownedWeapons(p);
  let levels = Math.min(p.bunkerLevel, MAX_LEVEL);
  for (const id of weapons) {
    const lv = weaponLevels(p, id);
    levels += lv.damage + lv.handling + lv.magazine + lv.reload;
  }
  // Recruits: 2 for joining, plus 1 per training level above the first.
  for (const r of p.recruits) levels += 2 + ((p.recruitLevels[r] ?? 1) - 1);
  // Attachments: 1 for each owned weapon that has one fitted.
  for (const id of weapons) if (fittedAttachment(p, id)) levels += 1;
  return 10 + 3 * (weapons.length - 1) + levels;
}

export type ThreatRating = 'ready' | 'risky' | 'hard';

export function threatRating(power: number, threat: number): ThreatRating {
  if (power >= threat) return 'ready';
  return power >= threat - 4 ? 'risky' : 'hard';
}
