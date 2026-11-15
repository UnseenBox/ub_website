/**
 * Game sound effects. Fourteen cues play MP3 samples from `./samples`; the
 * rest (clock stings, the workshop bench thud) are still synthesized with
 * Web Audio. Background music loops from `./samples/music.mp3`. Everything is
 * a silent no-op when audio is muted, unsupported, or still locked by the
 * browser's autoplay policy.
 */

const MASTER_VOLUME = 0.5;
const MUTE_KEY = 'dig-discover-muted';
/** Background music sits well under the sound effects. */
const MUSIC_GAIN = 0.32;
/** Seconds the music fades in over once it starts. */
const MUSIC_FADE_IN = 1.2;

/** Resolved by Vite at build time. Keys match the cue methods below. */
const SAMPLE_URLS = {
  dig: new URL('./samples/dig.mp3', import.meta.url).href,
  click: new URL('./samples/click.mp3', import.meta.url).href,
  coin: new URL('./samples/coin.mp3', import.meta.url).href,
  denied: new URL('./samples/denied.mp3', import.meta.url).href,
  exhausted: new URL('./samples/exhausted.mp3', import.meta.url).href,
  layerEnter: new URL('./samples/soil-level-up.mp3', import.meta.url).href,
  collect: new URL('./samples/money-collect.mp3', import.meta.url).href,
  rockFound: new URL('./samples/rock-found.mp3', import.meta.url).href,
  saw: new URL('./samples/saw.mp3', import.meta.url).href,
  sell: new URL('./samples/sell.mp3', import.meta.url).href,
  toolHit: new URL('./samples/tool-hit.mp3', import.meta.url).href,
  reveal: new URL('./samples/reveal.mp3', import.meta.url).href,
  rockUnder15: new URL('./samples/rock-under-15.mp3', import.meta.url).href,
  music: new URL('./samples/music.mp3', import.meta.url).href,
} as const;

type SampleKey = keyof typeof SAMPLE_URLS;

/** Samples are peak-normalised; this is the mix, not a volume correction. */
const SAMPLE_GAIN: Record<SampleKey, number> = {
  dig: 0.9,
  click: 0.45,
  coin: 0.35,
  denied: 0.4,
  exhausted: 0.65,
  layerEnter: 0.55,
  collect: 0.6,
  rockFound: 0.7,
  saw: 0.5,
  sell: 0.6,
  toolHit: 0.8,
  reveal: 0.6,
  rockUnder15: 0.6,
  // Unused through play(); the background loop mixes itself via MUSIC_GAIN.
  music: 1,
};

/** The blade under load: louder and a touch slower. */
const SAW_GRIND_GAIN = 0.9;

interface ToneOptions {
  f: number;
  f2?: number;
  type?: OscillatorType;
  dur: number;
  vol: number;
  at?: number;
  attack?: number;
}

interface NoiseOptions {
  dur: number;
  vol: number;
  filter: BiquadFilterType;
  f: number;
  f2?: number;
  q?: number;
  at?: number;
}

interface PlayOptions {
  rate?: number;
  gain?: number;
  when?: number;
  offset?: number;
  loop?: boolean;
}

export interface SawHandle {
  grind(on: boolean): void;
  stop(): void;
}

const SILENT_SAW: SawHandle = { grind: () => undefined, stop: () => undefined };

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

function readMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

