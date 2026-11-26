// The sums behind a gun tile (see gunTile.ts), kept free of Phaser so they can be tested.

/** Where the middle of each gun sits across its picture, as a share of the picture's width. */
const GUN_CENTRE: Record<string, number> = {
  service: 0.555, m4: 0.6, shotgun: 0.57, tesla: 0.5, m249: 0.59, m82: 0.6, m32: 0.617,
};

/** The square of a gun's picture that frames the gun, in the picture's own pixels. */
export function gunCrop(id: string, width: number, height: number): { x: number; y: number; side: number } {
  const side = Math.min(width, height);
  const x = Math.max(0, Math.min(width - side, width * (GUN_CENTRE[id] ?? 0.58) - side / 2));
  return { x: Math.round(x), y: Math.round((height - side) / 2), side };
}

/** Drains the colour from RGBA pixels, for a gun that is still locked. Alpha is left alone. */
export function toGrey(data: Uint8ClampedArray): void {
  for (let i = 0; i < data.length; i += 4) {
    const v = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) * 0.9 + 12;
    data[i] = data[i + 1] = data[i + 2] = v;
  }
}

/** The rolling wave: seconds between waves, seconds one takes to cross a tile, and its depth. */
export const WAVE = { period: 3.2, travel: 1.4, height: 0.3 } as const;

/**
 * The top of the wave on a tile `size` tall at `time` seconds, or null between waves.
 * `seed` sets tiles apart, so their waves do not roll in step.
 */
export function waveAt(time: number, seed: number, size: number): number | null {
  const t = (time + seed * 0.83) % WAVE.period;
  if (t >= WAVE.travel) return null;
  const band = size * WAVE.height;
  return -band + (t / WAVE.travel) * (size + band);
}

/** True during the brief waver of brightness a tube shows now and then. */
export function flickerAt(time: number, seed: number): boolean {
  return (time + seed * 1.37) % 3.7 < 0.08;
}
