// Eight-wave prototype campaign. Each group spawns `count` enemies, starting
// `delay` seconds into the wave, one every `interval` seconds. `burst` spawns
// that many at once per tick (pressure spikes).

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
    groups: [{ enemy: 'shambler', count: 10, delay: 0, interval: 2.6 }],
  },
  {
    name: 'The Long Walk',
    speedMul: 1.03,
    healthMul: 1,
    groups: [
      { enemy: 'shambler', count: 12, delay: 0, interval: 2.0 },
      { enemy: 'shambler', count: 8, delay: 14, interval: 1.0, burst: 2 },
    ],
  },
  {
    name: 'Fast Movers',
    speedMul: 1.05,
    healthMul: 1.05,
    groups: [
      { enemy: 'shambler', count: 14, delay: 0, interval: 1.8 },
      { enemy: 'runner', count: 4, delay: 9, interval: 4.5 },
    ],
  },
  {
    name: 'Mixed Column',
    speedMul: 1.07,
    healthMul: 1.08,
    groups: [
      { enemy: 'shambler', count: 18, delay: 0, interval: 1.5 },
      { enemy: 'runner', count: 8, delay: 6, interval: 3.0 },
      { enemy: 'runner', count: 4, delay: 30, interval: 0.6, burst: 2 },
    ],
  },
  {
    name: 'Riot Line',
    speedMul: 1.08,
    healthMul: 1.1,
    groups: [
      { enemy: 'shambler', count: 14, delay: 0, interval: 1.7 },
      { enemy: 'plated', count: 4, delay: 8, interval: 6.0 },
      { enemy: 'runner', count: 6, delay: 14, interval: 2.6 },
    ],
  },
  {
    name: 'Pressure',
    speedMul: 1.1,
    healthMul: 1.14,
    groups: [
      { enemy: 'shambler', count: 24, delay: 0, interval: 1.1 },
      { enemy: 'runner', count: 10, delay: 5, interval: 2.2 },
      { enemy: 'plated', count: 6, delay: 12, interval: 4.5 },
    ],
  },
  {
    name: 'Swollen Dead',
    speedMul: 1.12,
    healthMul: 1.18,
    groups: [
      { enemy: 'shambler', count: 18, delay: 0, interval: 1.2 },
      { enemy: 'carrier', count: 3, delay: 4, interval: 9 },
      { enemy: 'runner', count: 10, delay: 10, interval: 2.0 },
      { enemy: 'plated', count: 6, delay: 16, interval: 4.0 },
    ],
  },
  {
    name: 'Last Stand',
    speedMul: 1.15,
    healthMul: 1.22,
    groups: [
      { enemy: 'shambler', count: 30, delay: 0, interval: 0.9, burst: 2 },
      { enemy: 'runner', count: 16, delay: 6, interval: 1.6 },
      { enemy: 'plated', count: 10, delay: 10, interval: 3.2 },
      { enemy: 'carrier', count: 5, delay: 14, interval: 7 },
      { enemy: 'runner', count: 8, delay: 45, interval: 0.4, burst: 4 },
    ],
  },
];

/** Total enemies a wave spawns from its schedule (not counting Crawler bursts). */
export function scheduledCount(wave: WaveDef): number {
  return wave.groups.reduce((n, g) => n + g.count, 0);
}
