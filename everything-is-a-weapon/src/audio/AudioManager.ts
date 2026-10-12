import type { SoundKind } from '../objects/Materials';
import { Music } from './Music';
import { SAMPLE_FILES, SampleBank, samplesEnabled, type SampleName, type SampleOptions } from './Samples';
import { Synth, VOWEL, type Partial } from './Synth';

export type SoundName =
  | 'pickup' | 'drop' | 'throw' | 'whistle' | 'chargeFull' | 'dash' | 'swipe' | 'hurt'
  | 'poof' | 'glassBreak' | 'zap' | 'ignite' | 'hiss' | 'splash' | 'explosion'
  | 'discovery' | 'paper' | 'stamp' | 'roomClear' | 'fail' | 'door' | 'knock' | 'yawn'
  | 'slide' | 'squeak' | 'gong' | 'alarm' | 'plop' | 'scream'
  | 'chomp' | 'click' | 'fuse' | 'boombox' | 'snap' | 'kettle' | 'crackle' | 'boing';

export type VoiceKind = 'oof' | 'yelp' | 'panic' | 'defeat' | 'alert' | 'attack' | 'ow' | 'hup';

/** Which recorded sample (if any) replaces a named sound. Functional pitch-critical
 *  sounds (charge notes, combo/scale runs, contain no entry and stay synthesised. */
const SAMPLE_FOR: { [K in SoundName]?: { file: SampleName; gain?: number; rateFromPitch?: boolean } } = {
  pickup: { file: 'pickup' },
  drop: { file: 'drop' },
  throw: { file: 'throw' },
  whistle: { file: 'whistle' },
  dash: { file: 'dash' },
  swipe: { file: 'swipe' },
  poof: { file: 'poof' },
  glassBreak: { file: 'impact-glass-big' },
  zap: { file: 'zap' },
  splash: { file: 'splash' },
  explosion: { file: 'boom', gain: 0.9 },
  discovery: { file: 'bell', gain: 0.5 },
  paper: { file: 'impact-paper-page' },
  stamp: { file: 'stamp' },
  roomClear: { file: 'winclear', gain: 0.7 },
  fail: { file: 'fail', gain: 0.7 },
  door: { file: 'door-open' },
  knock: { file: 'impact-wood-light' },
  squeak: { file: 'duck' },
  gong: { file: 'metal-pot', rateFromPitch: true },
  alarm: { file: 'alarm' },
  plop: { file: 'plop' },
  scream: { file: 'death', gain: 0.7 },
  click: { file: 'click', gain: 0.5 },
  boing: { file: 'boing', rateFromPitch: true },
};

/** Recorded thud per material for `impact()`. Mass still picks the pitch, via rate. */
const IMPACT_SAMPLE: Record<SoundKind, SampleName> = {
  wood: 'impact-wood',
  metal: 'impact-metal',
  glass: 'impact-glass',
  plastic: 'plastic',
  rubber: 'boing',
  paper: 'impact-paper',
  soft: 'impact-soft',
};

type AudioContextCtor = typeof AudioContext;

const MIN_GAP_SECONDS = 0.045;
const MAX_VOICES = 34;

/** How each material rings when struck: [frequency ratio, decay seconds, level]. */
const WOOD: readonly Partial[] = [[1, 0.11, 1], [2.57, 0.07, 0.5], [4.3, 0.04, 0.25]];
const METAL: readonly Partial[] = [[1, 0.55, 1], [1.58, 0.42, 0.7], [2.76, 0.34, 0.5], [4.21, 0.22, 0.32], [5.4, 0.14, 0.2]];
const GLASS: readonly Partial[] = [[1, 0.16, 1], [1.47, 0.12, 0.6], [2.31, 0.09, 0.4], [3.4, 0.06, 0.22]];
const PLASTIC: readonly Partial[] = [[1, 0.055, 1], [1.9, 0.035, 0.45]];
const MARIMBA: readonly Partial[] = [[1, 0.38, 1], [3.93, 0.12, 0.3], [9.2, 0.05, 0.1]];
const BELL: readonly Partial[] = [[1, 0.5, 1], [2.01, 0.35, 0.5], [3.03, 0.2, 0.25]];

/** C major pentatonic from C5: combos and chains always land in key. */
const SCALE = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51, 1567.98, 1760];

/**
 * Sound for the whole game, synthesised at runtime — there is not a single audio file.
 * Objects ring according to their material and mass, intruders have little formant voices,
 * combos play notes of a scale, and a four-layer score follows how busy the room is.
 * Every call is a safe no-op until the browser allows audio, or if Web Audio is missing.
 */
