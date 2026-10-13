import type { AudioManager } from './AudioManager';

/** Seconds per step: eighth notes at 104 beats a minute. */
const STEP = 60 / 104 / 2;

/** One bar of maqsum, the street rhythm: dum tek . tek dum . tek, and a brush on the last step. */
const BAR: ReadonlyArray<readonly [name: string, gain: number, rate: number] | null> = [
  ['thud', 0.9, 0.7],
  ['tap', 0.7, 1.5],
  null,
  ['tap', 0.55, 1.5],
  ['thud', 0.8, 0.7],
  null,
  ['tap', 0.7, 1.6],
  ['grit', 0.22, 1.4],
];
/** One struck note at the top of each bar, walking up and down a scale. */
const TUNE = [1, 1.19, 1.33, 1.5, 1.33, 1.19, 1, 0.89];

/**
 * The game's music: a hand-drum pattern played from the same recordings as the effects, so
 * it needs no extra download. It is scheduled a fraction of a second ahead, every frame.
 */
export class Music {
  private next = 0;
  private step = 0;

  update(audio: AudioManager): void {
    const now = audio.now;
    if (now < 0 || audio.musicVolume <= 0) return;
    // After a pause (a hidden tab), pick the beat up from now instead of catching up.
    if (this.next < now) this.next = now + 0.05;
    while (this.next < now + 0.3) {
      const at = this.next - now;
      const hit = BAR[this.step % BAR.length];
      if (hit) audio.play(hit[0], { gain: hit[1], rate: hit[2], at, variant: 0, music: true });
      if (this.step % BAR.length === 0) audio.play('glass_tap', { gain: 0.3, rate: 0.5 * TUNE[(this.step / BAR.length) % TUNE.length], at, variant: 0, music: true });
      this.step++;
      this.next += STEP;
    }
  }
}
