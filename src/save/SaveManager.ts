export interface Settings {
  masterVolume: number;
  ambienceVolume: number;
  effectsVolume: number;
  screenShake: boolean;
  /** Dials back flashing, distortion and tremor without changing the rules. */
  reducedEffects: boolean;
  highContrastCursor: boolean;
  showHints: boolean;
}

export interface RoomRecord {
  completed: boolean;
  bestTimeMs: number;
  bestScore: number;
  attempts: number;
  perfect: boolean;
}

export interface SaveData {
  version: number;
  settings: Settings;
  rooms: Record<string, RoomRecord>;
  discoveries: string[];
  challengeScores: Record<string, number>;
  /** How far the campaign has been unlocked, as a count of rooms. */
  unlocked: number;
  totals: {
    runs: number;
    escapes: number;
    detections: number;
    clicks: number;
    deaths: number;
  };
}

const KEY = 'dontletitseeyou.save';
const VERSION = 2;

export function defaultSettings(): Settings {
  return {
    masterVolume: 0.8,
    ambienceVolume: 0.75,
    effectsVolume: 0.9,
    screenShake: true,
    reducedEffects: false,
    highContrastCursor: false,
    showHints: true,
  };
}

function defaultSave(): SaveData {
  return {
    version: VERSION,
    settings: defaultSettings(),
    rooms: {},
    discoveries: [],
    challengeScores: {},
    unlocked: 1,
    totals: { runs: 0, escapes: 0, detections: 0, clicks: 0, deaths: 0 },
  };
}

/**
 * Versioned LocalStorage save.
 *
 * Storage can be unavailable (private windows, blocked cookies, embedded in a
 * portal iframe), so every access is guarded and the game simply runs with an
 * in-memory save when it has to. Losing progress is a shame; crashing is not an
 * option.
 */
export class SaveManager {
  private data: SaveData = defaultSave();
  private storageWorks = true;
  private writeQueued = false;

  constructor() {
    this.load();
  }

  get settings(): Settings {
    return this.data.settings;
  }

  get all(): SaveData {
    return this.data;
  }

  get storageAvailable(): boolean {
    return this.storageWorks;
  }

  load(): void {
    try {
      const raw = window.localStorage.getItem(KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<SaveData>;
      this.data = this.migrate(parsed);
    } catch (err) {
      console.warn('[save] could not read, starting fresh', err);
      this.storageWorks = false;
      this.data = defaultSave();
    }
  }

  private migrate(parsed: Partial<SaveData>): SaveData {
    const base = defaultSave();
    const version = typeof parsed.version === 'number' ? parsed.version : 1;
    const merged: SaveData = {
      version: VERSION,
      settings: { ...base.settings, ...(parsed.settings ?? {}) },
      rooms: { ...(parsed.rooms ?? {}) },
      discoveries: Array.isArray(parsed.discoveries) ? parsed.discoveries.slice() : [],
      challengeScores: { ...(parsed.challengeScores ?? {}) },
      unlocked: typeof parsed.unlocked === 'number' ? Math.max(1, parsed.unlocked) : 1,
      totals: { ...base.totals, ...(parsed.totals ?? {}) },
    };
    if (version < 2) {
      // Version 1 stored best times in seconds. Convert once.
      for (const record of Object.values(merged.rooms)) {
        if (record.bestTimeMs > 0 && record.bestTimeMs < 1000) {
          record.bestTimeMs = Math.round(record.bestTimeMs * 1000);
        }
      }
    }
    return merged;
  }

  /** Coalesce writes: progress changes in bursts at the end of a room. */
  save(): void {
    if (!this.storageWorks || this.writeQueued) return;
    this.writeQueued = true;
    window.setTimeout(() => {
      this.writeQueued = false;
      try {
        window.localStorage.setItem(KEY, JSON.stringify(this.data));
      } catch (err) {
        console.warn('[save] could not write', err);
        this.storageWorks = false;
      }
    }, 120);
  }

  updateSettings(patch: Partial<Settings>): Settings {
    this.data.settings = { ...this.data.settings, ...patch };
    this.save();
    return this.data.settings;
  }

  record(roomId: string): RoomRecord {
    let r = this.data.rooms[roomId];
    if (!r) {
      r = { completed: false, bestTimeMs: 0, bestScore: 0, attempts: 0, perfect: false };
      this.data.rooms[roomId] = r;
    }
    return r;
  }

  noteAttempt(roomId: string): void {
    this.record(roomId).attempts++;
    this.data.totals.runs++;
    this.save();
  }

  noteEscape(
    roomId: string,
    timeMs: number,
    score: number,
    perfect: boolean,
    roomIndex: number,
    roomCount: number,
  ): { newBestTime: boolean; newBestScore: boolean } {
    const r = this.record(roomId);
    const newBestTime = r.bestTimeMs === 0 || timeMs < r.bestTimeMs;
    const newBestScore = score > r.bestScore;
    r.completed = true;
    if (newBestTime) r.bestTimeMs = timeMs;
    if (newBestScore) r.bestScore = score;
    if (perfect) r.perfect = true;
    this.data.totals.escapes++;
    this.data.unlocked = Math.max(this.data.unlocked, Math.min(roomCount, roomIndex + 2));
    this.save();
    return { newBestTime, newBestScore };
  }

  noteDeath(): void {
    this.data.totals.deaths++;
    this.save();
  }

  noteDetection(): void {
    this.data.totals.detections++;
  }

  noteClicks(count: number): void {
    this.data.totals.clicks += count;
  }

  setDiscoveries(ids: readonly string[]): void {
    this.data.discoveries = ids.slice();
    this.save();
  }

  noteChallenge(key: string, score: number): boolean {
    const prev = this.data.challengeScores[key] ?? 0;
    if (score <= prev) return false;
    this.data.challengeScores[key] = score;
    this.save();
    return true;
  }

  challengeScore(key: string): number {
    return this.data.challengeScores[key] ?? 0;
  }

  get unlocked(): number {
    return this.data.unlocked;
  }

  wipe(): void {
    this.data = defaultSave();
    try {
      window.localStorage.removeItem(KEY);
    } catch {
      // Nothing to remove, which is the same outcome.
    }
  }
}
