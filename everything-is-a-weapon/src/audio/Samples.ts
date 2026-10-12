/**
 * Recorded sound effects and music. Sources (all free for commercial use):
 *
 * - Impacts, doors, UI, explosion, zap, plop, gong-pot: Kenney game audio
 *   (kenney.nl), Creative Commons CC0, converted ogg -> mp3.
 * - Cartoon hits, animals, whistle, trombone, win jingle, splash, alarm:
 *   Mixkit (mixkit.co), royalty-free, no attribution required, mp3 previews.
 * - Late-night music loop ("One Night In France" by HoliznaCC0, via Free Music
 *   Archive), Creative Commons CC0, with loop fades applied.
 *
 * Files live in `public/sfx/` next to the page and are fetched + decoded after
 * the first user gesture creates the AudioContext. Anything missing — or the
 * single-file CrazyGames build (`__SAMPLES__` false, no `sfx/` folder ships) —
 * falls back to the synthesiser, so every call site works either way.
 */

/** False in the single-file CrazyGames build, where no sample files ship. */
declare const __SAMPLES__: boolean;

export function samplesEnabled(): boolean {
  try {
    return __SAMPLES__;
  } catch {
    return true;
  }
}

export type SampleName =
  | 'impact-wood' | 'impact-wood-light' | 'impact-metal' | 'impact-glass' | 'impact-glass-big'
  | 'impact-paper' | 'impact-paper-page' | 'impact-punch' | 'impact-soft'
  | 'bell-gong' | 'door-open' | 'door-close' | 'boom' | 'zap' | 'plop'
  | 'click' | 'drop' | 'stamp' | 'swipe' | 'metal-pot'
  | 'dog' | 'cat' | 'parrot' | 'hamster'
  | 'boing' | 'plastic' | 'throw' | 'dash' | 'pickup' | 'splash' | 'duck' | 'whistle'
  | 'fail' | 'winclear' | 'bell' | 'alarm' | 'death' | 'poof'
  | 'music-night';

/** Every sample that is prefetched at boot. */
export const SAMPLE_FILES: readonly SampleName[] = [
  'impact-wood', 'impact-wood-light', 'impact-metal', 'impact-glass', 'impact-glass-big',
  'impact-paper', 'impact-paper-page', 'impact-punch', 'impact-soft',
  'bell-gong', 'door-open', 'door-close', 'boom', 'zap', 'plop',
  'click', 'drop', 'stamp', 'swipe', 'metal-pot',
  'dog', 'cat', 'parrot', 'hamster',
  'boing', 'plastic', 'throw', 'dash', 'pickup', 'splash', 'duck', 'whistle',
  'fail', 'winclear', 'bell', 'alarm', 'death', 'poof',
  'music-night',
];

export interface SampleOptions {
  /** Linear gain for this hit. */
  gain?: number;
  /** Playback rate (pitch). Small random detune keeps repeats from stacking. */
  rate?: number;
  /** Seconds to wait before starting. */
  delay?: number;
}

/**
 * Decoded sample buffers with a shared download cache. Downloads start before
 * any AudioContext exists; decoding happens on unlock. Purely a player: rate
 * limiting lives in AudioManager next to the synth's.
 */
export class SampleBank {
  private readonly buffers = new Map<SampleName, AudioBuffer>();
  private readonly bytes = new Map<SampleName, Promise<ArrayBuffer | null>>();

  constructor(private readonly base: string) {}

  /** Fire off downloads now; safe before any AudioContext exists. */
  prefetch(names: readonly SampleName[]): void {
    if (!samplesEnabled()) return;
    for (const name of names) {
      if (this.bytes.has(name)) continue;
      this.bytes.set(
        name,
        fetch(`${this.base}${name}.mp3`)
          .then((response) => (response.ok ? response.arrayBuffer() : null))
          .catch(() => null),
      );
    }
  }

  /** Decode whatever arrived. Resolves when done; missing files stay missing. */
  async attach(ctx: BaseAudioContext, names: readonly SampleName[]): Promise<void> {
    if (!samplesEnabled()) return;
    await Promise.all(
      names.map(async (name) => {
        if (this.buffers.has(name)) return;
        try {
          const pending = this.bytes.get(name) ?? fetch(`${this.base}${name}.mp3`)
            .then((response) => (response.ok ? response.arrayBuffer() : null))
            .catch(() => null);
          const raw = await pending;
          if (!raw || raw.byteLength === 0) return;
          const decoded = await ctx.decodeAudioData(raw.slice(0));
          this.buffers.set(name, decoded);
        } catch {
          // Stays on the synthesiser for this sound.
        }
      }),
    );
  }

  has(name: SampleName): boolean {
    return this.buffers.has(name);
  }

  /** Direct buffer access (for the looping music track). */
  get(name: SampleName): AudioBuffer | null {
    return this.buffers.get(name) ?? null;
  }

  count(): number {
    return this.buffers.size;
  }

  /** Fire-and-forget one shot. No-op when the buffer never arrived. */
  play(ctx: BaseAudioContext, out: AudioNode, name: SampleName, options: SampleOptions = {}): void {
    const buffer = this.buffers.get(name);
    if (!buffer) return;
    try {
      const t = ctx.currentTime + Math.max(0, options.delay ?? 0);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.playbackRate.value = options.rate ?? 1;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(Math.max(0.0001, options.gain ?? 0.6), t);
      source.connect(gain);
      gain.connect(out);
      source.start(t);
      source.onended = () => {
        source.disconnect();
        gain.disconnect();
      };
    } catch {
      // A sound must never take the game down with it.
    }
  }
}
