// The player's persistent profile: settings and campaign progress.
//
// It lives in localStorage, and on CrazyGames also in the SDK's cloud data store,
// so progress follows a signed-in player between devices. Every storage access is
// guarded: private windows or blocked storage simply fall back to defaults.

import { MISSIONS, STARTING_GEAR } from '../data/missions';
import { MAX_LEVEL, WeaponLevels } from '../data/workshop';
import { MetaData, defaultMeta, parseMeta } from './MetaState';
import { attachmentById } from '../data/attachments';

export interface MissionRecord {
  /** Best star rating, 0–3. */
  stars: number;
  wins: number;
  plays: number;
  bestKills: number;
  /** Won on Veteran at least once (a Veteran medal). */
  veteran: boolean;
}

export interface ProfileData {
  version: 2;
  volumes: { master: number; sfx: number; music: number };
  /** From older saves. The briefing it recorded is gone. */
  tutorialSeen: boolean;
  bestKills: number;
  /** Persistent currency for upgrades between missions. */
  supplies: number;
  /** Lifetime Supplies, never spent; used to pick the more advanced of two saves. */
  suppliesEarned: number;
  /** Weapons owned for good (earned by first clears). The starter rifle is always owned. */
  weapons: string[];
  /** Mods, supports and defences owned for good (`mod:ap`, `support:gunship`…). */
  gear: string[];
  /** Workshop levels per weapon id. */
  workshop: Record<string, WeaponLevels>;
  /** Workshop level of the bunker. */
  bunkerLevel: number;
  /** What the player last chose to carry (weapon ids and support ids). */
  loadout: { weapons: string[]; supports: string[] };
  /** One-time control hints already shown. */
  hints: string[];
  /** Squad members who have joined, their training levels (1–5) and who is posted at the windows. */
  recruits: string[];
  recruitLevels: Record<string, number>;
  squad: string[];
  missions: Record<string, MissionRecord>;
  /** Attachments bought in the Workshop, and the one fitted to each weapon. */
  attachments: string[];
  fitted: Record<string, string>;
  /** Retention: daily drop, contracts, depot, Fog Surge, Last Stand, Field Notes, mastery. */
  meta: MetaData;
  /** ms since epoch of the last save; breaks ties between a local and a cloud save. */
  savedAt: number;
}

/** A synchronous string store with the localStorage shape (the CrazyGames data module matches it). */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
}

export const PROFILE_KEY = 'fogline.profile.v2';
export const LEGACY_KEY = 'fogline.save.v1';

const DEFAULT_VOLUMES = { master: 0.8, sfx: 0.9, music: 0.45 };

export function defaultProfile(): ProfileData {
  return {
    version: 2,
    volumes: { ...DEFAULT_VOLUMES },
    tutorialSeen: false,
    bestKills: 0,
    supplies: 0,
    suppliesEarned: 0,
    weapons: [],
    gear: [...STARTING_GEAR],
    workshop: {},
    bunkerLevel: 0,
    loadout: { weapons: [], supports: [] },
    hints: [],
    recruits: [],
    recruitLevels: {},
    squad: [],
    missions: {},
    attachments: [],
    fitted: {},
    meta: defaultMeta(),
    savedAt: 0,
  };
}

const strings = (v: unknown): string[] =>
  Array.isArray(v) ? [...new Set(v.filter((s): s is string => typeof s === 'string'))] : [];

const level = (v: unknown): number => Math.min(MAX_LEVEL, Math.max(0, Math.floor(num(v))));

