import { portal } from '../ads/Portal';
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

/**
 * Keeps any one cue from repeating or ringing on. `gapMs` ignores a cue that fires again too soon,
 * `maxSec` cuts the clip short with a fade (some source clips are long and contain several bursts).
 */
interface CueRule {
  gapMs?: number;
  maxSec?: number;
  fade?: number;
}

const CUE_RULES: Partial<Record<SampleKey, CueRule>> = {
  click: { gapMs: 40, maxSec: 0.5, fade: 0.1 },
  coin: { gapMs: 70, maxSec: 0.5, fade: 0.1 },
  denied: { gapMs: 350, maxSec: 0.7, fade: 0.2 },
  // The source clip is 3 s with two separate huffs: only the first one is kept.
  exhausted: { maxSec: 1.2, fade: 0.3 },
  layerEnter: { gapMs: 600, maxSec: 1.4, fade: 0.2 },
  collect: { gapMs: 110, maxSec: 0.4, fade: 0.08 },
  rockFound: { gapMs: 110, maxSec: 0.45, fade: 0.08 },
  sell: { gapMs: 150, maxSec: 0.4, fade: 0.08 },
  toolHit: { maxSec: 0.8, fade: 0.25 },
  // The source clip is 18 s and holds several bursts: keep the opening fanfare only.
  reveal: { maxSec: 3.2, fade: 0.8 },
  rockUnder15: { maxSec: 1.6, fade: 0.25 },
};

