/**
 * Recorded sound effects and music. Sources (all free for commercial use):
 *
 * - RPG Sound Pack by artisticdude (opengameart.org/content/rpg-sound-pack),
 *   CC0, converted wav -> mp3 — most of what the pack does best: weapon
 *   swings (`throw`/`dash`/`swipe`), `snap`, interface blips (`click`,
 *   `discovery`, `charge-full`, `note`), coins (`pickup`, `room-clear`),
 *   wood/metal/cloth impacts, the creaky world door (`door-open`), `poof`,
 *   `crackle`, the shatter cascade (`chainmail2` as `glassBreak`), bubbles
 *   (`plop`), `tin`, creature stings (`scream`, `rage`, `shout`, `yawn`,
 *   `oof`, `hup`) and the NPC creature voices (`bite*`, `slime*`, `shade*`,
 *   `giant*`, `ogre*`, `mnstr*`, `wolfman`) that intruder reactions, boss
 *   roars and mom all borrow (see AudioManager's CRY_BY_TYPE).
 * - Kenney.nl / Mixkit free recordings the game started with, still in for
 *   `bell` and `plastic`.
 * - The "New Added" replacement set (provided in the source assets) —
 *   `alarm`, `boing`, the `boom` explosion, `splash`, `stamp`, `zap`, the
 *   glass and paper impacts and the boss's `boss-walk` march.
 * - The 400 Sounds Pack (provided in the source assets) — `knock-knock`'s
 *   door raps (`enemy knock knock.mp3`), `whistle` (the rising first phrase
 *   of `Human/whistle.wav`) and the `impact-paper-page` toggle click behind
 *   `paper` (menu page flips, `UI/toggle_on.wav`).
 * - jute-dh RPG sounds (provided in the source assets) — the fire loops
 *   behind `ignite`/`fuse`, and `fall` for `fail`.
 * - "hits and punches" (provided in the source assets) — `hurt` and the
 *   `impact-punch` flesh layer.
 * - Mixkit (mixkit.co) royalty-free for the pet voices; the pack has no cats,
 *   dogs, parrots or hamsters, so the pets keep their own recordings (their
 *   pitch contours live in PetVoices.ts).
 * - Late-night music loop ("One Night In France" by HoliznaCC0, via Free Music
 *   Archive), CC0, with loop fades applied — no pack ships music.
 *
 * Files live in `public/sfx/` next to the page and are fetched + decoded after
 * the first user gesture creates the AudioContext. Anything missing — sounds
 * with no good recording (`hiss`, `kettle`, `slide`, `squeak`), or the
 * single-file portal builds (`__SAMPLES__` false, no `sfx/` folder ships) —
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
  | 'wood-small' | 'metal-small' | 'metal-ringing' | 'cloth'
  | 'impact-glass' | 'impact-glass-big' | 'impact-paper' | 'impact-paper-page' | 'impact-punch'
  | 'door-open' | 'knock-knock' | 'boss-walk' | 'boom' | 'fuse' | 'zap' | 'plop'
  | 'click' | 'stamp' | 'swipe' | 'discovery' | 'snap' | 'note' | 'tin'
  | 'dog' | 'cat' | 'parrot' | 'hamster'
  | 'boing' | 'plastic' | 'throw' | 'dash' | 'pickup' | 'splash' | 'whistle'
  | 'bell' | 'alarm' | 'poof' | 'charge-full'
  | 'hurt' | 'room-clear' | 'fail' | 'yawn' | 'ignite'
  | 'crackle' | 'scream' | 'rage' | 'shout'
  | 'oof' | 'hup'
  | 'bite1' | 'bite2' | 'bite3'
  | 'slime2' | 'slime6' | 'slime8' | 'slime9'
  | 'shade2' | 'shade6' | 'shade12'
  | 'giant1' | 'giant2' | 'giant4'
  | 'ogre1' | 'ogre2' | 'ogre5'
  | 'mnstr1' | 'mnstr7' | 'mnstr14' | 'wolfman'
  | 'music-night' | 'boss-bg-music';

/** Every sample that is prefetched at boot. */
export const SAMPLE_FILES: readonly SampleName[] = [
  'wood-small', 'metal-small', 'metal-ringing', 'cloth',
  'impact-glass', 'impact-glass-big', 'impact-paper', 'impact-paper-page', 'impact-punch',
  'door-open', 'knock-knock', 'boss-walk', 'boom', 'fuse', 'zap', 'plop',
  'click', 'stamp', 'swipe', 'discovery', 'snap', 'note', 'tin',
  'dog', 'cat', 'parrot', 'hamster',
  'boing', 'plastic', 'throw', 'dash', 'pickup', 'splash', 'whistle',
  'bell', 'alarm', 'poof', 'charge-full',
  'hurt', 'room-clear', 'fail', 'yawn', 'ignite',
  'crackle', 'scream', 'rage', 'shout',
  'oof', 'hup',
  'bite1', 'bite2', 'bite3',
  'slime2', 'slime6', 'slime8', 'slime9',
  'shade2', 'shade6', 'shade12',
  'giant1', 'giant2', 'giant4',
  'ogre1', 'ogre2', 'ogre5',
  'mnstr1', 'mnstr7', 'mnstr14', 'wolfman',
  'music-night', 'boss-bg-music',
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