const num = (v: unknown, fallback = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
const clamp01 = (v: unknown, fallback: number): number => Math.min(1, Math.max(0, num(v, fallback)));

/** Reads a stored v2 profile, repairing anything missing or malformed. Null when there is none. */
export function parseProfile(raw: string | null): ProfileData | null {
  if (!raw) return null;
  let d: Record<string, unknown>;
  try {
    d = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
  if (!d || typeof d !== 'object' || d.version !== 2) return null;
  const p = defaultProfile();
  const vol = (d.volumes ?? {}) as Record<string, unknown>;
  p.volumes = {
    master: clamp01(vol.master, DEFAULT_VOLUMES.master),
    sfx: clamp01(vol.sfx, DEFAULT_VOLUMES.sfx),
    music: clamp01(vol.music, DEFAULT_VOLUMES.music),
  };
  p.tutorialSeen = d.tutorialSeen === true;
  p.bestKills = Math.max(0, Math.floor(num(d.bestKills)));
  p.supplies = Math.max(0, Math.floor(num(d.supplies)));
  p.suppliesEarned = Math.max(p.supplies, Math.floor(num(d.suppliesEarned)));
  p.weapons = strings(d.weapons);
  p.gear = [...new Set([...STARTING_GEAR, ...strings(d.gear)])];
  p.bunkerLevel = level(d.bunkerLevel);
  p.hints = strings(d.hints);
  p.recruits = strings(d.recruits);
  p.squad = strings(d.squad).filter((r) => p.recruits.includes(r));
  const rl = (d.recruitLevels ?? {}) as Record<string, unknown>;
  for (const r of p.recruits) p.recruitLevels[r] = Math.min(MAX_LEVEL, Math.max(1, Math.floor(num(rl?.[r], 1))));
  const lo = (d.loadout ?? {}) as Record<string, unknown>;
  p.loadout = { weapons: strings(lo.weapons), supports: strings(lo.supports) };
  const shop = (d.workshop ?? {}) as Record<string, Record<string, unknown>>;
  if (shop && typeof shop === 'object') {
    for (const [id, lv] of Object.entries(shop)) {
      if (!lv || typeof lv !== 'object') continue;
      p.workshop[id] = { damage: level(lv.damage), handling: level(lv.handling), magazine: level(lv.magazine), reload: level(lv.reload) };
    }
  }
  p.savedAt = num(d.savedAt);
  p.meta = parseMeta(d.meta);
  p.attachments = strings(d.attachments).filter((a) => attachmentById(a));
  for (const [w, a] of Object.entries((d.fitted ?? {}) as Record<string, unknown>)) {
    if (typeof a === 'string' && p.attachments.includes(a)) p.fitted[w] = a;
  }
  const missions = (d.missions ?? {}) as Record<string, Record<string, unknown>>;
  if (missions && typeof missions === 'object') {
    for (const [id, r] of Object.entries(missions)) {
      if (!r || typeof r !== 'object') continue;
      p.missions[id] = {
        stars: Math.min(3, Math.max(0, Math.floor(num(r.stars)))),
        wins: Math.max(0, Math.floor(num(r.wins))),
        plays: Math.max(0, Math.floor(num(r.plays))),
        bestKills: Math.max(0, Math.floor(num(r.bestKills))),
        veteran: r.veteran === true,
      };
    }
  }
  return p;
}

/**
 * Converts the pre-campaign save (settings and best wave) into a profile. A player who
 * already held the line through the old eight waves gets the matching missions marked
 * as won with one star, and the weapons those missions award, so nobody starts over.
 */
export function migrateLegacy(raw: string | null): ProfileData {
  const p = defaultProfile();
  if (!raw) return p;
  let d: Record<string, unknown>;
  try {
    d = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return p;
  }
  const vol = (d.volumes ?? {}) as Record<string, unknown>;
  p.volumes = {
    master: clamp01(vol.master, DEFAULT_VOLUMES.master),
    sfx: clamp01(vol.sfx, DEFAULT_VOLUMES.sfx),
    music: clamp01(vol.music, DEFAULT_VOLUMES.music),
  };
  p.tutorialSeen = d.tutorialSeen === true;
  p.bestKills = Math.max(0, Math.floor(num(d.bestKills)));
  const bestWave = num(d.bestWave);
  // Surviving the old run's early, middle or full eight waves counts as winning the
  // first one, two or three missions, with their rewards.
  const credit: [number, number][] = [[3, 1], [6, 2], [8, 3]];
  const won = credit.filter(([wave]) => bestWave >= wave).reduce((n, [, m]) => Math.max(n, m), 0);
  for (const m of MISSIONS.slice(0, won)) {
    p.missions[m.id] = { stars: 1, wins: 1, plays: 1, bestKills: 0, veteran: false };
    for (const w of m.firstClear.weapons) if (!p.weapons.includes(w)) p.weapons.push(w);
    for (const g of m.firstClear.gear) if (!p.gear.includes(g)) p.gear.push(g);
  }
  return p;
}

/** How far a save has got, for choosing between a local and a cloud copy. */
export function progressScore(p: ProfileData): number {
  const stars = Object.values(p.missions).reduce((n, r) => n + r.stars, 0);
  const wins = Object.values(p.missions).filter((r) => r.wins > 0).length;
  return wins * 1_000_000 + stars * 10_000 + p.suppliesEarned;
}

/** The save to keep when two copies disagree: more progress wins, then the newer one. */
export function pickProfile(a: ProfileData, b: ProfileData): ProfileData {
  const sa = progressScore(a);
  const sb = progressScore(b);
  if (sa !== sb) return sa > sb ? a : b;
  return a.savedAt >= b.savedAt ? a : b;
}

function safeLocalStorage(): KeyValueStore | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

function read(store: KeyValueStore | null, key: string): string | null {
  try {
    return store?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

/** Holds the profile in memory and writes every change through to local (and cloud) storage. */
export class ProfileStore {
  private data: ProfileData | null = null;
  private cloud: KeyValueStore | null = null;
  /** True once the portal's store has taken over as the save. */
  private localOff = false;

  constructor(private readonly local: () => KeyValueStore | null = safeLocalStorage) {}

  get(): ProfileData {
    if (!this.data) this.data = this.loadLocal();
    return this.data;
  }

  update(fn: (d: ProfileData) => void): ProfileData {
    const d = this.get();
    fn(d);
    this.save();
    return d;
  }

  save(): void {
    const d = this.get();
    d.savedAt = Date.now();
    const raw = JSON.stringify(d);
    for (const store of [this.localOff ? null : this.local(), this.cloud]) {
      try {
        store?.setItem(PROFILE_KEY, raw);
      } catch {
        /* storage unavailable: progress lives for this session only */
      }
    }
  }

  /**
   * Makes the portal's data store the only save, as CrazyGames asks: it keeps a guest's
   * progress itself and swaps in the account's on signing in, so a second copy here would
   * leak one player's progress into another's. Progress saved before is carried over, and the
   * local copy is dropped only once the store is seen to hold it.
   */
  moveTo(store: KeyValueStore): void {
    const remote = parseProfile(read(store, PROFILE_KEY));
    if (remote) this.data = remote;
    this.cloud = store;
    this.save();
    if (read(store, PROFILE_KEY) === null) return;
    const local = this.local();
    this.localOff = true;
    for (const key of [PROFILE_KEY, LEGACY_KEY]) {
      try {
        local?.removeItem?.(key);
      } catch {
        /* nothing to tidy */
      }
    }
  }

  /**
   * Adds the portal's cloud store. Whichever copy has more progress becomes the
   * profile, and both stores are brought up to date with it.
   */
  attachCloud(store: KeyValueStore): void {
    this.cloud = store;
    const local = this.get();
    const remote = parseProfile(read(store, PROFILE_KEY));
    if (remote) this.data = pickProfile(local, remote);
    this.save();
  }

  /** Forget the in-memory copy (tests). */
  reset(): void {
    this.data = null;
    this.cloud = null;
    this.localOff = false;
  }

  private loadLocal(): ProfileData {
    const store = this.local();
    const current = parseProfile(read(store, PROFILE_KEY));
    if (current) return current;
    return migrateLegacy(read(store, LEGACY_KEY));
  }
}

/** The one profile for the page. */
export const profile = new ProfileStore();
