import { Bank, buildSoundBank } from './SoundBank';

export interface PlayOpts {
  volume?: number;
  rate?: number;
  /** -1 (left) .. 1 (right). */
  pan?: number;
  /** Lowpass cutoff in Hz to fake distance. */
  muffle?: number;
  delay?: number;
}

interface Voice {
  key: string;
  src: AudioBufferSourceNode;
  started: number;
}

export interface LoopHandle {
  setVolume(v: number, ramp?: number): void;
  stop(fade?: number): void;
}

/** Max simultaneous voices per sound family; extra requests steal the oldest. */
const FAMILY_LIMIT: [RegExp, number][] = [
  [/^shot_/, 10],
  [/^groan_|^death_/, 6],
  [/^hit_|^ricochet/, 8],
  [/^explosion|^orbital|^nuke/, 4],
  [/^bunker_hit|^shutter_hit|^claw/, 4],
];
const GLOBAL_LIMIT = 40;

/**
 * Web Audio mixer: master → compressor → out, with SFX and music buses.
 * Synthesized buffers are built lazily once the context exists. The context is
 * only resumed after a user gesture, as browsers require.
 */
export class AudioManager {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfx!: GainNode;
  private music!: GainNode;
  private comp!: DynamicsCompressorNode;
  private buffers = new Map<string, AudioBuffer>();
  /** Alternate decoded buffers for keys that rotate between recordings. */
  private variants = new Map<string, AudioBuffer[]>();
  /** Recorded files to swap in once the context exists. */
  private overrides = new Map<string, string | string[]>();
  private overridesLoading: Promise<void> | null = null;
  /** One fetch/decode per URL, shared by every key that uses the file. */
  private decodeCache = new Map<string, Promise<AudioBuffer | null>>();
  private voices: Voice[] = [];
  private loops = new Set<{ gain: GainNode; src: AudioBufferSourceNode; base: number }>();
  private loopsPaused = false;
  volumes = { master: 0.8, sfx: 0.9, music: 0.5 };
  ready = false;
  private bank: Bank | null = null;

  /** Synthesize every sound (no AudioContext needed). Call during boot. */
  prepare(): void {
    if (!this.bank) this.bank = buildSoundBank(44100);
  }

  /** Create context + synthesize the bank. Safe to call repeatedly. */
  init(): void {
    if (this.ctx) return;
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    this.ctx = new Ctor({ latencyHint: 'interactive' });
    const ctx = this.ctx;
    this.comp = ctx.createDynamicsCompressor();
    this.comp.threshold.value = -14;
    this.comp.knee.value = 10;
    this.comp.ratio.value = 5;
    this.comp.attack.value = 0.002;
    this.comp.release.value = 0.18;
    this.master = ctx.createGain();
    this.sfx = ctx.createGain();
    this.music = ctx.createGain();
    this.sfx.connect(this.comp);
    this.music.connect(this.comp);
    this.comp.connect(this.master);
    this.master.connect(ctx.destination);
    this.applyVolumes();
    this.prepare();
    for (const [k, { data, rate }] of this.bank!) {
      const b = ctx.createBuffer(1, data.length, rate);
      b.copyToChannel(data as Float32Array<ArrayBuffer>, 0);
      this.buffers.set(k, b);
    }
    this.ready = true;
    void this.decodeRegisteredOverrides();
  }

  /**
   * Build the context and decode recordings ahead of time. The context stays
   * suspended until unlock(), so this is safe before the first user gesture.
   */
  preload(): void {
    this.init();
  }

  /** Must be called from a user-gesture handler. */
  async unlock(): Promise<void> {
    this.init();
    if (this.ctx && this.ctx.state !== 'running') {
      try {
        await this.ctx.resume();
      } catch {
        /* the browser may require another gesture */
      }
    }
  }

  get unlocked(): boolean {
    return !!this.ctx && this.ctx.state === 'running';
  }

  /**
   * Queue a recorded file (or a pool of files) to replace a synthesized key.
   * Call before the AudioContext is unlocked; decoding starts in init().
   * A pool makes each play() pick one of the recordings at random.
   */
  registerOverride(key: string, url: string | string[]): void {
    this.overrides.set(key, url);
  }

  /** Replace a synthesized sound with a decoded licensed recording. */
  async loadOverride(key: string, url: string): Promise<void> {
    if (!this.ctx) return;
    const buf = await this.decodeFromUrl(url);
    if (buf) this.buffers.set(key, buf);
  }

  has(key: string): boolean {
    return this.buffers.has(key) || this.variants.has(key);
  }

