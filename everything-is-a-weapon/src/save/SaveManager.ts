import { ABILITY_IDS } from '../gameplay/Abilities';
import { isHeroId, type HeroId } from '../core/Hero';
import type { PortalStorage } from '../platform/Portal';

export const SAVE_VERSION = 4;
const STORAGE_KEY = 'everything-is-a-weapon/save';

/** Best run on one room, for the level-select wall and replay bragging rights. */
export interface RoomBest {
  score: number;
  chain: number;
}

export interface Settings {
  volume: number;
  muted: boolean;
  music: boolean;
  reducedShake: boolean;
  highContrast: boolean;
}

export interface SaveData {
  version: number;
  discoveries: string[];
  highScore: number;
  /** Longest chain reaction ever pulled off, across all rooms. */
  bestChain: number;
  /** Scrap salvaged from defeated intruders; buys permanent abilities. */
  scrap: number;
  /** Unlocked ability ids (see gameplay/Abilities.ts). */
  abilities: string[];
  /** Highest room index (0-based) the player may start from. */
  unlockedRoom: number;
  completedChallenges: string[];
  roomsCleared: number;
  /** Per-room bests by room id (new in version 2). */
  roomBests: Record<string, RoomBest>;
  /** Campaign stars per room id, 0–3 (new in version 3). */
  roomStars: Record<string, number>;
  /** Completed contract ids (new in version 3). */
  contractsDone: string[];
  /** Lifetime campaign counters (new in version 3): only rooms cleared count. */
  totalKills: number;
  totalChains: number;
  totalHazardKills: number;
  bossesBeaten: number;
  /** Daily-challenge return hook (new in version 3). */
  lastDaily: string;
  dailyStreak: number;
  /** Deepest room cleared, 1-based (new in version 4). */
  deepest: number;
  hero: HeroId;
  /** Room 1's lesson plan: '' not started, a lesson id part-way through, 'done' after. */
  tutorial: string;
  settings: Settings;
}

function defaults(): SaveData {
  return {
    version: SAVE_VERSION,
    discoveries: [],
    highScore: 0,
    bestChain: 0,
    scrap: 0,
    abilities: [],
    unlockedRoom: 0,
    completedChallenges: [],
    roomsCleared: 0,
    roomBests: {},
    roomStars: {},
    contractsDone: [],
    totalKills: 0,
    totalChains: 0,
    totalHazardKills: 0,
    bossesBeaten: 0,
    lastDaily: '',
    dailyStreak: 0,
    deepest: 0,
    hero: 'tenant',
    tutorial: '',
    settings: { volume: 0.7, muted: false, music: true, reducedShake: false, highContrast: false },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}

function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/**
 * Upgrades any older save shape to the current one. Add a step per version bump:
 *   if (version < 2) { ...transform raw...; version = 2; }
 */
function migrate(raw: Record<string, unknown>): Record<string, unknown> {
  let version = finite(raw.version, 0);
  if (version > SAVE_VERSION) {
    console.warn('[save] save is from a newer version; loading what is understood.');
  }
  if (version < 2) {
    // Version 2 adds per-room bests; older saves simply start collecting them.
    raw.roomBests = {};
    version = 2;
  }
  if (version < 3) {
    // Version 3 adds the campaign layer (stars, contracts, lifetime counters, daily streak).
    raw.roomStars = {};
    raw.contractsDone = [];
    raw.totalKills = 0;
    raw.totalChains = 0;
    raw.totalHazardKills = 0;
    raw.bossesBeaten = 0;
    raw.lastDaily = '';
    raw.dailyStreak = 0;
    version = 3;
  }
  if (version < 4) {
    // Version 4 tracks the deepest room cleared for the post-game.
    raw.deepest = 0;
    version = 4;
  }
  return raw;
}

function roomBests(value: unknown): Record<string, RoomBest> {
  const out: Record<string, RoomBest> = {};
  if (!isRecord(value)) return out;
  for (const [id, entry] of Object.entries(value)) {
    if (!isRecord(entry)) continue;
    out[id] = {
      score: Math.max(0, Math.floor(finite(entry.score, 0))),
      chain: Math.max(0, Math.floor(finite(entry.chain, 0))),
    };
  }
  return out;
}

function starMap(value: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!isRecord(value)) return out;
  for (const [id, n] of Object.entries(value)) {
    if (typeof n !== 'number' || !Number.isFinite(n)) continue;
    out[id] = Math.max(0, Math.min(3, Math.floor(n)));
  }
  return out;
}

