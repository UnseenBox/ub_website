import type { Boost } from '../abilities/Cards';
import { SKINS } from '../ball/Skins';
import { noUpgrades, UPGRADE_MAX, type UpgradeLevels } from '../progression/Upgrades';

const KEY = 'crazy-goal-save';
/**
 * Version 2 added the economy and onboarding fields. A save is never wiped for being a different
 * version: older ones are migrated, newer ones keep every field this build understands.
 */
export const SAVE_VERSION = 2;

export interface LevelRecord {
  best: number;
  attempts: number;
  goals: number;
  /** Best star rating so far, 0 to 3. */
  stars: number;
  /** The level's coin has been collected once, ever. */
  coin: boolean;
  /** Stars already paid out in coins (never pay for the same star twice). */
  paidStars: number;
}

export interface SaveData {
  version: number;
  levels: Record<string, LevelRecord>;
  muted: boolean;
  /** Volumes, 0 to 1. */
  sound: number;
  music: number;
  /** Id of the chosen ball (see Skins). */
  skin: string;
  /** Kora Coins: earned by progress (first clears, new stars), spent on shot abilities. */
  coins: number;
  /** One-time tips already shown. */
  tips: string[];
  /** The boost column has been introduced. */
  boostIntro: boolean;
  /** Free boost charges, spent before any coins. */
  freeBoosts: Partial<Record<Boost, number>>;
  /** Skins the player has already been told about (toast / NEW dot). */
  seenSkins: string[];
  /** Shot upgrades bought in the store, 0 to 3 each. */
  upgrades: UpgradeLevels;
}

const freshLevel = (): LevelRecord => ({ best: 0, attempts: 0, goals: 0, stars: 0, coin: false, paidStars: 0 });

const fresh = (): SaveData => ({
  version: SAVE_VERSION,
  levels: {},
  muted: false,
  sound: 0.3,
  music: 0.2,
  skin: 'classic',
  coins: 0,
  tips: [],
  boostIntro: false,
  freeBoosts: {},
  seenSkins: [],
  upgrades: noUpgrades(),
});

const volume = (v: unknown, fallback: number): number => (typeof v === 'number' && v >= 0 && v <= 1 ? v : fallback);

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0);
const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

const BOOSTS: readonly Boost[] = ['fire', 'magnet', 'rubber'];

/**
 * Reads whatever is stored and keeps only what is well formed. Version 1 is migrated, a version
 * from the future still yields every field this build knows; only unreadable JSON throws.
 */
export function parseSave(raw: string | null): SaveData {
  if (!raw) return fresh();
  const data: unknown = JSON.parse(raw);
  if (!isRecord(data)) return fresh();
  // Only our own saves carry a numeric version; anything else is not ours to migrate.
  if (typeof data.version !== 'number' || data.version < 1) return fresh();
  const legacy = data.version === 1;
  const out = fresh();
  out.muted = data.muted === true;
  out.sound = volume(data.sound, out.sound);
  out.music = volume(data.music, out.music);
  out.coins = num(data.coins);
  if (typeof data.skin === 'string') out.skin = data.skin;
  if (isRecord(data.levels)) {
    for (const [id, rec] of Object.entries(data.levels)) {
      if (!isRecord(rec)) continue;
      const stars = Math.min(3, num(rec.stars));
      out.levels[id] = {
        best: num(rec.best),
        attempts: num(rec.attempts),
        goals: num(rec.goals),
        stars,
        coin: rec.coin === true,
        // A v1 star was always paid for in goal coins: migrate as `stars` so nobody is paid twice.
        paidStars: legacy || rec.paidStars === undefined ? stars : Math.min(3, num(rec.paidStars)),
      };
    }
  }
  out.tips = strings(data.tips);
  out.boostIntro = data.boostIntro === true;
  if (isRecord(data.freeBoosts)) {
    for (const id of BOOSTS) {
      const n = Math.floor(num(data.freeBoosts[id]));
      if (n > 0) out.freeBoosts[id] = n;
    }
  }
  if (isRecord(data.upgrades)) {
    for (const id of ['power', 'curl', 'aim'] as const) out.upgrades[id] = Math.min(UPGRADE_MAX, Math.floor(num(data.upgrades[id])));
  }
  if (legacy) {
    // A v1 player who has already played houma 6 had the boost column all along: no introduction.
    const six = out.levels['houma-06'];
    out.boostIntro = !!six && (six.attempts > 0 || six.goals > 0);
    // Everything a v1 player has already earned is old news, not a surprise to announce.
    let stars = 0;
    for (const rec of Object.values(out.levels)) stars += rec.stars;
    out.seenSkins = SKINS.filter((s) => s.need <= stars).map((s) => s.id);
  } else {
    out.seenSkins = strings(data.seenSkins);
  }
  return out;
}

/** Versioned LocalStorage save. If storage is blocked the game simply runs without remembering. */
export class SaveManager {
  readonly data: SaveData;

  constructor() {
    let data = fresh();
    try {
      data = parseSave(localStorage.getItem(KEY));
    } catch {
      /* private mode, blocked storage or a corrupt entry: start clean */
    }
    this.data = data;
  }

  level(id: string): LevelRecord {
    let rec = this.data.levels[id];
    if (!rec) {
      rec = freshLevel();
      this.data.levels[id] = rec;
    }
    return rec;
  }

  save(): void {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.data));
    } catch {
      /* nothing useful to do; progress lives for this session only */
    }
  }
}

export const freshSaveData = fresh;
export const freshLevelRecord = freshLevel;
