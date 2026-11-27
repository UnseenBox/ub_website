// Eight-wave prototype campaign. Each group spawns `count` enemies, starting
// `delay` seconds into the wave, one every `interval` seconds. `burst` spawns
// that many at once per tick (pressure spikes).
//
// Pacing is deliberately gentle: each wave grows by about a quarter, enemies come a
// little slower, and the toughening per wave is halved.
//
// Introductions: Brutes (giant, hard to kill) and Hollow Hounds arrive in wave 2,
// Wraiths in wave 5 and Pumpkin Broods in wave 7. Every wave is bigger than
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
    speedMul: 1.0,
    healthMul: 1.0,
    groups: [
      { enemy: 'shambler', count: 14, delay: 0, interval: 2.3 },
      { enemy: 'shambler', count: 6, delay: 18, interval: 1.4, burst: 2 },
    ],
  },
  {
    name: 'Giants in the Fog',
    speedMul: 1.02,
    healthMul: 1.0,
    groups: [
      { enemy: 'shambler', count: 20, delay: 0, interval: 1.7 },
      { enemy: 'hollow_hound', count: 2, delay: 14, interval: 9.2 },
      { enemy: 'brute', count: 2, delay: 5, interval: 25.3 },
    ],
  },
  {
    name: 'Close Quarters',
    speedMul: 1.02,
    healthMul: 1.02,
    groups: [
      { enemy: 'shambler', count: 22, delay: 0, interval: 1.6 },
      { enemy: 'shambler', count: 4, delay: 6, interval: 5, burst: 2 },
      { enemy: 'hollow_hound', count: 2, delay: 12, interval: 9.8 },
      { enemy: 'brute', count: 2, delay: 8, interval: 23.0 },
    ],
  },
  {
    name: 'Mixed Column',
    speedMul: 1.04,
    healthMul: 1.04,
    groups: [
      { enemy: 'shambler', count: 25, delay: 0, interval: 1.4 },
      { enemy: 'hollow_hound', count: 4, delay: 5, interval: 6.3 },
      { enemy: 'shambler', count: 5, delay: 10, interval: 3.8, burst: 2 },
      { enemy: 'brute', count: 2, delay: 6, interval: 18.4 },
    ],
  },
  {
    name: 'Smoke Line',
    speedMul: 1.04,
    healthMul: 1.05,
    groups: [
      { enemy: 'shambler', count: 32, delay: 0, interval: 1.3 },
      { enemy: 'wraith', count: 4, delay: 8, interval: 5.8 },
      { enemy: 'hollow_hound', count: 3, delay: 12, interval: 7.5 },
      { enemy: 'shambler', count: 5, delay: 16, interval: 4.3, burst: 2 },
      { enemy: 'brute', count: 2, delay: 10, interval: 18.4 },
    ],
  },
  {
    name: 'Pressure',
    speedMul: 1.05,
    healthMul: 1.07,
    groups: [
      { enemy: 'shambler', count: 38, delay: 0, interval: 1.0 },
      { enemy: 'hollow_hound', count: 4, delay: 4, interval: 6.3 },
      { enemy: 'wraith', count: 5, delay: 10, interval: 4.6 },
      { enemy: 'shambler', count: 6, delay: 14, interval: 3.3, burst: 3 },
      { enemy: 'brute', count: 3, delay: 8, interval: 16.1 },
    ],
  },
  {
    name: 'Swollen Dead',
    speedMul: 1.06,
    healthMul: 1.09,
    groups: [
      { enemy: 'shambler', count: 43, delay: 0, interval: 1.0 },
      { enemy: 'pumpkin_brood', count: 1, delay: 4, interval: 27.6 },
      { enemy: 'hollow_hound', count: 6, delay: 8, interval: 4.7 },
      { enemy: 'wraith', count: 7, delay: 12, interval: 4.1 },
      { enemy: 'shambler', count: 7, delay: 18, interval: 3.4, burst: 3 },
      { enemy: 'brute', count: 4, delay: 8, interval: 13.8 },
    ],
  },
  {
    name: 'Last Stand',
    speedMul: 1.07,
    healthMul: 1.11,
    groups: [
      { enemy: 'shambler', count: 52, delay: 0, interval: 0.8, burst: 2 },
      { enemy: 'hollow_hound', count: 6, delay: 5, interval: 4 },
      { enemy: 'wraith', count: 8, delay: 9, interval: 3.2 },
      { enemy: 'pumpkin_brood', count: 2, delay: 12, interval: 13.8 },
      { enemy: 'shambler', count: 8, delay: 16, interval: 2.8, burst: 3 },
      { enemy: 'brute', count: 5, delay: 6, interval: 11.5 },
      { enemy: 'hollow_hound', count: 3, delay: 50, interval: 1.2 },
    ],
  },
];

/** Total enemies a wave spawns from its schedule (not counting bursts). */
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