class SoundFx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private buffers = new Map<SampleKey, AudioBuffer>();
  private mutedFlag = readMuted();
  private lastDig = 0;
  private lastTired = 0;
  private digVoice: AudioBufferSourceNode | null = null;
  private rockVoice: AudioBufferSourceNode | null = null;
  private revealVoice: AudioBufferSourceNode | null = null;
  private rockUnderVoice: AudioBufferSourceNode | null = null;
  private tiredVoice: AudioBufferSourceNode | null = null;
  private deniedVoice: AudioBufferSourceNode | null = null;
  private coinVoices: AudioBufferSourceNode[] = [];
  private musicSource: AudioBufferSourceNode | null = null;
  private readonly unlockHandler = () => this.unlock();

  constructor() {
    // Decode through an OfflineAudioContext: it is not blocked by autoplay
    // policy, so every sample is ready before the first user gesture.
    const decoder = this.ensureDecoder();
    if (decoder) void this.preload(decoder);
    window.addEventListener('pointerdown', this.unlockHandler);
    window.addEventListener('keydown', this.unlockHandler);
    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return;
      if (document.hidden) this.ctx.suspend().catch(() => undefined);
      else this.ctx.resume().catch(() => undefined);
    });
  }

  get muted(): boolean {
    return this.mutedFlag;
  }

  setMuted(muted: boolean): void {
    this.mutedFlag = muted;
    try {
      localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
    } catch {
      /* storage unavailable: keep the in-memory setting */
    }
    if (this.ctx && this.master) {
      this.master.gain.setTargetAtTime(muted ? 0 : MASTER_VOLUME, this.ctx.currentTime, 0.02);
    }
  }

  /** The offline decoder keeps the live context absent until a gesture. */
  private ensureDecoder(): BaseAudioContext | null {
    if (this.ctx) return this.ctx;
    const Offline =
      window.OfflineAudioContext ??
      (window as unknown as { webkitOfflineAudioContext?: typeof OfflineAudioContext }).webkitOfflineAudioContext;
    if (Offline) {
      try {
        return new Offline(1, 1, 44100);
      } catch {
        /* fall back to a live context */
      }
    }
    return this.ensureContext();
  }

  /** Must run inside a user gesture for browsers to allow audio. */
  private ensureContext(): AudioContext | null {
    if (this.ctx) return this.ctx;
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    try {
      this.ctx = new Ctor();
    } catch {
      return null;
    }
    this.master = this.ctx.createGain();
    this.master.gain.value = this.mutedFlag ? 0 : MASTER_VOLUME;
    this.master.connect(this.ctx.destination);
    const len = Math.floor(this.ctx.sampleRate * 1);
    this.noiseBuffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return this.ctx;
  }

  private async preload(decoder: BaseAudioContext): Promise<void> {
    await Promise.all(
      (Object.keys(SAMPLE_URLS) as SampleKey[]).map(async (key) => {
        try {
          const response = await fetch(SAMPLE_URLS[key]);
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const data = await response.arrayBuffer();
          this.buffers.set(key, await decoder.decodeAudioData(data));
        } catch (error) {
          console.warn(`[sfx] Could not load "${key}":`, error);
        }
      }),
    );
    // A first tap may have happened before the music buffer finished decoding;
    // this retries the loop once everything is ready.
    this.ensureMusic();
  }

  private unlock(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const onRunning = () => {
      if (ctx.state !== 'running') return;
      this.ensureMusic();
      window.removeEventListener('pointerdown', this.unlockHandler);
      window.removeEventListener('keydown', this.unlockHandler);
    };
    if (ctx.state === 'suspended') {
      ctx.resume().then(onRunning).catch(() => undefined);
      // Scheduling the loop now is fine; it starts as the context wakes.
      this.ensureMusic();
      return;
    }
    onRunning();
  }

  /**
   * Starts the looping background music. It plays across every scene, fades
   * in gently and honours the master mute (which silences the whole game,
   * music included). Safe to call repeatedly; no-ops until the buffer and the
   * live context are both ready.
   */
  private ensureMusic(): void {
    const ctx = this.ctx;
    if (!ctx || !this.master || this.musicSource) return;
    const buffer = this.buffers.get('music');
    if (!buffer) return; // preload() retries once the buffer arrives
    const t0 = ctx.currentTime;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(MUSIC_GAIN, t0 + MUSIC_FADE_IN);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    src.connect(gain).connect(this.master);
    src.start(t0);
    this.musicSource = src;
  }

  private ready(): AudioContext | null {
    if (!this.ctx || !this.master || this.mutedFlag || this.ctx.state === 'closed') return null;
    // A cue fired on the very first gesture may arrive before resume() has
    // resolved; scheduling it now is fine, it starts as the context wakes.
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => undefined);
    return this.ctx;
  }

  private envelope(ctx: AudioContext, t0: number, attack: number, dur: number, vol: number): GainNode {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    g.connect(this.master!);
    return g;
  }

  private tone(o: ToneOptions): void {
    const ctx = this.ready();
    if (!ctx) return;
    const t0 = ctx.currentTime + (o.at ?? 0);
    const osc = ctx.createOscillator();
    osc.type = o.type ?? 'sine';
    osc.frequency.setValueAtTime(o.f, t0);
    if (o.f2) osc.frequency.exponentialRampToValueAtTime(o.f2, t0 + o.dur);
    osc.connect(this.envelope(ctx, t0, o.attack ?? 0.008, o.dur, o.vol));
    osc.start(t0);
    osc.stop(t0 + o.dur + 0.02);
  }

  private noise(o: NoiseOptions): void {
    const ctx = this.ready();
    if (!ctx || !this.noiseBuffer) return;
    const t0 = ctx.currentTime + (o.at ?? 0);
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = o.filter;
    filter.frequency.setValueAtTime(o.f, t0);
    if (o.f2) filter.frequency.exponentialRampToValueAtTime(o.f2, t0 + o.dur);
    filter.Q.value = o.q ?? 0.8;
    src.connect(filter);
    filter.connect(this.envelope(ctx, t0, 0.005, o.dur, o.vol));
    src.start(t0, Math.random() * 0.5);
    src.stop(t0 + o.dur + 0.02);
  }

  private play(key: SampleKey, options: PlayOptions = {}): AudioBufferSourceNode | null {
    const ctx = this.ready();
    const buffer = this.buffers.get(key);
    if (!ctx || !buffer || !this.master) return null;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = options.loop ?? false;
    src.playbackRate.setValueAtTime(options.rate ?? 1, ctx.currentTime);
    const gain = ctx.createGain();
    gain.gain.value = options.gain ?? SAMPLE_GAIN[key];
    src.connect(gain).connect(this.master);
    src.start(ctx.currentTime + (options.when ?? 0), options.offset ?? 0);
    return src;
  }

  private stopVoice(voice: AudioBufferSourceNode | null): void {
    if (!voice) return;
    try {
      voice.stop();
    } catch {
      /* already ended */
    }
  }

  dig(hitRock: boolean, clang = 0): void {
    const now = performance.now();
    if (now - this.lastDig < 60) return;
    this.lastDig = now;
    const hard = clamp01(clang);
    // A swing that lands on an embedded rock strikes it directly: the rock
    // gets its own sample instead of the softer dirt sound.
    if (hitRock) {
      this.stopVoice(this.rockVoice);
      this.rockVoice = this.play('toolHit', {
        rate: 0.94 + Math.random() * 0.12 + hard * 0.06,
        gain: SAMPLE_GAIN.toolHit * (0.9 + 0.25 * hard),
      });
      return;
    }
    this.stopVoice(this.digVoice);
    this.digVoice = this.play('dig', {
      rate: 0.96 + Math.random() * 0.08 + hard * 0.05,
      gain: SAMPLE_GAIN.dig * (0.9 + 0.2 * hard),
    });
  }

  timesUp(): void {
    this.tone({ f: 523, f2: 392, type: 'triangle', dur: 0.25, vol: 0.3, at: 0 });
    this.tone({ f: 392, f2: 262, type: 'triangle', dur: 0.35, vol: 0.25, at: 0.25 });
  }

  newDay(): void {
    this.tone({ f: 523, type: 'triangle', dur: 0.15, vol: 0.22, at: 0 });
    this.tone({ f: 659, type: 'triangle', dur: 0.15, vol: 0.22, at: 0.1 });
    this.tone({ f: 784, type: 'triangle', dur: 0.2, vol: 0.22, at: 0.2 });
    this.tone({ f: 1047, type: 'triangle', dur: 0.3, vol: 0.25, at: 0.35 });
  }

  dayEnd(): void {
    this.tone({ f: 523, type: 'triangle', dur: 0.25, vol: 0.2, at: 0 });
    this.tone({ f: 659, type: 'triangle', dur: 0.25, vol: 0.2, at: 0.15 });
    this.tone({ f: 784, type: 'triangle', dur: 0.4, vol: 0.22, at: 0.3 });
  }

  layerEnter(): void {
    this.play('layerEnter');
  }

  tired(): void {
    const now = performance.now();
    if (now - this.lastTired < 2500) return;
    this.lastTired = now;
    this.stopVoice(this.tiredVoice);
    this.tiredVoice = this.play('exhausted');
  }

  discover(): void {
    this.play('rockFound');
  }

  collect(): void {
    this.play('collect');
  }

  /** The big "what was THAT?!" moment: a wobbly rising arpeggio that grows with the tier. */
  surprise(tier: number): void {
    this.tone({ f: 330, f2: 392, type: 'square', dur: 0.1, vol: 0.14, at: 0 });
    this.tone({ f: 523, f2: 466, type: 'square', dur: 0.1, vol: 0.14, at: 0.09 });
    this.tone({ f: 659, type: 'triangle', dur: 0.14, vol: 0.2, at: 0.18 });
    if (tier >= 2) this.tone({ f: 880, type: 'triangle', dur: 0.2, vol: 0.2, at: 0.3 });
    if (tier >= 3) this.tone({ f: 1175, type: 'triangle', dur: 0.3, vol: 0.22, at: 0.42 });
    if (tier >= 4) {
      this.tone({ f: 1568, type: 'sine', dur: 0.5, vol: 0.24, at: 0.55 });
      this.tone({ f: 784, f2: 1568, type: 'sine', dur: 0.6, vol: 0.18, at: 0.3 });
    }
  }

  /** A short buzz on phones. */
  haptic(pattern: number | number[]): void {
    try {
      navigator.vibrate?.(pattern);
    } catch {
      /* not supported */
    }
  }

  place(): void {
    this.tone({ f: 140, f2: 70, dur: 0.14, vol: 0.4 });
    this.noise({ dur: 0.09, vol: 0.2, filter: 'lowpass', f: 700 });
  }

  click(): void {
    this.play('click');
  }

  denied(): void {
    this.stopVoice(this.deniedVoice);
    this.deniedVoice = this.play('denied');
  }

  startSaw(): SawHandle {
    const ctx = this.ready();
    const buffer = this.buffers.get('saw');
    if (!ctx || !buffer || !this.master) return SILENT_SAW;
    const t0 = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    src.playbackRate.setValueAtTime(1, t0);
    const out = ctx.createGain();
    out.gain.setValueAtTime(0.0001, t0);
    out.gain.exponentialRampToValueAtTime(SAMPLE_GAIN.saw, t0 + 0.15);
    src.connect(out).connect(this.master);
    src.start(t0);
    let stopped = false;
    return {
      grind: (on: boolean) => {
        if (stopped) return;
        const t = ctx.currentTime;
        out.gain.setTargetAtTime(on ? SAW_GRIND_GAIN : SAMPLE_GAIN.saw, t, 0.06);
        src.playbackRate.setTargetAtTime(on ? 0.92 : 1, t, 0.08);
      },
      stop: () => {
        if (stopped) return;
        stopped = true;
        const t = ctx.currentTime;
        out.gain.setTargetAtTime(0.0001, t, 0.08);
        src.stop(t + 0.45);
      },
    };
  }

  reveal(_tier: number, value: number): void {
    // A weak take (Ordinary Stone, most honey calcite, cheap quartz) gets the
    // "under $15" sting instead of the reveal piece; the dud flag used to be
    // the test, value is finer. Tier still drives flash/rays/confetti.
    if (value < 15) {
      this.stopVoice(this.rockUnderVoice);
      this.rockUnderVoice = this.play('rockUnder15');
      return;
    }
    this.stopVoice(this.revealVoice);
    this.revealVoice = this.play('reveal', { gain: SAMPLE_GAIN.reveal });
  }

  sell(): void {
    this.play('sell');
  }

  coin(): void {
    // A sale can spawn a dozen coins a few frames apart; keep the tail from
    // stacking into a wash.
    if (this.coinVoices.length >= 4) this.stopVoice(this.coinVoices.shift() ?? null);
    const voice = this.play('coin', { rate: 0.94 + Math.random() * 0.12 });
    if (!voice) return;
    this.coinVoices.push(voice);
    voice.onended = () => {
      this.coinVoices = this.coinVoices.filter((entry) => entry !== voice);
    };
  }
}

export const sfx = new SoundFx();