/** Most one-shot sounds that may sound at once; beyond it the oldest is cut. */
const MAX_VOICES = 10;
/** After an "exhausted" cue, the next one waits at least this long. */
const TIRED_REPEAT_MS = 10000;
/** A saw that was never stopped (a scene closed mid-cut) shuts itself off after this long. */
const SAW_WATCHDOG_MS = 6000;

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
  private lastTired = Number.NEGATIVE_INFINITY;
  private digVoice: AudioBufferSourceNode | null = null;
  private rockVoice: AudioBufferSourceNode | null = null;
  private revealVoice: AudioBufferSourceNode | null = null;
  private rockUnderVoice: AudioBufferSourceNode | null = null;
  private tiredVoice: AudioBufferSourceNode | null = null;
  private deniedVoice: AudioBufferSourceNode | null = null;
  private coinVoices: AudioBufferSourceNode[] = [];
  private musicSource: AudioBufferSourceNode | null = null;
  /** Every one-shot sample currently sounding, oldest first (see MAX_VOICES). */
  private readonly active = new Set<AudioBufferSourceNode>();
  private readonly lastPlayed = new Map<SampleKey, number>();
  /** True while an ad is on screen: silent, but never written to the player's saved setting. */
  private adHold = false;
  private readonly unlockHandler = () => this.unlock();
  private readonly resumeHandler = () => this.resumeIfStopped();

  constructor() {
    // Decode through an OfflineAudioContext: it is not blocked by autoplay
    // policy, so every sample is ready before the first user gesture.
    const decoder = this.ensureDecoder();
    if (decoder) void this.preload(decoder);
    window.addEventListener('pointerdown', this.unlockHandler);
    window.addEventListener('keydown', this.unlockHandler);
    // iOS "interrupts" the audio context (phone call, app switch) and only a real touch or click can wake it
    // again; a visibility change is not enough. These listeners stay for the whole session.
    for (const type of ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown'] as const) {
      window.addEventListener(type, this.resumeHandler, { passive: true });
    }
    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return;
      if (document.hidden) {
        // Nothing may be left ringing (or queued) while the tab is away.
        this.stopCues();
        this.ctx.suspend().catch(() => undefined);
      } else {
        this.ctx.resume().catch(() => undefined);
      }
    });
  }

  /** What the mute button shows: the player's choice or the portal's setting. */
  get muted(): boolean {
    return this.mutedFlag || portal.muteForced;
  }

  /** Nothing should sound: the player's toggle, the portal's mute setting, or an ad. */
  private get silenced(): boolean {
    return this.mutedFlag || portal.muteForced || this.adHold;
  }

  /** Sets the master gain from the player's toggle, the portal's mute setting or an ad. */
  applyMasterGain(): void {
    if (this.ctx && this.master) {
      this.master.gain.setTargetAtTime(this.silenced ? 0 : MASTER_VOLUME, this.ctx.currentTime, 0.02);
    }
  }

  /** Silences the game while an ad plays. Unlike setMuted it never touches the saved setting. */
  holdForAd(on: boolean): void {
    this.adHold = on;
    if (on) this.stopCues();
    this.applyMasterGain();
  }

  /** Cuts every one-shot sound that is still sounding (scene changes, hidden tab, ads). Music and the saw stay. */
  stopCues(): void {
    for (const voice of this.active) this.stopVoice(voice);
    this.active.clear();
    this.coinVoices = [];
  }

  setMuted(muted: boolean): void {
    this.mutedFlag = muted;
    try {
      localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
    } catch {
      /* storage unavailable: keep the in-memory setting */
    }
    this.applyMasterGain();
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
    this.master.gain.value = this.silenced ? 0 : MASTER_VOLUME;
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

  /** Wakes the context from a user gesture when it is not running (suspended, or iOS "interrupted"). */
  private resumeIfStopped(): void {
    const ctx = this.ctx;
    if (!ctx || document.hidden || ctx.state === 'running' || ctx.state === 'closed') return;
    ctx.resume().catch(() => undefined);
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
    if (!this.ctx || !this.master || this.silenced || this.ctx.state === 'closed') return null;
    // A hidden tab is suspended on purpose: cues fired meanwhile would queue up and burst out together on return.
    if (document.hidden) return null;
    // A cue fired on the very first gesture may arrive before resume() has
    // resolved; scheduling it now is fine, it starts as the context wakes.
    if (this.ctx.state !== 'running') this.ctx.resume().catch(() => undefined);
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
    const rule = CUE_RULES[key];
    const nowMs = performance.now();
    if (rule?.gapMs && nowMs - (this.lastPlayed.get(key) ?? -Infinity) < rule.gapMs) return null;
    this.lastPlayed.set(key, nowMs);
    const loop = options.loop ?? false;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = loop;
    src.playbackRate.setValueAtTime(options.rate ?? 1, ctx.currentTime);
    const gain = ctx.createGain();
    const level = options.gain ?? SAMPLE_GAIN[key];
    gain.gain.value = level;
    src.connect(gain).connect(this.master);
    const startAt = ctx.currentTime + (options.when ?? 0);
    src.start(startAt, options.offset ?? 0);
    if (rule?.maxSec && !loop) {
      // Fade out, then stop: a long source clip never rings on or repeats its second half.
      const fade = Math.min(rule.fade ?? 0.12, rule.maxSec);
      const end = startAt + rule.maxSec;
      gain.gain.setValueAtTime(level, end - fade);
      gain.gain.linearRampToValueAtTime(0.0001, end);
      src.stop(end + 0.02);
    }
    if (!loop) {
      // Too many at once turns into a wash: cut the oldest instead of stacking.
      if (this.active.size >= MAX_VOICES) {
        const oldest = this.active.values().next().value;
        if (oldest) {
          this.stopVoice(oldest);
          this.active.delete(oldest);
        }
      }
      this.active.add(src);
      src.onended = () => this.active.delete(src);
    }
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
    // Holding the button with an empty tank must not loop the sigh. Regeneration lets a swing through
    // every second or two, so "once per exhaustion" cannot be told from the swings alone: a plain gap it is.
    const now = performance.now();
    if (now - this.lastTired < TIRED_REPEAT_MS) return;
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

  /** A blast: a low thump and a burst of rubble. `power` scales the weight (0..1). */
  blast(power = 1): void {
    this.tone({ f: 110, f2: 38, dur: 0.38, vol: 0.5 * power });
    this.noise({ dur: 0.42, vol: 0.4 * power, filter: 'lowpass', f: 1100, f2: 140 });
    this.noise({ dur: 0.18, vol: 0.18 * power, filter: 'highpass', f: 2400, at: 0.02 });
  }

  /** Angry Shoveler: a short growl. */
  rage(): void {
    this.tone({ f: 130, f2: 70, type: 'sawtooth', dur: 0.45, vol: 0.2 });
    this.tone({ f: 95, f2: 60, type: 'square', dur: 0.4, vol: 0.12, at: 0.05 });
  }

  /** After Image: a thin, airy shimmer. */
  ghost(): void {
    this.tone({ f: 660, f2: 1320, type: 'sine', dur: 0.28, vol: 0.1 });
    this.tone({ f: 990, f2: 1980, type: 'sine', dur: 0.22, vol: 0.06, at: 0.06 });
  }

  /** Second Wind: a rising breath. */
  wind(): void {
    this.noise({ dur: 0.5, vol: 0.14, filter: 'bandpass', f: 500, f2: 1800, q: 0.7 });
    this.tone({ f: 392, f2: 784, type: 'triangle', dur: 0.4, vol: 0.12 });
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
    const stop = (): void => {
      if (stopped) return;
      stopped = true;
      window.clearTimeout(watchdog);
      const t = ctx.currentTime;
      out.gain.setTargetAtTime(0.0001, t, 0.08);
      try {
        src.stop(t + 0.45);
      } catch {
        /* already ended */
      }
    };
    // A cut takes about two seconds; if the scene closes mid-cut the loop would never end.
    const watchdog = window.setTimeout(stop, SAW_WATCHDOG_MS);
    return {
      grind: (on: boolean) => {
        if (stopped) return;
        const t = ctx.currentTime;
        out.gain.setTargetAtTime(on ? SAW_GRIND_GAIN : SAMPLE_GAIN.saw, t, 0.06);
        src.playbackRate.setTargetAtTime(on ? 0.92 : 1, t, 0.08);
      },
      stop,
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
    this.coinVoices = this.coinVoices.filter((entry) => this.active.has(entry));
    if (this.coinVoices.length >= 4) this.stopVoice(this.coinVoices.shift() ?? null);
    const voice = this.play('coin', { rate: 0.94 + Math.random() * 0.12 });
    if (voice) this.coinVoices.push(voice);
  }
}

export const sfx = new SoundFx();