  private decodeFromUrl(url: string): Promise<AudioBuffer | null> {
    const cached = this.decodeCache.get(url);
    if (cached) return cached;
    const ctx = this.ctx;
    if (!ctx) return Promise.resolve(null);
    const pending = (async () => {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await ctx.decodeAudioData(await res.arrayBuffer());
      } catch (err) {
        console.warn(`[audio] Could not decode ${url}`, err);
        return null;
      }
    })();
    this.decodeCache.set(url, pending);
    return pending;
  }

  private decodeRegisteredOverrides(): Promise<void> {
    if (!this.ctx || this.overridesLoading) return this.overridesLoading ?? Promise.resolve();
    this.overridesLoading = Promise.all(
      [...this.overrides].map(async ([key, urls]) => {
        const list = Array.isArray(urls) ? urls : [urls];
        const decoded = await Promise.all(list.map((url) => this.decodeFromUrl(url)));
        const usable = decoded.filter((b): b is AudioBuffer => b !== null);
        if (!usable.length) return;
        if (usable.length === 1) this.buffers.set(key, usable[0]);
        else this.variants.set(key, usable);
      }),
    )
      .then(() => {
        this.overridesLoading = null;
      })
      .catch(() => {
        this.overridesLoading = null;
      });
    return this.overridesLoading;
  }

  setVolumes(v: Partial<AudioManager['volumes']>): void {
    Object.assign(this.volumes, v);
    this.applyVolumes();
  }

  private applyVolumes(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.volumes.master, t, 0.02);
    this.sfx.gain.setTargetAtTime(this.volumes.sfx, t, 0.02);
    this.music.gain.setTargetAtTime(this.volumes.music, t, 0.02);
  }

  play(key: string, opts: PlayOpts = {}): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    const pool = this.variants.get(key);
    const buf = pool ? pool[Math.floor(Math.random() * pool.length)] : this.buffers.get(key);
    if (!buf) return;
    this.enforceLimits(key);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = opts.rate ?? 1;
    let node: AudioNode = src;
    if (opts.muffle && opts.muffle < 18000) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = opts.muffle;
      node.connect(f);
      node = f;
    }
    const g = ctx.createGain();
    g.gain.value = opts.volume ?? 1;
    node.connect(g);
    node = g;
    if (opts.pan) {
      const p = ctx.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, opts.pan));
      node.connect(p);
      node = p;
    }
    node.connect(this.sfx);
    const when = ctx.currentTime + (opts.delay ?? 0);
    src.start(when);
    const v: Voice = { key, src, started: when };
    this.voices.push(v);
    src.onended = () => {
      const i = this.voices.indexOf(v);
      if (i >= 0) this.voices.splice(i, 1);
      src.disconnect();
    };
  }

  private enforceLimits(key: string): void {
    for (const [re, limit] of FAMILY_LIMIT) {
      if (!re.test(key)) continue;
      const fam = this.voices.filter((v) => re.test(v.key));
      if (fam.length >= limit) this.stopVoice(fam[0]);
      break;
    }
    if (this.voices.length >= GLOBAL_LIMIT) this.stopVoice(this.voices[0]);
  }

  private stopVoice(v: Voice): void {
    try {
      v.src.stop();
    } catch {
      /* already stopped */
    }
    const i = this.voices.indexOf(v);
    if (i >= 0) this.voices.splice(i, 1);
  }

  loop(key: string, volume: number, bus: 'sfx' | 'music' = 'sfx', fadeIn = 0.5): LoopHandle {
    const ctx = this.ctx;
    const buf = this.buffers.get(key);
    if (!ctx || !buf) return { setVolume() {}, stop() {} };
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const g = ctx.createGain();
    g.gain.value = 0;
    g.gain.setTargetAtTime(this.loopsPaused && bus === 'sfx' ? 0 : volume, ctx.currentTime, fadeIn / 3);
    src.connect(g);
    g.connect(bus === 'sfx' ? this.sfx : this.music);
    src.start();
    const entry = { gain: g, src, base: volume };
    if (bus === 'sfx') this.loops.add(entry);
    return {
      setVolume: (v: number, ramp = 0.2) => {
        entry.base = v;
        if (!this.loopsPaused || bus === 'music') g.gain.setTargetAtTime(v, ctx.currentTime, ramp / 3);
      },
      stop: (fade = 0.4) => {
        g.gain.setTargetAtTime(0, ctx.currentTime, fade / 3);
        try {
          src.stop(ctx.currentTime + fade + 0.05);
        } catch {
          /* ignore */
        }
        this.loops.delete(entry);
      },
    };
  }

  /** Duck gameplay loops (rotor, wind) while a menu pauses combat. */
  setLoopsPaused(paused: boolean): void {
    if (!this.ctx) return;
    this.loopsPaused = paused;
    for (const l of this.loops) l.gain.gain.setTargetAtTime(paused ? 0 : l.base, this.ctx.currentTime, 0.08);
  }
}

export const audio = new AudioManager();