export class AudioManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private sfx: Synth | null = null;
  private music: Music | null = null;

  private volume = 0.7;
  private muted = false;
  private ducked = false;
  private portalMuted = false;
  private musicEnabled = true;
  private readonly lastPlayed = new Map<string, number>();

  private charge: { source: AudioBufferSourceNode; gain: GainNode } | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private hum: GainNode | null = null;
  private rumble: GainNode | null = null;
  private sfxOut: GainNode | null = null;
  private bank: SampleBank | null = null;
  private sampleMusic: { source: AudioBufferSourceNode; trim: GainNode } | null = null;
  private musicLevel = 0;

  /**
   * Start downloading recorded sounds. Safe before any AudioContext exists;
   * call once at boot so they are (usually) decoded by the first gesture.
   * No-op in builds without sample files (CrazyGames single-file).
   */
  prefetchSamples(): void {
    if (!samplesEnabled() || this.bank) return;
    try {
      const base = new URL('sfx/', document.baseURI).href;
      this.bank = new SampleBank(base);
      this.bank.prefetch(SAMPLE_FILES);
    } catch {
      this.bank = null;
    }
  }

  /** How many recorded sounds are decoded and ready (dev visibility). */
  sampleCount(): number {
    return this.bank ? this.bank.count() : 0;
  }

  /** Must be called from a user gesture (click / key / touch) at least once. */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume().catch(() => {});
      return;
    }
    try {
      const w = window as unknown as { AudioContext?: AudioContextCtor; webkitAudioContext?: AudioContextCtor };
      const Ctor = w.AudioContext ?? w.webkitAudioContext;
      if (!Ctor) return;
      const ctx = new Ctor();

      const master = ctx.createGain();
      const limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = -16;
      limiter.ratio.value = 6;
      limiter.attack.value = 0.004;
      limiter.release.value = 0.18;
      master.connect(limiter);
      limiter.connect(ctx.destination);

      const noise = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 1.5), ctx.sampleRate);
      const samples = noise.getChannelData(0);
      for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;

      // A short synthetic impulse response: everything happens in the same small room.
      const tail = Math.floor(ctx.sampleRate * 0.5);
      const impulse = ctx.createBuffer(2, tail, ctx.sampleRate);
      for (let c = 0; c < 2; c++) {
        const data = impulse.getChannelData(c);
        for (let i = 0; i < tail; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / tail, 2.8);
      }
      const reverb = ctx.createConvolver();
      reverb.buffer = impulse;
      const wet = ctx.createGain();
      wet.gain.value = 0.2;
      reverb.connect(wet);
      wet.connect(master);

      const sfxBus = ctx.createGain();
      sfxBus.connect(master);
      sfxBus.connect(reverb);

      const musicBus = ctx.createGain();
      musicBus.gain.value = 0;
      const warmth = ctx.createBiquadFilter();
      warmth.type = 'lowpass';
      warmth.frequency.value = 2600;
      warmth.Q.value = 0.4;
      musicBus.connect(warmth);
      warmth.connect(master);
      const musicSend = ctx.createGain();
      musicSend.gain.value = 0.35;
      warmth.connect(musicSend);
      musicSend.connect(reverb);

      this.ctx = ctx;
      this.noiseBuffer = noise;
      this.master = master;
      this.musicBus = musicBus;
      this.sfx = new Synth(ctx, sfxBus, noise);
      this.sfxOut = sfxBus;
      if (samplesEnabled()) {
        // Recorded sounds + music loop; anything missing stays synthesised.
        if (!this.bank) this.prefetchSamples();
        const bank = this.bank;
        if (bank) {
          void bank.attach(ctx, SAMPLE_FILES).then(() => this.startSampleMusic());
        }
      } else {
        this.music = new Music(new Synth(ctx, musicBus, noise));
        this.music.start();
      }
      this.applyVolume();
    } catch (error) {
      console.warn('[audio] Web Audio unavailable; continuing silently.', error);
      this.ctx = null;
    }
  }

  setVolume(volume: number): void {
    this.volume = Math.min(1, Math.max(0, volume));
    this.applyVolume();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    this.applyVolume();
  }

  setMusicEnabled(enabled: boolean): void {
    this.musicEnabled = enabled;
    this.applyVolume();
  }

  /** Temporarily silences the game (ads, hidden tab) without touching the user's setting. */
  setDucked(ducked: boolean): void {
    this.ducked = ducked;
    this.applyVolume();
  }

  /** The host page's own mute switch. It wins over the in-game setting: unmuting in game cannot override it. */
  setPortalMuted(muted: boolean): void {
    this.portalMuted = muted;
    this.applyVolume();
  }

  /** 0..3 picks how many layers of the score play; -1 holds it silent (paused). */
  setMusicIntensity(level: number): void {
    this.musicLevel = level;
    if (this.sampleMusic && this.ctx) {
      const gain = level < 0 ? 0 : level === 0 ? 0.5 : Math.min(1, 0.65 + level * 0.12);
      this.sampleMusic.trim.gain.setTargetAtTime(gain, this.ctx.currentTime, 0.4);
    } else if (this.music) {
      this.music.intensity = level;
    }
  }

  /** Starts the recorded music loop once its buffer arrives (replaces the score). */
  private startSampleMusic(): void {
    const ctx = this.ctx;
    const bank = this.bank;
    const musicBus = this.musicBus;
    if (!ctx || !bank || !musicBus || this.sampleMusic || !bank.has('music-night')) return;
    try {
      const buffer = bank.get('music-night');
      if (!buffer) return;
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      const trim = ctx.createGain();
      trim.gain.value = 0;
      source.connect(trim);
      trim.connect(musicBus);
      source.start();
      this.sampleMusic = { source, trim };
      this.setMusicIntensity(this.musicLevel);
    } catch {
      this.sampleMusic = null;
    }
  }

  private applyVolume(): void {
    if (!this.master || !this.ctx || !this.musicBus) return;
    const silent = this.muted || this.ducked || this.portalMuted;
    this.master.gain.setTargetAtTime(silent ? 0 : this.volume * 0.9, this.ctx.currentTime, 0.02);
    this.musicBus.gain.setTargetAtTime(this.musicEnabled ? 0.62 : 0, this.ctx.currentTime, 0.1);
  }

  /** Returns false when a sound keyed `key` must stay silent right now. */
  private allow(key: string, gap = MIN_GAP_SECONDS): boolean {
    const ctx = this.ctx;
    const sfx = this.sfx;
    if (!ctx || !sfx || ctx.state !== 'running' || this.muted || this.ducked || this.portalMuted) return false;
    const last = this.lastPlayed.get(key) ?? -1;
    if (ctx.currentTime - last < gap || sfx.voices >= MAX_VOICES) return false;
    this.lastPlayed.set(key, ctx.currentTime);
    return true;
  }

  /** Returns the synth if a sound keyed `key` may start right now. */
  private begin(key: string, gap = MIN_GAP_SECONDS): Synth | null {
    return this.allow(key, gap) ? this.sfx : null;
  }

  /**
   * Plays a recorded sound. Returns false (caller falls back to the
   * synthesiser) when audio is off, rate-limited, or the file never arrived.
   */
  sample(name: SampleName, options: SampleOptions & { key?: string; gap?: number } = {}): boolean {
    const ctx = this.ctx;
    const bank = this.bank;
    const out = this.sfxOut;
    if (!ctx || !bank || !out || !bank.has(name)) return false;
    if (!this.allow(options.key ?? `sample:${name}`, options.gap)) return false;
    bank.play(ctx, out, name, options);
    return true;
  }

  /**
   * One rate-limit check for a burst of the same sample (knocks, chirps):
   * every repeat plays, spaced by `gap` seconds.
   */
  burstSamples(name: SampleName, count: number, gap: number, options: SampleOptions = {}): boolean {
    const ctx = this.ctx;
    const bank = this.bank;
    const out = this.sfxOut;
    if (!ctx || !bank || !out || !bank.has(name)) return false;
    if (!this.allow(`burst:${name}`)) return false;
    const at = options.delay ?? 0;
    for (let i = 0; i < count; i++) {
      bank.play(ctx, out, name, { ...options, delay: at + i * gap });
    }
    return true;
  }

  /** Flesh thump layered under a material hit when something smacks an intruder. */
  impactFlesh(damage: number): void {
    this.sample('impact-punch', {
      gain: Math.min(0.85, 0.25 + damage / 70),
      rate: 0.92 + Math.random() * 0.16,
      key: 'flesh',
      gap: 0.06,
    });
  }

  /** For sound sets that live in their own file (audio/CompanionSounds.ts). Same rate limiting as the rest. */
  synth(key: string, gap?: number): Synth | null {
    return this.begin(key, gap);
  }

  /**
   * Something hit something. Recorded thud when available (mass still picks the
   * pitch, via rate: a table thuds, a bottle tinks); otherwise the synth.
   */
  impact(kind: SoundKind, intensity: number, mass = 5): void {
    const i = Math.min(1, Math.max(0.05, intensity));
    if (
      this.sample(IMPACT_SAMPLE[kind], {
        gain: 0.25 + i * 0.55,
        rate: Math.min(1.3, Math.max(0.55, 1.75 - Math.log2(1 + mass) * 0.24)) * (0.94 + Math.random() * 0.12),
        key: `impact:${kind}`,
      })
    ) {
      return;
    }
    const s = this.begin(`impact:${kind}`);
    if (!s) return;
    const g = 0.1 + i * 0.42;
    const size = Math.min(1.7, Math.max(0.5, 1.75 - Math.log2(1 + mass) * 0.24));
    const vary = 0.94 + Math.random() * 0.12;
    const stretch = 0.6 + i * 0.7;
    switch (kind) {
      case 'wood':
        s.modal(205 * size * vary, WOOD, g, 0, stretch);
        s.noise({ filter: 'lowpass', from: 1700, to: 350, dur: 0.035 + i * 0.03, gain: g * 0.55 });
        if (i > 0.6) s.tone({ from: 95 * size, to: 48, dur: 0.14, gain: g * 0.5 });
        break;
      case 'metal':
        s.modal(360 * size * vary, METAL, g * 0.5, 0, stretch);
        s.noise({ filter: 'bandpass', from: 3200, to: 1400, dur: 0.03, gain: g * 0.45, q: 2 });
        break;
      case 'glass':
        s.modal(1850 * size * vary, GLASS, g * 0.42, 0, stretch);
        s.noise({ filter: 'highpass', from: 5000, dur: 0.012, gain: g * 0.3 });
        break;
      case 'plastic':
        s.modal(330 * size * vary, PLASTIC, g * 0.85, 0, stretch);
        s.noise({ filter: 'bandpass', from: 950 * size, dur: 0.035, gain: g * 0.6, q: 2.5 });
        break;
      case 'rubber': {
        // boing: the pitch springs up, sags and wobbles
        const f = 150 * size * vary;
        s.tone({ from: f, to: f * 1.9, dur: 0.07, gain: g * 0.9 });
        s.tone({ from: f * 1.9, to: f * 0.9, dur: 0.22 + i * 0.1, gain: g * 0.7, delay: 0.06, vibrato: { rate: 24, depth: f * 0.22 } });
        break;
      }
      case 'paper':
        s.noise({ filter: 'bandpass', from: 2600, dur: 0.028, gain: g * 0.5, q: 1.2 });
        s.noise({ filter: 'bandpass', from: 1900, dur: 0.035, gain: g * 0.35, q: 1.2, delay: 0.045 });
        break;
      case 'soft':
        // bonk
        s.tone({ from: 210 * size * vary, to: 75, dur: 0.11, gain: g });
        s.noise({ filter: 'lowpass', from: 600, to: 160, dur: 0.06, gain: g * 0.5 });
        break;
    }
  }

  /** Little formant voices. `pitch` is the speaker's base pitch in Hz. */
  voice(kind: VoiceKind, pitch: number): void {
    const s = this.begin(`voice:${kind}`, kind === 'oof' ? 0.09 : 0.14);
    if (!s) return;
    const b = pitch * (0.94 + Math.random() * 0.12);
    switch (kind) {
      case 'oof':
        s.voice({ pitch: [b * 1.2, b * 0.78], dur: 0.16, from: VOWEL.o, to: VOWEL.u, gain: 0.3 });
        break;
      case 'yelp':
        s.voice({ pitch: [b * 1.6, b * 2.3, b * 1.8], dur: 0.32, from: VOWEL.i, to: VOWEL.e, gain: 0.24, vibrato: { rate: 30, depth: b * 0.3 } });
        break;
      case 'panic':
        s.voice({ pitch: [b * 1.4, b * 2, b * 1.5, b * 2.1], dur: 0.44, from: VOWEL.a, to: VOWEL.e, gain: 0.22, vibrato: { rate: 9, depth: b * 0.12 } });
        break;
      case 'defeat':
        s.voice({ pitch: [b * 1.35, b * 0.95], dur: 0.15, from: VOWEL.u, to: VOWEL.a, gain: 0.3 });
        s.voice({ pitch: [b, b * 0.5], dur: 0.4, from: VOWEL.o, to: VOWEL.u, gain: 0.3, delay: 0.17, vibrato: { rate: 7, depth: b * 0.05 } });
        break;
      case 'alert':
        s.voice({ pitch: [b * 0.9, b * 1.55], dur: 0.2, from: VOWEL.ah, to: VOWEL.e, gain: 0.2 });
        break;
      case 'attack':
        s.voice({ pitch: [b * 1.3, b * 1.75, b * 1.15], dur: 0.2, from: VOWEL.i, to: VOWEL.a, gain: 0.24 });
        break;
      case 'ow':
        s.voice({ pitch: [b * 1.55, b], dur: 0.26, from: VOWEL.a, to: VOWEL.u, gain: 0.3 });
        break;
      case 'hup':
        s.voice({ pitch: [b, b * 1.45], dur: 0.12, from: VOWEL.e, to: VOWEL.a, gain: 0.22 });
        break;
    }
  }

  /** One marimba note per combo level, climbing the scale. */
  combo(level: number): void {
    const s = this.begin('combo');
    if (!s) return;
    const note = SCALE[Math.min(SCALE.length - 1, Math.max(0, level - 1))]!;
    s.modal(note, MARIMBA, 0.22);
    s.noise({ filter: 'bandpass', from: 2400, dur: 0.012, gain: 0.08, q: 2 });
  }

  /** A run up the scale, one note per link of the chain reaction. */
  chain(length: number): void {
    const s = this.begin('chain', 0.4);
    if (!s) return;
    for (let i = 0; i < Math.min(length + 1, 8); i++) s.modal(SCALE[i]!, MARIMBA, 0.2, i * 0.075);
    s.modal(SCALE[Math.min(length + 1, 8)]! * 2, BELL, 0.1, Math.min(length + 1, 8) * 0.075);
  }

  /**
   * Winding up a throw. No drone: just a breath of air drawing in under the notes that
   * `chargeStep` plays as the throw gets stronger.
   */
  chargeStart(seconds: number): void {
    const ctx = this.ctx;
    const s = this.begin('charge', 0.02);
    this.chargeStop();
    if (!ctx || !s || !this.noiseBuffer) return;
    const t = ctx.currentTime;
    const source = ctx.createBufferSource();
    source.buffer = this.noiseBuffer;
    source.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 1.4;
    filter.frequency.setValueAtTime(380, t);
    filter.frequency.exponentialRampToValueAtTime(1500, t + seconds);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(0.05, t + seconds);
    gain.gain.linearRampToValueAtTime(0.018, t + seconds + 0.4);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(s.out);
    source.start(t);
    this.charge = { source, gain };
  }

  /** One plucked note per quarter of charge, climbing the scale: you can hear how hard the throw will be. */
  chargeStep(index: number): void {
    const s = this.begin(`charge:${index}`, 0.02);
    if (!s) return;
    s.modal(SCALE[Math.min(index, 4)]! / 2, MARIMBA, 0.13 + index * 0.02, 0, 0.6);
  }

  chargeStop(): void {
    const charge = this.charge;
    const ctx = this.ctx;
    if (!charge || !ctx) return;
    this.charge = null;
    const t = ctx.currentTime;
    charge.gain.gain.cancelScheduledValues(t);
    charge.gain.gain.setTargetAtTime(0, t, 0.02);
    charge.source.stop(t + 0.12);
    charge.source.onended = () => charge.gain.disconnect();
  }

  /**
   * Room tone for live hazards: an electrical hum while anything is energised and a crackling
   * bed while anything burns. Called every frame with how much of each there is.
   */
  ambience(fire: number, electric: number, dt: number): void {
    const ctx = this.ctx;
    const s = this.sfx;
    if (!ctx || !s || ctx.state !== 'running') return;
    if (!this.hum) {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = 50;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 420;
      filter.Q.value = 1.2;
      const flutter = ctx.createOscillator();
      flutter.frequency.value = 23;
      const flutterDepth = ctx.createGain();
      flutterDepth.gain.value = 0.5;
      const tremolo = ctx.createGain();
      tremolo.gain.value = 0.6;
      flutter.connect(flutterDepth);
      flutterDepth.connect(tremolo.gain);
      this.hum = ctx.createGain();
      this.hum.gain.value = 0;
      osc.connect(filter);
      filter.connect(tremolo);
      tremolo.connect(this.hum);
      this.hum.connect(s.out);
      osc.start();
      flutter.start();

      const src = ctx.createBufferSource();
      src.buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const data = src.buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      src.loop = true;
      const low = ctx.createBiquadFilter();
      low.type = 'lowpass';
      low.frequency.value = 380;
      this.rumble = ctx.createGain();
      this.rumble.gain.value = 0;
      src.connect(low);
      low.connect(this.rumble);
      this.rumble.connect(s.out);
      src.start();
    }
    const silent = this.muted || this.ducked;
    const t = ctx.currentTime;
    this.hum.gain.setTargetAtTime(silent ? 0 : Math.min(1, electric) * 0.05, t, 0.08);
    this.rumble!.gain.setTargetAtTime(silent ? 0 : Math.min(1, fire / 3) * 0.09, t, 0.15);
    if (!silent && fire > 0 && Math.random() < Math.min(3, fire) * dt * 9 && s.voices < MAX_VOICES) {
      s.noise({ filter: 'bandpass', from: 1400 + Math.random() * 2600, dur: 0.012, gain: 0.05 + Math.random() * 0.07, q: 3 });
    }
  }

  play(name: SoundName, intensity = 1, pitch = 1): void {
    const g = Math.min(1, Math.max(0.05, intensity));
    const mapped = SAMPLE_FOR[name];
    if (mapped) {
      // A knock is three raps; everything else is one shot (pitch bends gongs/boings).
      if (name === 'knock') {
        if (this.burstSamples(mapped.file, 3, 0.16, { gain: 0.5 * g })) return;
      } else if (
        this.sample(mapped.file, {
          gain: (mapped.gain ?? 0.6) * g,
          rate: mapped.rateFromPitch ? Math.min(1.6, Math.max(0.5, pitch)) : undefined,
          key: name,
        })
      ) {
        return;
      } else if (this.bank && this.bank.has(mapped.file)) {
        return;
      }
    }
    const s = this.begin(name);
    if (!s) return;
    switch (name) {
      case 'pickup':
        // a mouth "pop"
        s.tone({ from: 260 * pitch, to: 900 * pitch, dur: 0.05, gain: 0.26 * g });
        s.noise({ filter: 'bandpass', from: 1800, dur: 0.015, gain: 0.08 * g, q: 2 });
        break;
      case 'drop':
        s.tone({ from: 640, to: 210, dur: 0.07, gain: 0.18 * g });
        break;
      case 'throw':
        s.noise({ filter: 'bandpass', from: 420 * pitch, to: (1500 + 1700 * g) * pitch, dur: 0.1 + g * 0.06, gain: 0.3 * g, q: 0.9 });
        s.noise({ filter: 'bandpass', from: (1500 + 1700 * g) * pitch, to: 500 * pitch, dur: 0.14, gain: 0.22 * g, q: 0.9, delay: 0.09 + g * 0.05 });
        break;
      case 'whistle':
        // slide whistle for ridiculous projectiles
        s.tone({ from: 520, to: 1250 + 500 * g, dur: 0.26, gain: 0.1, vibrato: { rate: 13, depth: 18 } });
        break;
      case 'chargeFull':
        // the top of the scale, with a little shimmer: ready
        s.modal(SCALE[5]! / 2, MARIMBA, 0.2);
        s.modal(SCALE[5]!, BELL, 0.07, 0.05);
        break;
      case 'dash':
        s.noise({ filter: 'bandpass', from: 2400, to: 500, dur: 0.13, gain: 0.3 * g, q: 0.8 });
        s.tone({ from: 620, to: 260, dur: 0.09, gain: 0.08 * g });
        break;
      case 'swipe':
        s.noise({ filter: 'bandpass', from: 700, to: 2600, dur: 0.11, gain: 0.26 * g, q: 1.4 });
        break;
      case 'hurt':
        s.tone({ from: 150, to: 55, dur: 0.16, gain: 0.4 * g });
        s.noise({ filter: 'lowpass', from: 900, to: 180, dur: 0.1, gain: 0.3 * g });
        break;
      case 'poof':
        s.noise({ filter: 'lowpass', from: 1500, to: 220, dur: 0.22, gain: 0.28 * g });
        s.tone({ from: 760, to: 190, dur: 0.07, gain: 0.2 * g });
        break;
      case 'glassBreak': {
        // a crack, then the shards settle one by one
        s.noise({ filter: 'highpass', from: 3200, to: 6500, dur: 0.07, gain: 0.5 * g });
        s.tone({ from: 240, to: 80, dur: 0.06, gain: 0.25 * g });
        for (let i = 0; i < 11; i++) {
          const when = Math.pow(Math.random(), 1.8) * 0.42;
          const f = 2100 + Math.random() * 4600;
          s.modal(f, [[1, 0.05 + Math.random() * 0.13, 1], [1.51, 0.04, 0.4]], 0.11 * g * (1 - when), when);
        }
        break;
      }
      case 'zap': {
        // mains buzz chopped by a fast gate, plus arcing clicks
        s.tone({ type: 'sawtooth', from: 104, to: 96, dur: 0.3, gain: 0.16 * g, vibrato: { rate: 50, depth: 30 } });
        s.tone({ type: 'square', from: 1700, to: 420, dur: 0.09, gain: 0.07 * g });
        s.noise({ filter: 'bandpass', from: 3600, to: 1300, dur: 0.24, gain: 0.3 * g, q: 5 });
        for (let i = 0; i < 6; i++) {
          s.noise({ filter: 'highpass', from: 4500, dur: 0.008, gain: 0.26 * g, delay: Math.random() * 0.28 });
        }
        break;
      }
      case 'ignite':
        s.noise({ filter: 'lowpass', from: 220, to: 1700, dur: 0.5, gain: 0.42 * g, attack: 0.14 });
        s.tone({ from: 78, to: 44, dur: 0.3, gain: 0.3 * g, attack: 0.05 });
        break;
      case 'hiss':
        s.noise({ filter: 'highpass', from: 2400, to: 4200, dur: 0.5, gain: 0.26 * g, attack: 0.02 });
        s.noise({ filter: 'bandpass', from: 5200, dur: 0.3, gain: 0.1 * g, q: 6 });
        break;
      case 'splash':
        s.noise({ filter: 'bandpass', from: 1300, to: 380, dur: 0.24, gain: 0.42 * g, q: 0.7 });
        for (let i = 0; i < 4; i++) {
          const f = 260 + Math.random() * 420;
          s.tone({ from: f, to: f * 2.1, dur: 0.045, gain: 0.12 * g, delay: 0.06 + Math.random() * 0.22 });
        }
        break;
      case 'explosion':
        s.tone({ from: 125, to: 27, dur: 0.95, gain: 0.85 * g });
        s.noise({ filter: 'lowpass', from: 1500, to: 70, dur: 0.95, gain: 0.85 * g });
        s.noise({ filter: 'bandpass', from: 2600, to: 600, dur: 0.14, gain: 0.5 * g, q: 0.7 });
        // debris coming back down
        for (let i = 0; i < 9; i++) {
          const when = 0.22 + Math.random() * 0.8;
          if (i % 2 === 0) s.modal(170 + Math.random() * 190, WOOD, 0.1, when);
          else s.modal(420 + Math.random() * 700, METAL, 0.04, when, 0.5);
        }
        // the ringing in your ears
        s.tone({ from: 3150, to: 3100, dur: 1.5, gain: 0.022, attack: 0.25 });
        break;
      case 'discovery':
        // camera shutter, then a sparkle
        s.noise({ filter: 'bandpass', from: 3400, dur: 0.012, gain: 0.3, q: 2 });
        s.noise({ filter: 'bandpass', from: 1700, dur: 0.02, gain: 0.26, q: 2, delay: 0.07 });
        s.modal(SCALE[2]!, MARIMBA, 0.16, 0.14);
        s.modal(SCALE[4]!, MARIMBA, 0.16, 0.21);
        s.modal(SCALE[5]!, MARIMBA, 0.16, 0.28);
        s.modal(SCALE[7]!, BELL, 0.1, 0.36);
        break;
      case 'paper':
        // a scrap being picked up
        s.noise({ filter: 'bandpass', from: 3800 * pitch, to: 2600 * pitch, dur: 0.035, gain: 0.14 * g, q: 1.1 });
        s.noise({ filter: 'bandpass', from: 5200 * pitch, dur: 0.02, gain: 0.08 * g, q: 1.5, delay: 0.035 });
        break;
      case 'stamp':
        // rubber stamp: a thud on the desk and the slap of paper
        s.tone({ from: 120, to: 46, dur: 0.16, gain: 0.6 * g });
        s.noise({ filter: 'lowpass', from: 1300, to: 240, dur: 0.07, gain: 0.5 * g });
        s.noise({ filter: 'bandpass', from: 3000, dur: 0.03, gain: 0.12 * g, q: 1.2, delay: 0.05 });
        break;
      case 'roomClear':
        s.modal(SCALE[0]!, MARIMBA, 0.2, 0.12);
        s.modal(SCALE[2]!, MARIMBA, 0.2, 0.22);
        s.modal(SCALE[3]!, MARIMBA, 0.2, 0.32);
        s.modal(SCALE[5]!, MARIMBA, 0.24, 0.42);
        s.modal(SCALE[5]! * 2, BELL, 0.1, 0.42);
        break;
      case 'fail': {
        // sad trombone
        const notes = [233.1, 220, 207.7, 196];
        notes.forEach((f, i) => {
          const last = i === notes.length - 1;
          s.voice({
            pitch: last ? [f, f, f * 0.93] : [f * 1.03, f],
            dur: last ? 0.95 : 0.3,
            from: VOWEL.u,
            to: VOWEL.a,
            gain: 0.26,
            delay: i * 0.33,
            vibrato: last ? { rate: 5.5, depth: 5 } : undefined,
          });
        });
        break;
      }
      case 'door':
        s.modal(105, WOOD, 0.5, 0, 1.6);
        s.noise({ filter: 'lowpass', from: 900, to: 150, dur: 0.14, gain: 0.4 * g });
        s.noise({ filter: 'bandpass', from: 2400, dur: 0.02, gain: 0.14 * g, q: 2, delay: 0.02 });
        break;
      case 'knock':
        for (let i = 0; i < 3; i++) {
          s.modal(168 + i * 4, WOOD, 0.34 * g, i * 0.15, 1.1);
          s.noise({ filter: 'lowpass', from: 800, to: 260, dur: 0.03, gain: 0.16 * g, delay: i * 0.15 });
        }
        break;
      case 'slide':
        // falling slide whistle: someone's feet have gone
        s.tone({ from: 1500 * pitch, to: 380 * pitch, dur: 0.32, gain: 0.12, vibrato: { rate: 14, depth: 22 } });
        break;
      case 'squeak':
        s.tone({ from: 950, to: 1900, dur: 0.05, gain: 0.16 * g });
        s.tone({ from: 1900, to: 1250, dur: 0.09, gain: 0.13 * g, delay: 0.05 });
        break;
      case 'gong':
        // a frying pan connecting with something
        s.modal(300 * pitch, [[1, 0.9, 1], [2.32, 0.6, 0.55], [3.9, 0.35, 0.3], [5.6, 0.2, 0.18]], 0.3 * g);
        s.noise({ filter: 'bandpass', from: 2400, dur: 0.02, gain: 0.2 * g, q: 1.5 });
        break;
      case 'alarm':
        // twin-bell alarm clock: the hammer rattling between two bells
        for (let i = 0; i < 7; i++) {
          s.modal(i % 2 === 0 ? 2350 : 2790, [[1, 0.07, 1], [2.6, 0.04, 0.3]], 0.08, i * 0.045);
        }
        break;
      case 'plop':
        s.tone({ from: 420, to: 110, dur: 0.09, gain: 0.3 * g });
        s.noise({ filter: 'lowpass', from: 900, to: 200, dur: 0.05, gain: 0.2 * g });
        break;
      case 'chomp':
        // clockwork teeth: two quick wooden clacks
        s.modal(900, PLASTIC, 0.22 * g);
        s.modal(760, PLASTIC, 0.2 * g, 0.06);
        break;
      case 'click':
        // a spring being set
        s.modal(1500, PLASTIC, 0.12 * g);
        s.noise({ filter: 'bandpass', from: 3200, dur: 0.01, gain: 0.06 * g, q: 2 });
        break;
      case 'fuse':
        // a match being struck, then a quiet fizz
        s.noise({ filter: 'bandpass', from: 2600, to: 5200, dur: 0.09, gain: 0.16 * g, q: 1.2 });
        s.noise({ filter: 'highpass', from: 4200, dur: 0.5, gain: 0.05 * g, attack: 0.08, delay: 0.08 });
        break;
      case 'boombox': {
        // a tinny little groove; `pitch` is the step of the bar
        const step = Math.floor(pitch) % 8;
        const riff = [0, -1, 2, 0, 3, -1, 2, 4][step]!;
        if (riff >= 0) s.modal(SCALE[riff]! / 2, MARIMBA, 0.11);
        if (step % 2 === 0) s.tone({ from: 110, to: 52, dur: 0.09, gain: 0.16 });
        else s.noise({ filter: 'bandpass', from: 1900, dur: 0.035, gain: 0.07, q: 1.4 });
        break;
      }
      case 'snap':
        // a sprung bar coming down on wood
        s.modal(210, WOOD, 0.5 * g);
        s.modal(1250, [[1, 0.09, 1], [2.4, 0.05, 0.4]], 0.14 * g);
        s.noise({ filter: 'bandpass', from: 2800, dur: 0.018, gain: 0.2 * g, q: 1.5 });
        break;
      case 'kettle':
        // steam finding its way out: breathy, wavering, getting higher
        s.tone({ from: 1180 * pitch, to: 1420 * pitch, dur: 0.36, gain: 0.035, attack: 0.08, vibrato: { rate: 9, depth: 14 } });
        s.noise({ filter: 'bandpass', from: 2300, to: 3000, dur: 0.36, gain: 0.07, q: 5, attack: 0.06 });
        break;
      case 'crackle':
        // a firework: a scatter of small pops and falling glitter
        for (let i = 0; i < 14; i++) {
          const when = 0.05 + Math.random() * 0.75;
          s.noise({ filter: 'bandpass', from: 1800 + Math.random() * 3600, dur: 0.02, gain: 0.16 * (1 - when * 0.7), q: 2.5, delay: when });
        }
        for (let i = 0; i < 5; i++) s.modal(SCALE[4 + i]!, BELL, 0.035, 0.12 + i * 0.09);
        break;
      case 'boing':
        // rubber coming back off a wall
        s.tone({ from: 190 * pitch, to: 520 * pitch, dur: 0.13, gain: 0.2 * g, vibrato: { rate: 26, depth: 40 } });
        break;
      case 'yawn':
        s.voice({ pitch: [210, 320, 170], dur: 1, from: VOWEL.a, to: VOWEL.o, gain: 0.1 });
        break;
    }
  }
}
