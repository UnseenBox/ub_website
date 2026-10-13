const KEY = 'crazy-goal-save';
const VERSION = 1;

export interface LevelRecord {
  best: number;
  attempts: number;
  goals: number;
  /** Best star rating so far, 0 to 3. */
  stars: number;
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
  /** Kora Coins: earned per goal in solo play, spent on shot abilities. */
  coins: number;
}

const fresh = (): SaveData => ({ version: VERSION, levels: {}, muted: false, sound: 0.8, music: 0.5, skin: 'classic', coins: 0 });
const volume = (v: unknown, fallback: number): number => (typeof v === 'number' && v >= 0 && v <= 1 ? v : fallback);

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0);

/** Reads whatever is stored and keeps only what is well formed. Unknown versions start clean. */
function parse(raw: string | null): SaveData {
  if (!raw) return fresh();
  const data: unknown = JSON.parse(raw);
  if (!isRecord(data) || data.version !== VERSION) return fresh();
  const out = fresh();
  out.muted = data.muted === true;
  out.sound = volume(data.sound, out.sound);
  out.music = volume(data.music, out.music);
  out.coins = num(data.coins);
  if (typeof data.skin === 'string') out.skin = data.skin;
  if (isRecord(data.levels)) {
    for (const [id, rec] of Object.entries(data.levels)) {
      if (isRecord(rec)) out.levels[id] = { best: num(rec.best), attempts: num(rec.attempts), goals: num(rec.goals), stars: Math.min(3, num(rec.stars)) };
    }
  }
  return out;
}

/** Versioned LocalStorage save. If storage is blocked the game simply runs without remembering. */
export class SaveManager {
  readonly data: SaveData;

  constructor() {
    let data = fresh();
    try {
      data = parse(localStorage.getItem(KEY));
    } catch {
      /* private mode, blocked storage or a corrupt entry: start clean */
    }
    this.data = data;
  }

  level(id: string): LevelRecord {
    let rec = this.data.levels[id];
    if (!rec) {
      rec = { best: 0, attempts: 0, goals: 0, stars: 0 };
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
