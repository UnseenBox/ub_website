// Persists settings and best results. Every storage access is guarded: private
// windows or blocked storage simply fall back to defaults.

export interface SaveData {
  volumes: { master: number; sfx: number; music: number };
  bestWave: number;
  bestKills: number;
}

const KEY = 'fogline.save.v1';
const DEFAULTS: SaveData = { volumes: { master: 0.8, sfx: 0.9, music: 0.45 }, bestWave: 0, bestKills: 0 };

export const SaveManager = {
  load(): SaveData {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return structuredClone(DEFAULTS);
      const d = JSON.parse(raw) as Partial<SaveData>;
      return {
        volumes: { ...DEFAULTS.volumes, ...(d.volumes ?? {}) },
        bestWave: Number(d.bestWave) || 0,
        bestKills: Number(d.bestKills) || 0,
      };
    } catch {
      return structuredClone(DEFAULTS);
    }
  },
  save(d: SaveData): void {
    try {
      localStorage.setItem(KEY, JSON.stringify(d));
    } catch {
      /* storage unavailable */
    }
  },
  update(fn: (d: SaveData) => void): SaveData {
    const d = this.load();
    fn(d);
    this.save(d);
    return d;
  },
};