function sanitize(raw: unknown): SaveData {
  const base = defaults();
  if (!isRecord(raw)) return base;
  const data = migrate(raw);
  const settings = isRecord(data.settings) ? data.settings : {};
  return {
    version: SAVE_VERSION,
    discoveries: [...new Set(stringArray(data.discoveries))],
    highScore: Math.max(0, finite(data.highScore, 0)),
    bestChain: Math.max(0, Math.floor(finite(data.bestChain, 0))),
    scrap: Math.max(0, Math.floor(finite(data.scrap, 0))),
    abilities: [...new Set(stringArray(data.abilities).filter((id) => ABILITY_IDS.includes(id)))],
    unlockedRoom: Math.max(0, Math.floor(finite(data.unlockedRoom, 0))),
    completedChallenges: [...new Set(stringArray(data.completedChallenges))],
    roomsCleared: Math.max(0, Math.floor(finite(data.roomsCleared, 0))),
    roomBests: roomBests(data.roomBests),
    roomStars: starMap(data.roomStars),
    contractsDone: [...new Set(stringArray(data.contractsDone))],
    totalKills: Math.max(0, Math.floor(finite(data.totalKills, 0))),
    totalChains: Math.max(0, Math.floor(finite(data.totalChains, 0))),
    totalHazardKills: Math.max(0, Math.floor(finite(data.totalHazardKills, 0))),
    bossesBeaten: Math.max(0, Math.floor(finite(data.bossesBeaten, 0))),
    lastDaily: typeof data.lastDaily === 'string' ? data.lastDaily : '',
    dailyStreak: Math.max(0, Math.floor(finite(data.dailyStreak, 0))),
    deepest: Math.max(0, Math.floor(finite(data.deepest, 0))),
    hero: isHeroId(data.hero) ? data.hero : base.hero,
    // Saves from before the lesson plan: anyone past room 1 has nothing left to be taught.
    tutorial: typeof data.tutorial === 'string' ? data.tutorial : finite(data.unlockedRoom, 0) > 0 ? 'done' : '',
    settings: {
      volume: Math.min(1, Math.max(0, finite(settings.volume, base.settings.volume))),
      muted: settings.muted === true,
      music: settings.music !== false,
      reducedShake: settings.reducedShake === true,
      highContrast: settings.highContrast === true,
    },
  };
}

/** LocalStorage persistence that degrades to an in-memory save when storage is blocked. */
export class SaveManager {
  data: SaveData = defaults();
  /** False when the browser refused storage (private mode, sandboxed iframe on a portal, ...). */
  persistent = true;

  /** `storage` is the portal's own save store, when it has one; otherwise the browser's. */
  constructor(private readonly storage: PortalStorage | null = null) {}

  private get store(): PortalStorage {
    return this.storage ?? window.localStorage;
  }

  load(): void {
    try {
      const text = this.store.getItem(STORAGE_KEY);
      this.data = text ? sanitize(JSON.parse(text)) : defaults();
    } catch (error) {
      console.warn('[save] could not read save; starting fresh.', error);
      this.persistent = false;
      this.data = defaults();
    }
  }

  write(): void {
    if (!this.persistent) return;
    try {
      this.store.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch (error) {
      console.warn('[save] could not write save; progress will last for this session only.', error);
      this.persistent = false;
    }
  }

  clear(): void {
    this.data = defaults();
    try {
      this.store.removeItem(STORAGE_KEY);
    } catch {
      // Nothing to clear if storage is unavailable.
    }
  }
}
