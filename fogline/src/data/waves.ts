// Eight-wave prototype campaign. Each group spawns `count` enemies, starting
// `delay` seconds into the wave, one every `interval` seconds. `burst` spawns
// that many at once per tick (pressure spikes).
//
// Introductions: Brutes (giant, hard to kill) arrive in wave 2, Crawler packs in
// wave 3, Riot Husks in wave 5 and Bloaters in wave 6. Every wave is bigger than
// the one before.

export interface SpawnGroup {
  enemy: string;
  count: number;
  delay: number;
  interval: number;
  burst?: number;
}

export interface WaveDef {
  name: string;
  groups: SpawnGroup[];
  /** Multipliers applied to every enemy in the wave. */
  speedMul: number;
  healthMul: number;
}

export const WAVES: WaveDef[] = [
  {
    name: 'First Contact',
    speedMul: 1,
    healthMul: 1,
    groups: [
      { enemy: 'shambler', count: 14, delay: 0, interval: 2.0 },
      { enemy: 'shambler', count: 6, delay: 18, interval: 1.2, burst: 2 },
    ],
  },
  {
    name: 'Giants in the Fog',
    speedMul: 1.03,
    healthMul: 1,
    groups: [
      { enemy: 'shambler', count: 22, delay: 0, interval: 1.5 },
      { enemy: 'runner', count: 4, delay: 14, interval: 4.0 },
      { enemy: 'brute', count: 2, delay: 5, interval: 22 },
    ],
  },
  {
    name: 'Crawl Space',
    speedMul: 1.05,
    healthMul: 1.05,
    groups: [
      { enemy: 'shambler', count: 22, delay: 0, interval: 1.4 },
      { enemy: 'crawler', count: 14, delay: 6, interval: 1.6, burst: 2 },
      { enemy: 'runner', count: 6, delay: 12, interval: 3.4 },
      { enemy: 'brute', count: 2, delay: 8, interval: 20 },
    ],
  },
  {
    name: 'Mixed Column',
    speedMul: 1.07,
    healthMul: 1.08,
    groups: [
      { enemy: 'shambler', count: 26, delay: 0, interval: 1.2 },
      { enemy: 'runner', count: 12, delay: 5, interval: 2.4 },
      { enemy: 'crawler', count: 16, delay: 10, interval: 1.4, burst: 2 },
      { enemy: 'brute', count: 3, delay: 6, interval: 16 },
    ],
  },
  {
    name: 'Riot Line',
    speedMul: 1.08,
    healthMul: 1.1,
    groups: [
      { enemy: 'shambler', count: 28, delay: 0, interval: 1.1 },
      { enemy: 'plated', count: 5, delay: 8, interval: 5.0 },
      { enemy: 'runner', count: 10, delay: 12, interval: 2.4 },
      { enemy: 'crawler', count: 14, delay: 16, interval: 1.6, burst: 2 },
      { enemy: 'brute', count: 3, delay: 10, interval: 16 },
    ],
  },
  {
    name: 'Pressure',
    speedMul: 1.1,
    healthMul: 1.14,
    groups: [
      { enemy: 'shambler', count: 34, delay: 0, interval: 0.9 },
      { enemy: 'runner', count: 14, delay: 4, interval: 2.0 },
      { enemy: 'plated', count: 7, delay: 10, interval: 4.0 },
      { enemy: 'crawler', count: 18, delay: 14, interval: 1.2, burst: 3 },
      { enemy: 'brute', count: 4, delay: 8, interval: 14 },
    ],
  },
  {
    name: 'Swollen Dead',
    speedMul: 1.12,
    healthMul: 1.18,
    groups: [
      { enemy: 'shambler', count: 30, delay: 0, interval: 0.9 },
      { enemy: 'carrier', count: 4, delay: 4, interval: 8 },
      { enemy: 'runner', count: 16, delay: 8, interval: 1.7 },
      { enemy: 'plated', count: 8, delay: 12, interval: 3.6 },
      { enemy: 'crawler', count: 20, delay: 18, interval: 1.2, burst: 3 },
      { enemy: 'brute', count: 5, delay: 8, interval: 12 },
    ],
  },
  {
    name: 'Last Stand',
    speedMul: 1.15,
    healthMul: 1.22,
    groups: [
      { enemy: 'shambler', count: 44, delay: 0, interval: 0.7, burst: 2 },
      { enemy: 'runner', count: 24, delay: 5, interval: 1.3 },
      { enemy: 'plated', count: 12, delay: 9, interval: 2.8 },
      { enemy: 'carrier', count: 6, delay: 12, interval: 6 },
      { enemy: 'crawler', count: 30, delay: 16, interval: 1.0, burst: 3 },
      { enemy: 'brute', count: 7, delay: 6, interval: 10 },
      { enemy: 'runner', count: 10, delay: 50, interval: 0.4, burst: 5 },
    ],
  },
];

/** Total enemies a wave spawns from its schedule (not counting Crawler bursts). */
export function scheduledCount(wave: WaveDef): number {
  return wave.groups.reduce((n, g) => n + g.count, 0);
}

/** Enemy ids that appear for the first time in wave `index` (0-based). */
export function newEnemiesInWave(index: number, waves: WaveDef[] = WAVES): string[] {
  const seen = new Set<string>();
  for (let i = 0; i < index; i++) for (const g of waves[i].groups) seen.add(g.enemy);
  const fresh: string[] = [];
  for (const g of waves[index]?.groups ?? []) {
    if (!seen.has(g.enemy) && !fresh.includes(g.enemy)) fresh.push(g.enemy);
  }
  return fresh;
}
